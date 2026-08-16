import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'

// Suivi du stock et demandes de matériel — espace du surveillant.
//
// Deux règles tiennent tout l'écran :
//
//   1. Le stock ne se saisit jamais. On enregistre un mouvement — une
//      réception, une livraison, une perte, une correction d'inventaire — et
//      la quantité suit, recalculée en base. Un chiffre qu'on peut corriger à
//      la main finit toujours par mentir sur ce qu'il y a dans l'armoire.
//
//   2. C'est la livraison qui sort la marchandise, pas la validation. Le
//      surveillant peut valider une demande le lundi et livrer le mercredi :
//      tant qu'il n'a rien remis, le stock n'a pas bougé.
//
// Le surveillant livre parfois moins que demandé, parce qu'il n'a pas tout.
// L'écran l'accepte et enregistre ce qui est réellement sorti : une demande
// close sur un chiffre faux vaut moins qu'une livraison partielle honnête.

// Deux codes pour la même cause : table jamais créée.
const tableAbsente = e =>
  Boolean(e) && (e.code === '42P01' || e.code === 'PGRST205' || /Could not find the table/i.test(e.message || ''))

const MSG_INSTALL = "Le suivi du stock n'est pas encore installé. Le script sql/stock_et_sanctions.sql doit être exécuté une fois dans Supabase."

const MOTIFS = {
  reception: 'Réception',
  livraison: 'Livraison',
  perte: 'Perte ou casse',
  inventaire: 'Correction d’inventaire',
}

const dateLisible = iso =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SuiviStock({ user }) {
  const [vue, setVue] = useState('demandes')      // 'demandes' | 'stock' | 'mouvements'
  const [materiels, setMateriels] = useState([])
  const [demandes, setDemandes] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)     // id de la ligne en cours de traitement

  // Formulaire d'ajout au catalogue
  const [nouveau, setNouveau] = useState({ nom: '', unite: 'unité', seuil_alerte: '0' })

  useEffect(() => { charger() }, [])

  async function charger() {
    setChargement(true); setErreur(null)
    const [mat, dem, mvt] = await Promise.all([
      supabase.from('materiels').select('*').eq('actif', true).order('nom'),
      supabase.from('demandes_materiel').select('*, users:demandeur_id(prenom, nom)').order('created_at', { ascending: false }),
      supabase.from('mouvements_stock').select('*, materiels(nom, unite), users:saisi_par(prenom)').order('created_at', { ascending: false }).limit(60),
    ])

    // Table absente : le script sql/stock_et_sanctions.sql n'a pas encore été
    // exécuté. PostgREST le dit de deux façons selon qu'il interroge la base
    // (42P01) ou son propre cache de schéma (PGRST205) — il faut donc guetter
    // les deux, sinon l'écran affiche un message technique au surveillant.
    if ([mat, dem, mvt].some(r => tableAbsente(r.error))) {
      setErreur(MSG_INSTALL)
      setChargement(false); return
    }
    const echec = [mat, dem, mvt].find(r => r.error)
    if (echec) { setErreur('Chargement impossible : ' + echec.error.message); setChargement(false); return }

    setMateriels(mat.data || [])
    setDemandes(dem.data || [])
    setMouvements(mvt.data || [])
    setChargement(false)
  }

  // ── Mouvements ─────────────────────────────────────────────────────────

  async function enregistrerMouvement(materielId, quantite, motif, commentaire, demandeId) {
    const { error } = await supabase.from('mouvements_stock').insert({
      materiel_id: materielId,
      quantite,
      motif,
      commentaire: commentaire || null,
      demande_id: demandeId || null,
      saisi_par: user.id,
    })
    return error
  }

  async function receptionner(m) {
    const q = prompt(`Combien de « ${m.nom} » entrent en stock ?`, '1')
    if (q === null) return
    const n = parseInt(q, 10)
    if (!Number.isFinite(n) || n <= 0) { alert('Indiquez un nombre supérieur à zéro.') ; return }
    setEnCours(m.id)
    const error = await enregistrerMouvement(m.id, n, 'reception', null, null)
    setEnCours(null)
    if (error) { alert("Réception non enregistrée : " + error.message); return }
    charger()
  }

  async function corriger(m) {
    const q = prompt(`Quantité réellement comptée pour « ${m.nom} » ?`, String(m.quantite))
    if (q === null) return
    const reel = parseInt(q, 10)
    if (!Number.isFinite(reel) || reel < 0) { alert('Indiquez un nombre positif ou zéro.'); return }
    const ecart = reel - m.quantite
    if (ecart === 0) { alert('Le compte est déjà juste, rien à corriger.'); return }
    const raison = prompt(`Écart de ${ecart > 0 ? '+' : ''}${ecart}. Pourquoi ?`, '')
    if (raison === null) return
    setEnCours(m.id)
    const error = await enregistrerMouvement(m.id, ecart, 'inventaire', raison, null)
    setEnCours(null)
    if (error) { alert('Correction non enregistrée : ' + error.message); return }
    charger()
  }

  // ── Demandes ───────────────────────────────────────────────────────────

  async function statuerDemande(d, statut, commentaire) {
    const { error } = await supabase.from('demandes_materiel').update({
      statut,
      traite_par: user.id,
      traite_le: new Date().toISOString(),
      commentaire_traitement: commentaire || null,
    }).eq('id', d.id)
    if (error) { alert("Décision non enregistrée : " + error.message); return false }

    const transmise = await pushNotification(d.demandeur_id, {
      titre: statut === 'refusee' ? 'Demande de matériel refusée' : 'Demande de matériel validée',
      message: `${d.quantite} × ${d.libelle}${commentaire ? ' — ' + commentaire : ''}`,
      type: 'stock',
      tabTarget: 'materiel',
    })
    if (!transmise) alert("Décision enregistrée, mais l'enseignant n'a pas pu être notifié. Prévenez-le de vive voix.")
    return true
  }

  async function valider(d) {
    const c = prompt('Commentaire pour l’enseignant (facultatif) :', '')
    if (c === null) return
    setEnCours(d.id)
    const ok = await statuerDemande(d, 'validee', c)
    setEnCours(null)
    if (ok) charger()
  }

  async function refuser(d) {
    const c = prompt('Motif du refus :', '')
    if (!c) return
    setEnCours(d.id)
    const ok = await statuerDemande(d, 'refusee', c)
    setEnCours(null)
    if (ok) charger()
  }

  // La livraison est le seul geste qui sort la marchandise du stock.
  async function livrer(d) {
    const q = prompt(`Combien de « ${d.libelle} » remettez-vous réellement ?`, String(d.quantite))
    if (q === null) return
    const livree = parseInt(q, 10)
    if (!Number.isFinite(livree) || livree < 0) { alert('Indiquez un nombre positif ou zéro.'); return }

    setEnCours(d.id)

    // Le mouvement d'abord : si le stock n'a pas bougé, la demande ne doit pas
    // être marquée livrée. L'inverse laisserait croire à une remise qui n'a
    // pas eu lieu.
    if (d.materiel_id && livree > 0) {
      const error = await enregistrerMouvement(d.materiel_id, -livree, 'livraison', `Demande de ${d.users?.prenom || ''}`.trim(), d.id)
      if (error) {
        setEnCours(null)
        alert("Le stock n'a pas pu être mis à jour, la demande reste ouverte : " + error.message)
        return
      }
    }

    const { error } = await supabase.from('demandes_materiel').update({
      statut: 'livree',
      quantite_livree: livree,
      traite_par: user.id,
      traite_le: new Date().toISOString(),
    }).eq('id', d.id)

    setEnCours(null)
    if (error) { alert('Livraison non enregistrée : ' + error.message); return }

    await pushNotification(d.demandeur_id, {
      titre: 'Matériel livré',
      message: `${livree} × ${d.libelle} — à retirer auprès du surveillant`,
      type: 'stock',
      tabTarget: 'materiel',
    })
    charger()
  }

  async function ajouterAuCatalogue(e) {
    e.preventDefault()
    if (!nouveau.nom.trim()) return
    const { error } = await supabase.from('materiels').insert({
      nom: nouveau.nom.trim(),
      unite: nouveau.unite.trim() || 'unité',
      seuil_alerte: parseInt(nouveau.seuil_alerte, 10) || 0,
    })
    if (error) {
      alert(error.code === '23505' ? 'Cet article est déjà au catalogue.' : 'Ajout impossible : ' + error.message)
      return
    }
    setNouveau({ nom: '', unite: 'unité', seuil_alerte: '0' })
    charger()
  }

  // ── Rendu ──────────────────────────────────────────────────────────────

  if (chargement) return <div className="empty-state"><p>Chargement du stock…</p></div>
  if (erreur) return <div className="empty-state"><div className="empty-icon">🛠️</div><p>{erreur}</p></div>

  const enAttente = demandes.filter(d => d.statut === 'en_attente')
  const aLivrer   = demandes.filter(d => d.statut === 'validee')
  const closes    = demandes.filter(d => d.statut === 'livree' || d.statut === 'refusee')
  const sousSeuil = materiels.filter(m => m.quantite <= m.seuil_alerte)

  const onglet = (id, libelle, compte) => (
    <button key={id} onClick={() => setVue(id)}
      style={{
        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
        border: '2px solid ' + (vue === id ? 'var(--accent)' : 'var(--border)'),
        background: vue === id ? 'var(--accent)' : 'var(--bg)',
        color: vue === id ? '#fff' : 'var(--muted)', whiteSpace: 'nowrap',
      }}>
      {libelle}{compte > 0 ? ` · ${compte}` : ''}
    </button>
  )

  const carte = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }
  const bandeau = { background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }
  const btn = (fond) => ({ padding: '5px 12px', borderRadius: 8, border: 'none', background: fond, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' })

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, width: 'max-content', whiteSpace: 'nowrap' }}>
          {onglet('demandes', '📥 Demandes', enAttente.length + aLivrer.length)}
          {onglet('stock', '📦 Stock', sousSeuil.length)}
          {onglet('mouvements', '🧾 Mouvements', 0)}
        </div>
      </div>

      {sousSeuil.length > 0 && (
        <div style={{ background: 'rgba(247,148,29,.08)', border: '1px solid rgba(247,148,29,.35)', borderRadius: 12, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
          <b>À réapprovisionner :</b> {sousSeuil.map(m => `${m.nom} (${m.quantite} ${m.unite})`).join(', ')}.
        </div>
      )}

      {/* ── Demandes ── */}
      {vue === 'demandes' && (
        <>
          {enAttente.length === 0 && aLivrer.length === 0 && (
            <div className="empty-state"><div className="empty-icon">📭</div><p>Aucune demande en cours.</p></div>
          )}

          {[['À valider', enAttente, true], ['À livrer', aLivrer, false]].map(([titre, liste, aStatuer]) =>
            liste.length === 0 ? null : (
              <div key={titre} style={carte}>
                <div style={bandeau}>{titre} · {liste.length}</div>
                {liste.map(d => (
                  <div key={d.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{d.quantite} × {d.libelle}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {d.users ? `${d.users.prenom} ${d.users.nom}` : 'Enseignant'}
                      {d.groupe ? ` · ${d.groupe}` : ''} · {dateLisible(d.created_at)}
                      {!d.materiel_id && ' · hors catalogue'}
                    </div>
                    {d.motif && <div style={{ fontSize: 12, marginTop: 4 }}>« {d.motif} »</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {aStatuer ? (
                        <>
                          <button disabled={enCours === d.id} style={btn('var(--green)')} onClick={() => valider(d)}>✓ Valider</button>
                          <button disabled={enCours === d.id} style={btn('var(--red)')} onClick={() => refuser(d)}>✖ Refuser</button>
                        </>
                      ) : (
                        <button disabled={enCours === d.id} style={btn('#0d2a3b')} onClick={() => livrer(d)}>📦 J’ai livré</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {closes.length > 0 && (
            <div style={carte}>
              <div style={bandeau}>Historique · {closes.length}</div>
              {closes.slice(0, 20).map(d => (
                <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.libelle}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {d.users ? `${d.users.prenom} ${d.users.nom}` : ''} · demandé {d.quantite}
                      {d.statut === 'livree' && d.quantite_livree !== d.quantite && ` · livré ${d.quantite_livree}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: d.statut === 'livree' ? 'var(--green)' : 'var(--red)' }}>
                    {d.statut === 'livree' ? 'livrée' : 'refusée'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Stock ── */}
      {vue === 'stock' && (
        <>
          <div style={carte}>
            <div style={bandeau}>Catalogue · {materiels.length} article{materiels.length > 1 ? 's' : ''}</div>
            {materiels.length === 0 && (
              <div style={{ padding: '14px', fontSize: 12, color: 'var(--muted)' }}>
                Le catalogue est vide. Ajoutez un premier article ci-dessous.
              </div>
            )}
            {materiels.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{m.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>seuil d’alerte : {m.seuil_alerte}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: m.quantite <= m.seuil_alerte ? 'var(--amber)' : 'var(--text)' }}>
                  {m.quantite} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{m.unite}</span>
                </div>
                <button disabled={enCours === m.id} style={btn('var(--green)')} onClick={() => receptionner(m)}>+ Réception</button>
                <button disabled={enCours === m.id} style={btn('#64748b')} onClick={() => corriger(m)}>Inventaire</button>
              </div>
            ))}
          </div>

          <form onSubmit={ajouterAuCatalogue} style={{ ...carte, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>
              Ajouter un article
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input required value={nouveau.nom} onChange={e => setNouveau({ ...nouveau, nom: e.target.value })}
                placeholder="Crayons de papier" style={{ flex: 2, minWidth: 150, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
              <input value={nouveau.unite} onChange={e => setNouveau({ ...nouveau, unite: e.target.value })}
                placeholder="unité" style={{ flex: 1, minWidth: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
              <input type="number" min="0" value={nouveau.seuil_alerte} onChange={e => setNouveau({ ...nouveau, seuil_alerte: e.target.value })}
                title="Seuil d’alerte" style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
              <button type="submit" style={btn('var(--accent)')}>Ajouter</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              La quantité de départ s’enregistre ensuite par une réception : le stock est toujours la somme des mouvements.
            </div>
          </form>
        </>
      )}

      {/* ── Mouvements ── */}
      {vue === 'mouvements' && (
        <div style={carte}>
          <div style={bandeau}>60 derniers mouvements</div>
          {mouvements.length === 0 && (
            <div style={{ padding: '14px', fontSize: 12, color: 'var(--muted)' }}>Aucun mouvement enregistré.</div>
          )}
          {mouvements.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
              <span style={{
                fontSize: 14, fontWeight: 900, width: 52, textAlign: 'right',
                color: m.quantite > 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {m.quantite > 0 ? '+' : ''}{m.quantite}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.materiels?.nom || '(article retiré)'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {MOTIFS[m.motif] || m.motif} · {dateLisible(m.created_at)}
                  {m.users?.prenom ? ` · ${m.users.prenom}` : ''}
                  {m.commentaire ? ` · ${m.commentaire}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

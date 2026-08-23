import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'
import { messageLisible } from '../lib/chargement'

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

// `magasin` : 'pedagogique' pour le surveillant, 'cuisine' pour la cuisinière.
// Deux armoires, deux responsables, deux inventaires — mais la même mécanique,
// et donc le même écran. Seules les demandes des enseignants sont propres au
// matériel pédagogique : personne ne réclame du riz par la plateforme.
export default function SuiviStock({ user, magasin = 'pedagogique' }) {
  const avecDemandes = magasin === 'pedagogique'
  const [vue, setVue] = useState(magasin === 'pedagogique' ? 'demandes' : 'stock')
  const [materiels, setMateriels] = useState([])
  const [retires, setRetires] = useState([])   // articles désactivés, réactivables
  const [demandes, setDemandes] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  // Signaler par bloc, pas par page : un registre de mouvements illisible ne
  // doit pas masquer un catalogue qui, lui, a répondu.
  const [demandesEnEchec, setDemandesEnEchec] = useState(null)
  const [mouvementsEnEchec, setMouvementsEnEchec] = useState(null)
  const [enCours, setEnCours] = useState(null)     // id de la ligne en cours de traitement

  // Formulaire d'ajout au catalogue
  const [nouveau, setNouveau] = useState({ nom: '', unite: 'unité', seuil_alerte: '0' })

  // Comptage physique en cours : identifiant d'article -> quantité comptée,
  // gardée en texte tant que le surveillant saisit. Une case vide veut dire
  // « pas encore compté », ce qui n'est pas la même chose que zéro.
  const [compte, setCompte] = useState({})
  const [inventaireEnCours, setInventaireEnCours] = useState(false)

  useEffect(() => { charger() }, [magasin])

  async function charger() {
    setChargement(true); setErreur(null)
    setDemandesEnEchec(null); setMouvementsEnEchec(null)
    const [mat, dem, mvt] = await Promise.all([
      // On charge aussi les articles retirés : ils ne s'affichent pas dans le
      // catalogue, mais il faut pouvoir en reprendre un qu'on a retiré par
      // mégarde — sans quoi on en recrée un presque identique, et le stock du
      // premier reste bloqué dans un article invisible.
      supabase.from('materiels').select('*').eq('magasin', magasin).order('nom'),
      avecDemandes
        ? supabase.from('demandes_materiel').select('*, users:demandeur_id(prenom, nom)').order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('mouvements_stock').select('*, materiels(nom, unite, magasin), users:saisi_par(prenom)').order('created_at', { ascending: false }).limit(200),
    ])

    // Table absente : le script sql/stock_et_sanctions.sql n'a pas encore été
    // exécuté. PostgREST le dit de deux façons selon qu'il interroge la base
    // (42P01) ou son propre cache de schéma (PGRST205) — il faut donc guetter
    // les deux, sinon l'écran affiche un message technique au surveillant.
    if ([mat, dem, mvt].some(r => tableAbsente(r.error))) {
      setErreur(MSG_INSTALL)
      setChargement(false); return
    }
    // Le catalogue est l'ossature de l'écran : sans lui il n'y a ni stock, ni
    // inventaire, ni libellé de mouvement. Son échec est le seul qui doive
    // faire tomber la page entière. Le message reste lisible — il ne recopie
    // pas l'erreur PostgREST, qui nommerait la table au surveillant.
    if (mat.error) {
      setErreur(messageLisible(mat.error))
      setChargement(false); return
    }

    const liste = r => (Array.isArray(r?.data) ? r.data : [])

    setMateriels(liste(mat).filter(m => m.actif !== false))
    setRetires(liste(mat).filter(m => m.actif === false))

    // Demandes et mouvements sont des blocs indépendants : l'un en panne ne
    // doit pas emporter le catalogue. Chacun garde son échec, et l'onglet
    // concerné le dit au lieu d'afficher « aucune donnée » — ce qui, sur un
    // registre de sorties de stock, se lirait comme une absence de mouvement.
    setDemandesEnEchec(dem.error ? messageLisible(dem.error) : null)
    setDemandes(dem.error ? [] : liste(dem))

    // Les mouvements des deux magasins vivent dans la même table : chacun ne
    // voit que le sien, sinon la cuisinière lirait les sorties de crayons.
    setMouvementsEnEchec(mvt.error ? messageLisible(mvt.error) : null)
    setMouvements(mvt.error ? [] : liste(mvt).filter(m => !m.materiels || m.materiels.magasin === magasin))
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

  // ── Inventaire ─────────────────────────────────────────────────────────
  //
  // Un inventaire n'écrase pas le stock : il enregistre l'écart constaté,
  // article par article, comme n'importe quel autre mouvement. On garde donc
  // la trace de ce qui manquait et de quand on s'en est aperçu, au lieu de
  // faire disparaître le problème en réécrivant le chiffre.
  //
  // Les lignes laissées vides sont ignorées : un inventaire interrompu ne doit
  // pas remettre à zéro les articles qu'on n'a pas eu le temps de compter.

  const lignesInventaire = () => materiels
    .map(m => ({ m, saisi: compte[m.id] }))
    .filter(({ saisi }) => saisi !== undefined && String(saisi).trim() !== '')
    .map(({ m, saisi }) => ({ m, reel: parseInt(saisi, 10) }))
    .filter(({ reel }) => Number.isFinite(reel) && reel >= 0)
    .map(({ m, reel }) => ({ m, reel, ecart: reel - m.quantite }))

  async function enregistrerInventaire() {
    const lignes = lignesInventaire()
    const ecarts = lignes.filter(l => l.ecart !== 0)

    if (lignes.length === 0) { alert('Aucun article compté.'); return }
    if (ecarts.length === 0) {
      alert(`${lignes.length} article(s) compté(s), aucun écart. Rien à enregistrer : le stock était juste.`)
      setCompte({})
      return
    }

    const resume = ecarts.map(l => `· ${l.m.nom} : ${l.m.quantite} → ${l.reel} (${l.ecart > 0 ? '+' : ''}${l.ecart})`).join('\n')
    if (!confirm(`${ecarts.length} écart(s) à enregistrer :\n\n${resume}\n\nConfirmer ?`)) return

    const raison = prompt("Commentaire pour cet inventaire (ce qui explique les écarts) :", '')
    if (raison === null) return

    // Une référence commune à toutes les lignes : c'est elle qui permettra de
    // relire un inventaire comme un tout dans l'historique des mouvements.
    const reference = `Inventaire du ${new Date().toLocaleDateString('fr-FR')}`

    setInventaireEnCours(true)
    const { error } = await supabase.from('mouvements_stock').insert(
      ecarts.map(l => ({
        materiel_id: l.m.id,
        quantite: l.ecart,
        motif: 'inventaire',
        commentaire: raison ? `${reference} — ${raison}` : reference,
        saisi_par: user.id,
      }))
    )
    setInventaireEnCours(false)

    if (error) { alert("Inventaire non enregistré : " + error.message); return }
    setCompte({})
    alert(`${ecarts.length} écart(s) enregistré(s). Le stock est à jour.`)
    charger()
  }

  async function modifierArticle(m) {
    const nom = prompt('Nom de l’article :', m.nom)
    if (nom === null) return
    const unite = prompt('Unité (kg, litre, boîte, paquet, sachet…) :', m.unite)
    if (unite === null) return
    const seuil = prompt('Seuil d’alerte — en dessous, l’article est signalé à réapprovisionner :', String(m.seuil_alerte))
    if (seuil === null) return

    const n = parseInt(seuil, 10)
    if (!nom.trim()) { alert('Le nom ne peut pas être vide.'); return }
    if (!Number.isFinite(n) || n < 0) { alert('Le seuil doit être un nombre positif ou zéro.'); return }

    setEnCours(m.id)
    const { error } = await supabase.from('materiels')
      .update({ nom: nom.trim(), unite: unite.trim() || 'unité', seuil_alerte: n })
      .eq('id', m.id)
    setEnCours(null)
    if (error) {
      alert(error.code === '23505' ? 'Un article porte déjà ce nom dans ce magasin.' : 'Modification impossible : ' + error.message)
      return
    }
    charger()
  }

  // Retirer un article : on le désactive, on ne l'efface pas. Ses mouvements
  // passés doivent rester lisibles, sinon l'historique du stock ment.
  async function retirerArticle(m) {
    if (m.quantite !== 0 && !confirm(
      `Il reste ${m.quantite} ${m.unite} de « ${m.nom} » en stock.\n\n` +
      `En le retirant, ce stock disparaît du catalogue sans être perdu : l'article ira dans « Articles retirés », d'où vous pourrez le reprendre.\n\nLe retirer quand même ?`
    )) return
    setEnCours(m.id)
    const { error } = await supabase.from('materiels').update({ actif: false }).eq('id', m.id)
    setEnCours(null)
    if (error) { alert('Retrait impossible : ' + error.message); return }
    charger()
  }

  async function reactiverArticle(m) {
    setEnCours(m.id)
    const { error } = await supabase.from('materiels').update({ actif: true }).eq('id', m.id)
    setEnCours(null)
    if (error) { alert('Réactivation impossible : ' + error.message); return }
    charger()
  }

  async function ajouterAuCatalogue(e) {
    e.preventDefault()
    if (!nouveau.nom.trim()) return
    const { error } = await supabase.from('materiels').insert({
      nom: nouveau.nom.trim(),
      unite: nouveau.unite.trim() || 'unité',
      seuil_alerte: parseInt(nouveau.seuil_alerte, 10) || 0,
      magasin,
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
  if (erreur) return (
    <div className="empty-state">
      <div className="empty-icon">🛠️</div>
      <p>{erreur}</p>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        Le catalogue n’a pas pu être lu. Aucune quantité n’est affichée : ce n’est pas un stock vide.
      </p>
      <button onClick={charger}
        style={{ marginTop: 10, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        Réessayer
      </button>
    </div>
  )

  // Bandeau d'échec d'un bloc : dit ce qui manque, et propose de recharger.
  const bandeauEchec = (texte, message) => (
    <div style={{ background: 'rgba(220,38,38,.07)', border: '1px solid var(--red)', borderLeft: '4px solid var(--red)', borderRadius: 12, padding: '11px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--red)' }}>{texte}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text)', marginTop: 4 }}>{message}</div>
      <button onClick={charger}
        style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
        Réessayer
      </button>
    </div>
  )

  const enAttente = demandes.filter(d => d.statut === 'en_attente')
  const aLivrer   = demandes.filter(d => d.statut === 'validee')
  const closes    = demandes.filter(d => d.statut === 'livree' || d.statut === 'refusee')
  // Un seuil à zéro signifie « aucune alerte réglée », pas « alerte dès que
  // c'est vide » : sinon tout article neuf, forcément à zéro, sonne l'alarme,
  // et la liste des choses à réapprovisionner devient un bruit qu'on n'écoute
  // plus. Les quatorze denrées créées d'un coup l'ont montré aussitôt.
  const sousSeuil = materiels.filter(m => m.seuil_alerte > 0 && m.quantite <= m.seuil_alerte)

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
          {avecDemandes && onglet('demandes', '📥 Demandes', enAttente.length + aLivrer.length)}
          {onglet('stock', '📦 Stock', sousSeuil.length)}
          {onglet('inventaire', '🔢 Inventaire', 0)}
          {onglet('mouvements', '🧾 Mouvements', 0)}
        </div>
      </div>

      {sousSeuil.length > 0 && (
        <div style={{ background: 'rgba(247,148,29,.08)', border: '1px solid rgba(247,148,29,.35)', borderRadius: 12, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
          <b>À réapprovisionner :</b> {sousSeuil.map(m => `${m.nom} (${m.quantite} ${m.unite})`).join(', ')}.
        </div>
      )}

      {/* ── Demandes ── */}
      {avecDemandes && vue === 'demandes' && (
        <>
          {/* « Aucune demande en cours » est une réponse ; un chargement raté
              n'en est pas une. Une demande en attente invisible, c'est une
              classe qui attend son matériel sans que personne ne le sache. */}
          {demandesEnEchec
            ? bandeauEchec('Demandes illisibles — on ne sait pas s’il y en a', demandesEnEchec)
            : enAttente.length === 0 && aLivrer.length === 0 && (
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
                <button disabled={enCours === m.id} style={btn('#64748b')} onClick={() => corriger(m)}>Corriger</button>
                <button disabled={enCours === m.id} style={btn('#0d2a3b')} onClick={() => modifierArticle(m)}>Modifier</button>
                <button disabled={enCours === m.id} style={btn('var(--red)')} onClick={() => retirerArticle(m)}>Retirer</button>
              </div>
            ))}
          </div>

          {retires.length > 0 && (
            <div style={carte}>
              <div style={bandeau}>Articles retirés · {retires.length}</div>
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted)' }}>
                Ils n'apparaissent plus au catalogue, mais leur stock et leur historique sont conservés.
              </div>
              {retires.map(m => (
                <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{m.nom}</div>
                    {m.quantite > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--amber)' }}>
                        {m.quantite} {m.unite} encore en stock — réactivez-le pour les récupérer
                      </div>
                    )}
                  </div>
                  <button disabled={enCours === m.id} style={btn('var(--green)')} onClick={() => reactiverArticle(m)}>Réactiver</button>
                </div>
              ))}
            </div>
          )}

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

      {/* ── Inventaire ── */}
      {vue === 'inventaire' && (() => {
        const lignes = lignesInventaire()
        const ecarts = lignes.filter(l => l.ecart !== 0)
        const restants = materiels.length - lignes.length
        return (
          <>
            <div style={{ background: 'rgba(26,175,224,.08)', border: '1px solid rgba(26,175,224,.4)', borderRadius: 12, padding: '10px 14px', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
              Comptez l’armoire article par article et notez ce que vous trouvez.
              Les cases laissées vides sont ignorées : vous pouvez compter en plusieurs fois.
              L’écart s’enregistre comme un mouvement, il ne remplace pas le stock —
              on garde ainsi la trace de ce qui manquait et du jour où on s’en est aperçu.
            </div>

            {materiels.length === 0 && (
              <div className="empty-state"><div className="empty-icon">📦</div><p>Le catalogue est vide : rien à compter.</p></div>
            )}

            {materiels.length > 0 && (
              <div style={carte}>
                <div style={{ ...bandeau, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Comptage</span>
                  <span style={{ opacity: .75 }}>{lignes.length}/{materiels.length} compté{lignes.length > 1 ? 's' : ''}</span>
                </div>
                {materiels.map(m => {
                  const saisi = compte[m.id]
                  const reel = parseInt(saisi, 10)
                  const compteFait = saisi !== undefined && String(saisi).trim() !== '' && Number.isFinite(reel) && reel >= 0
                  const ecart = compteFait ? reel - m.quantite : null
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{m.nom}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>en stock : {m.quantite} {m.unite}</div>
                      </div>
                      <input
                        type="number" min="0" inputMode="numeric"
                        value={saisi ?? ''}
                        placeholder="compté"
                        onChange={e => setCompte({ ...compte, [m.id]: e.target.value })}
                        style={{ width: 92, padding: '7px 10px', borderRadius: 8, textAlign: 'center', fontWeight: 700,
                                 border: '1.5px solid ' + (compteFait ? (ecart === 0 ? 'var(--green)' : 'var(--amber)') : 'var(--border)') }}
                      />
                      <div style={{ width: 62, textAlign: 'right', fontSize: 13, fontWeight: 800,
                                    color: ecart === null ? 'var(--border)' : ecart === 0 ? 'var(--green)' : 'var(--amber)' }}>
                        {ecart === null ? '—' : ecart === 0 ? 'juste' : `${ecart > 0 ? '+' : ''}${ecart}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {lignes.length > 0 && (
              <div style={{ ...carte, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.6 }}>
                  <b>{lignes.length}</b> article{lignes.length > 1 ? 's' : ''} compté{lignes.length > 1 ? 's' : ''},
                  {' '}<b style={{ color: ecarts.length ? 'var(--amber)' : 'var(--green)' }}>{ecarts.length} écart{ecarts.length > 1 ? 's' : ''}</b>.
                  {restants > 0 && <> Il reste {restants} article{restants > 1 ? 's' : ''} à compter.</>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button disabled={inventaireEnCours} style={{ ...btn('var(--accent)'), flex: 2, minWidth: 180, padding: 11 }} onClick={enregistrerInventaire}>
                    {inventaireEnCours ? 'Enregistrement…' : 'Enregistrer l’inventaire'}
                  </button>
                  <button disabled={inventaireEnCours} style={{ ...btn('#64748b'), flex: 1, minWidth: 110, padding: 11 }} onClick={() => setCompte({})}>
                    Effacer le comptage
                  </button>
                </div>
              </div>
            )}

            {/* Inventaires passés, relus depuis les mouvements qu'ils ont produits */}
            {/* Les inventaires passés se relisent dans les mouvements : si ce
                registre est illisible, l'absence du bloc ne doit pas se lire
                comme « aucun inventaire n'a jamais été fait ». */}
            {mouvementsEnEchec && (
              <div style={{ fontSize: 11.5, color: 'var(--red)', padding: '4px 2px 10px' }}>
                Historique des inventaires indisponible — {mouvementsEnEchec}
              </div>
            )}
            {(() => {
              if (mouvementsEnEchec) return null
              const passes = mouvements.filter(m => m.motif === 'inventaire')
              if (!passes.length) return null
              const parJour = {}
              passes.forEach(m => {
                const j = new Date(m.created_at).toLocaleDateString('fr-FR')
                ;(parJour[j] = parJour[j] || []).push(m)
              })
              return (
                <div style={carte}>
                  <div style={bandeau}>Inventaires passés</div>
                  {Object.entries(parJour).map(([jour, lignesJour]) => (
                    <div key={jour} style={{ padding: '9px 14px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {jour} — {lignesJour.length} écart{lignesJour.length > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {lignesJour.map(l => `${l.materiels?.nom || '(article retiré)'} ${l.quantite > 0 ? '+' : ''}${l.quantite}`).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </>
        )
      })()}

      {/* ── Mouvements ── */}
      {vue === 'mouvements' && (
        <div style={carte}>
          <div style={bandeau}>60 derniers mouvements</div>
          {mouvementsEnEchec ? (
            <div style={{ padding: '14px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--red)' }}>
                Registre des mouvements illisible
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text)', marginTop: 4 }}>{mouvementsEnEchec}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Ce n’est pas « aucun mouvement » : la liste n’a pas pu être lue.
              </div>
              <button onClick={charger}
                style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                Réessayer
              </button>
            </div>
          ) : mouvements.length === 0 && (
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

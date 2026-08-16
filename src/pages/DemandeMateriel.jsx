import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'

// Demande de matériel — espace enseignant.
//
// Volontairement séparée des demandes RH : ce n'est ni la même personne qui
// tranche — le surveillant, pas la direction — ni le même cycle. Une demande
// de matériel n'est close que lorsque l'objet est physiquement remis, ce qui
// suppose une étape de plus que « approuvée / refusée ».
//
// L'enseignant peut demander un article du catalogue ou quelque chose qui n'y
// figure pas encore : lui imposer une liste fermée l'obligerait à attendre que
// le surveillant crée l'article avant de pouvoir seulement le réclamer.

const tableAbsente = e =>
  Boolean(e) && (e.code === '42P01' || e.code === 'PGRST205' || /Could not find the table/i.test(e.message || ''))

const ETIQUETTES = {
  en_attente: { texte: '⏳ En attente du surveillant', couleur: 'var(--amber)' },
  validee:    { texte: '✓ Validée, en attente de livraison', couleur: 'var(--accent)' },
  livree:     { texte: '📦 Livrée', couleur: 'var(--green)' },
  refusee:    { texte: '✖ Refusée', couleur: 'var(--red)' },
}

const dateLisible = iso =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function DemandeMateriel({ user }) {
  const [materiels, setMateriels] = useState([])
  const [mesDemandes, setMesDemandes] = useState([])
  const [groupes, setGroupes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({ materiel_id: '', libelle: '', quantite: '1', groupe: '', motif: '' })

  useEffect(() => { charger() }, [user?.id])

  async function charger() {
    setChargement(true); setErreur(null)
    const [mat, dem, aff] = await Promise.all([
      supabase.from('materiels').select('id, nom, unite').eq('actif', true).order('nom'),
      supabase.from('demandes_materiel').select('*').eq('demandeur_id', user.id).order('created_at', { ascending: false }),
      supabase.from('affectations_matieres').select('groupe').eq('prof_id', user.id),
    ])

    // PostgREST signale une table absente soit par 42P01, soit par PGRST205
    // quand c'est son cache de schéma qui l'ignore. Guetter les deux évite
    // d'afficher un message technique à l'enseignant.
    if ([mat, dem].some(r => tableAbsente(r.error))) {
      setErreur("Les demandes de matériel ne sont pas encore installées. Le script sql/stock_et_sanctions.sql doit être exécuté une fois dans Supabase.")
      setChargement(false); return
    }
    const echec = [mat, dem].find(r => r.error)
    if (echec) { setErreur('Chargement impossible : ' + echec.error.message); setChargement(false); return }

    setMateriels(mat.data || [])
    setMesDemandes(dem.data || [])
    setGroupes([...new Set((aff.data || []).map(a => a.groupe))].sort())
    setChargement(false)
  }

  // Le surveillant peut livrer pendant que l'écran est ouvert : on relit au
  // retour sur l'application, comme pour les demandes RH.
  useEffect(() => {
    const relire = () => { if (document.visibilityState === 'visible') charger() }
    const timer = setInterval(relire, 30000)
    document.addEventListener('visibilitychange', relire)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', relire) }
  }, [user?.id])

  async function envoyer(e) {
    e.preventDefault()
    const article = materiels.find(m => m.id === form.materiel_id)
    const libelle = (article ? article.nom : form.libelle).trim()
    const quantite = parseInt(form.quantite, 10)

    if (!libelle) { setMessage({ type: 'err', texte: 'Indiquez ce dont vous avez besoin.' }); return }
    if (!Number.isFinite(quantite) || quantite <= 0) { setMessage({ type: 'err', texte: 'La quantité doit être supérieure à zéro.' }); return }

    setEnvoi(true); setMessage(null)
    const { error } = await supabase.from('demandes_materiel').insert({
      demandeur_id: user.id,
      materiel_id: article ? article.id : null,
      libelle,
      quantite,
      groupe: form.groupe || null,
      motif: form.motif.trim() || null,
    })
    setEnvoi(false)

    // Une demande perdue en silence laisse l'enseignant attendre un matériel
    // que personne n'a vu passer.
    if (error) { setMessage({ type: 'err', texte: "Demande non transmise : " + error.message }); return }

    await pushNotification('surveillant', {
      titre: '📦 Nouvelle demande de matériel',
      message: `${[user.prenom, user.nom].filter(Boolean).join(' ')} demande ${quantite} × ${libelle}`,
      type: 'stock',
      tabTarget: 'stock',
    })

    setForm({ materiel_id: '', libelle: '', quantite: '1', groupe: '', motif: '' })
    setMessage({ type: 'ok', texte: 'Demande transmise au surveillant ✓' })
    charger()
  }

  if (chargement) return <div className="empty-state"><p>Chargement…</p></div>
  if (erreur) return <div className="empty-state"><div className="empty-icon">🛠️</div><p>{erreur}</p></div>

  const champ = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }
  const carte = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }

  return (
    <>
      <form onSubmit={envoyer} style={{ ...carte, padding: '14px' }}>
        <div className="section-title" style={{ fontSize: 15, marginBottom: 10 }}>Demander du matériel</div>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
          Article
          <select value={form.materiel_id} onChange={e => setForm({ ...form, materiel_id: e.target.value, libelle: '' })} style={{ ...champ, marginTop: 4 }}>
            <option value="">— autre, à préciser —</option>
            {materiels.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.unite})</option>)}
          </select>
        </label>

        {!form.materiel_id && (
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 10 }}>
            Ce dont vous avez besoin
            <input value={form.libelle} onChange={e => setForm({ ...form, libelle: e.target.value })}
              placeholder="Crayons de papier" style={{ ...champ, marginTop: 4 }} />
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 90, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            Quantité
            <input type="number" min="1" value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })} style={{ ...champ, marginTop: 4 }} />
          </label>
          {groupes.length > 0 && (
            <label style={{ flex: 1, minWidth: 120, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
              Pour la classe
              <select value={form.groupe} onChange={e => setForm({ ...form, groupe: e.target.value })} style={{ ...champ, marginTop: 4 }}>
                <option value="">—</option>
                {groupes.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          )}
        </div>

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 10 }}>
          À quoi cela va servir
          <textarea rows={2} value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })}
            placeholder="Pour les exercices d’écriture du CP1" style={{ ...champ, marginTop: 4 }} />
        </label>

        {message && (
          <div style={{
            marginTop: 10, padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: message.type === 'ok' ? 'rgba(46,158,79,.10)' : 'rgba(220,53,69,.10)',
            color: message.type === 'ok' ? 'var(--green)' : 'var(--red)',
          }}>{message.texte}</div>
        )}

        <button type="submit" disabled={envoi} className="btn btn-primary"
          style={{ marginTop: 12, width: '100%', padding: 12, borderRadius: 12, fontWeight: 800 }}>
          {envoi ? 'Envoi…' : 'Envoyer au surveillant'}
        </button>
      </form>

      <div style={carte}>
        <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
          Mes demandes · {mesDemandes.length}
        </div>
        {mesDemandes.length === 0 && (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--muted)' }}>Vous n’avez encore rien demandé.</div>
        )}
        {mesDemandes.map(d => {
          const e = ETIQUETTES[d.statut] || { texte: d.statut, couleur: 'var(--muted)' }
          return (
            <div key={d.id} style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{d.quantite} × {d.libelle}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: e.couleur }}>{e.texte}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Demandé le {dateLisible(d.created_at)}{d.groupe ? ` · ${d.groupe}` : ''}
              </div>
              {d.statut === 'livree' && d.quantite_livree !== d.quantite && (
                <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
                  {d.quantite_livree} remis sur {d.quantite} demandés.
                </div>
              )}
              {d.commentaire_traitement && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <b style={{ color: 'var(--accent)' }}>Surveillant :</b> {d.commentaire_traitement}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

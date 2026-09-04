import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmtDate = value => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  : 'Date non précisée'

const messageErreur = error => {
  const texte = String(error?.message || error || '')
  if (/lire_circuit_assistantes_maternelle|schema cache|does not exist/i.test(texte)) {
    return 'Le circuit doit être installé dans Supabase avec le script sql/circuit_assistantes_maternelle.sql.'
  }
  if (/42501|requise|non_autorise|non accessible/i.test(texte)) return "Votre compte n'a pas accès à cette action."
  return texte || "L'action n'a pas pu être terminée."
}

const extraireMateriels = texte => String(texte || '')
  .split(/[\n;,]+/)
  .map(x => x.replace(/^[-•]\s*/, '').trim())
  .filter(Boolean)
  .map(ligne => {
    const m = ligne.match(/^(\d+)\s*(?:x|×)\s+(.+)$/i)
    return { libelle: (m?.[2] || ligne).trim(), quantite: m ? Number(m[1]) : 1 }
  })

const note = (valeur, maximum) => valeur == null ? 'En attente' : `${Number(valeur).toLocaleString('fr-FR')} / ${Number(maximum).toLocaleString('fr-FR')}`

function PastillePoints({ label, valeur, maximum, neutre = false }) {
  const complet = valeur != null && Number(valeur) >= Number(maximum)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '9px 10px', background: neutre ? '#f8fafc' : complet ? '#ecfdf5' : '#fff' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 900, color: complet ? '#047857' : '#0d2a3b' }}>{note(valeur, maximum)}</div>
    </div>
  )
}

function ResumePoints({ points }) {
  const max = points?.maximums || {}
  const responsables = points?.responsabilites || []
  const labels = { enseignant: 'enseignante', assistante: 'assistante', surveillant: 'surveillant', responsable_administratif: 'responsable administratif' }
  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 7, marginTop: 12 }}>
      <PastillePoints label="Préparation" valeur={points?.preparation} maximum={max.preparation || 20} />
      <PastillePoints label="Lecture & apport" valeur={points?.contribution_assistante} maximum={max.contribution_assistante || 10} />
      <PastillePoints label="Matériel assistante" valeur={points?.materiel_assistante} maximum={max.materiel_assistante || 10} neutre={points?.materiel_assistante == null} />
      <PastillePoints label="Surveillance" valeur={points?.surveillance} maximum={max.surveillance || 10} neutre={points?.surveillance == null} />
      <PastillePoints label="Administration" valeur={points?.administration} maximum={max.administration || 10} neutre={points?.administration == null} />
    </div>
    {responsables.length > 0 && <div style={{ marginTop: 9, padding: '8px 10px', borderRadius: 10, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 800 }}>Action non accomplie à l’échéance : {[...new Set(responsables)].map(r => labels[r] || r).join(', ')}.</div>}
    </>
  )
}

function FormContribution({ preparation, onDone, busy }) {
  const existante = preparation.contribution || {}
  const [form, setForm] = useState({
    comprehension: existante.comprehension || '',
    role: existante.role_propose || '',
    apport: existante.apport_propose || '',
  })
  const [saving, setSaving] = useState(false)
  const valide = Object.values(form).every(v => v.trim().length >= 5)
  const sauver = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('enregistrer_contribution_assistante', {
        p_preparation_id: preparation.id,
        p_comprehension: form.comprehension,
        p_role_propose: form.role,
        p_apport_propose: form.apport,
      })
      if (error) throw error
      await onDone('Votre lecture et votre apport ont été enregistrés.')
    } catch (error) { await onDone(error) }
    finally { setSaving(false) }
  }
  return (
    <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#075985' }}>1. J’ai lu et compris la préparation</div>
      <label className="form-group" style={{ marginTop: 9 }}><span>Ce que j’ai compris du cours</span><textarea className="form-input" rows="2" value={form.comprehension} onChange={e => setForm({ ...form, comprehension: e.target.value })} /></label>
      <label className="form-group"><span>Le rôle que je jouerai pendant la séance</span><textarea className="form-input" rows="2" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></label>
      <label className="form-group"><span>Mon apport pour mieux aider les enfants</span><textarea className="form-input" rows="2" value={form.apport} onChange={e => setForm({ ...form, apport: e.target.value })} /></label>
      <button className="btn-primary" disabled={!valide || busy || saving} onClick={sauver} style={{ width: '100%' }}>{saving ? 'Enregistrement…' : existante.id ? 'Mettre à jour mon apport' : 'Valider ma contribution'}</button>
    </div>
  )
}

function FormMateriel({ preparation, onDone, busy }) {
  const materielPrevu = preparation.contenu?.materiel || ''
  const [texte, setTexte] = useState(materielPrevu)
  const [saving, setSaving] = useState(false)
  const elements = useMemo(() => extraireMateriels(texte), [texte])
  const demander = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('demander_materiel_assistante', { p_preparation_id: preparation.id, p_elements: elements })
      if (error) throw error
      await onDone(`${elements.length} demande${elements.length > 1 ? 's' : ''} transmise${elements.length > 1 ? 's' : ''} au surveillant.`)
    } catch (error) { await onDone(error) }
    finally { setSaving(false) }
  }
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa' }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#9a3412' }}>2. Je rassemble le matériel</div>
      <div style={{ fontSize: 11, color: '#9a3412', marginTop: 3 }}>Une ligne par matériel. Écrivez par exemple « 4 x ardoises ».</div>
      <textarea className="form-input" rows="3" value={texte} onChange={e => setTexte(e.target.value)} placeholder="Matériel indiqué dans la préparation" style={{ marginTop: 9 }} />
      <button className="btn-primary" disabled={!elements.length || busy || saving} onClick={demander} style={{ width: '100%', marginTop: 8 }}>{saving ? 'Transmission…' : 'Demander au surveillant'}</button>
    </div>
  )
}

const statutMateriel = {
  demande_assistante: 'À traiter par le surveillant',
  escalade_administration: 'Transmis au responsable administratif',
  retour_surveillance: 'Fourni par l’administration · à remettre',
  livre_assistante: 'Remis à l’assistante · confirmation attendue',
  installe: 'Reçu et installé',
  non_fourni: 'Non fourni',
}

function LigneMateriel({ item, mode, agir, busy }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 11, marginTop: 8, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{item.quantite} × {item.libelle}</b>
        <span style={{ fontSize: 10, fontWeight: 800, color: item.statut === 'installe' ? '#047857' : '#b45309' }}>{statutMateriel[item.statut] || item.statut}</span>
      </div>
      {item.stock_nom && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Stock : {item.stock_nom} · {item.stock_disponible} disponible(s)</div>}
      {mode === 'surveillant' && ['demande_assistante', 'retour_surveillance'].includes(item.statut) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 9 }}>
          <button className="btn-primary" disabled={busy} onClick={() => agir(item, 'livrer')}>Remettre</button>
          <button className="btn-sm" disabled={busy} onClick={() => agir(item, 'escalader')}>Stock insuffisant</button>
        </div>
      )}
      {mode === 'administration' && item.statut === 'escalade_administration' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 9 }}>
          <button className="btn-primary" disabled={busy} onClick={() => agir(item, 'fourni')}>Fourni</button>
          <button className="btn-sm" disabled={busy} onClick={() => agir(item, 'commande')}>Commandé</button>
          <button className="btn-sm" disabled={busy} onClick={() => agir(item, 'non_fourni')}>Indisponible</button>
        </div>
      )}
      {mode === 'assistante' && item.statut === 'livre_assistante' && (
        <button className="btn-primary" disabled={busy} onClick={() => agir(item, 'confirmer')} style={{ width: '100%', marginTop: 9 }}>Confirmer reçu et installé</button>
      )}
    </div>
  )
}

function ReglageDirection({ config, onDone, busy }) {
  const [valeurs, setValeurs] = useState(config || {})
  const [saving, setSaving] = useState(false)
  const champs = [
    ['points_preparation', 'Préparation à temps'], ['heures_points_pleins', 'Délai plein (heures)'],
    ['heures_minimum', 'Délai minimum (heures)'], ['points_contribution', 'Lecture et apport'],
    ['points_materiel_assistante', 'Matériel assistante'], ['points_surveillance', 'Traitement surveillant'],
    ['points_administration', 'Traitement administratif'],
  ]
  const sauver = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('configurer_bareme_assistantes_maternelle', { p_config: valeurs })
      if (error) throw error
      await onDone('Le barème du circuit maternelle a été mis à jour.')
    } catch (error) { await onDone(error) }
    finally { setSaving(false) }
  }
  return (
    <div className="card" style={{ padding: 15, marginBottom: 15, borderLeft: '4px solid #7c3aed' }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>⚙️ Barème du circuit</h3>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Seule la Direction peut modifier ces valeurs.</p>
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
        Barème en vigueur : {valeurs.points_preparation ?? 20} points à partir de {valeurs.heures_points_pleins ?? 24} h d’avance, puis retrait d’un point par heure jusqu’au seuil de {valeurs.heures_minimum ?? 5} h. Sous ce seuil, la préparation vaut 0 et les rubriques de l’assistante sont neutralisées. Le dernier maillon non accompli porte la responsabilité.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
        {champs.map(([cle, label]) => <label className="form-group" key={cle}><span>{label}</span><input className="form-input" type="number" min="0" step="1" value={valeurs[cle] ?? ''} onChange={e => setValeurs({ ...valeurs, [cle]: Number(e.target.value) })} /></label>)}
      </div>
      <button className="btn-primary" disabled={busy || saving} onClick={sauver}>{saving ? 'Enregistrement…' : 'Enregistrer le barème'}</button>
    </div>
  )
}

export default function CircuitAssistantesMaternelle({ user, mode: modeForce }) {
  const mode = modeForce || (/^assistante-/.test(String(user?.fonction || '').toLowerCase()) ? 'assistante' : user?.role === 'surveillant' ? 'surveillant' : user?.role === 'responsable_administratif' ? 'administration' : 'direction')
  const [data, setData] = useState({ config: {}, preparations: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const charger = useCallback(async () => {
    setLoading(true)
    const { data: resultat, error } = await supabase.rpc('lire_circuit_assistantes_maternelle')
    if (error) setMessage(messageErreur(error))
    else { setData(resultat || { config: {}, preparations: [] }); setMessage('') }
    setLoading(false)
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(charger, 0)
    return () => window.clearTimeout(timer)
  }, [charger])

  const terminer = async resultat => {
    setBusy(false)
    if (resultat instanceof Error || resultat?.message) setMessage(messageErreur(resultat))
    else { setMessage(resultat); await charger() }
  }
  const executer = async fn => {
    setBusy(true); setMessage('')
    try { await fn(); await terminer('Action enregistrée et tracée.') } catch (e) { await terminer(e) }
  }
  const agirMateriel = (item, action) => executer(async () => {
    if (mode === 'surveillant') {
      const { error } = await supabase.rpc('traiter_materiel_surveillance', { p_circuit_id: item.id, p_action: action, p_quantite_livree: action === 'livrer' ? item.quantite : null, p_commentaire: null })
      if (error) throw error
    } else if (mode === 'administration') {
      const { error } = await supabase.rpc('traiter_materiel_administration', { p_circuit_id: item.id, p_decision: action, p_commentaire: null })
      if (error) throw error
    } else {
      const { error } = await supabase.rpc('confirmer_materiel_assistante', { p_circuit_id: item.id, p_recu: true, p_installe: true, p_commentaire: null })
      if (error) throw error
    }
  })

  const preparations = (data.preparations || []).filter(p => {
    if (mode === 'surveillant') return (p.materiels || []).some(m => ['demande_assistante', 'retour_surveillance'].includes(m.statut))
    if (mode === 'administration') return (p.materiels || []).some(m => m.statut === 'escalade_administration')
    return true
  })

  return (
    <div>
      <div style={{ marginBottom: 15 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0d2a3b' }}>🤝 Circuit des préparations maternelles</h2>
        <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          {mode === 'assistante' && 'Lire, proposer votre apport, demander le matériel puis confirmer son installation.'}
          {mode === 'surveillant' && 'Remettre le matériel disponible ou transmettre le manque à l’administration.'}
          {mode === 'administration' && 'Répondre aux besoins que le magasin ne peut pas couvrir.'}
          {mode === 'direction' && 'Suivre chaque maillon et régler le barème validé.'}
        </p>
      </div>
      {message && <div style={{ padding: 11, borderRadius: 11, marginBottom: 12, background: /installé|accès|terminée|erreur|pas pu/i.test(message) ? '#fff7ed' : '#ecfdf5', color: '#0d2a3b', fontSize: 12, fontWeight: 700 }}>{message}</div>}
      {mode === 'direction' && <ReglageDirection config={data.config} busy={busy} onDone={terminer} />}
      {loading ? <div className="empty-state"><p>Chargement du circuit…</p></div> : preparations.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">✓</div><p>Aucune action en attente pour le moment.</p></div>
      ) : preparations.map(p => (
        <div className="card" key={p.id} style={{ padding: 15, marginBottom: 13, borderLeft: '4px solid #00a8e0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div><div style={{ fontWeight: 900, fontSize: 15 }}>{p.matiere || 'Préparation'} · {p.groupe}</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{fmtDate(p.date_cours)} à {String(p.heure_cours || '').slice(0, 5)} · {p.enseignant?.nom}</div></div>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#0369a1' }}>{p.status}</span>
          </div>
          {p.contenu?.objectif && <div style={{ marginTop: 10, fontSize: 12, background: '#f8fafc', padding: 10, borderRadius: 10 }}><b>Objectif :</b> {p.contenu.objectif}</div>}
          <ResumePoints points={p.points} />
          {mode === 'assistante' && <FormContribution preparation={p} busy={busy} onDone={terminer} />}
          {mode === 'assistante' && p.contribution && !(p.materiels || []).length && <FormMateriel preparation={p} busy={busy} onDone={terminer} />}
          {(p.materiels || []).length > 0 && <div style={{ marginTop: 12 }}><b style={{ fontSize: 13 }}>Matériel de la séance</b>{p.materiels.map(m => <LigneMateriel key={m.id} item={m} mode={mode} agir={agirMateriel} busy={busy} />)}</div>}
        </div>
      ))}
    </div>
  )
}

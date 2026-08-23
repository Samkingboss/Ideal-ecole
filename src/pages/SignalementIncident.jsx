import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'

const initial = { classe_id: '', eleve_id: '', gravite: 'mineure', motif: '' }

export default function SignalementIncident({ user, flottant = false }) {
  const [ouvert, setOuvert] = useState(!flottant)
  const [classes, setClasses] = useState([])
  const [eleves, setEleves] = useState([])
  const [form, setForm] = useState(initial)
  const [chargement, setChargement] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!ouvert) return
    Promise.all([
      supabase.from('classes').select('id,nom,ordre').order('ordre'),
      supabase.from('eleves').select('id,prenom,nom,classe_id').eq('actif', true).order('nom'),
    ]).then(([c, e]) => {
      setClasses(Array.isArray(c.data) ? c.data : [])
      setEleves(Array.isArray(e.data) ? e.data : [])
    })
  }, [ouvert])

  const elevesClasse = useMemo(
    () => eleves.filter(e => String(e.classe_id) === String(form.classe_id)),
    [eleves, form.classe_id]
  )

  const envoyer = async (e) => {
    e.preventDefault()
    if (!form.classe_id || !form.eleve_id || !form.motif.trim()) {
      setMessage('Choisissez une classe, un élève et décrivez précisément l’incident.')
      return
    }
    setChargement(true)
    setMessage('')
    const eleve = eleves.find(x => String(x.id) === String(form.eleve_id))
    const classe = classes.find(x => String(x.id) === String(form.classe_id))
    const signalant = `${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.email || 'Membre du personnel'
    const maintenant = new Date()
    const { data, error } = await supabase.from('disciplines').insert({
      eleve_id: form.eleve_id,
      prof_id: user?.id,
      motif: form.motif.trim(),
      gravite: form.gravite,
      statut: 'signalé',
      date_incident: maintenant.toISOString().slice(0, 10),
    }).select('id').single()

    if (error) {
      setMessage(`Le signalement n’a pas été enregistré : ${error.message}`)
      setChargement(false)
      return
    }

    const notifie = await pushNotification('surveillant', {
      titre: '⚖️ Nouvel incident à traiter',
      message: `${eleve?.prenom || ''} ${eleve?.nom || ''} · ${classe?.nom || ''} · signalé par ${signalant}`,
      type: 'discipline',
      tabTarget: 'discipline',
      ref: data?.id,
    })

    setForm(initial)
    setChargement(false)
    setMessage(notifie
      ? 'Signalement enregistré et transmis au surveillant. Il décidera de la sanction.'
      : 'Signalement enregistré, mais la notification au surveillant a échoué. Prévenez-le directement.')
  }

  const contenu = (
    <div className="card" style={{ padding: '1.2rem', width: '100%', maxWidth: 620 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>⚖️ Signaler un incident concernant un élève</h3>
          <p style={{ margin: '4px 0 14px', color: 'var(--muted)', fontSize: 12 }}>Le surveillant recevra le signalement et sera le seul à appliquer la punition.</p>
        </div>
        {flottant && <button className="btn-sm" onClick={() => setOuvert(false)} style={{ fontSize: 18 }}>×</button>}
      </div>
      <form onSubmit={envoyer} style={{ display: 'grid', gap: 12 }}>
        <label className="form-group" style={{ margin: 0 }}>
          <span className="form-label">1. Classe concernée *</span>
          <select className="form-select" value={form.classe_id} onChange={e => setForm({ ...form, classe_id: e.target.value, eleve_id: '' })} required>
            <option value="">Choisir la classe</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className="form-group" style={{ margin: 0 }}>
          <span className="form-label">2. Élève concerné *</span>
          <select className="form-select" value={form.eleve_id} onChange={e => setForm({ ...form, eleve_id: e.target.value })} disabled={!form.classe_id} required>
            <option value="">{form.classe_id ? 'Choisir l’élève' : 'Choisissez d’abord une classe'}</option>
            {elevesClasse.map(el => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
          </select>
        </label>
        <label className="form-group" style={{ margin: 0 }}>
          <span className="form-label">3. Gravité constatée *</span>
          <select className="form-select" value={form.gravite} onChange={e => setForm({ ...form, gravite: e.target.value })}>
            <option value="mineure">Mineure</option>
            <option value="moyenne">Moyenne</option>
            <option value="grave">Grave</option>
            <option value="critique">Critique / sécurité immédiate</option>
          </select>
        </label>
        <label className="form-group" style={{ margin: 0 }}>
          <span className="form-label">4. Description précise de l’incident *</span>
          <textarea className="form-input" rows={4} value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })} placeholder="Décrivez les faits observés, le lieu et l’heure approximative…" required />
        </label>
        {message && <div style={{ padding: 10, borderRadius: 10, background: message.startsWith('Signalement enregistré') ? '#ecfdf5' : '#fff7ed', fontSize: 12, fontWeight: 700 }}>{message}</div>}
        <button className="btn btn-primary" type="submit" disabled={chargement} style={{ padding: 12 }}>
          {chargement ? 'Transmission…' : '📨 Transmettre au surveillant'}
        </button>
      </form>
    </div>
  )

  if (!flottant) return contenu
  return <>
    <button onClick={() => setOuvert(true)} style={{ position: 'fixed', right: 16, bottom: 92, zIndex: 850, border: 0, borderRadius: 24, padding: '11px 15px', background: '#dc2626', color: '#fff', fontWeight: 900, boxShadow: '0 8px 24px rgba(220,38,38,.3)' }}>⚖️ Signaler un incident</button>
    {ouvert && <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(13,42,59,.68)', padding: 16, display: 'grid', placeItems: 'center', overflowY: 'auto' }} onClick={() => setOuvert(false)}><div onClick={e => e.stopPropagation()} style={{ width: 'min(620px,100%)' }}>{contenu}</div></div>}
  </>
}

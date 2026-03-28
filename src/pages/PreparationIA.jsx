import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CRITERES = [
  { id: 'structure',  label: 'Structure & organisation', max: 4 },
  { id: 'objectifs',  label: 'Clarté des objectifs',     max: 4 },
  { id: 'contenu',    label: 'Qualité du contenu',       max: 4 },
  { id: 'methodes',   label: 'Méthodes & activités',     max: 4 },
  { id: 'evaluation', label: 'Évaluation prévue',        max: 4 },
]

const getBadge = (note) => {
  if (note >= 18) return { label: 'Excellent',   color: '#16a34a', bg: 'rgba(22,163,74,.1)',  icon: '🏆' }
  if (note >= 15) return { label: 'Très bien',   color: '#2563eb', bg: 'rgba(37,99,235,.1)',  icon: '⭐' }
  if (note >= 12) return { label: 'Bien',        color: '#1AAFE0', bg: 'rgba(26,175,224,.1)', icon: '👍' }
  if (note >= 10) return { label: 'Assez bien',  color: '#F7941D', bg: 'rgba(247,148,29,.1)', icon: '📝' }
  return           { label: 'À améliorer', color: '#ED1C24', bg: 'rgba(237,28,36,.1)', icon: '⚠️' }
}

const verifierDelai = (dateStr, heureStr) => {
  if (!dateStr || !heureStr) return { ok: true, retardMinutes: 0 }
  const heureCours = new Date(dateStr + 'T' + heureStr + ':00')
  const limiteEnvoi = new Date(heureCours.getTime() - 10 * 60 * 60 * 1000)
  const retardMs = new Date() - limiteEnvoi
  return { ok: retardMs <= 0, retardMinutes: Math.max(0, Math.floor(retardMs / 60000)) }
}

export default function PreparationIA({ user }) {
  const [vue, setVue] = useState('liste')
  const [preparations, setPreparations] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({
    classe_id: '',
    matiere: '',
    date_cours: new Date().toISOString().slice(0, 10),
    heure_cours: '08:00',
    fichier: null,
  })
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [delai, setDelai] = useState({ ok: true, retardMinutes: 0 })

  useEffect(() => { chargerDonnees() }, [])

  useEffect(() => {
    const check = () => setDelai(verifierDelai(form.date_cours, form.heure_cours))
    check()
    const timer = setInterval(check, 60000)
    return () => clearInterval(timer)
  }, [form.date_cours, form.heure_cours])

  const chargerDonnees = async () => {
    const [{ data: cl }, { data: prep }] = await Promise.all([
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('preparations')
        .select('*, classes(nom)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    setClasses(cl || [])
    setPreparations(prep || [])
    if (cl?.length) setForm(f => ({ ...f, classe_id: cl[0].id }))
  }

  const soumettre = async () => {
    setErreur('')
    if (!form.fichier)        { setErreur('Joignez un fichier PDF ou une image.'); return }
    if (!form.matiere.trim()) { setErreur('Indiquez la matière concernée.'); return }
    if (!form.classe_id)      { setErreur('Sélectionnez une classe.'); return }

    setLoading(true)
    try {
      const nomFichier = user.id + '/' + Date.now() + '_' + form.fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(nomFichier, form.fichier, { upsert: false })
      if (uploadErr) throw new Error('Erreur upload : ' + uploadErr.message)

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(nomFichier)
      const { ok: dansLesDelais, retardMinutes } = verifierDelai(form.date_cours, form.heure_cours)

      await supabase.from('preparations').insert({
        user_id: user.id,
        classe_id: form.classe_id,
        matiere: form.matiere,
        date_cours: form.date_cours,
        heure_cours: form.heure_cours,
        url_doc: publicUrl,
        status: dansLesDelais ? 'en_attente' : 'retard',
        retard_minutes: retardMinutes,
        note_ia: null,
      })

      setVue('liste')
      setForm(f => ({ ...f, fichier: null, matiere: '' }))
      chargerDonnees()
      alert('Préparation soumise ! Le directeur va la corriger.')
    } catch (err) {
      setErreur('Erreur : ' + err.message)
    }
    setLoading(false)
  }

  if (vue === 'formulaire') return (
    <div style={{ padding: '1rem 1.2rem 3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
        <button onClick={() => setVue('liste')} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>← Retour</button>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Soumettre une préparation</div>
      </div>

      {erreur && <div style={{ background: 'rgba(237,28,36,.08)', border: '1px solid rgba(237,28,36,.2)', borderRadius: 10, padding: '.7rem 1rem', fontSize: 13, color: '#ED1C24', marginBottom: '1rem' }}>{erreur}</div>}

      <div style={{ background: delai.ok ? 'rgba(141,198,63,.08)' : 'rgba(237,28,36,.08)', border: '1px solid ' + (delai.ok ? 'rgba(141,198,63,.3)' : 'rgba(237,28,36,.3)'), borderRadius: 12, padding: '.8rem 1rem', marginBottom: '1rem', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 20 }}>{delai.ok ? '✅' : '⏰'}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: delai.ok ? '#8DC63F' : '#ED1C24' }}>{delai.ok ? 'Dans les délais' : 'Hors délai'}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{delai.ok ? 'Soumission avant H-10 — préparation acceptée.' : 'Retard de ' + delai.retardMinutes + ' min — note pénalisée.'}</div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Classe</label>
        <select className="form-select" value={form.classe_id} onChange={e => setForm({ ...form, classe_id: e.target.value })}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Matière</label>
        <input className="form-input" placeholder="Ex : Lecture, Mathématiques..." value={form.matiere} onChange={e => setForm({ ...form, matiere: e.target.value })} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Date du cours</label>
          <input className="form-input" type="date" value={form.date_cours} onChange={e => setForm({ ...form, date_cours: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Heure du cours</label>
          <input className="form-input" type="time" value={form.heure_cours} onChange={e => setForm({ ...form, heure_cours: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Fichier de préparation</label>
        <div onClick={() => document.getElementById('prep-upload').click()}
          style={{ border: '2px dashed var(--border)', borderRadius: 14, padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', background: form.fichier ? 'rgba(141,198,63,.04)' : 'var(--bg)' }}>
          {form.fichier ? (
            <><div style={{ fontSize: 32, marginBottom: 8 }}>📄</div><div style={{ fontSize: 13, fontWeight: 700, color: '#8DC63F' }}>{form.fichier.name}</div></>
          ) : (
            <><div style={{ fontSize: 32, marginBottom: 8 }}>📤</div><div style={{ fontSize: 13, color: 'var(--muted)' }}>Cliquez pour choisir un fichier</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>PDF, JPG, PNG acceptés</div></>
          )}
        </div>
        <input id="prep-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => setForm({ ...form, fichier: e.target.files[0] || null })} />
      </div>

      <button onClick={soumettre} disabled={loading}
        style={{ width: '100%', padding: '1rem', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#ccc' : 'linear-gradient(135deg,#0d2a3b,#1AAFE0)', color: '#fff' }}>
        {loading ? 'Envoi en cours...' : '📤 Soumettre la préparation'}
      </button>
    </div>
  )

  return (
    <div style={{ padding: '1rem 1.2rem 3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Mes préparations</div>
        <button onClick={() => setVue('formulaire')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Soumettre</button>
      </div>

      <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1565a0)', borderRadius: 14, padding: '1rem', marginBottom: '1rem', color: '#fff', display: 'flex', gap: 12 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>📋</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Correction par le directeur</div>
          <div style={{ fontSize: 11, opacity: .7, lineHeight: 1.5 }}>Soumettez vos préparations avant <b>H-10</b>. Le directeur les notera sur 20 avec des commentaires.</div>
        </div>
      </div>

      {preparations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: '.5rem' }}>📚</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Aucune préparation soumise</div>
          <button onClick={() => setVue('formulaire')} style={{ marginTop: '1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Soumettre une préparation</button>
        </div>
      ) : preparations.map(prep => {
        const badge = prep.note_ia !== null ? getBadge(prep.note_ia) : null
        const date = new Date(prep.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
        return (
          <div key={prep.id} style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{prep.note_ia !== null ? '✅' : prep.status === 'retard' ? '⏰' : '⏳'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{prep.matiere}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{prep.classes?.nom} · {date}{prep.status === 'retard' ? ' · Retard ' + prep.retard_minutes + ' min' : ''}</div>
              {prep.note_ia === null && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, fontWeight: 600 }}>⏳ En attente de correction</div>}
              {prep.commentaire_ia && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4, paddingLeft: 8, borderLeft: '3px solid var(--accent)' }}>{prep.commentaire_ia.slice(0, 80)}...</div>}
            </div>
            {badge && (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: badge.color }}>{prep.note_ia}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>/20</div>
                <span style={{ fontSize: 9, fontWeight: 700, background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: 20, display: 'block', marginTop: 4 }}>{badge.label}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

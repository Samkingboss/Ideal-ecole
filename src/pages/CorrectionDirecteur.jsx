import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CRITERES = [
  { id: 'structure',  label: 'Structure et organisation', max: 4 },
  { id: 'objectifs',  label: 'Clarte des objectifs',      max: 4 },
  { id: 'contenu',    label: 'Qualite du contenu',        max: 4 },
  { id: 'methodes',   label: 'Methodes et activites',     max: 4 },
  { id: 'evaluation', label: 'Evaluation prevue',         max: 4 },
]

const getBadge = (note) => {
  if (note >= 18) return { label: 'Excellent',   color: '#16a34a', bg: 'rgba(22,163,74,.1)'  }
  if (note >= 15) return { label: 'Tres bien',   color: '#2563eb', bg: 'rgba(37,99,235,.1)'  }
  if (note >= 12) return { label: 'Bien',        color: '#1AAFE0', bg: 'rgba(26,175,224,.1)' }
  if (note >= 10) return { label: 'Assez bien',  color: '#F7941D', bg: 'rgba(247,148,29,.1)' }
  return           { label: 'A ameliorer', color: '#ED1C24', bg: 'rgba(237,28,36,.1)'  }
}

export default function CorrectionDirecteur() {
  const [preparations, setPreparations] = useState([])
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState({ structure: 0, objectifs: 0, contenu: 0, methodes: 0, evaluation: 0 })
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(false)
  const [filtre, setFiltre] = useState('toutes')

  useEffect(() => { chargerPreparations() }, [])

  const chargerPreparations = async () => {
    const { data } = await supabase
      .from('preparations')
      .select('*, classes(nom)')
      .order('heure_depot', { ascending: false })
    setPreparations(data || []); console.log('PREP:', data ? data.length : 0, 'ERR:', error ? error.message : 'ok')
  }

  const ouvrirCorrection = async (prep) => {
    const { data: userData } = await supabase
      .from('users').select('prenom, nom').eq('id', prep.user_id).single()
    setSelected({ ...prep, user: userData })
    setNotes({ structure: 0, objectifs: 0, contenu: 0, methodes: 0, evaluation: 0 })
    setCommentaire(prep.commentaire_ia || '')
  }

  const total = Object.values(notes).reduce((a, b) => a + b, 0)

  const sauvegarderCorrection = async () => {
    if (!selected) return
    setLoading(true)
    await supabase.from('preparations').update({
      note_ia: total,
      commentaire_ia: commentaire,
      status: 'valide',
    }).eq('id', selected.id)
    setSelected(null)
    chargerPreparations()
    setLoading(false)
  }

  const prepsFiltrees = preparations.filter(p => {
    if (filtre === 'toutes') return true
    if (filtre === 'en_attente') return !p.note_ia || p.status === 'en_attente'
    if (filtre === 'corrigees') return p.note_ia && p.status === 'valide'
    return true
  })

  if (selected) {
    const badge = getBadge(total)
    const dateDepot = selected.heure_depot ? new Date(selected.heure_depot).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    return (
      <div style={{ padding: '1rem 1.2rem 3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>Retour</button>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Corriger la preparation</div>
        </div>
        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.user ? selected.user.prenom + ' ' + selected.user.nom : 'Professeur'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{selected.classes?.nom} · {selected.date_cours}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Depose le {dateDepot}</div>
          {selected.url_doc && (
            <a href={selected.url_doc} target='_blank' rel='noreferrer' style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'rgba(26,175,224,.08)', border: '1px solid rgba(26,175,224,.2)', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
              Ouvrir la preparation
            </a>
          )}
          {selected.status === 'rejete (retard)' && <div style={{ marginTop: 8, fontSize: 11, color: '#ED1C24', fontWeight: 600 }}>Soumis en retard</div>}
        </div>
        <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1565a0)', borderRadius: 14, padding: '1rem', marginBottom: '1rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, opacity: .8 }}>Note totale</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 900 }}>{total}</div>
            <div><div style={{ fontSize: 14, opacity: .6 }}>/20</div><span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 20 }}>{badge.label}</span></div>
          </div>
        </div>
        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '1rem' }}>
          <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Notation par critere</div>
          {CRITERES.map(crit => {
            const note = notes[crit.id] || 0
            const pct = (note / crit.max) * 100
            const col = pct >= 75 ? '#8DC63F' : pct >= 50 ? '#F7941D' : '#ED1C24'
            return (
              <div key={crit.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{crit.label}</div>
                  <div style={{ fontWeight: 900, fontSize: 15, color: col }}>{note}/{crit.max}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: crit.max + 1 }, (_, i) => (
                    <button key={i} onClick={() => setNotes({ ...notes, [crit.id]: i })}
                      style={{ flex: 1, padding: '6px 0', border: '1.5px solid', borderColor: note === i ? col : 'var(--border)', borderRadius: 8, background: note === i ? col : 'var(--bg)', color: note === i ? '#fff' : 'var(--muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className='form-group'>
          <label className='form-label'>Commentaire general</label>
          <textarea className='form-input' rows={3} value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder='Appreciation globale...' style={{ resize: 'none', lineHeight: 1.6 }} />
        </div>
        <button onClick={sauvegarderCorrection} disabled={loading}
          style={{ width: '100%', padding: '1rem', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#ccc' : '#0d2a3b', color: '#fff' }}>
          {loading ? 'Enregistrement...' : 'Valider la correction'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem 1.2rem 3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Corrections ({preparations.length})</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['toutes','Toutes'],['en_attente','En attente'],['corrigees','Corrigees']].map(([f,l]) => (
            <button key={f} onClick={() => setFiltre(f)}
              style={{ padding: '4px 10px', borderRadius: 20, border: '1.5px solid', borderColor: filtre === f ? 'var(--accent)' : 'var(--border)', background: filtre === f ? 'var(--accent)' : 'var(--card)', color: filtre === f ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {prepsFiltrees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: '.5rem' }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune preparation</div>
        </div>
      ) : prepsFiltrees.map(prep => {
        const badge = prep.note_ia !== null ? getBadge(prep.note_ia) : null
        const date = prep.heure_depot ? new Date(prep.heure_depot).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''
        return (
          <div key={prep.id} onClick={() => ouvrirCorrection(prep)}
            style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{prep.status === 'valide' ? '✅' : prep.status === 'rejete (retard)' ? '⏰' : '⏳'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{prep.classes?.nom} · {prep.date_cours}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{date} · {prep.status}</div>
              {prep.status !== 'valide' && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, fontWeight: 600 }}>Cliquez pour corriger</div>}
            </div>
            {badge && (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: badge.color }}>{prep.note_ia}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>/20</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

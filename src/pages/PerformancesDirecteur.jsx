import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PerformancesDirecteur() {
  const [profs, setProfs] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { charger() }, [])

  const charger = async () => {
    setLoading(true)
    const { data: users } = await supabase.from('users').select('*').neq('role', 'directeur')
    const { data: checkpoints } = await supabase.from('checkpoints').select('*')
    const { data: recrees } = await supabase.from('recrees').select('*')
    const { data: manquements } = await supabase.from('manquements').select('*')

    const liste = (users || []).map(u => {
      const cps = (checkpoints || []).filter(c => c.user_id === u.id)
      const recs = (recrees || []).filter(r => r.user_id === u.id)
      const manqs = (manquements || []).filter(m => m.user_id === u.id)

      const totalCps = cps.length
      const cpsValides = cps.filter(c => c.statut === 'valide' || c.statut === 'ok').length
      const ponctualite = totalCps > 0 ? Math.round((cpsValides / totalCps) * 100) : null

      const totalRecs = recs.length
      const recsOk = recs.filter(r => r.statut === 'present' || r.statut === 'ok').length
      const presenceRec = totalRecs > 0 ? Math.round((recsOk / totalRecs) * 100) : null

      const nbManquements = manqs.length

      return { ...u, ponctualite, presenceRec, nbManquements, totalCps, totalRecs }
    })

    setProfs(liste)
    setLoading(false)
  }

  const getColor = (val) => {
    if (val === null) return '#aaa'
    if (val >= 90) return '#8DC63F'
    if (val >= 75) return '#F7941D'
    return '#ED1C24'
  }

  const getNote = (val) => {
    if (val === null) return '—'
    if (val >= 90) return 'Excellent'
    if (val >= 75) return 'Bien'
    if (val >= 60) return 'Moyen'
    return 'Insuffisant'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', color: 'var(--muted)' }}>
      Chargement...
    </div>
  )

  if (selected) {
    const p = selected
    return (
      <div style={{ padding: '1rem 1.2rem 3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
          <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>← Retour</button>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Performances de {p.prenom} {p.nom}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1565a0)', borderRadius: 16, padding: '1.2rem', marginBottom: '1rem', color: '#fff' }}>
          <div style={{ fontSize: 13, opacity: .7, marginBottom: 4 }}>{p.role} · {p.classe_nom || ''}</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{p.prenom} {p.nom}</div>
        </div>

        {[
          { label: 'Ponctualité', val: p.ponctualite, total: p.totalCps, unite: 'check-points' },
          { label: 'Présence récréations', val: p.presenceRec, total: p.totalRecs, unite: 'récréations' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{stat.label}</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: getColor(stat.val) }}>
                {stat.val !== null ? stat.val + '%' : '—'}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: (stat.val || 0) + '%', background: getColor(stat.val), borderRadius: 20, transition: 'width .6s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{stat.total} {stat.unite} enregistrés · {getNote(stat.val)}</div>
          </div>
        ))}

        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Manquements disciplinaires</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: p.nbManquements === 0 ? '#8DC63F' : p.nbManquements < 3 ? '#F7941D' : '#ED1C24' }}>
            {p.nbManquements}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {p.nbManquements === 0 ? 'Aucun manquement enregistré' : 'manquements enregistrés'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem 1.2rem 3rem' }}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: '1rem' }}>Performances de l équipe</div>

      {profs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48 }}>👥</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Aucun employé trouvé</div>
        </div>
      ) : profs.map(p => (
        <div key={p.id} onClick={() => setSelected(p)}
          style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.prenom} {p.nom}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.role}</div>
            </div>
            <span style={{ fontSize: 11, background: 'rgba(26,175,224,.1)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
              Voir détails →
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'Ponctualité', val: p.ponctualite },
              { label: 'Récréations', val: p.presenceRec },
              { label: 'Manquements', val: p.nbManquements, invert: true },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: s.invert ? (s.val === 0 ? '#8DC63F' : s.val < 3 ? '#F7941D' : '#ED1C24') : getColor(s.val) }}>
                  {s.val !== null ? (s.invert ? s.val : s.val + '%') : '—'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

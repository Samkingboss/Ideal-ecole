import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const RECREES = [
  { id:'r1', label:'9h40 - Recreation matin' },
  { id:'r2', label:'12h15 - Pause dejeuner' },
  { id:'r3', label:'14h15 - Recreation apres-midi' },
]
const RECREE_CHECKS = [
  { id:'outils', label:'Outils pedagogiques ranges' },
  { id:'tables', label:'Tables-bancs bien ranges' },
  { id:'ventilo', label:'Ventilateur eteint' },
  { id:'fermee', label:'Salle fermee a cle' },
  { id:'cle', label:'Cle deposee a l heure' },
]

export default function SurveillantApp({ user, onLogout }) {
  const [tab, setTab] = useState('pointage')
  const [profs, setProfs] = useState([])
  const [today] = useState(new Date().toISOString().slice(0,10))
  const [performances, setPerformances] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: u } = await supabase.from('users').select('*').eq('role','professeur').eq('actif',true)
    setProfs(u || [])
    // Load today performances
    const { data: perfs } = await supabase.from('performances').select('*, recrees(*)').eq('date_jour', today)
    const perfMap = {}
    ;(perfs||[]).forEach(p => { perfMap[p.prof_id] = p })
    setPerformances(perfMap)
  }

  const getOrCreate = async (profId) => {
    if (performances[profId]) return performances[profId]
    const { data, error } = await supabase.from('performances')
      .upsert({ prof_id: profId, date_jour: today, sacs_accroches: false, preparation: 0 }, { onConflict: 'prof_id,date_jour' })
      .select('*, recrees(*)').single()
    if (data) {
      setPerformances(prev => ({ ...prev, [profId]: data }))
      return data
    }
    return null
  }

  const updateArrival = async (profId, time) => {
    if (performances[profId]?.valide) return
    setSaving(true)
    await supabase.from('performances').upsert({ prof_id: profId, date_jour: today, heure_arrivee: time }, { onConflict: 'prof_id,date_jour' })
    setPerformances(prev => ({ ...prev, [profId]: { ...(prev[profId]||{}), heure_arrivee: time } }))
    setSaving(false)
  }

  const updateDepart = async (profId, time) => {
    if (performances[profId]?.valide) return
    setSaving(true)
    await supabase.from('performances').upsert({ prof_id: profId, date_jour: today, heure_depart: time }, { onConflict: 'prof_id,date_jour' })
    setPerformances(prev => ({ ...prev, [profId]: { ...(prev[profId]||{}), heure_depart: time } }))
    setSaving(false)
  }

  const toggleSacs = async (profId) => {
    if (performances[profId]?.valide) return
    const cur = performances[profId]?.sacs_accroches || false
    await supabase.from('performances').upsert({ prof_id: profId, date_jour: today, sacs_accroches: !cur }, { onConflict: 'prof_id,date_jour' })
    setPerformances(prev => ({ ...prev, [profId]: { ...(prev[profId]||{}), sacs_accroches: !cur } }))
  }

  const toggleRecreeCheck = async (profId, recreeId, checkId) => {
    const perf = performances[profId]
    if (!perf?.id || perf.valide) return
    const existing = perf.recrees?.find(r => r.recree_id === recreeId)
    if (existing) {
      const updated = { ...existing, [checkId]: !existing[checkId] }
      await supabase.from('recrees').update({ [checkId]: !existing[checkId] }).eq('id', existing.id)
      setPerformances(prev => ({
        ...prev,
        [profId]: { ...prev[profId], recrees: prev[profId].recrees.map(r => r.recree_id === recreeId ? updated : r) }
      }))
    } else {
      const newRec = { performance_id: perf.id, recree_id: recreeId, [checkId]: true }
      const { data } = await supabase.from('recrees').insert(newRec).select().single()
      setPerformances(prev => ({
        ...prev,
        [profId]: { ...prev[profId], recrees: [...(prev[profId].recrees||[]), data] }
      }))
    }
  }

  const validerJournee = async (profId) => {
    const perfData = await getOrCreate(profId);
    if (!perfData) return;
    setSaving(true);
    await supabase.from('performances').update({ valide: true }).eq('id', perfData.id);
    setPerformances(prev => ({ ...prev, [profId]: { ...prev[profId], valide: true } }));
    setSaving(false);
  }

  const calcPonct = (perf) => {
    if (!perf?.heure_arrivee) return 0
    return perf.heure_arrivee <= '07:30' ? 30 : perf.heure_arrivee <= '08:00' ? 25 : 0
  }

  const calcGestion = (perf) => {
    let pts = perf?.sacs_accroches ? 4 : 0
    ;(perf?.recrees||[]).forEach(r => {
      const checked = RECREE_CHECKS.filter(c => r[c.id]).length
      pts += checked + (checked === 5 ? 2 : 0)
    })
    return pts
  }

  const calcTotal = (perf) => {
    const ponct = calcPonct(perf)
    const gestion = calcGestion(perf)
    const prep = perf?.preparation || 0
    return Math.max(0, ponct + gestion + prep)
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">Surveillant</div>
          </div>
        </div>
        <div className="topbar-user">
          <span className="role-badge role-surveillant">Surveillant</span>
          <button className="btn-logout" onClick={onLogout}>x</button>
        </div>
      </div>

      <div className="page-content">
        <div className="section-head">
          <div className="section-title">Pointage du jour</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'})}</div>
        </div>

        {profs.map(prof => {
          const perf = performances[prof.id] || {}
          const ponct = calcPonct(perf)
          const gestion = calcGestion(perf)
          const total = calcTotal(perf)
          const barColor = total >= 60 ? 'var(--green)' : total >= 40 ? 'var(--amber)' : 'var(--red)'

          return (
            <div key={prof.id} className="card" style={{marginBottom:12}}>
              <div style={{background:'linear-gradient(135deg,#0d2a3b,#1565a0)',color:'#fff',padding:'.8rem 1rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{prof.prenom} {prof.nom}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.6)',marginTop:2}}>{prof.langue === 'en' ? 'Anglais' : 'Francais'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'monospace',fontSize:20,fontWeight:900,color:'#1AAFE0'}}>{total}/75</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>pts</div>
                </div>
              </div>

              <div style={{padding:'1rem'}}>
                {/* Arrival / Departure */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>Ponctualite ({ponct}/30 pts)</div>
                  <div className="time-row">
                    <span style={{fontSize:12,color:'var(--muted)',width:55}}>Arrivee</span>
                    <input type="time" className="time-input" disabled={perf.valide} value={perf.heure_arrivee||''} onChange={e=>updateArrival(prof.id, e.target.value)} />
                    <span style={{fontSize:11,fontWeight:700,color:ponct===30?'var(--green)':ponct===25?'var(--amber)':'var(--muted)'}}>{ponct} pts</span>
                  </div>
                  <div className="time-row">
                    <span style={{fontSize:12,color:'var(--muted)',width:55}}>Depart</span>
                    <input type="time" className="time-input" disabled={perf.valide} value={perf.heure_depart||''} onChange={e=>updateDepart(prof.id, e.target.value)} />
                    {perf.heure_depart && <span style={{fontSize:11,color:perf.heure_depart>='16:00'?'var(--green)':'var(--red)'}}>{perf.heure_depart >= '16:00' ? 'Conforme' : 'Depart anticipe'}</span>}
                  </div>
                </div>

                {/* Gestion classe */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>Gestion de classe ({gestion}/25 pts)</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <button className={`chk-btn ${perf.sacs_accroches ? 'on' : ''}`} disabled={perf.valide} onClick={()=>toggleSacs(prof.id)}>{perf.sacs_accroches ? '✓' : ''}</button>
                    <span style={{fontSize:12}}>Sacs bien accroches (4 pts)</span>
                  </div>
                  {RECREES.map(recree => {
                    const recData = (perf.recrees||[]).find(r => r.recree_id === recree.id) || {}
                    const checked = RECREE_CHECKS.filter(c => recData[c.id]).length
                    return (
                      <div key={recree.id} style={{background:'var(--bg)',borderRadius:10,padding:'.6rem',marginBottom:6}}>
                        <div style={{fontSize:11,fontWeight:700,marginBottom:6,display:'flex',justifyContent:'space-between'}}>
                          <span>{recree.label}</span>
                          <span style={{color:'var(--accent)'}}>{checked + (checked===5?2:0)}/7 pts</span>
                        </div>
                        {RECREE_CHECKS.map(chk => (
                          <div key={chk.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                            <button className={`chk-btn ${recData[chk.id] ? 'on' : ''}`} disabled={perf.valide} style={{width:22,height:22}} onClick={()=>toggleRecreeCheck(prof.id, recree.id, chk.id)}>{recData[chk.id]?'✓':''}</button>
                            <span style={{fontSize:11,flex:1}}>{chk.label}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* Validation Button */}
                <div style={{marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center'}}>
                  {perf.valide ? (
                    <div style={{color: 'var(--green)', fontSize: 13, fontWeight: 700}}>✅ Journée validée</div>
                  ) : (
                    <button className="btn btn-primary" onClick={() => validerJournee(prof.id)} disabled={saving} style={{width:'100%', padding:'10px'}}>
                      {saving ? '...' : 'Valider la journée'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {profs.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><p>Aucun professeur enregistre. Contactez le directeur.</p></div>}
      </div>
    </div>
  )
}

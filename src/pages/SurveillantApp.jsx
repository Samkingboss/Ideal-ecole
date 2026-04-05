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
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('pointage')
  const [profs, setProfs] = useState([])
  const [performances, setPerformances] = useState({})
  const [preparations, setPreparations] = useState({})
  
  // Discipline states
  const [disciplines, setDisciplines] = useState([])
  const [eleves, setEleves] = useState([])
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [sanctionForm, setSanctionForm] = useState({ pts: 0, type: 'retenue', duree: 10, details: '' })

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: u } = await supabase.from('users').select('*').eq('role','professeur').eq('actif',true)
    setProfs(u || [])
    // Load today performances
    const { data: perfs } = await supabase.from('performances').select('*, recrees(*)').eq('date_jour', today)
    const perfMap = {}
    ;(perfs||[]).forEach(p => { perfMap[p.prof_id] = p })
    setPerformances(perfMap)

    // Load today's preparations (for grading)
    const { data: preps } = await supabase.from('preparations').select('*').eq('date_cours', today)
    const prepMap = {}
    ;(preps||[]).forEach(p => { prepMap[p.user_id] = p })
    setPreparations(prepMap)

    // Load discipline data
    const [{ data: disc }, { data: el }] = await Promise.all([
      supabase.from('disciplines').select('*, eleves(prenom, nom, points_discipline, classes(nom)), users!prof_id(prenom, nom)').order('created_at', { ascending: false }),
      supabase.from('eleves').select('*, classes(nom)').eq('actif', true).order('points_discipline', { ascending: true })
    ])
    setDisciplines(disc || [])
    setEleves(el || [])
  }

  const applyIaNote = async (profId) => {
    const prep = preparations[profId]
    if (!prep || performances[profId]?.valide) return
    setSaving(true)
    const note = prep.note_ia || 0
    await supabase.from('performances').upsert({ prof_id: profId, date_jour: today, preparation: note }, { onConflict: 'prof_id,date_jour' })
    setPerformances(prev => ({ ...prev, [profId]: { ...(prev[profId]||{}), preparation: note } }))
    setSaving(false)
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

  const validateIncident = async () => {
    if (!selectedIncident) return
    setSaving(true)
    const { error: updErr } = await supabase.from('disciplines').update({
      statut: 'validé',
      surveillant_id: user.id,
      points_perdus: sanctionForm.pts,
      sanction_type: sanctionForm.type,
      sanction_duree: sanctionForm.duree,
      sanction_details: sanctionForm.details
    }).eq('id', selectedIncident.id)

    if (!updErr) {
      // Deduct points from student
      const newPts = Math.max(0, (selectedIncident.eleves?.points_discipline || 100) - sanctionForm.pts)
      await supabase.from('eleves').update({ points_discipline: newPts }).eq('id', selectedIncident.eleve_id)
      
      // Notify parent logic could go here
      
      loadData()
      setSelectedIncident(null)
    } else {
      alert('Erreur: ' + updErr.message)
    }
    setSaving(false)
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
          <button className="btn-logout" onClick={onLogout} style={{padding:'4px 12px', fontSize:11, borderRadius:8, width:'auto', height:'auto', marginLeft:10}}>Déconnexion</button>
        </div>
      </div>

      <div className="bottom-nav">
        <button className={`nav-item ${tab==='pointage'?'active':''}`} onClick={()=>setTab('pointage')}>
          <div className="nav-icon">📋</div>
          <span>Pointage</span>
        </button>
        <button className={`nav-item ${tab==='discipline'?'active':''}`} onClick={()=>setTab('discipline')}>
          <div className="nav-icon">⚖️</div>
          <span>Discipline</span>
        </button>
      </div>

      {tab === 'pointage' && (
        <div className="page-content" style={{paddingBottom:80}}>
          <div className="section-head">
            <div className="section-title">Pointage du jour</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'})}</div>
          </div>

          {profs.map(prof => {
            const perf = performances[prof.id] || {}
            const ponct = calcPonct(perf)
            const gestion = calcGestion(perf)
            const total = calcTotal(perf)

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

                  <div style={{marginBottom:15, padding:10, background:'rgba(26,175,224,.05)', borderRadius:12}}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>📚 Préparation IA ({perf.preparation || 0}/20 pts)</div>
                    {preparations[prof.id] ? (
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12, fontWeight:700, color:'var(--accent)'}}>Note IA : {preparations[prof.id].note_ia}/20</div>
                          <div style={{fontSize:10, color:'var(--muted)', fontStyle:'italic'}}>"{preparations[prof.id].commentaire_ia}"</div>
                        </div>
                        <button className="btn-sm" disabled={perf.valide || perf.preparation === preparations[prof.id].note_ia} onClick={() => applyIaNote(prof.id)}>
                          {perf.preparation === preparations[prof.id].note_ia ? 'Appliquée' : 'Appliquer'}
                        </button>
                      </div>
                    ) : (
                      <div style={{fontSize:11, color:'var(--red)'}}>Pas de préparation reçue pour aujourd'hui</div>
                    )}
                  </div>

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
      )}

      {tab === 'discipline' && (
        <div className="page-content" style={{paddingBottom:80}}>
          <div className="section-head">
            <div className="section-title">⚖️ Gestion Discipline</div>
            <div style={{fontSize:11, color:'var(--muted)'}}>{eleves.filter(e => e.points_discipline < 100).length} élèves signalés</div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
            <div className="kpi-card kpi-amber" style={{padding:'12px'}}>
              <div style={{fontSize:20, fontWeight:900}}>{eleves.filter(e => e.points_discipline <= 50 && e.points_discipline > 20).length}</div>
              <div style={{fontSize:10}}>TIG / Convocation</div>
            </div>
            <div className="kpi-card kpi-pink" style={{padding:'12px'}}>
              <div style={{fontSize:20, fontWeight:900}}>{eleves.filter(e => e.points_discipline <= 20).length}</div>
              <div style={{fontSize:10}}>Retenue Samedi</div>
            </div>
          </div>

          <div className="card-header" style={{background:'transparent', padding:'0 0 10px 4px', fontSize:12, fontWeight:800}}>Signalements à valider</div>
          {disciplines.filter(d => d.statut === 'signalé').length === 0 ? (
            <div className="empty-state" style={{padding:'2rem'}}>
              <div className="empty-icon">✅</div>
              <p>Aucun incident en attente.</p>
            </div>
          ) : disciplines.filter(d => d.statut === 'signalé').map(d => (
            <div key={d.id} className="card" style={{marginBottom:10, borderLeft:'4px solid '+(d.gravite==='grave'?'var(--red)':'var(--amber)')}}>
              <div style={{padding:'12px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                  <span style={{fontSize:12, fontWeight:800}}>{d.eleves?.prenom} {d.eleves?.nom}</span>
                  <span className={`chip ${d.gravite==='grave'?'chip-red':'chip-amber'}`} style={{fontSize:9}}>{d.gravite}</span>
                </div>
                <div style={{fontSize:11, color:'var(--muted)', marginBottom:10}}>Signalé par: {d.users?.prenom} {d.users?.nom}</div>
                <div style={{background:'rgba(0,0,0,0.03)', padding:8, borderRadius:8, fontSize:11, fontStyle:'italic', marginBottom:12}}>
                  "{d.motif}"
                </div>
                <button className="btn-sm" style={{width:'100%', background:'var(--accent)', color:'#fff', border:'none'}} onClick={() => {
                  setSelectedIncident(d)
                  const ptsDict = { mineure: 5, moyenne: 15, grave: 30, blâme: 50, exclusion: 50 }
                  setSanctionForm({ pts: ptsDict[d.gravite]||5, type: d.gravite==='grave'?'samedi':'retenue', duree: 10, details: '' })
                }}>Valider & Sanctionner</button>
              </div>
            </div>
          ))}

          <div className="card-header" style={{background:'transparent', padding:'20px 0 10px 4px', fontSize:12, fontWeight:800}}>Élèves surveillés (moins de 50 pts)</div>
          {eleves.filter(e => e.points_discipline < 50).map(el => (
            <div key={el.id} className="card" style={{marginBottom:8, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div className="avatar" style={{width:30, height:30, fontSize:10, background: el.points_discipline <= 20 ? 'var(--red)' : 'var(--amber)', color:'#fff'}}>{el.points_discipline}</div>
                <div>
                  <div style={{fontSize:12, fontWeight:700}}>{el.prenom} {el.nom}</div>
                  <div style={{fontSize:10, color:'var(--muted)'}}>{el.classes?.nom}</div>
                </div>
              </div>
              {el.points_discipline <= 20 && <span className="chip chip-red" style={{fontSize:9}}>⚠️ SAMEDI</span>}
            </div>
          ))}

          <div className="card-header" style={{background:'transparent', padding:'20px 0 10px 4px', fontSize:12, fontWeight:800}}>📜 Historique des Sanctions</div>
          {disciplines.filter(d => d.statut === 'validé').length === 0 ? (
            <div style={{fontSize:11, color:'var(--muted)', textAlign:'center', padding:20}}>Aucun historique.</div>
          ) : disciplines.filter(d => d.statut === 'validé').slice(0, 20).map(d => (
            <div key={d.id} className="card" style={{marginBottom:8, padding:12, opacity:0.8}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                <span style={{fontSize:12, fontWeight:700}}>{d.eleves?.prenom} {d.eleves?.nom}</span>
                <span style={{fontSize:10, color:'var(--red)', fontWeight:800}}>-{d.points_perdus} pts</span>
              </div>
              <div style={{fontSize:10, color:'var(--muted)'}}>Motif: {d.motif}</div>
              <div style={{fontSize:10, marginTop:4, color:'var(--accent)', fontWeight:600}}>
                Punition: {d.sanction_type} {d.sanction_duree ? `(${d.sanction_duree} min)` : ''}
              </div>
              <div style={{fontSize:9, color:'var(--muted)', marginTop:4, textAlign:'right'}}>
                Validé le {new Date(d.created_at).toLocaleDateString('fr-FR')} à {new Date(d.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedIncident && (
        <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setSelectedIncident(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Valider la sanction</div>
            <div style={{fontSize:12, marginBottom:16, color:'var(--muted)'}}>Élève: <b>{selectedIncident.eleves?.prenom} {selectedIncident.eleves?.nom}</b></div>
            
            <div className="form-group">
              <label className="form-label">Points à retirer</label>
              <input type="number" className="form-input" value={sanctionForm.pts} onChange={e => setSanctionForm({...sanctionForm, pts: parseInt(e.target.value)||0})} />
            </div>

            <div className="form-group">
              <label className="form-label">Type de Sanction</label>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {[['retenue','Retenue'],['tig','TIG'],['samedi','Retenue Samedi']].map(([v,l])=>(
                  <div key={v} onClick={()=>setSanctionForm({...sanctionForm, type:v})} style={{flex:1, textAlign:'center', padding:8, borderRadius:10, fontSize:11, fontWeight:600, border:'1.5px solid '+(sanctionForm.type===v?'var(--accent)':'var(--border)'), background:sanctionForm.type===v?'rgba(26,175,224,.1)':'var(--bg)', color:sanctionForm.type===v?'var(--accent)':'var(--muted)', cursor:'pointer'}}>{l}</div>
                ))}
              </div>
            </div>

            {sanctionForm.type === 'retenue' && (
              <div className="form-group">
                <label className="form-label">Durée (minutes)</label>
                <div style={{display:'flex', gap:6}}>
                  {[10, 20, 30].map(m => (
                    <div key={m} onClick={()=>setSanctionForm({...sanctionForm, duree:m})} style={{flex:1, textAlign:'center', padding:8, borderRadius:10, fontSize:11, fontWeight:600, border:'1.5px solid '+(sanctionForm.duree===m?'var(--accent)':'var(--border)'), background:sanctionForm.duree===m?'rgba(26,175,224,.1)':'var(--bg)', color:sanctionForm.duree===m?'var(--accent)':'var(--muted)', cursor:'pointer'}}>{m} min</div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observations / Détails</label>
              <textarea className="form-input" rows={2} value={sanctionForm.details} onChange={e => setSanctionForm({...sanctionForm, details: e.target.value})} placeholder="Ex: Nettoyage de la cour, etc." />
            </div>

            <button className="btn btn-primary" onClick={validateIncident} disabled={saving}>{saving ? 'Validation...' : 'Confirmer la sanction'}</button>
            <button className="btn-cancel" onClick={() => setSelectedIncident(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

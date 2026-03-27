import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const TABS = [
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'checkpoint', icon:'✅', label:'Check-point' },
  { id:'progression', icon:'📈', label:'Progression' },
  { id:'messages', icon:'💬', label:'Messages' },
  { id:'perfs', icon:'⭐', label:'Mes Perfs' },
]

export default function ProfApp({ user, onLogout }) {
  const [tab, setTab] = useState('agenda')
  const [classes, setClasses] = useState([])
  const [periodes, setPeriodes] = useState([])
  const [eleves, setEleves] = useState([])
  const [planifications, setPlanifications] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [selectedClasse, setSelectedClasse] = useState(null)
  const [selectedPeriode, setSelectedPeriode] = useState(null)
  const [showCpModal, setShowCpModal] = useState(false)
  const [cpEntries, setCpEntries] = useState({})
  const [cpDate, setCpDate] = useState(new Date().toISOString().slice(0,10))
  const [msgEleve, setMsgEleve] = useState(null)
  const [msgType, setMsgType] = useState('comportement')
  const [msgBody, setMsgBody] = useState('')
  const [schoolNum] = useState('22390190007')
  const [loading, setLoading] = useState(false)
  const [myPerfs, setMyPerfs] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [{ data: cl }, { data: per }, { data: profClasses }, { data: ev }, { data: docs }] = await Promise.all([
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('periodes').select('*').order('ordre'),
      supabase.from('prof_classes').select('*, classes(*)').eq('user_id', user.id),
      supabase.from('evenements').select('*').order('date_event', { ascending: true }),
      supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
    ])
    setPeriodes(per || [])
    // Filter classes for this prof
    let myClasses = cl || []
    if (profClasses && profClasses.length > 0) {
      const myClassIds = profClasses.map(pc => pc.classe_id)
      myClasses = myClasses.filter(c => myClassIds.includes(c.id))
    }
    setClasses(myClasses)
    if (myClasses.length > 0) setSelectedClasse(myClasses[0])
    if (per && per.length > 0) setSelectedPeriode(per[0])
    // Load all eleves
    const { data: el } = await supabase.from('eleves').select('*').eq('actif', true)
    setEleves(el || [])
    
    setEvenements(ev || [])
    if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)

    // Load planifications for this prof's langue
    const { data: pl } = await supabase.from('planifications')
      .select('*, classes(nom), periodes(nom), objectifs(*)')
      .eq('langue', user.langue || 'fr')
    setPlanifications(pl || [])
    // Load checkpoints by this prof
    const { data: cp } = await supabase.from('checkpoints')
      .select('*, progressions(*, eleves(prenom,nom), objectifs(discipline,description))')
      .eq('prof_id', user.id)
      .order('date_checkpoint', { ascending: false })
    setCheckpoints(cp || [])
    // Load performances
    const { data: perfsData } = await supabase.from('performances')
      .select('*').eq('prof_id', user.id).order('date_jour', { ascending: false }).limit(30)
    setMyPerfs(perfsData || [])
  }

  const getCurrentPlan = () => {
    if (!selectedClasse || !selectedPeriode) return null
    return planifications.find(p => p.classe_id === selectedClasse.id && p.periode_id === selectedPeriode.id)
  }

  const getClasseEleves = () => {
    if (!selectedClasse) return []
    return eleves.filter(e => e.classe_id === selectedClasse.id)
  }

  const openCheckpoint = () => {
    const plan = getCurrentPlan()
    if (!plan) return
    const classEleves = getClasseEleves()
    const entries = {}
    classEleves.forEach(el => {
      entries[el.id] = {}
      plan.objectifs.forEach(obj => { entries[el.id][obj.id] = 0 })
    })
    // Pre-fill from last checkpoint
    const lastCp = checkpoints.find(cp => {
      const p = planifications.find(pl => pl.id === cp.planification_id)
      return p && p.classe_id === selectedClasse.id && p.periode_id === selectedPeriode.id
    })
    if (lastCp) {
      lastCp.progressions.forEach(pr => {
        if (!entries[pr.eleve_id]) entries[pr.eleve_id] = {}
        entries[pr.eleve_id][pr.objectif_id] = pr.pourcentage
      })
    }
    setCpEntries(entries)
    setCpDate(new Date().toISOString().slice(0,10))
    setShowCpModal(true)
  }

  const saveCheckpoint = async () => {
    const plan = getCurrentPlan()
    if (!plan) return
    setLoading(true)
    const { data: cpData, error } = await supabase.from('checkpoints')
      .insert({ planification_id: plan.id, prof_id: user.id, date_checkpoint: cpDate })
      .select().single()
    if (error) { setLoading(false); return }
    const progressions = []
    Object.entries(cpEntries).forEach(([eleveId, objectives]) => {
      Object.entries(objectives).forEach(([objId, pct]) => {
        progressions.push({ checkpoint_id: cpData.id, eleve_id: eleveId, objectif_id: objId, pourcentage: pct })
      })
    })
    await supabase.from('progressions').insert(progressions)
    setShowCpModal(false)
    loadData()
    setLoading(false)
  }

  const getProgressionData = () => {
    if (!selectedClasse || !selectedPeriode) return []
    const plan = getCurrentPlan()
    if (!plan) return []
    const classCps = checkpoints.filter(cp => {
      const p = planifications.find(pl => pl.id === cp.planification_id)
      return p && p.classe_id === selectedClasse.id && p.periode_id === selectedPeriode.id
    }).sort((a,b) => a.date_checkpoint.localeCompare(b.date_checkpoint))
    return classCps.map(cp => {
      const allPcts = cp.progressions.map(pr => pr.pourcentage)
      const avg = allPcts.length ? Math.round(allPcts.reduce((a,b)=>a+b,0)/allPcts.length) : 0
      return { date: cp.date_checkpoint.slice(5), moyenne: avg }
    })
  }

  const getEleveProgress = (eleveId) => {
    const plan = getCurrentPlan()
    if (!plan) return { avg: 0, byDiscipline: {} }
    const classCps = checkpoints.filter(cp => {
      const p = planifications.find(pl => pl.id === cp.planification_id)
      return p && p.classe_id === selectedClasse?.id && p.periode_id === selectedPeriode?.id
    }).sort((a,b) => b.date_checkpoint.localeCompare(a.date_checkpoint))
    if (!classCps.length) return { avg: 0, byDiscipline: {} }
    const lastCp = classCps[0]
    const myProgs = lastCp.progressions.filter(pr => pr.eleve_id === eleveId)
    const all = myProgs.map(pr => pr.pourcentage)
    const avg = all.length ? Math.round(all.reduce((a,b)=>a+b,0)/all.length) : 0
    const byDiscipline = {}
    myProgs.forEach(pr => {
      if (!byDiscipline[pr.objectifs?.discipline]) byDiscipline[pr.objectifs?.discipline] = []
      byDiscipline[pr.objectifs?.discipline].push(pr.pourcentage)
    })
    Object.keys(byDiscipline).forEach(d => {
      const vals = byDiscipline[d]
      byDiscipline[d] = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)
    })
    return { avg, byDiscipline }
  }

  const sendWhatsApp = (eleve) => {
    if (!eleve) return
    const msg = msgBody || `Chers parents de *${eleve.prenom} ${eleve.nom}*,\n\n${msgType === 'comportement' ? 'Nous souhaitons vous informer d un incident.' : 'Voici les resultats de votre enfant.'}\n\n— IDEAL Ecole Internationale Bilingue\n+223 90 19 00 07`
    window.open(`https://wa.me/${schoolNum}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const plan = getCurrentPlan()
  const classEleves = getClasseEleves()

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">{user.prenom} {user.nom}</div>
          </div>
        </div>
        <div className="topbar-user">
          <span className="role-badge role-professeur">{user.langue === 'en' ? 'English' : 'Francais'}</span>
          <button className="btn-logout" onClick={onLogout}>×</button>
        </div>
      </div>

      <div className="page-content">
        {tab === 'agenda' && (
          <>
            <div className="section-head"><div className="section-title">Agenda & Événements</div></div>
            
            {calendrierUrl && (
              <div className="card" style={{marginBottom:16, background:'linear-gradient(135deg,#0d2a3b,#1565a0)', color:'#fff'}}>
                <div style={{padding:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:700, fontSize:14}}>Calendrier Scolaire</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,.7)', marginTop:4}}>Consultez le calendrier officiel</div>
                  </div>
                  <a href={calendrierUrl} target="_blank" rel="noreferrer" style={{background:'#fff', color:'var(--accent)', padding:'6px 12px', borderRadius:20, textDecoration:'none', fontSize:11, fontWeight:700}}>📄 Ouvrir</a>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header">Événements à venir</div>
              <div style={{padding:0}}>
                {evenements.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">📅</div><p>Aucun événement programmé.</p></div>
                ) : evenements.map(ev => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const eventDate = new Date(ev.date_event); eventDate.setHours(0,0,0,0);
                  const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24))
                  const isUrgent = daysDiff >= 0 && daysDiff <= 2
                  return (
                    <div key={ev.id} style={{padding:'12px 14px', borderBottom:'1px solid var(--border)', background: isUrgent ? 'rgba(255,0,0,.05)' : 'transparent', borderLeft: isUrgent ? '3px solid var(--red)' : '3px solid transparent'}}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span style={{fontWeight:700, fontSize:13, color: isUrgent ? 'var(--red)' : 'inherit'}}>{ev.titre}</span>
                        <span style={{fontSize:11, fontWeight:700, color: isUrgent ? 'var(--red)' : 'var(--accent)'}}>{new Date(ev.date_event).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {ev.description && <div style={{fontSize:12, color:'var(--muted)'}}>{ev.description}</div>}
                      {isUrgent && <div style={{fontSize:10, fontWeight:700, color:'var(--red)', marginTop:6}}>⚠️ Alerte : Prévu {daysDiff === 0 ? "aujourd'hui" : daysDiff === 1 ? 'demain' : 'dans 2 jours'} !</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Filters */}
        {tab !== 'agenda' && tab !== 'messages' && tab !== 'perfs' && (
          <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
            <select className="form-select" style={{flex:1,minWidth:120}} value={selectedClasse?.id||''} onChange={e=>setSelectedClasse(classes.find(c=>c.id===e.target.value))}>
              {classes.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select className="form-select" style={{flex:1,minWidth:120}} value={selectedPeriode?.id||''} onChange={e=>setSelectedPeriode(periodes.find(p=>p.id===e.target.value))}>
              {periodes.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
        )}

        {tab === 'checkpoint' && (
          <>
            <div className="section-head">
              <div className="section-title">Check-points</div>
              {plan && <button className="btn-sm" onClick={openCheckpoint}>+ Check-point</button>}
            </div>
            {!plan ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>Aucune planification {user.langue==='en'?'anglais':'francais'} pour {selectedClasse?.nom} - {selectedPeriode?.nom}.</p>
                <p style={{fontSize:12,marginTop:8}}>Contactez le directeur pour charger la planification.</p>
              </div>
            ) : (
              <>
                <div className="card" style={{marginBottom:12}}>
                  <div className="card-header">{plan.classes?.nom} — {plan.periodes?.nom}</div>
                  <div style={{padding:0}}>
                    {plan.pdf_url && (
                      <div style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'rgba(26,175,224,.05)'}}>
                        <a href={plan.pdf_url} target="_blank" rel="noreferrer" style={{color:'var(--accent)', fontSize:13, fontWeight:700, textDecoration:'none'}}>📄 Télécharger la planification (PDF)</a>
                      </div>
                    )}
                    {plan.objectifs?.map(obj => (
                      <div key={obj.id} style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',gap:8}}>
                        <span style={{background:'rgba(26,175,224,.1)',color:'var(--accent)',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700,flexShrink:0}}>{obj.discipline}</span>
                        <span style={{fontSize:12}}>{obj.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Progression overview */}
                {classEleves.map(el => {
                  const prog = getEleveProgress(el.id)
                  const barColor = prog.avg >= 75 ? 'var(--green)' : prog.avg >= 50 ? 'var(--amber)' : 'var(--red)'
                  return (
                    <div key={el.id} style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'.8rem 1rem',marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600}}>{el.prenom} {el.nom}</div>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                            <div className="progress-wrap" style={{flex:1}}>
                              <div className="progress-fill" style={{width:prog.avg+'%',background:barColor}}></div>
                            </div>
                            <div style={{fontSize:12,fontWeight:700,color:barColor,width:35,textAlign:'right'}}>{prog.avg}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {tab === 'progression' && (
          <>
            <div className="section-head"><div className="section-title">Progression</div></div>
            {getProgressionData().length > 0 ? (
              <div className="card" style={{marginBottom:12}}>
                <div className="card-header">Evolution — {selectedClasse?.nom}</div>
                <div style={{padding:'1rem',height:220}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getProgressionData()}>
                      <XAxis dataKey="date" style={{fontSize:10}} />
                      <YAxis domain={[0,100]} tickFormatter={v=>v+'%'} style={{fontSize:10}} />
                      <Tooltip formatter={v=>v+'%'} />
                      <Line type="monotone" dataKey="moyenne" stroke="#1AAFE0" strokeWidth={2} dot={{r:4}} name="Moy. classe" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-icon">📈</div><p>Pas encore de check-points pour cette classe et periode.</p></div>
            )}
            {/* Per student detail */}
            {classEleves.map(el => {
              const prog = getEleveProgress(el.id)
              const barColor = prog.avg >= 75 ? 'var(--green)' : prog.avg >= 50 ? 'var(--amber)' : 'var(--red)'
              return (
                <div key={el.id} className="card" style={{marginBottom:8}}>
                  <div style={{padding:'.8rem 1rem'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700}}>{el.prenom} {el.nom}</div>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                          <div className="progress-wrap" style={{flex:1}}><div className="progress-fill" style={{width:prog.avg+'%',background:barColor}}></div></div>
                          <span style={{fontSize:13,fontWeight:700,color:barColor}}>{prog.avg}%</span>
                        </div>
                      </div>
                    </div>
                    {Object.entries(prog.byDiscipline).map(([disc, pct]) => {
                      const c = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
                      return (
                        <div key={disc} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                          <div style={{fontSize:11,width:100,color:'var(--muted)',flexShrink:0}}>{disc}</div>
                          <div className="progress-wrap" style={{flex:1}}><div className="progress-fill" style={{width:pct+'%',background:c}}></div></div>
                          <span style={{fontSize:11,fontWeight:700,color:c,width:30,textAlign:'right'}}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'messages' && (
          <>
            <div className="section-head"><div className="section-title">Messages parents</div></div>
            <div className="form-group">
              <label className="form-label">Eleve</label>
              <select className="form-select" value={msgEleve?.id||''} onChange={e=>setMsgEleve(classEleves.find(el=>el.id===e.target.value))}>
                <option value="">-- Selectionnez un eleve --</option>
                {classEleves.map(el=><option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type de message</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {[['comportement','📋','Comportement'],['resultats','📊','Resultats'],['libre','✏️','Message libre']].map(([v,icon,label])=>(
                  <div key={v} onClick={()=>setMsgType(v)} style={{background:msgType===v?'rgba(26,175,224,.08)':'var(--bg)',border:`1.5px solid ${msgType===v?'var(--accent)':'var(--border)'}`,borderRadius:12,padding:'.6rem .4rem',textAlign:'center',cursor:'pointer',fontSize:11,fontWeight:600,color:msgType===v?'var(--accent)':'var(--muted)'}}>
                    <div style={{fontSize:20}}>{icon}</div>{label}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-input form-textarea" rows={5} value={msgBody} onChange={e=>setMsgBody(e.target.value)} placeholder={msgEleve ? `Chers parents de ${msgEleve.prenom} ${msgEleve.nom}...` : 'Selectionnez d abord un eleve'} style={{lineHeight:1.6}} />
            </div>
            <button className="btn btn-wa btn-primary" onClick={()=>sendWhatsApp(msgEleve)} disabled={!msgEleve}>
              📲 Envoyer via WhatsApp
            </button>
          </>
        )}

        {tab === 'perfs' && (
          <>
            <div className="section-head"><div className="section-title">Mes Performances</div></div>
            {myPerfs.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">⭐</div><p>Aucune donnee de performance. Le surveillant saisit les informations quotidiennes.</p></div>
            ) : myPerfs.slice(0,10).map(perf => {
              const ponct = perf.heure_arrivee ? (perf.heure_arrivee <= '07:30' ? 30 : perf.heure_arrivee <= '08:00' ? 25 : 0) : 0
              return (
                <div key={perf.id} className="card" style={{marginBottom:8}}>
                  <div style={{padding:'.8rem 1rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{new Date(perf.date_jour).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'})}</div>
                      <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>Arrivee: {perf.heure_arrivee||'—'} · Depart: {perf.heure_depart||'—'}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:ponct>=25?'var(--green)':'var(--red)'}}>{ponct}/30 pts</span>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="bottom-nav">
        {TABS.map(t=>(
          <button key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            <div className="nav-icon">{t.icon}</div>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {showCpModal && plan && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowCpModal(false)}>
          <div className="modal" style={{maxHeight:'88vh'}}>
            <div className="modal-handle"></div>
            <div className="modal-title">Check-point — {selectedClasse?.nom}</div>
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={cpDate} onChange={e=>setCpDate(e.target.value)} /></div>
            {classEleves.map(el => (
              <div key={el.id} style={{background:'var(--bg)',borderRadius:12,padding:'.8rem',marginBottom:.8+'rem'}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:.6+'rem',display:'flex',alignItems:'center',gap:8}}>
                  <div className="avatar av-blue" style={{width:28,height:28,fontSize:11}}>{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                  {el.prenom} {el.nom}
                </div>
                {/* Group by discipline */}
                {Object.entries(
                  plan.objectifs.reduce((acc, obj) => {
                    if (!acc[obj.discipline]) acc[obj.discipline] = []
                    acc[obj.discipline].push(obj)
                    return acc
                  }, {})
                ).map(([disc, objs]) => (
                  <div key={disc} style={{marginBottom:8}}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{disc}</div>
                    {objs.map(obj => (
                      <div key={obj.id} className="obj-row">
                        <div className="obj-label">{obj.description}</div>
                        <input type="range" min="0" max="100" step="10"
                          value={cpEntries[el.id]?.[obj.id] || 0}
                          onChange={e => setCpEntries(prev => ({...prev, [el.id]: {...(prev[el.id]||{}), [obj.id]: parseInt(e.target.value)}}))}
                        />
                        <div className="obj-pct">{cpEntries[el.id]?.[obj.id] || 0}%</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            <button className="btn btn-primary" onClick={saveCheckpoint} disabled={loading}>{loading?'Enregistrement...':'Enregistrer'}</button>
            <button className="btn-cancel" onClick={()=>setShowCpModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

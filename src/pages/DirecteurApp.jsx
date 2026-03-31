import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PerformancesDirecteur from './PerformancesDirecteur'
import AgendaCalendrier from './AgendaCalendrier'

const TABS = [
  { id:'dashboard', icon:'📊', label:'Tableau de bord' },
  { id:'profs', icon:'👥', label:'Equipe' },
  { id:'eleves', icon:'🎒', label:'Eleves' },
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'perfs', icon:'⭐', label:'Performances' },
  { id:'synthese', icon:'📊', label:'Synthèse' },
]

export default function DirecteurApp({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState({ profs:0, eleves:0, checkpoints:0 })
  const [profs, setProfs] = useState([])
  const [eleves, setEleves] = useState([])
  const [classes, setClasses] = useState([])
  const [periodes, setPeriodes] = useState([])
  const [planifications, setPlanifications] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresGlobal, setJoursOuvresGlobal] = useState(20)
  const [showModal, setShowModal] = useState(null)
  const [newProf, setNewProf] = useState({ prenom:'', nom:'', role:'professeur', langue:'fr', code_acces:'', plafond_salaire: 180000 })
  const [newEleve, setNewEleve] = useState({ prenom:'', nom:'', classe_id:'' })
  const [newPlan, setNewPlan] = useState({ classe_id:'', periode_id:'', langue:'fr', objectives:[] })
  const [newEvenement, setNewEvenement] = useState({ titre:'', date_event:'', description:'' })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preparations, setPreparations] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [syntheseData, setSyntheseData] = useState([])
  const [activeSyntheseClass, setActiveSyntheseClass] = useState(null)
  const [activeEleveClass, setActiveEleveClass] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [{ data: u }, { data: el }, { data: cl }, { data: per }, { data: pl }, { data: ev }, { data: docs }, { data: param }, { data: prep }, { data: cp }] = await Promise.all([
      supabase.from('users').select('*').neq('role','directeur').eq('actif',true),
      supabase.from('eleves').select('*, classes(nom)').eq('actif',true),
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('periodes').select('*').order('ordre'),
      supabase.from('planifications').select('*, classes(nom), periodes(nom), objectifs(*)'),
      supabase.from('evenements').select('*').order('date_event', { ascending: true }),
      supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
      supabase.from('parametres_mois').select('*').eq('mois', currentMoisStr).maybeSingle(),
      supabase.from('preparations').select('*, users(prenom, nom), classes(nom)').order('heure_depot', { ascending: false }),
      supabase.from('checkpoints').select('*')
    ])
    if (param) setJoursOuvresGlobal(param.jours_ouvres);
    setPreparations(prep || [])

    setProfs(u || [])
    setEleves(el || [])
    setClasses(cl || [])
    setPeriodes(per || [])
    setPlanifications(pl || [])
    setEvenements(ev || [])
    if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)
    setStats({ profs: (u||[]).length, eleves: (el||[]).length, checkpoints: (cp||[]).length })
    setCheckpoints(cp || [])
    if (cl && cl.length > 0) setNewEleve(p => ({ ...p, classe_id: cl[0].id }))
    if (cl && cl.length > 0) setNewPlan(p => ({ ...p, classe_id: cl[0].id, periode_id: per?.[0]?.id || '' }))

    // Load curriculum data for synthesis
    const { data: allMats } = await supabase.from('matieres').select('*, objectifs_v2(*, competences(*))')
    const { data: allProgs } = await supabase.from('progressions').select('*, eleves(classe_id), competences(objectif_id)')
    
    // Group analysis
    const analysis = []
    cl.forEach(c => {
      const cMats = (allMats || []).filter(m => m.classe_id === c.id)
      const cProgs = (allProgs || []).filter(p => p.eleves?.classe_id === c.id)
      
      const matStats = cMats.map(m => {
        const mCompIds = m.objectifs_v2?.flatMap(o => o.competences?.map(co => co.id)) || []
        const mProgs = cProgs.filter(p => mCompIds.includes(p.competence_id))
        const avg = mProgs.length ? Math.round(mProgs.reduce((acc,p)=>acc+p.pourcentage,0)/mProgs.length) : 0
        return { nom: m.nom, avg }
      }).sort((a,b) => b.avg - a.avg)
      
      analysis.push({ classe: c.nom, stats: matStats })
    })
    setSyntheseData(analysis)
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  const saveProf = async () => {
    setLoading(true)
    const code = newProf.code_acces || generateCode()
    const { error } = await supabase.from('users').insert({ ...newProf, code_acces: code, actif: true })
    if (error) { setMsg('Erreur: ' + error.message) } else { setMsg('Compte cree! Code: ' + code); loadData(); setShowModal(null) }
    setLoading(false)
  }

  const saveJoursOuvres = async () => {
    setLoading(true);
    const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const { error } = await supabase.from('parametres_mois').upsert({ mois: currentMoisStr, jours_ouvres: joursOuvresGlobal }, { onConflict: 'mois' });
    if (error) setMsg('Erreur: ' + error.message);
    else setMsg('Configurations financières mises à jour !');
    setLoading(false);
  }

  const saveEleve = async () => {
    setLoading(true)
    const { error } = await supabase.from('eleves').insert({ ...newEleve, actif: true })
    if (error) { setMsg('Erreur: ' + error.message) } else { loadData(); setShowModal(null) }
    setLoading(false)
  }

  const saveEvenement = async () => {
    if (!newEvenement.titre || !newEvenement.date_event) { setMsg('Titre et date obligatoires'); return }
    setLoading(true)
    const { error } = await supabase.from('evenements').insert({ ...newEvenement })
    if (error) { setMsg('Erreur: ' + error.message) } else { loadData(); setShowModal(null); setNewEvenement({titre:'',date_event:'',description:''}) }
    setLoading(false)
  }

  const handleUploadPDF = async (e, type, planId = null) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${type}_${Math.random()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file)
    if (uploadError) { setMsg('Erreur upload: ' + uploadError.message); setUploading(false); return }
    
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)
    
    if (type === 'calendrier') {
      await supabase.from('documents').insert({ nom: file.name, url: publicUrl, type: 'calendrier' })
      setCalendrierUrl(publicUrl)
      setMsg('Calendrier mis à jour !')
    } else if (type === 'planification' && planId) {
      await supabase.from('planifications').update({ pdf_url: publicUrl }).eq('id', planId)
      loadData()
      setMsg('PDF de planification ajouté !')
    }
    setUploading(false)
  }

  const addObjective = () => {
    setNewPlan(p => ({ ...p, objectives: [...p.objectives, { discipline:'', description:'' }] }))
  }

  const savePlan = async () => {
    if (!newPlan.objectives.filter(o => o.description.trim()).length) { setMsg('Ajoutez au moins un objectif'); return }
    setLoading(true)
    const { data: planData, error: planErr } = await supabase.from('planifications')
      .upsert({ classe_id: newPlan.classe_id, periode_id: newPlan.periode_id, langue: newPlan.langue, created_by: user.id }, { onConflict: 'classe_id,periode_id,langue' })
      .select().single()
    if (planErr) { setMsg('Erreur planification: ' + planErr.message); setLoading(false); return }
    // delete old objectives
    await supabase.from('objectifs').delete().eq('planification_id', planData.id)
    // insert new
    const objs = newPlan.objectives.filter(o => o.description.trim()).map((o, i) => ({ planification_id: planData.id, discipline: o.discipline || 'General', description: o.description, ordre: i }))
    await supabase.from('objectifs').insert(objs)
    setMsg('Planification enregistree!')
    loadData()
    setShowModal(null)
    setLoading(false)
  }

  const deleteProf = async (id) => {
    await supabase.from('users').update({ actif: false }).eq('id', id)
    loadData()
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">ECOLE INTERNATIONALE BILINGUE</div>
          </div>
        </div>
        <div className="topbar-user">
          <span className="role-badge role-directeur">Directeur</span>
          <button className="btn-logout" onClick={onLogout}>Deconnexion</button>
        </div>
      </div>

      <div className="page-content">
        {msg && <div className="error-msg" style={{background:'rgba(141,198,63,.1)',borderColor:'var(--green)',color:'var(--green)',marginBottom:'1rem'}} onClick={()=>setMsg('')}>{msg}</div>}

        {tab === 'dashboard' && (
          <>
            <div className="section-head"><div className="section-title">Tableau de bord</div></div>
            <div className="section-head"><div className="section-title">Tableau de bord</div></div>
            <div className="kpi-grid">
              <div className="kpi-card kpi-accent"><div className="kpi-value">{stats.profs}</div><div className="kpi-label">Enseignants</div></div>
              <div className="kpi-card kpi-green"><div className="kpi-value">{stats.eleves}</div><div className="kpi-label">Eleves</div></div>
              <div className="kpi-card kpi-amber"><div className="kpi-value">{stats.checkpoints}</div><div className="kpi-label">Check-points</div></div>
              <div className="kpi-card kpi-pink"><div className="kpi-value">{classes.length}</div><div className="kpi-label">Classes</div></div>
            </div>
            
            <div className="card">
              <div className="card-header">Activités récentes (Préparations)</div>
              <div className="card-body" style={{padding:'0'}}>
                {(preparations || []).length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">📝</div><p>Aucune préparation de cours déposée.</p></div>
                ) : preparations.slice(0, 5).map(pre => (
                  <div key={pre.id} className="user-row">
                    <div className="avatar av-amber">{(pre.users?.prenom?.[0]||'')+(pre.users?.nom?.[0]||'')}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>{pre.users?.prenom} {pre.users?.nom}</div>
                      <div style={{fontSize:11,color:'var(--muted)'}}>Déposé le {new Date(pre.heure_depot).toLocaleDateString()} pour {pre.classes?.nom}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'profs' && (
          <>
            <div className="section-head">
              <div className="section-title">Equipe</div>
              <button className="btn-sm" onClick={()=>{setNewProf({prenom:'',nom:'',role:'professeur',langue:'fr',code_acces:''});setShowModal('prof')}}>+ Ajouter</button>
            </div>
            {profs.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👥</div><p>Aucun membre. Ajoutez des professeurs et surveillants.</p></div>
            ) : profs.map((p, i) => (
              <div key={p.id} className="card">
                <div className="user-row">
                  <div className={`avatar ${['av-blue','av-green','av-amber','av-pink'][i%4]}`}>{(p.prenom[0]||'')+((p.nom||'')[0]||'')}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{p.prenom} {p.nom}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                      Code: <b style={{color:'var(--accent)'}}>{p.code_acces}</b> &middot; {p.role}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexDirection:'column',alignItems:'flex-end'}}>
                    <span className={`chip ${p.role==='professeur'?'chip-blue':'chip-amber'}`}>{p.role}</span>
                    {p.langue && <span className="chip chip-green">{p.langue==='fr'?'FR':p.langue==='en'?'EN':'FR+EN'}</span>}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'eleves' && (
          <>
            <div className="section-head">
              <div className="section-title">Gestion des Eleves</div>
              <button className="btn-sm" onClick={()=>setShowModal('eleve')}>+ Ajouter un élève</button>
            </div>
            {classes.map(cls => {
              const clsEleves = eleves.filter(e => e.classe_id === cls.id)
              const isActive = activeEleveClass === cls.id
              return (
                <div key={cls.id} className="card" style={{marginBottom:12, overflow:'hidden', borderRadius:16, border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)', transition:'all 0.2s'}}>
                  <div 
                    onClick={() => setActiveEleveClass(isActive ? null : cls.id)}
                    style={{padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background: isActive ? 'rgba(26,175,224,.05)' : 'var(--bg)'}}
                  >
                    <div style={{display:'flex', alignItems:'center', gap:12}}>
                      <div className="avatar av-blue" style={{width:32, height:32, fontSize:12}}>{cls.nom.slice(0,2)}</div>
                      <div style={{display:'flex', flexDirection:'column'}}>
                        <span style={{fontWeight:800, fontSize:14, color: isActive ? 'var(--accent)' : 'var(--text)'}}>{cls.nom}</span>
                        <span style={{fontSize:11, color:'var(--muted)'}}>{clsEleves.length} élève{clsEleves.length>1?'s':''}</span>
                      </div>
                    </div>
                    <span style={{fontSize:18, color:'var(--muted)', transform: isActive ? 'rotate(180deg)' : 'none', transition:'0.3s'}}>⌄</span>
                  </div>
                  
                  {isActive && (
                    <div style={{padding:'0', borderTop:'1px solid var(--border)'}}>
                      {clsEleves.length === 0 ? (
                        <div style={{fontSize:12, color:'var(--muted)', textAlign:'center', padding:'2rem'}}>Aucun élève dans cette classe.</div>
                      ) : clsEleves.map(el => (
                        <div key={el.id} className="user-row" style={{borderBottom:'1px solid var(--border)', padding:'10px 18px'}}>
                          <div className="avatar av-blue" style={{width:28, height:28, fontSize:10}}>{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                          <div style={{flex:1, fontWeight:600, fontSize:13}}>{el.prenom} {el.nom}</div>
                          <button onClick={async () => { if(confirm('Sûr ?')) { await supabase.from('eleves').update({actif:false}).eq('id', el.id); loadData() } }} style={{background:'none', border:'none', color:'var(--red)', fontSize:18, cursor:'pointer'}}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {eleves.length === 0 && <div className="empty-state"><div className="empty-icon">🎒</div><p>Aucun eleve enregistré</p></div>}
          </>
        )}


        {tab === 'agenda' && (
          <AgendaCalendrier checkpoints={checkpoints} classes={classes} periodes={periodes} isAdmin={true} />
        )}


        {tab === 'perfs' && (
          <PerformancesDirecteur />
        )}

        {tab === 'synthese' && (
          <>
            <div className="section-head"><div className="section-title">Synthèse des Programmes</div></div>
            {syntheseData.map(c => {
              const isActive = activeSyntheseClass === c.classe
              return (
                <div key={c.classe} className="card" style={{marginBottom:12, overflow:'hidden', borderRadius:16, border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)', transition:'all 0.2s'}}>
                  <div 
                    onClick={() => setActiveSyntheseClass(isActive ? null : c.classe)}
                    style={{padding:'14px 18px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background: isActive ? 'rgba(26,175,224,.05)' : 'var(--bg)'}}
                  >
                    <div style={{display:'flex', alignItems:'center', gap:12}}>
                      <div className="avatar av-blue" style={{width:32, height:32, fontSize:12}}>{c.classe.slice(0,2)}</div>
                      <span style={{fontWeight:800, fontSize:14, color: isActive ? 'var(--accent)' : 'var(--text)'}}>{c.classe} — Performance par matière</span>
                    </div>
                    <span style={{fontSize:18, color:'var(--muted)', transform: isActive ? 'rotate(180deg)' : 'none', transition:'0.3s'}}>⌄</span>
                  </div>
                  
                  {isActive && (
                    <div style={{padding:'1rem', borderTop:'1px solid var(--border)', background:'rgba(255,255,255,0.02)'}}>
                      {c.stats.length === 0 ? (
                        <div style={{fontSize:12, color:'var(--muted)', textAlign:'center', padding:'1rem'}}>Aucune donnée pour cette classe.</div>
                      ) : (
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
                          {c.stats.map(s => {
                            const col = s.avg >= 75 ? 'var(--green)' : s.avg >= 50 ? 'var(--amber)' : 'var(--red)'
                            return (
                              <div key={s.nom} style={{background:'var(--card)', borderRadius:12, padding:12, border:'1px solid var(--border)', boxShadow:'0 2px 5px rgba(0,0,0,0.02)'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                                  <span style={{fontSize:12, fontWeight:700, color:'var(--text)'}}>{s.nom}</span>
                                  <span style={{fontSize:12, fontWeight:900, color:col}}>{s.avg}%</span>
                                </div>
                                <div style={{height:6, background:'rgba(0,0,0,0.05)', borderRadius:10, overflow:'hidden'}}>
                                  <div style={{height:'100%', width:s.avg+'%', background:col}}></div>
                                </div>
                                <div style={{fontSize:10, color:col, marginTop:6, fontWeight:700, display:'flex', alignItems:'center', gap:4}}>
                                  {s.avg >= 75 ? '🌟 Excellence' : s.avg >= 50 ? '📈 En progrès' : '⚠️ Difficultés'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="bottom-nav">
        {TABS.map(t => (
          <button key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            <div className="nav-icon">{t.icon}</div>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {showModal === 'prof' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouveau membre de l'équipe</div>
            <div className="form-group"><label className="form-label">Prénom</label><input className="form-input" value={newProf.prenom} onChange={e=>setNewProf({...newProf,prenom:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Nom</label><input className="form-input" value={newProf.nom} onChange={e=>setNewProf({...newProf,nom:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Rôle</label>
              <select className="form-select" value={newProf.role} onChange={e=>setNewProf({...newProf,role:e.target.value})}>
                <option value="professeur">Professeur / Enseignant</option>
                <option value="surveillant">Surveillant</option>
              </select>
            </div>

            {newProf.role === 'professeur' && (
              <div className="form-group">
                <label className="form-label">Catégorie de paie (Mensuel)</label>
                <select className="form-select" value={newProf.plafond_salaire || 180000} onChange={e=>setNewProf({...newProf, plafond_salaire: parseInt(e.target.value, 10)})}>
                  <option value="180000">Professeur du primaire (180.000 FCFA)</option>
                  <option value="150000">Maîtresse (150.000 FCFA)</option>
                  <option value="80000">Assistante (80.000 FCFA)</option>
                </select>
              </div>
            )}

            {newProf.role === 'professeur' && (
              <div className="form-group">
                <label className="form-label">Langue enseignee</label>
                <select className="form-select" value={newProf.langue} onChange={e=>setNewProf({...newProf,langue:e.target.value})}>
                  <option value="fr">Francais</option>
                  <option value="en">Anglais</option>
                  <option value="both">Les deux</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Code d acces (laisser vide pour generer)</label>
              <input className="form-input code-input" value={newProf.code_acces} onChange={e=>setNewProf({...newProf,code_acces:e.target.value.toUpperCase()})} placeholder="Auto-genere" maxLength={12} />
            </div>
            <button className="btn btn-primary" onClick={saveProf} disabled={loading}>{loading?'...':'Creer le compte'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {showModal === 'eleve' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouvel eleve</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Prenom</label><input className="form-input" value={newEleve.prenom} onChange={e=>setNewEleve({...newEleve,prenom:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Nom</label><input className="form-input" value={newEleve.nom} onChange={e=>setNewEleve({...newEleve,nom:e.target.value})} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Classe</label>
              <select className="form-select" value={newEleve.classe_id} onChange={e=>setNewEleve({...newEleve,classe_id:e.target.value})}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={saveEleve} disabled={loading}>{loading?'...':'Ajouter'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {showModal === 'evenement' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouvel événement</div>
            <div className="form-group"><label className="form-label">Titre de l événement</label><input className="form-input" value={newEvenement.titre} onChange={e=>setNewEvenement({...newEvenement,titre:e.target.value})} placeholder="Ex: Réunion Parents-Profs" /></div>
            <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={newEvenement.date_event} onChange={e=>setNewEvenement({...newEvenement,date_event:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Description (optionnel)</label><textarea className="form-input" value={newEvenement.description} onChange={e=>setNewEvenement({...newEvenement,description:e.target.value})} rows={3} /></div>
            <button className="btn btn-primary" onClick={saveEvenement} disabled={loading}>{loading?'...':'Enregistrer'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

    </div>
  )
}

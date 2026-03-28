import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PerformancesDirecteur from './PerformancesDirecteur'

const TABS = [
  { id:'dashboard', icon:'📊', label:'Tableau de bord' },
  { id:'profs', icon:'👥', label:'Equipe' },
  { id:'eleves', icon:'🎒', label:'Eleves' },
  { id:'planning', icon:'📋', label:'Planification' },
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'perfs', icon:'⭐', label:'Performances' },
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

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [{ data: u }, { data: el }, { data: cl }, { data: per }, { data: pl }, { data: ev }, { data: docs }, { data: param }, { data: prep }] = await Promise.all([
      supabase.from('users').select('*').neq('role','directeur').eq('actif',true),
      supabase.from('eleves').select('*, classes(nom)').eq('actif',true),
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('periodes').select('*').order('ordre'),
      supabase.from('planifications').select('*, classes(nom), periodes(nom), objectifs(*)'),
      supabase.from('evenements').select('*').order('date_event', { ascending: true }),
      supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
      supabase.from('parametres_mois').select('*').eq('mois', currentMoisStr).maybeSingle(),
      supabase.from('preparations').select('*, users(prenom, nom), classes(nom)').order('heure_depot', { ascending: false })
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
    setStats({ profs: (u||[]).length, eleves: (el||[]).length, checkpoints: 0 })
    if (cl && cl.length > 0) setNewEleve(p => ({ ...p, classe_id: cl[0].id }))
    if (cl && cl.length > 0) setNewPlan(p => ({ ...p, classe_id: cl[0].id, periode_id: per?.[0]?.id || '' }))
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
            <div className="kpi-grid">
              <div className="kpi-card kpi-accent"><div className="kpi-value">{stats.profs}</div><div className="kpi-label">Enseignants</div></div>
              <div className="kpi-card kpi-green"><div className="kpi-value">{stats.eleves}</div><div className="kpi-label">Eleves</div></div>
              <div className="kpi-card kpi-amber"><div className="kpi-value">{planifications.length}</div><div className="kpi-label">Planifications</div></div>
              <div className="kpi-card kpi-pink"><div className="kpi-value">{classes.length}</div><div className="kpi-label">Classes</div></div>
            </div>
            <div className="card">
              <div className="card-header">Planifications chargees</div>
              <div className="card-body" style={{padding:'0'}}>
                {planifications.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">📋</div><p>Aucune planification encore</p></div>
                ) : planifications.map(pl => (
                  <div key={pl.id} className="user-row">
                    <div className={`avatar ${pl.langue==='fr'?'av-blue':'av-green'}`}>{pl.langue.toUpperCase()}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>{pl.classes?.nom} — {pl.periodes?.nom}</div>
                      <div style={{fontSize:11,color:'var(--muted)'}}>{pl.objectifs?.length || 0} objectifs</div>
                    </div>
                    <span className={`chip ${pl.langue==='fr'?'chip-blue':'chip-green'}`}>{pl.langue==='fr'?'Francais':'Anglais'}</span>
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
              <div className="section-title">Eleves</div>
              <button className="btn-sm" onClick={()=>setShowModal('eleve')}>+ Ajouter</button>
            </div>
            {classes.map(cls => {
              const clsEleves = eleves.filter(e => e.classe_id === cls.id)
              if (!clsEleves.length) return null
              return (
                <div key={cls.id} className="card" style={{marginBottom:12}}>
                  <div className="card-header">{cls.nom} — {clsEleves.length} eleve{clsEleves.length>1?'s':''}</div>
                  <div style={{padding:0}}>
                    {clsEleves.map(el => (
                      <div key={el.id} className="user-row">
                        <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                        <div style={{flex:1,fontWeight:600,fontSize:13}}>{el.prenom} {el.nom}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {eleves.length === 0 && <div className="empty-state"><div className="empty-icon">🎒</div><p>Aucun eleve enregistre</p></div>}
          </>
        )}

        {tab === 'planning' && (
          <>
            <div className="section-head">
              <div className="section-title">Planification</div>
              <button className="btn-sm" onClick={()=>{setNewPlan({classe_id:classes[0]?.id||'',periode_id:periodes[0]?.id||'',langue:'fr',objectives:[{discipline:'',description:''},{discipline:'',description:''},{discipline:'',description:''}]});setShowModal('plan')}}>+ Nouvelle</button>
            </div>
            {planifications.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📋</div><p>Aucune planification. Importez depuis un PDF ou saisissez les objectifs.</p></div>
            ) : planifications.map(pl => (
              <div key={pl.id} className="card" style={{marginBottom:10}}>
                <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{pl.classes?.nom} — {pl.periodes?.nom}</span>
                  <span className={`chip ${pl.langue==='fr'?'chip-blue':'chip-green'}`}>{pl.langue==='fr'?'FR':'EN'}</span>
                </div>
                <div style={{padding:0}}>
                  {pl.pdf_url && (
                    <div style={{padding:'8px 14px', borderBottom:'1px solid var(--border)', background: 'rgba(26,175,224,.05)'}}>
                      <a href={pl.pdf_url} target="_blank" rel="noreferrer" style={{color:'var(--accent)', fontSize: 13, fontWeight: 700, textDecoration:'none'}}>📄 Voir le document de planification (PDF)</a>
                    </div>
                  )}
                  {(pl.objectifs||[]).map(obj => (
                    <div key={obj.id} style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{background:'rgba(26,175,224,.1)',color:'var(--accent)',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700,flexShrink:0}}>{obj.discipline}</span>
                      <span style={{fontSize:13}}>{obj.description}</span>
                    </div>
                  ))}
                  <div style={{padding:'8px 14px', display:'flex', alignItems:'center', gap: 10}}>
                    <label style={{fontSize: 11, color: 'var(--muted)', cursor:'pointer', border:'1px dotted var(--border)', padding:'4px 8px', borderRadius: 4}}>
                      + Joindre un PDF
                      <input type="file" accept=".pdf" style={{display:'none'}} onChange={e => handleUploadPDF(e, 'planification', pl.id)} />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'agenda' && (
          <>
            <div className="section-head"><div className="section-title">Agenda & Configuration</div></div>
            
            <div className="card" style={{marginBottom:16, background:'rgba(26,175,224,.05)'}}>
              <div className="card-header" style={{color:'var(--accent)'}}>Finance : Jours ouvrés du mois en cours</div>
              <div style={{padding:'1rem'}}>
                <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Ce chiffre sert de base absolue pour le calcul du salaire des professeurs ce mois-ci. Vous pouvez le modifier pour déduire les congés ou vacances du mois.</p>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <input type="number" className="form-input" style={{width:80}} value={joursOuvresGlobal} onChange={e => setJoursOuvresGlobal(parseInt(e.target.value, 10))} />
                  <span style={{fontSize:13, fontWeight:600}}>jours réels de travail</span>
                  <button className="btn-sm" onClick={saveJoursOuvres} disabled={loading} style={{marginLeft:'auto', background:'var(--accent)', color:'#fff', border:'none'}}>{loading?'...':'Sauvegarder'}</button>
                </div>
              </div>
            </div>

            <div className="card" style={{marginBottom:16}}>
              <div className="card-header">Calendrier Scolaire (PDF)</div>
              <div style={{padding:'1rem'}}>
                {calendrierUrl ? (
                  <div style={{marginBottom:10}}>
                    <a href={calendrierUrl} target="_blank" rel="noreferrer" className="btn-sm" style={{textDecoration:'none',background:'var(--accent)',color:'#fff'}}>📄 Ouvrir le calendrier officiel (PDF)</a>
                  </div>
                ) : <p style={{fontSize:13,color:'var(--muted)'}}>Aucun calendrier uploadé pour le moment.</p>}
                <div style={{marginTop:10}}>
                  <label className="form-label" style={{display:'block', marginBottom:4}}>Remplacer ou définir le calendrier :</label>
                  <label className="btn-sm" style={{cursor:'pointer', display:'inline-block'}}>
                    Importer un PDF
                    <input type="file" accept=".pdf" style={{display:'none'}} onChange={e => handleUploadPDF(e, 'calendrier')} disabled={uploading} />
                  </label>
                  {uploading && <span style={{fontSize:12,color:'var(--accent)',marginLeft:10}}>Upload en cours...</span>}
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>Événements Majeurs</span>
                <button className="btn-sm" onClick={() => setShowModal('evenement')}>+ Ajouter événement</button>
              </div>
              <div style={{padding:0}}>
                {evenements.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">📅</div><p>Aucun événement programmé.</p></div>
                ) : evenements.map(ev => (
                  <div key={ev.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:13}}>{ev.titre}</span>
                      <span style={{fontSize:11,color:'var(--accent)',fontWeight:700}}>{new Date(ev.date_event).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {ev.description && <div style={{fontSize:12,color:'var(--muted)'}}>{ev.description}</div>}
                    <button onClick={async () => { await supabase.from('evenements').delete().eq('id', ev.id); loadData() }} style={{background:'none',border:'none',color:'var(--red)',fontSize:11,cursor:'pointer',padding:0,marginTop:6,textDecoration:'underline'}}>Supprimer</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}


        {tab === 'perfs' && (
          <PerformancesDirecteur />
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

      {showModal === 'plan' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouvelle planification</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Classe</label>
                <select className="form-select" value={newPlan.classe_id} onChange={e=>setNewPlan({...newPlan,classe_id:e.target.value})}>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Periode</label>
                <select className="form-select" value={newPlan.periode_id} onChange={e=>setNewPlan({...newPlan,periode_id:e.target.value})}>
                  {periodes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Langue</label>
              <select className="form-select" value={newPlan.langue} onChange={e=>setNewPlan({...newPlan,langue:e.target.value})}>
                <option value="fr">Francais</option>
                <option value="en">Anglais</option>
              </select>
            </div>
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Objectifs par discipline</div>
              {newPlan.objectives.map((obj, i) => (
                <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'flex-start'}}>
                  <input className="form-input" style={{width:120,flexShrink:0,fontSize:12}} placeholder="Discipline" value={obj.discipline} onChange={e=>{const o=[...newPlan.objectives];o[i]={...o[i],discipline:e.target.value};setNewPlan({...newPlan,objectives:o})}} />
                  <input className="form-input" style={{flex:1,fontSize:12}} placeholder="Decrire l objectif..." value={obj.description} onChange={e=>{const o=[...newPlan.objectives];o[i]={...o[i],description:e.target.value};setNewPlan({...newPlan,objectives:o})}} />
                  <button onClick={()=>setNewPlan({...newPlan,objectives:newPlan.objectives.filter((_,j)=>j!==i)})} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:18,padding:0,flexShrink:0}}>×</button>
                </div>
              ))}
              <button onClick={addObjective} style={{width:'100%',padding:'8px',background:'transparent',border:'1.5px dashed var(--border)',borderRadius:10,color:'var(--muted)',fontSize:12,cursor:'pointer',marginTop:4}}>+ Ajouter un objectif</button>
            </div>
            <button className="btn btn-primary" onClick={savePlan} disabled={loading}>{loading?'Enregistrement...':'Enregistrer'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

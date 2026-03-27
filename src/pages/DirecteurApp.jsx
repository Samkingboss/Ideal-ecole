import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TABS = [
  { id:'dashboard', icon:'📊', label:'Tableau de bord' },
  { id:'profs', icon:'👥', label:'Equipe' },
  { id:'eleves', icon:'🎒', label:'Eleves' },
  { id:'planning', icon:'📋', label:'Planification' },
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
  const [showModal, setShowModal] = useState(null)
  const [newProf, setNewProf] = useState({ prenom:'', nom:'', role:'professeur', langue:'fr', code_acces:'' })
  const [newEleve, setNewEleve] = useState({ prenom:'', nom:'', classe_id:'' })
  const [newPlan, setNewPlan] = useState({ classe_id:'', periode_id:'', langue:'fr', objectives:[] })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [{ data: u }, { data: el }, { data: cl }, { data: per }, { data: pl }] = await Promise.all([
      supabase.from('users').select('*').neq('role','directeur').eq('actif',true),
      supabase.from('eleves').select('*, classes(nom)').eq('actif',true),
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('periodes').select('*').order('ordre'),
      supabase.from('planifications').select('*, classes(nom), periodes(nom), objectifs(*)'),
    ])
    setProfs(u || [])
    setEleves(el || [])
    setClasses(cl || [])
    setPeriodes(per || [])
    setPlanifications(pl || [])
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

  const saveEleve = async () => {
    setLoading(true)
    const { error } = await supabase.from('eleves').insert({ ...newEleve, actif: true })
    if (error) { setMsg('Erreur: ' + error.message) } else { loadData(); setShowModal(null) }
    setLoading(false)
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
                  {(pl.objectifs||[]).map(obj => (
                    <div key={obj.id} style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{background:'rgba(26,175,224,.1)',color:'var(--accent)',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700,flexShrink:0}}>{obj.discipline}</span>
                      <span style={{fontSize:13}}>{obj.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'perfs' && (
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <p>Consultez les performances dans l onglet Stats de l application mobile.</p>
          </div>
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
            <div className="modal-title">Nouveau compte</div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={newProf.role} onChange={e=>setNewProf({...newProf,role:e.target.value})}>
                <option value="professeur">Professeur</option>
                <option value="surveillant">Surveillant</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Prenom</label><input className="form-input" value={newProf.prenom} onChange={e=>setNewProf({...newProf,prenom:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Nom</label><input className="form-input" value={newProf.nom} onChange={e=>setNewProf({...newProf,nom:e.target.value})} /></div>
            </div>
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

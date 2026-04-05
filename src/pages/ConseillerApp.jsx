import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ConseillerApp({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [eleves, setEleves] = useState([])
  const [classes, setClasses] = useState([])
  const [disciplines, setDisciplines] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [presences, setPresences] = useState({})
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(null)
  const [selectedClass, setSelectedClass] = useState(null)
  const [newEleve, setNewEleve] = useState({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', adresse:'', photo_url:'', classe_id:'' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [
      { data: el },
      { data: cl },
      { data: disc },
      { data: cp },
      { data: pres }
    ] = await Promise.all([
      supabase.from('eleves').select('*, classes(nom)').eq('actif', true).order('nom'),
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('disciplines').select('*, users!prof_id(prenom, nom)').eq('date_incident', today),
      supabase.from('checkpoints').select('*, planification:planifications(classe_id), progressions(eleve_id, pourcentage, objectifs(nom))').eq('date_checkpoint', today),
      supabase.from('presences_eleves').select('*').eq('date_jour', today)
    ])
    
    setEleves(el || [])
    setClasses(cl || [])
    setDisciplines(disc || [])
    setCheckpoints(cp || [])
    
    const pMap = {}
    ;(pres || []).forEach(p => { pMap[p.eleve_id] = p })
    setPresences(pMap)
    
    if (cl && cl.length > 0 && !selectedClass) setSelectedClass(cl[0].id)
    if (cl && cl.length > 0 && !newEleve.classe_id) setNewEleve(prev => ({ ...prev, classe_id: cl[0].id }))
    setLoading(false)
  }

  const saveEleve = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // On nettoie l'objet pour ne garder que les champs nécessaires
    const cleanEleve = {
      prenom: newEleve.prenom,
      nom: newEleve.nom,
      sexe: newEleve.sexe,
      date_naissance: newEleve.date_naissance || null,
      parent_nom: newEleve.parent_nom,
      parent_phone: newEleve.parent_phone,
      adresse: newEleve.adresse,
      photo_url: newEleve.photo_url || null,
      classe_id: newEleve.classe_id,
      actif: true
    }

    const { error } = await supabase.from('eleves').insert([cleanEleve])
    if (!error) {
      setShowModal(null)
      setNewEleve({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', adresse:'', photo_url:'', classe_id: classes[0]?.id || '' })
      loadData()
    } else {
      alert("Erreur base de données : " + error.message)
    }
    setLoading(false)
  }

  const markPresence = async (eleveId, statut, minutes = 0, justification = null) => {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.from('presences_eleves').upsert({
      eleve_id: eleveId,
      date_jour: today,
      statut,
      minutes_retard: minutes,
      justification
    }, { onConflict: 'eleve_id, date_jour' }).select().single()

    if (!error) {
      setPresences(prev => ({ ...prev, [eleveId]: data }))
    }
  }

  const generateCartography = (eleve) => {
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    const pres = presences[eleve.id]
    const disc = disciplines.filter(d => d.eleve_id === eleve.id)
    const studentCps = checkpoints.filter(cp => cp.planification?.classe_id === eleve.classe_id)
    
    let msg = `✨ *Bilan Quotidien - IDEAL École* ✨\n`
    msg += `📅 *${today}*\n`
    msg += `👤 Élève : *${eleve.prenom} ${eleve.nom}*\n\n`

    msg += `📍 *Assiduité* : `
    if (!pres) msg += `Non renseigné\n`
    else if (pres.statut === 'present') msg += `✅ Présent(e)\n`
    else if (pres.statut === 'absent') msg += `❌ Absent(e)${pres.justification ? ` (Justifié: ${pres.justification})` : ' (Non justifié)'}\n`
    else msg += `⏰ Arrivée tardive (${pres.minutes_retard} min)\n`
    msg += `\n`

    msg += `📚 *Scolarité* :\n`
    if (studentCps.length === 0) msg += `- Cours normaux dispensés\n`
    else {
      studentCps.forEach(cp => {
        const prog = cp.progressions?.find(p => p.eleve_id === eleve.id)
        if (prog) msg += `- ${prog.objectifs?.nom || 'Leçon'} : ${prog.pourcentage}%\n`
      })
    }
    msg += `\n`

    msg += `⚖️ *Discipline* :\n`
    if (disc.length === 0) msg += `- RAS : Exemplaire ✅\n`
    else {
      disc.forEach(d => {
        msg += `- ${d.motif} (-${d.points_perdus} pts)\n`
      })
    }
    msg += `🛡️ Capital restant : *${eleve.points_discipline}/100*\n\n`
    msg += `🚀 Bonne soirée !\n_Vie Scolaire IDEAL_`
    
    const url = `https://wa.me/${eleve.parent_phone?.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">Conseiller Vie Scolaire</div>
          </div>
        </div>
        <div className="topbar-user">
          <span className="role-badge" style={{background:'var(--accent)', color:'#fff'}}>CVS</span>
          <button className="btn-logout" onClick={onLogout} style={{marginLeft:10}}>Déconnexion</button>
        </div>
      </div>

      <div className="bottom-nav">
        <button className={`nav-item ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')}>
          <div className="nav-icon">📊</div>
          <span>Stats</span>
        </button>
        <button className={`nav-item ${tab==='inscriptions'?'active':''}`} onClick={()=>setTab('inscriptions')}>
          <div className="nav-icon">🎒</div>
          <span>Inscriptions</span>
        </button>
        <button className={`nav-item ${tab==='pointage'?'active':''}`} onClick={()=>setTab('pointage')}>
          <div className="nav-icon">⏰</div>
          <span>Pointage</span>
        </button>
        <button className={`nav-item ${tab==='bilans'?'active':''}`} onClick={()=>setTab('bilans')}>
          <div className="nav-icon">📱</div>
          <span>Bilans</span>
        </button>
      </div>

      <div className="page-content" style={{paddingBottom:100}}>
        {tab === 'dashboard' && (
          <>
            <div className="section-head"><div className="section-title">Tableau de Bord</div></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
              <div className="kpi-card kpi-accent">
                <div className="kpi-value">{eleves.length}</div>
                <div className="kpi-label">Élèves inscrits</div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='present').length}</div>
                <div className="kpi-label">Présents ce matin</div>
              </div>
              <div className="kpi-card kpi-amber">
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='retard').length}</div>
                <div className="kpi-label">En retard</div>
              </div>
              <div className="kpi-card kpi-pink">
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='absent').length}</div>
                <div className="kpi-label">Absents</div>
              </div>
            </div>
          </>
        )}

        {tab === 'inscriptions' && (
          <>
            <div className="section-head">
              <div className="section-title">Gestion des Élèves</div>
              <button className="btn-sm" onClick={()=>{setNewEleve({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', adresse:'', photo_url:'', classe_id:classes[0]?.id || '' }); setShowModal('eleve')}}>+ Ajouter</button>
            </div>
            {classes.map(cls => (
              <div key={cls.id} className="card" style={{marginBottom:10}}>
                <div className="card-header">{cls.nom}</div>
                <div className="card-body">
                  {eleves.filter(e => e.classe_id === cls.id).map(el => (
                    <div key={el.id} className="user-row">
                      <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700, fontSize:13}}>{el.prenom} {el.nom}</div>
                        <div style={{fontSize:10, color:'var(--muted)'}}>{el.parent_phone}</div>
                      </div>
                      <button className="btn-sm" onClick={()=>{setNewEleve({...el}); setShowModal('eleve')}}>✏️</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'pointage' && (
          <>
            <div className="section-head">
              <div className="section-title">Pointage & Retards</div>
              <select className="form-input" style={{width:'auto'}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            {eleves.filter(e => e.classe_id === selectedClass).map(el => {
              const p = presences[el.id] || {}
              return (
                <div key={el.id} className="card" style={{marginBottom:10, padding:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                    <div style={{fontWeight:700}}>{el.prenom} {el.nom}</div>
                    <div className={`chip ${p.statut==='present'?'chip-green':p.statut==='absent'?'chip-red':p.statut==='retard'?'chip-amber':''}`}>{p.statut || 'Non pointé'}</div>
                  </div>
                  <div style={{display:'flex', gap:6}}>
                    <button className="btn-sm" style={{flex:1, background:p.statut==='present'?'var(--green)':'#eee', color:p.statut==='present'?'#fff':'#333'}} onClick={()=>markPresence(el.id,'present')}>P</button>
                    <button className="btn-sm" style={{flex:1, background:p.statut==='absent'?'var(--red)':'#eee', color:p.statut==='absent'?'#fff':'#333'}} onClick={()=>{
                      const motif = prompt('Motif de l\'absence ? (Laisser vide si non justifiée)')
                      markPresence(el.id, 'absent', 0, motif)
                    }}>A</button>
                    <button className="btn-sm" style={{flex:1, background:p.statut==='retard'?'var(--amber)':'#eee', color:p.statut==='retard'?'#fff':'#333'}} onClick={()=>{
                      const now = new Date()
                      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
                      const diff = Math.max(0, Math.floor((now - start) / 60000))
                      markPresence(el.id, 'retard', diff)
                    }}>R {p.minutes_retard ? `(${p.minutes_retard}')` : ''}</button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'bilans' && (
          <>
            <div className="section-head">
              <div className="section-title">Envoi des Bilans</div>
              <select className="form-input" style={{width:'auto'}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            {eleves.filter(e => e.classe_id === selectedClass).map(el => (
              <div key={el.id} className="card" style={{marginBottom:10, padding:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700}}>{el.prenom} {el.nom}</div>
                  <div style={{fontSize:10, color:'var(--muted)'}}>Tél: {el.parent_phone || 'Non renseigné'}</div>
                </div>
                <button className="btn-sm" style={{background:'#25D366', color:'#fff', border:'none'}} onClick={()=>generateCartography(el)} disabled={!el.parent_phone}>
                  Envoyer 📲
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {showModal === 'eleve' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">{newEleve.id ? 'Modifier' : 'Ajouter'} un élève</div>
            <form onSubmit={saveEleve}>
              <div className="form-group"><label className="form-label">Prénom</label><input className="form-input" value={newEleve.prenom} onChange={e=>setNewEleve({...newEleve, prenom:e.target.value})} required/></div>
              <div className="form-group"><label className="form-label">Nom</label><input className="form-input" value={newEleve.nom} onChange={e=>setNewEleve({...newEleve, nom:e.target.value})} required/></div>
              <div className="form-group">
                <label className="form-label">Sexe</label>
                <div style={{display:'flex', gap:10}}>
                  <button type="button" className={`btn-sm ${newEleve.sexe==='M'?'active':''}`} onClick={()=>setNewEleve({...newEleve, sexe:'M'})}>Masculin</button>
                  <button type="button" className={`btn-sm ${newEleve.sexe==='F'?'active':''}`} onClick={()=>setNewEleve({...newEleve, sexe:'F'})}>Féminin</button>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Date de Naissance</label><input type="date" className="form-input" value={newEleve.date_naissance} onChange={e=>setNewEleve({...newEleve, date_naissance:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Classe</label>
                <select className="form-input" value={newEleve.classe_id} onChange={e=>setNewEleve({...newEleve, classe_id:e.target.value})} required>
                  <option value="">Sélectionner</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <hr style={{margin:'20px 0', border:'none', borderTop:'1px solid #eee'}}/>
              <div className="form-group"><label className="form-label">Nom du Parent / Tuteur</label><input className="form-input" value={newEleve.parent_nom} onChange={e=>setNewEleve({...newEleve, parent_nom:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Téléphone Parent (WhatsApp)</label><input className="form-input" value={newEleve.parent_phone} onChange={e=>setNewEleve({...newEleve, parent_phone:e.target.value})} placeholder="+223..."/></div>
              <div className="form-group"><label className="form-label">Adresse</label><textarea className="form-input" value={newEleve.adresse} onChange={e=>setNewEleve({...newEleve, adresse:e.target.value})} /></div>
              
              <div style={{display:'flex', gap:10, marginTop:10}}>
                <button className="btn btn-primary" type="submit" disabled={loading}>{loading?'...':'Enregistrer'}</button>
                <button type="button" className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

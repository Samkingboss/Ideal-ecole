import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ConseillerApp({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [selectedTrimester, setSelectedTrimester] = useState('T3')
  const [retardStats, setRetardStats] = useState([])
  const [eleves, setEleves] = useState([])
  const [classes, setClasses] = useState([])
  const [disciplines, setDisciplines] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [presences, setPresences] = useState({})
  const [devoirs, setDevoirs] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(null)
  const [selectedClass, setSelectedClass] = useState(null)
  const [newEleve, setNewEleve] = useState({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', parent2_nom:'', parent2_phone:'', adresse:'', photo_url:'', classe_id:'' })

  const TRIMESTRES = {
    T1: { start: '2025-09-01', end: '2025-12-31', label: '1er Trimestre' },
    T2: { start: '2026-01-01', end: '2026-03-31', label: '2ème Trimestre' },
    T3: { start: '2026-04-01', end: '2026-06-30', label: '3ème Trimestre' }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (tab === 'retards') loadRetardStats() }, [tab, selectedTrimester, selectedClass])

  const loadRetardStats = async () => {
    if (!selectedClass) return
    setLoading(true)
    const period = TRIMESTRES[selectedTrimester]
    
    const { data, error } = await supabase
      .from('presences_eleves')
      .select('eleve_id, minutes_retard, eleves(prenom, nom, classe_id)')
      .eq('statut', 'retard')
      .gte('date_jour', period.start)
      .lte('date_jour', period.end)

    if (!error) {
      // Filtrer par classe (car le join via select ne filtre pas la racine)
      const classRetards = (data || []).filter(r => r.eleves?.classe_id === selectedClass)
      
      // Aggréger par élève
      const stats = {}
      // Initialiser tous les élèves de la classe à 0
      eleves.filter(e => e.classe_id === selectedClass).forEach(e => {
        stats[e.id] = { name: `${e.prenom} ${e.nom}`, total: 0 }
      })
      
      classRetards.forEach(r => {
        if (stats[r.eleve_id]) {
          stats[r.eleve_id].total += (r.minutes_retard || 0)
        }
      })
      
      setRetardStats(Object.values(stats).sort((a,b) => b.total - a.total))
    }
    setLoading(false)
  }

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [
      { data: el },
      { data: cl },
      { data: disc },
      { data: cp },
      { data: pres },
      { data: dev }
    ] = await Promise.all([
      supabase.from('eleves').select('*, classes(nom)').eq('actif', true).order('nom'),
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('disciplines').select('*, users!prof_id(prenom, nom)').eq('date_incident', today),
      supabase.from('checkpoints').select('*, planification:planifications(classe_id), progressions(eleve_id, pourcentage, objectifs(nom))').eq('date_checkpoint', today),
      supabase.from('presences_eleves').select('*').eq('date_jour', today),
      supabase.from('devoirs').select('*').gte('date_rendu', today)
    ])
    
    setEleves(el || [])
    setClasses(cl || [])
    setDisciplines(disc || [])
    setCheckpoints(cp || [])
    setDevoirs(dev || [])
    
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
      parent2_nom: newEleve.parent2_nom || '',
      parent2_phone: newEleve.parent2_phone || '',
      adresse: newEleve.adresse,
      photo_url: newEleve.photo_url || null,
      classe_id: newEleve.classe_id,
      actif: true
    }

    const { error } = await supabase.from('eleves').upsert([
      { ...cleanEleve, id: newEleve.id }
    ], { onConflict: 'id' })

    if (!error) {
      setShowModal(null)
      setNewEleve({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', parent2_nom:'', parent2_phone:'', adresse:'', photo_url:'', classe_id: classes[0]?.id || '' })
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

  const generateCartography = (eleve, toGroup = false) => {
    try {
      const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const pres = presences[eleve.id]
      const disc = (disciplines || []).filter(d => d.eleve_id === eleve.id)
      const studentCps = (checkpoints || []).filter(cp => cp.planification?.classe_id === eleve.classe_id)
      const classDevs = (devoirs || []).filter(d => d.classe_id === eleve.classe_id)
      
      let msg = `*BILAN QUOTIDIEN - ÉCOLE IDEAL*\n`
      msg += `Date : *${today}*\n`
      msg += `Élève : *${eleve.prenom} ${eleve.nom}*\n`
      msg += `--------------------------\n`

      // 1. SECTION ASSIDUITÉ (Toujours obligatoire)
      msg += `\n[ ASSIDUITÉ ] : `
      if (!pres) msg += `Non renseigné\n`
      else if (pres.statut === 'present') msg += `PRESENT(E)\n`
      else if (pres.statut === 'absent') msg += `ABSENT(E)${pres.justification ? ` (Justifié: ${pres.justification})` : ' (Non justifié)'}\n`
      else msg += `ARRIVÉE TARDIVE (${pres.minutes_retard} min)\n`
      
      // 2. SECTION PÉDAGOGIQUE (Conditionnelle)
      const hasPedaResults = studentCps.some(cp => cp.progressions?.some(p => p.eleve_id === eleve.id))
      const hasHomework = classDevs.length > 0
      if (hasPedaResults || hasHomework) {
        msg += `\n- - - - - - - - - - - -\n`
        msg += `*SITUATION PÉDAGOGIQUE*\n\n`
        
        if (hasPedaResults) {
          studentCps.forEach(cp => {
            const prog = cp.progressions?.find(p => p.eleve_id === eleve.id)
            if (prog && prog.pourcentage !== undefined) {
              msg += `- ${prog.objectifs?.nom || 'Leçon'} : *${prog.pourcentage}%*\n`
            }
          })
        } else if (hasHomework) {
          msg += `- Voir travail à la maison ci-dessous\n`
        }

        if (hasHomework) {
          msg += `\n[ TRAVAIL À LA MAISON ] :\n`
          classDevs.forEach(d => {
            msg += `> ${d.matiere || 'Devoir'} : ${d.description || 'RAS'}\n`
            msg += `A rendre pour le : ${d.date_rendu ? new Date(d.date_rendu).toLocaleDateString('fr-FR') : '—'}\n`
          })
        }
      }
      
      // 3. SECTION DISCIPLINE (Conditionnelle)
      if (disc.length > 0) {
        msg += `\n- - - - - - - - - - - -\n`
        msg += `*DISCIPLINE*\n`
        disc.forEach(d => {
          msg += `- ${d.motif || 'Incident'} (-${d.points_perdus || 0} pts)\n`
        })
        msg += `Capital restant : *${eleve.points_discipline || 100}/100*\n`
      }
      
      msg += `\n--------------------------\n`
      msg += `À demain pour de nouveaux progrès !\n_Administration IDEAL_`
      
      if (toGroup) {
        // Envoi vers un groupe (ou choix libre du destinataire)
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
      } else {
        // Envoi direct au parent
        let phone = eleve.parent_phone?.replace(/[^\d+]/g, '') || ''
        if (phone.length === 8 && !phone.startsWith('+')) phone = '223' + phone
        if (phone.startsWith('00')) phone = phone.substring(2)
        if (!phone.startsWith('+')) phone = '+' + phone

        if (phone.length < 5) {
          alert("Numéro de téléphone invalide ou manquant pour cet élève.")
          return
        }

        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error(err)
      alert("Erreur lors de la génération du message. Vérifiez les informations de l'élève.")
    }
  }

  const hasDailyInfo = (el) => {
    // Info si : Absence/Retard OU Discipline OU Note
    const p = presences[el.id]
    if (p && p.statut !== 'present') return true
    if (disciplines.some(d => d.eleve_id === el.id)) return true
    if (checkpoints.some(cp => cp.progressions?.some(pr => pr.eleve_id === el.id))) return true
    return false
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
        <button className={`nav-item ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')} aria-label="Tableau de bord">
          <div className="nav-icon">📊</div>
          <span>Stats</span>
        </button>
        <button className={`nav-item ${tab==='inscriptions'?'active':''}`} onClick={()=>setTab('inscriptions')} aria-label="Gestion des inscriptions">
          <div className="nav-icon">🎒</div>
          <span>Élèves</span>
        </button>
        <button className={`nav-item ${tab==='pointage'?'active':''}`} onClick={()=>setTab('pointage')} aria-label="Pointage des présences">
          <div className="nav-icon">⏰</div>
          <span>Pointage</span>
        </button>
        <button className={`nav-item ${tab==='bilans'?'active':''}`} onClick={()=>setTab('bilans')} aria-label="Envoi des bilans quotidiens">
          <div className="nav-icon">📱</div>
          <span>Bilans</span>
        </button>
        <button className={`nav-item ${tab==='retards'?'active':''}`} onClick={()=>setTab('retards')} aria-label="Bilan des retards trimestriels">
          <div className="nav-icon">📝</div>
          <span>Retards</span>
        </button>
      </div>

      <div className="page-content" style={{paddingBottom:100}}>
        {tab === 'dashboard' && (
          <>
            <div className="section-head"><div className="section-title">Tableau de Bord</div></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:25}}>
              <div className="kpi-card kpi-accent">
                <div style={{fontSize:24, marginBottom:8}}>🎒</div>
                <div className="kpi-value">{eleves.length}</div>
                <div className="kpi-label">Inscrits</div>
              </div>
              <div className="kpi-card kpi-green">
                <div style={{fontSize:24, marginBottom:8}}>✅</div>
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='present').length}</div>
                <div className="kpi-label">Présents</div>
              </div>
              <div className="kpi-card kpi-amber">
                <div style={{fontSize:24, marginBottom:8}}>⏰</div>
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='retard').length}</div>
                <div className="kpi-label">Retards</div>
              </div>
              <div className="kpi-card kpi-pink">
                <div style={{fontSize:24, marginBottom:8}}>❌</div>
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='absent').length}</div>
                <div className="kpi-label">Absents</div>
              </div>
            </div>
          </>
        )}

        {tab === 'inscriptions' && (
          <>
            <div className="section-head">
              <div className="section-title">Élèves Inscrits</div>
              <button 
                className="btn btn-primary" 
                style={{width:'auto', padding:'8px 16px', fontSize:13}}
                onClick={()=>{setNewEleve({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', parent2_nom:'', parent2_phone:'', adresse:'', photo_url:'', classe_id:classes[0]?.id || '' }); setShowModal('eleve')}}
              >
                + Ajouter
              </button>
            </div>
            {classes.map(cls => (
              <div key={cls.id} className="card" style={{padding:0, marginBottom:16}}>
                <div className="card-header" style={{background:'var(--bg)', color:'var(--dark)', borderBottom:'1px solid var(--border)', padding:'10px 14px'}}>{cls.nom}</div>
                <div style={{padding:'4px 0'}}>
                  {eleves.filter(e => e.classe_id === cls.id).length === 0 ? (
                    <div style={{padding:20, textAlign:'center', color:'var(--muted)', fontSize:12}}>Aucun élève.</div>
                  ) : (
                    eleves.filter(e => e.classe_id === cls.id).map(el => (
                      <div key={el.id} className="user-row" style={{borderBottom:'1px solid var(--border)'}}>
                        <div className={`avatar ${el.sexe==='F'?'av-pink':'av-blue'}`}>{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700, fontSize:14}}>{el.prenom} {el.nom}</div>
                          <div style={{fontSize:11, color:'var(--muted)', marginTop:2}}>📱 {el.parent_phone}</div>
                        </div>
                        <button className="btn-sm" onClick={()=>{setNewEleve({...el}); setShowModal('eleve')}}>✏️</button>
                      </div>
                    ))
                  )}
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
            {eleves.filter(e => e.classe_id === selectedClass).length === 0 ? (
              <div className="card empty-state">
                <div className="empty-icon">🎒</div>
                Sélectionnez une classe pour commencer le pointage.
              </div>
            ) : (
              eleves.filter(e => e.classe_id === selectedClass).map(el => {
                const p = presences[el.id] || {}
                return (
                  <div key={el.id} className="card" style={{marginBottom:12, padding:14}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
                      <div style={{fontWeight:800, fontSize:15}}>{el.prenom} {el.nom}</div>
                      <div className={`chip ${p.statut==='present'?'chip-green':p.statut==='absent'?'chip-red':p.statut==='retard'?'chip-amber':''}`} style={{fontSize:10, padding:'4px 10px'}}>
                        {p.statut ? p.statut.toUpperCase() : 'À POINTER'}
                      </div>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <button 
                        className="btn" 
                        style={{flex:1, height:42, background:p.statut==='present'?'var(--green)':'var(--bg)', color:p.statut==='present'?'#fff':'var(--text)', border:p.statut==='present'?'none':'1px solid var(--border)'}} 
                        onClick={()=>markPresence(el.id,'present')}
                      >
                        P
                      </button>
                      <button 
                        className="btn" 
                        style={{flex:1, height:42, background:p.statut==='absent'?'var(--red)':'var(--bg)', color:p.statut==='absent'?'#fff':'var(--text)', border:p.statut==='absent'?'none':'1px solid var(--border)'}} 
                        onClick={()=>{
                          const motif = prompt('Motif de l\'absence ? (Laisser vide si non justifiée)')
                          markPresence(el.id, 'absent', 0, motif)
                        }}
                      >
                        A
                      </button>
                      <button 
                        className="btn" 
                        style={{flex:1, height:42, background:p.statut==='retard'?'var(--amber)':'var(--bg)', color:p.statut==='retard'?'#fff':'var(--text)', border:p.statut==='retard'?'none':'1px solid var(--border)'}} 
                        onClick={()=>{
                          const now = new Date()
                          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
                          const diff = Math.max(0, Math.floor((now - start) / 60000))
                          const ms = prompt('Minutes de retard ?', diff)
                          if (ms !== null) markPresence(el.id, 'retard', parseInt(ms, 10) || 0)
                        }}
                      >
                        R {p.statut==='retard' && `(${p.minutes_retard}')`}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {tab === 'bilans' && (
          <>
            <div className="section-head">
              <div className="section-title">Bilans (Informations du jour)</div>
              <select className="form-input" style={{width:'auto'}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            
            <div style={{fontSize:11, color:'var(--muted)', marginBottom:15, padding:'0 5px'}}>
              Note: Seuls les élèves ayant eu un événement (Retard, Absence, Discipline ou Note) s'affichent ici.
            </div>

            {eleves.filter(e => e.classe_id === selectedClass && hasDailyInfo(e)).length === 0 ? (
              <div className="card empty-state">
                <div className="empty-icon">✅</div>
                Aucun élève à bilan aujourd'hui.
              </div>
            ) : (
              eleves.filter(e => e.classe_id === selectedClass && hasDailyInfo(e)).map(el => (
                <div key={el.id} className="card" style={{padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800, fontSize:15}}>{el.prenom} {el.nom}</div>
                    <div style={{display:'flex', gap:6, marginTop:6}}>
                      {presences[el.id]?.statut !== 'present' && presences[el.id] && (
                        <span className="badge badge-red">PRÉSENCE</span>
                      )}
                      {disciplines.some(d => d.eleve_id === el.id) && (
                        <span className="badge badge-amber">DISCIPLINE</span>
                      )}
                      {checkpoints.some(cp => cp.progressions?.some(p => p.eleve_id === el.id)) && (
                        <span className="badge badge-green">NOTES</span>
                      )}
                    </div>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{height:40, padding:'0 15px', width:'auto'}}
                    onClick={()=>generateCartography(el, true)}
                  >
                    🚀 Envoyer
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'retards' && (
          <div className="printable-bilan">
            <div className="section-head no-print">
              <div className="section-title">Bilan Retards</div>
            </div>
            
            <div className="no-print" style={{display:'flex', gap:8, marginBottom:20}}>
              <select className="form-select" value={selectedTrimester} onChange={e=>setSelectedTrimester(e.target.value)}>
                {Object.entries(TRIMESTRES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select className="form-select" value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            <div className="no-print" style={{marginBottom:25}}>
              <button className="btn btn-primary" onClick={() => window.print()} style={{width:'100%'}}>
                <span>🖨️</span> Imprimer le rapport de classe
              </button>
            </div>

            <div className="print-header" style={{textAlign:'center', marginBottom:40}}>
              <div style={{fontSize:28, fontWeight:900, letterSpacing:-1}}>ÉCOLE IDÉAL</div>
              <div style={{fontSize:14, textTransform:'uppercase', letterSpacing:2, color:'var(--muted)', marginTop:5}}>Rapport d'Assiduité Trimestriel</div>
              <div style={{marginTop:20, fontSize:16}}>
                Classe : <strong>{classes.find(c=>c.id===selectedClass)?.nom}</strong> | Période : <strong>{TRIMESTRES[selectedTrimester].label}</strong>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{width:50}}>#</th>
                    <th>Élève</th>
                    <th style={{textAlign:'right'}}>Situation</th>
                  </tr>
                </thead>
                <tbody>
                  {retardStats.length === 0 ? (
                    <tr><td colSpan="3" style={{textAlign:'center', padding:40, color:'var(--muted)'}}>Aucun retard enregistré. ✅</td></tr>
                  ) : (
                    retardStats.map((s, idx) => {
                      let bClass = 'badge-green'
                      if (s.total > 120) bClass = 'badge-red'
                      else if (s.total > 60) bClass = 'badge-orange'
                      else if (s.total > 0) bClass = 'badge-amber'
                      
                      return (
                        <tr key={idx}>
                          <td style={{color:'var(--muted)'}}>{idx + 1}</td>
                          <td>{s.name}</td>
                          <td style={{textAlign:'right'}}>
                            <span className={`badge ${bClass}`}>{s.total} min</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="print-footer" style={{marginTop:60, display:'flex', justifyContent:'flex-end'}}>
              <div style={{textAlign:'center', width:250}}>
                <p style={{fontWeight:700, marginBottom:60}}>Le Conseiller Vie Scolaire</p>
                <div style={{borderBottom:'1px solid #000', width:'100%'}}></div>
                <p style={{fontSize:10, color:'#666', marginTop:10}}>Fait à Bamako, le {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
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
              <div className="form-group"><label className="form-label">Nom du Parent 1</label><input className="form-input" value={newEleve.parent_nom} onChange={e=>setNewEleve({...newEleve, parent_nom:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Téléphone Parent 1 (WhatsApp)</label><input className="form-input" value={newEleve.parent_phone} onChange={e=>setNewEleve({...newEleve, parent_phone:e.target.value})} placeholder="+223..."/></div>
              <div className="form-group"><label className="form-label">Nom du Parent 2</label><input className="form-input" value={newEleve.parent2_nom} onChange={e=>setNewEleve({...newEleve, parent2_nom:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Téléphone Parent 2 (WhatsApp)</label><input className="form-input" value={newEleve.parent2_phone} onChange={e=>setNewEleve({...newEleve, parent2_phone:e.target.value})} placeholder="+223..."/></div>
              <div className="form-group"><label className="form-label">Adresse Résidence</label><textarea className="form-input" value={newEleve.adresse} onChange={e=>setNewEleve({...newEleve, adresse:e.target.value})} /></div>
              
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

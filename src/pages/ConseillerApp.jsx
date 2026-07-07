import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import AgendaCalendrier from './AgendaCalendrier'

// Horaires officiels : arrivée 08h00, départ 16h00
const timeToMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const retardMatin = ha => { const v = timeToMin(ha); return v == null ? 0 : Math.max(0, v - 480) }  // 8h00
const retardSoir  = hd => { const v = timeToMin(hd); return v == null ? 0 : Math.max(0, v - 960) }  // 16h00

// Jours restants avant le prochain anniversaire (récurrent)
const joursAvantAnniv = (dn) => {
  if (!dn) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const [ , mm, jj] = dn.split('-').map(Number)
  let next = new Date(now.getFullYear(), mm - 1, jj)
  if (next < now) next = new Date(now.getFullYear() + 1, mm - 1, jj)
  return Math.round((next - now) / 86400000)
}

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

  // Absence : motif OBLIGATOIRE, 480 min de cours manqués (journée de 8h)
  const markAbsent = async (eleveId) => {
    const motif = prompt("Motif de l'absence (obligatoire) :\nEx : Maladie, Voyage, Rendez-vous, Non justifiée…")
    if (motif === null) return
    if (!motif.trim()) { alert("Le motif de l'absence est obligatoire."); return }
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase.from('presences_eleves').upsert({
      eleve_id: eleveId, date_jour: today, statut: 'absent',
      heure_arrivee: null, heure_depart: null, retard_matin: 0, retard_soir: 0,
      minutes_retard: 480, justification: motif.trim()
    }, { onConflict: 'eleve_id, date_jour' }).select().single()
    if (data) setPresences(prev => ({ ...prev, [eleveId]: data }))
  }

  // Pointage par heures : la plateforme calcule les retards automatiquement
  const savePointage = async (eleveId, patch) => {
    const today = new Date().toISOString().slice(0, 10)
    const cur = presences[eleveId] || {}
    const heure_arrivee = patch.heure_arrivee !== undefined ? patch.heure_arrivee : (cur.heure_arrivee || '')
    const heure_depart  = patch.heure_depart  !== undefined ? patch.heure_depart  : (cur.heure_depart  || '')
    const rm = retardMatin(heure_arrivee), rs = retardSoir(heure_depart)
    let statut = patch.statut
    if (!statut) statut = heure_arrivee ? (rm > 0 ? 'retard' : 'present') : (cur.statut || 'present')
    const row = {
      eleve_id: eleveId, date_jour: today, statut,
      heure_arrivee: heure_arrivee || null, heure_depart: heure_depart || null,
      retard_matin: rm, retard_soir: rs, minutes_retard: rm + rs
    }
    const { data, error } = await supabase.from('presences_eleves').upsert(row, { onConflict: 'eleve_id, date_jour' }).select().single()
    if (!error && data) setPresences(prev => ({ ...prev, [eleveId]: data }))
    else if (error) alert('Erreur : ' + error.message)
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
          <div className="nav-icon" aria-hidden="true">📊</div>
          <span>Stats</span>
        </button>
        <button className={`nav-item ${tab==='inscriptions'?'active':''}`} onClick={()=>setTab('inscriptions')} aria-label="Gestion des inscriptions">
          <div className="nav-icon" aria-hidden="true">🎒</div>
          <span>Inscriptions</span>
        </button>
        <button className={`nav-item ${tab==='pointage'?'active':''}`} onClick={()=>setTab('pointage')} aria-label="Pointage des présences">
          <div className="nav-icon" aria-hidden="true">⏰</div>
          <span>Pointage</span>
        </button>
        <button className={`nav-item ${tab==='agenda'?'active':''}`} onClick={()=>setTab('agenda')} aria-label="Agenda et anniversaires">
          <div className="nav-icon" aria-hidden="true">📅</div>
          <span>Agenda</span>
        </button>
        <button className={`nav-item ${tab==='rapports'?'active':''}`} onClick={()=>setTab('rapports')} aria-label="Rapports hebdomadaires">
          <div className="nav-icon" aria-hidden="true">📄</div>
          <span>Rapports</span>
        </button>
        <button className={`nav-item ${tab==='retards'?'active':''}`} onClick={()=>setTab('retards')} aria-label="Bilan des retards trimestriels">
          <div className="nav-icon" aria-hidden="true">📊</div>
          <span>Retards</span>
        </button>
      </div>

      <div className="page-content" style={{paddingBottom:100}}>
        {tab === 'dashboard' && (
          <>
            <div className="section-head"><div className="section-title">Tableau de Bord</div></div>
            {(() => {
              const proch = eleves
                .map(e => ({ e, j: joursAvantAnniv(e.date_naissance) }))
                .filter(x => x.j !== null && x.j <= 5)
                .sort((a, b) => a.j - b.j)
              if (!proch.length) return null
              return (
                <div style={{background:'linear-gradient(135deg,#EC008C,#b8005f)', color:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:16}}>
                  <div style={{fontWeight:800, fontSize:14, marginBottom:6}}>🎂 Anniversaires à venir (5 jours)</div>
                  {proch.map(({e, j}) => (
                    <div key={e.id} style={{fontSize:12, opacity:.95, marginTop:3}}>
                      {e.prenom} {e.nom} — {j === 0 ? "aujourd'hui 🎉" : j === 1 ? 'demain' : `dans ${j} jours`}
                    </div>
                  ))}
                </div>
              )
            })()}
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
              <button className="btn-sm" onClick={()=>{setNewEleve({ prenom:'', nom:'', sexe:'M', date_naissance:'', parent_nom:'', parent_phone:'', parent2_nom:'', parent2_phone:'', adresse:'', photo_url:'', classe_id:classes[0]?.id || '' }); setShowModal('eleve')}}>+ Ajouter</button>
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
              <div className="section-title">Pointage (arrivée / départ)</div>
              <select className="form-input" style={{width:'auto'}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div style={{fontSize:11, color:'var(--muted)', margin:'-6px 0 12px'}}>
              Horaires : arrivée <b>08h00</b> · départ <b>16h00</b>. Les minutes de retard sont calculées automatiquement.
            </div>
            {eleves.filter(e => e.classe_id === selectedClass).map(el => {
              const p = presences[el.id] || {}
              const rm = p.retard_matin ?? retardMatin(p.heure_arrivee)
              const rs = p.retard_soir ?? retardSoir(p.heure_depart)
              const absent = p.statut === 'absent'
              return (
                <div key={el.id} className="card" style={{marginBottom:10, padding:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                    <div style={{fontWeight:700}}>{el.prenom} {el.nom}</div>
                    <div className={`chip ${absent?'chip-red':(rm>0||rs>0)?'chip-amber':p.heure_arrivee?'chip-green':''}`}>
                      {absent ? 'Absent' : (rm>0||rs>0) ? `Retard ${rm+rs}'` : p.heure_arrivee ? 'À l\'heure' : 'Non pointé'}
                    </div>
                  </div>
                  {!absent && (
                    <div style={{display:'flex', gap:10, marginBottom:8}}>
                      <label style={{flex:1, fontSize:11, color:'var(--muted)'}}>Arrivée (8h)
                        <input type="time" className="form-input" style={{marginTop:3}} value={p.heure_arrivee||''}
                          onChange={e=>savePointage(el.id,{heure_arrivee:e.target.value})}/>
                        {rm>0 && <span style={{color:'var(--red)', fontWeight:700}}>+{rm} min</span>}
                      </label>
                      <label style={{flex:1, fontSize:11, color:'var(--muted)'}}>Départ (16h)
                        <input type="time" className="form-input" style={{marginTop:3}} value={p.heure_depart||''}
                          onChange={e=>savePointage(el.id,{heure_depart:e.target.value})}/>
                        {rs>0 && <span style={{color:'var(--red)', fontWeight:700}}>+{rs} min</span>}
                      </label>
                    </div>
                  )}
                  {absent && (
                    <div style={{fontSize:12, color:'var(--red)', fontWeight:600, marginBottom:8}}>
                      🔴 <b>480 min</b> de cours manqués (journée de 8h)<br/>
                      <span style={{color:'var(--muted)', fontWeight:400}}>Motif : {p.justification || '—'}</span>
                    </div>
                  )}
                  <button className="btn-sm" style={{width:'100%', background:absent?'var(--red)':'#eee', color:absent?'#fff':'#333'}}
                    onClick={()=> absent ? savePointage(el.id,{statut:'present',heure_arrivee:'',heure_depart:''}) : markAbsent(el.id)}>
                    {absent ? '↩ Annuler l\'absence' : '✕ Marquer absent'}
                  </button>
                </div>
              )
            })}
          </>
        )}

        {tab === 'agenda' && (
          <AgendaCalendrier checkpoints={checkpoints} anniversaires={eleves} />
        )}

        {tab === 'rapports' && (
          <>
            <div className="section-head"><div className="section-title">Rapports hebdomadaires</div></div>
            <a href="/rapports.html" style={{textDecoration:'none'}}>
              <div style={{background:'linear-gradient(135deg,#F7941D,#d97706)', color:'#fff', borderRadius:16, padding:'18px 18px', marginBottom:16}}>
                <div style={{fontSize:26}}>📄</div>
                <div style={{fontWeight:800, fontSize:16, marginTop:6}}>Composer les rapports</div>
                <div style={{fontSize:12, opacity:.9, marginTop:2}}>Bulletin hebdomadaire de chaque élève, transmis via IDEAL — le même outil que la direction.</div>
              </div>
            </a>

            <div className="section-head"><div className="section-title">Regard sur les élèves</div>
              <select className="form-input" style={{width:'auto'}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            {eleves.filter(e => e.classe_id === selectedClass).map(el => {
              const p = presences[el.id] || {}
              const jr = joursAvantAnniv(el.date_naissance)
              const nbDisc = disciplines.filter(d => d.eleve_id === el.id).length
              return (
                <div key={el.id} className="card" style={{marginBottom:8, padding:12}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800, fontSize:14}}>{el.prenom} {el.nom}</div>
                      <div style={{fontSize:11, color:'var(--muted)'}}>{classes.find(c=>c.id===el.classe_id)?.nom} · {el.parent_phone||'—'}</div>
                    </div>
                    {el.date_naissance && <span style={{fontSize:10, fontWeight:700, color:'#EC008C'}}>🎂 {jr===0?"aujourd'hui":`J-${jr}`}</span>}
                  </div>
                  <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
                    <span className={`chip ${p.statut==='absent'?'chip-red':(p.retard_matin>0||p.retard_soir>0)?'chip-amber':p.heure_arrivee?'chip-green':''}`} style={{fontSize:10}}>
                      {p.statut==='absent'?'Absent':(p.minutes_retard>0)?`Retard ${p.minutes_retard}'`:p.heure_arrivee?'Présent':'Non pointé'}
                    </span>
                    {nbDisc>0 && <span className="chip chip-amber" style={{fontSize:10}}>{nbDisc} incident(s)</span>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'retards' && (
          <div className="printable-bilan" style={{fontFamily: "'Inter', sans-serif"}}>
            <div className="section-head no-print">
              <div className="section-title" style={{fontWeight:900}}>Bilan Retards</div>
            </div>
            
            <div className="no-print" style={{display:'flex', gap:8, marginBottom:20}}>
              <select className="form-input" style={{flex:1}} value={selectedTrimester} onChange={e=>setSelectedTrimester(e.target.value)}>
                {Object.entries(TRIMESTRES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select className="form-input" style={{flex:1}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            <div className="no-print" style={{marginBottom:25}}>
              <button className="btn btn-primary" onClick={() => window.print()} style={{width:'100%', background:'linear-gradient(135deg, #1AAFE0, #0d2a3b)'}}>
                🖨️ Imprimer le rapport
              </button>
            </div>

            <div className="print-header" style={{textAlign:'center', marginBottom:40}}>
              <h2 style={{fontSize:28, fontWeight:900, letterSpacing:'-1px', margin:0}}>ÉCOLE IDÉAL</h2>
              <div style={{fontSize:12, textTransform:'uppercase', letterSpacing:2, color:'var(--muted)', marginTop:5, marginBottom:15}}>Rapport d'Assiduité Trimestriel</div>
              <p style={{margin:0, fontSize:15}}>Classe : <strong>{classes.find(c=>c.id===selectedClass)?.nom}</strong> | Période : <strong>{TRIMESTRES[selectedTrimester].label}</strong></p>
            </div>

            <div className="card" style={{padding:0, overflow:'hidden', borderRadius:16, border:'1px solid var(--border)'}}>
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
                          <td style={{fontWeight:700, color:'var(--muted)'}}>{idx + 1}</td>
                          <td style={{fontWeight:700}}>{s.name}</td>
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
            
            <div className="print-footer" style={{marginTop:50, display:'flex', justifyContent:'flex-end'}}>
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

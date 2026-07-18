import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PerformancesDirecteur from './PerformancesDirecteur'
import AgendaCalendrier from './AgendaCalendrier'

const BOTTOM_TABS = [
  { id:'dashboard', icon:'📊', label:'Bord' },
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'perfs', icon:'⭐', label:'Perfs' },
]

const TOP_TABS = [
  { id:'profs', icon:'👥', label:'Équipe' },
  { id:'eleves', icon:'🎒', label:'Élèves' },
  { id:'synthese', icon:'📊', label:'Synthèse' },
  { id:'discipline', icon:'⚖️', label:'Discipline' },
  { id:'pedagogie', icon:'📚', label:'Pédagogie' },
]

// Référentiel par défaut des postes (seed si app_state rh/postes est vide).
// Doit rester aligné avec SALAIRES_DETAIL de public/comptabilite.html.
const DEFAULT_POSTES = [
  { id:'directeur',              label:'Directeur',                       mensuel:400000, commentaire:'Direction générale' },
  { id:'resp-administratif',     label:'Responsable administratif',       mensuel:150000, commentaire:'Secrétariat et suivi' },
  { id:'conseillere-vie-scol',   label:'Conseillère de vie scolaire',     mensuel:75000,  commentaire:'' },
  { id:'surveillant',            label:'Surveillant(e)',                  mensuel:75000,  commentaire:'Sécurité et discipline' },
  { id:'menageres',              label:'Ménagères (× 3)',                 mensuel:150000, commentaire:'50 000 FCFA × 3' },
  { id:'gardien',                label:'Gardien',                         mensuel:30000,  commentaire:'Sécurité nocturne' },
  { id:'maitresse-fr-mat',       label:'Maîtresse Français (Maternelle)', mensuel:125000, commentaire:'' },
  { id:'maitresse-en-mat',       label:'Maîtresse Anglais (Maternelle)',  mensuel:125000, commentaire:'' },
  { id:'assistante-fr-mat',      label:'Assistante Français (Mater.)',    mensuel:75000,  commentaire:'' },
  { id:'assistante-en-mat',      label:'Assistante Anglais (Mater.)',     mensuel:75000,  commentaire:'' },
  { id:'maitre-fr-cp',           label:'Maître Français (CP1-CP2)',       mensuel:125000, commentaire:'Cours bilingue CP' },
  { id:'maitre-en-cp',           label:'Maître Anglais (CP1-CP2)',        mensuel:125000, commentaire:'Cours bilingue CP' },
  { id:'maitre-fr-ce',           label:'Maître Français (CE1-CE2)',       mensuel:125000, commentaire:'Cours bilingue CE' },
  { id:'maitre-en-ce',           label:'Maître Anglais (CE1-CE2)',        mensuel:125000, commentaire:'Cours bilingue CE' },
  { id:'maitre-fr-cm',           label:'Maître Français (CM1-CM2)',       mensuel:125000, commentaire:'Cours bilingue CM' },
  { id:'maitre-en-cm',           label:'Maître Anglais (CM1-CM2)',        mensuel:125000, commentaire:'Cours bilingue CM' },
  { id:'remun-associe',          label:'Rémunération Associé',            mensuel:250000, commentaire:'Retour sur investissement – Associé' },
  { id:'remun-directeur',        label:'Rémunération Directeur',          mensuel:100000, commentaire:'Retour sur investissement – Directeur' },
]

const fmtFCFA = n => (parseInt(n, 10) || 0).toLocaleString('fr-FR') + ' FCFA'

export default function DirecteurApp({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState({ profs:0, eleves:0, checkpoints:0 })
  const [profs, setProfs] = useState([])
  const [eleves, setEleves] = useState([])
  const [classes, setClasses] = useState([])
  const [periodes, setPeriodes] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresGlobal, setJoursOuvresGlobal] = useState(20)
  const [showModal, setShowModal] = useState(null)
  const [newProf, setNewProf] = useState({ prenom:'', nom:'', role:'professeur', langue:'fr', code_acces:'', plafond_salaire: 180000, classe_ids: [] })
  const [newEleve, setNewEleve] = useState({ prenom:'', nom:'', classe_id:'' })
  const [newEvenement, setNewEvenement] = useState({ titre:'', date_event:'', description:'' })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preparations, setPreparations] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [syntheseData, setSyntheseData] = useState([])
  const [activeSyntheseClass, setActiveSyntheseClass] = useState(null)
  const [activeEleveClass, setActiveEleveClass] = useState(null)
  const [disciplines, setDisciplines] = useState([])
  const [postes, setPostes] = useState(DEFAULT_POSTES)
  const [posteDraft, setPosteDraft] = useState([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const results = await Promise.all([
        supabase.from('users').select('*').neq('role','directeur').eq('actif',true),
        supabase.from('eleves').select('*, classes(nom)').eq('actif',true),
        supabase.from('classes').select('*').order('ordre'),
        supabase.from('periodes').select('*').order('ordre'),
        supabase.from('evenements').select('*').order('date_event', { ascending: true }),
        supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
        supabase.from('parametres_mois').select('*').eq('mois', currentMoisStr).maybeSingle(),
        supabase.from('preparations').select('*, users(prenom, nom), classes(nom)').order('heure_depot', { ascending: false }),
        supabase.from('checkpoints').select('*'),
        supabase.from('prof_classes').select('*'),
        supabase.from('disciplines').select('*, eleves(prenom, nom, classe_id, classes(nom)), users!prof_id(prenom, nom)').order('created_at', { ascending: false })
      ])

      const u = results[0].data || []
      const el = results[1].data || []
      const cl = results[2].data || []
      const ev = results[4].data || []
      const docs = results[5].data || []
      const param = results[6].data
      const prep = results[7].data || []
      const cp = results[8].data || []
      const pc = results[9].data || []
      const disc = results[10].data || []

      setDisciplines(disc)
      if (param) setJoursOuvresGlobal(param.jours_ouvres);
      setPreparations(prep)

      setEleves(el)
      setClasses(cl)
      setEvenements(ev)
      if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)
      setStats({ profs: u.length, eleves: el.length, checkpoints: cp.length })
      setCheckpoints(cp)
      
      const enrichedProfs = u.map(p => ({
        ...p,
        classe_ids: pc.filter(link => link.user_id === p.id).map(link => link.classe_id)
      }))
      setProfs(enrichedProfs)
      
      if (cl.length > 0) setNewEleve(p => ({ ...p, classe_id: cl[0].id }))

      const { data: allMats } = await supabase.from('matieres').select('*, objectifs(*)')
      const { data: allProgs } = await supabase.from('progressions').select('*, eleves(classe_id), objectifs(id)')
      
      const analysis = []
      cl.forEach(c => {
        const cMats = (allMats || []).filter(m => m.classe_id === c.id)
        const cProgs = (allProgs || []).filter(p => p.eleves?.classe_id === c.id)
        const matStats = cMats.map(m => {
          const mObjIds = (m.objectifs || []).map(o => o.id)
          const mProgs = cProgs.filter(p => mObjIds.includes(p.objectif_id))
          const avg = mProgs.length ? Math.round(mProgs.reduce((acc,p)=>acc+p.pourcentage,0)/mProgs.length) : 0
          return { nom: m.nom, avg }
        }).sort((a,b) => b.avg - a.avg)
        analysis.push({ classe: c.nom, stats: matStats })
      })
      setSyntheseData(analysis)

      // Référentiel Postes & salaires (partagé avec la comptabilité via app_state rh/postes)
      const { data: rhPostes } = await supabase.from('app_state')
        .select('value').eq('app', 'rh').eq('key', 'postes').maybeSingle()
      if (Array.isArray(rhPostes?.value) && rhPostes.value.length > 0) setPostes(rhPostes.value)
    } catch (e) {
      console.error('Error loading data:', e)
    }
  }

  const savePostes = async () => {
    const cleaned = posteDraft
      .filter(p => (p.label || '').trim())
      .map(p => ({
        id: p.id || (p.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poste-' + Date.now()),
        label: p.label.trim(),
        mensuel: parseInt(p.mensuel, 10) || 0,
        commentaire: (p.commentaire || '').trim()
      }))
    setLoading(true)
    const { error } = await supabase.from('app_state').upsert(
      { app: 'rh', key: 'postes', value: cleaned, updated_at: new Date().toISOString() },
      { onConflict: 'app,key' }
    )
    setLoading(false)
    if (error) { setMsg('Erreur: ' + error.message); return }
    setPostes(cleaned)
    setShowModal(null)
    setMsg('Postes & salaires enregistrés — la comptabilité est synchronisée.')
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  const saveProf = async () => {
    setLoading(true)
    try {
      const code = newProf.code_acces || generateCode()
      const { data: userData, error } = await supabase.from('users').upsert({ 
        id: newProf.id || undefined,
        prenom: newProf.prenom, 
        nom: newProf.nom, 
        role: newProf.role, 
        langue: newProf.langue, 
        code_acces: code, 
        plafond_salaire: newProf.plafond_salaire,
        actif: true 
      }, { onConflict: 'id' }).select().single()

      if (error) { 
        setMsg('Erreur: ' + error.message) 
      } else if (userData) {
        if (newProf.role === 'professeur') {
          await supabase.from('prof_classes').delete().eq('user_id', userData.id)
          if (newProf.classe_ids?.length > 0) {
            const links = newProf.classe_ids.map(cid => ({ 
              user_id: userData.id, 
              classe_id: cid,
              langue: newProf.langue || 'fr'
            }))
            const { error: linkErr } = await supabase.from('prof_classes').insert(links)
            if (linkErr) {
              alert("Classes non sauvées: " + linkErr.message)
            }
          }
        }
        setMsg(`Compte ${newProf.id ? 'mis à jour' : 'créé'} ! Code: ` + code)
        await loadData()
        setShowModal(null)
        setNewProf({ prenom:'', nom:'', role:'professeur', langue:'fr', code_access:'', plafond_salaire: 180000, classe_ids: [] })
      }
    } catch (e) {
      console.error(e)
      setMsg('Erreur imprévue')
    } finally {
      setLoading(false)
    }
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

      <div className="top-nav-secondary">
        {TOP_TABS.map(t => (
          <button 
            key={t.id} 
            className={`top-nav-item ${tab===t.id?'active':''}`} 
            onClick={()=>setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {msg && <div className="error-msg" style={{background:'rgba(141,198,63,.1)',borderColor:'var(--green)',color:'var(--green)',marginBottom:'1rem'}} onClick={()=>setMsg('')}>{msg}</div>}

        {tab === 'dashboard' && (() => {
          // Calculs pour le dashboard
          const avgParClasse = syntheseData.map(cl => {
            const avg = cl.stats.length
              ? Math.round(cl.stats.reduce((s, m) => s + m.avg, 0) / cl.stats.length)
              : 0
            return { classe: cl.classe, avg }
          }).sort((a, b) => b.avg - a.avg)

          const cpParClasse = classes.map(cl => {
            const elevesCl = eleves.filter(e => e.classe_id === cl.id)
            const cpCl = checkpoints.filter(cp => elevesCl.some(e => e.id === cp.eleve_id))
            const total = elevesCl.length * 3
            const fait = cpCl.filter(cp => cp.statut === 'validé' || cp.note !== null).length
            return { classe: cl.nom, pct: total > 0 ? Math.round(fait / total * 100) : 0, fait, total: elevesCl.length }
          })

          const evAVenir = evenements
            .filter(e => new Date(e.date_event) >= new Date())
            .slice(0, 3)

          const disciplinesGraves = disciplines.filter(d =>
            (d.gravite === 'grave' || d.gravite === 'exclusion') && d.statut === 'signalé'
          )

          return (
            <>
              {/* KPI Cards */}
              <div className="kpi-grid" style={{marginBottom: 16}}>
                <div className="kpi-card kpi-accent">
                  <div className="kpi-value">{stats.profs}</div>
                  <div className="kpi-label">Enseignants</div>
                </div>
                <div className="kpi-card kpi-green">
                  <div className="kpi-value">{stats.eleves}</div>
                  <div className="kpi-label">Élèves</div>
                </div>
                <div className="kpi-card kpi-amber">
                  <div className="kpi-value">{classes.length}</div>
                  <div className="kpi-label">Classes</div>
                </div>
                <div className="kpi-card kpi-pink">
                  <div className="kpi-value">{preparations.length}</div>
                  <div className="kpi-label">Préparations</div>
                </div>
              </div>

              {/* Modules administratifs */}
              <div className="card" style={{marginBottom:16}}>
                <h3 style={{margin:'0 0 12px 0', fontSize:15}}>Gestion administrative</h3>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <a href="/inscription.html" style={{textDecoration:'none'}}>
                    <div style={{background:'linear-gradient(135deg,#00a8e0,#0078b4)', color:'#fff', borderRadius:14, padding:'18px 16px'}}>
                      <div style={{fontSize:28}} aria-hidden="true">📝</div>
                      <div style={{fontWeight:700, marginTop:6}}>Inscriptions</div>
                      <div style={{fontSize:12, opacity:.85, marginTop:2}}>Nouvelles &amp; réinscriptions, dossiers élèves</div>
                    </div>
                  </a>
                  <a href="/comptabilite.html" style={{textDecoration:'none'}}>
                    <div style={{background:'linear-gradient(135deg,#7bc142,#5a9a2e)', color:'#fff', borderRadius:14, padding:'18px 16px'}}>
                      <div style={{fontSize:28}} aria-hidden="true">💰</div>
                      <div style={{fontWeight:700, marginTop:6}}>Comptabilité</div>
                      <div style={{fontSize:12, opacity:.85, marginTop:2}}>Frais, paiements, reçus, dépenses</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Alerte discipline */}
              {disciplinesGraves.length > 0 && (
                <div className="card" style={{borderLeft:'4px solid var(--red)', marginBottom:16}}>
                  <div className="card-header" style={{background:'rgba(255,0,0,0.07)', color:'var(--red)', fontWeight:900, fontSize:12}}>
                    ⚠️ {disciplinesGraves.length} ALERTE{disciplinesGraves.length > 1 ? 'S' : ''} DISCIPLINE GRAVE
                  </div>
                  <div style={{padding:'0.75rem 1rem'}}>
                    {disciplinesGraves.slice(0, 3).map(d => (
                      <div key={d.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
                        <div>
                          <div style={{fontSize:13, fontWeight:800}}>{d.eleves?.prenom} {d.eleves?.nom} <span style={{color:'var(--muted)', fontWeight:400}}>({d.eleves?.classes?.nom})</span></div>
                          <div style={{fontSize:11, color:'var(--muted)', marginTop:2}}>{d.motif}</div>
                        </div>
                        <span className="chip chip-red" style={{fontSize:9}}>{d.gravite}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Performance par classe */}
              {avgParClasse.length > 0 && (
                <div className="card" style={{marginBottom:16}}>
                  <div className="card-header">📊 Performance par classe</div>
                  <div className="card-body" style={{padding:'1rem'}}>
                    {avgParClasse.map((cl, i) => (
                      <div key={cl.classe} style={{marginBottom: i < avgParClasse.length - 1 ? 14 : 0}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5}}>
                          <span style={{fontSize:13, fontWeight:700}}>{cl.classe}</span>
                          <span style={{
                            fontSize:12, fontWeight:800,
                            color: cl.avg >= 70 ? 'var(--green)' : cl.avg >= 40 ? 'var(--amber, #f59e0b)' : 'var(--red)'
                          }}>{cl.avg}%</span>
                        </div>
                        <div style={{height:8, background:'var(--border)', borderRadius:99, overflow:'hidden'}}>
                          <div style={{
                            height:'100%', borderRadius:99,
                            width: `${cl.avg}%`,
                            background: cl.avg >= 70
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : cl.avg >= 40
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #ef4444, #f87171)',
                            transition: 'width 0.6s ease'
                          }} />
                        </div>
                      </div>
                    ))}
                    {avgParClasse.length === 0 && (
                      <div style={{color:'var(--muted)', fontSize:12, textAlign:'center', padding:'1rem'}}>
                        Aucune donnée de progression disponible.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Check-points + Événements côte à côte */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
                {/* Check-points par classe */}
                <div className="card">
                  <div className="card-header">✅ Check-points par classe</div>
                  <div className="card-body" style={{padding:'1rem'}}>
                    {cpParClasse.map(cl => (
                      <div key={cl.classe} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)'}}>
                        <span style={{fontSize:12, fontWeight:600}}>{cl.classe}</span>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <span style={{fontSize:11, color:'var(--muted)'}}>{cl.total} élèves</span>
                          <span style={{
                            fontSize:12, fontWeight:800, minWidth:36, textAlign:'right',
                            color: cl.pct >= 70 ? 'var(--green)' : cl.pct >= 40 ? '#f59e0b' : 'var(--red)'
                          }}>{cl.pct}%</span>
                        </div>
                      </div>
                    ))}
                    {cpParClasse.length === 0 && (
                      <div style={{color:'var(--muted)', fontSize:12, textAlign:'center', padding:'1rem'}}>Aucun check-point</div>
                    )}
                  </div>
                </div>

                {/* Événements à venir */}
                <div className="card">
                  <div className="card-header">📅 Prochains événements</div>
                  <div className="card-body" style={{padding:'1rem'}}>
                    {evAVenir.length === 0 ? (
                      <div style={{color:'var(--muted)', fontSize:12, textAlign:'center', padding:'1rem'}}>Aucun événement prévu</div>
                    ) : evAVenir.map(ev => (
                      <div key={ev.id} style={{padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
                        <div style={{fontSize:12, fontWeight:700}}>{ev.titre}</div>
                        <div style={{fontSize:11, color:'var(--accent)', marginTop:2}}>
                          📅 {new Date(ev.date_event).toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'})}
                        </div>
                        {ev.description && <div style={{fontSize:10, color:'var(--muted)', marginTop:2}}>{ev.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Préparations récentes */}
              <div className="card">
                <div className="card-header">📝 Préparations récentes</div>
                <div className="card-body" style={{padding:'0'}}>
                  {(preparations || []).length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">📝</div><p>Aucune préparation de cours déposée.</p></div>
                  ) : preparations.slice(0, 5).map(pre => (
                    <div key={pre.id} className="user-row">
                      <div className="avatar av-amber">{(pre.users?.prenom?.[0]||'')+(pre.users?.nom?.[0]||'')}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{pre.users?.prenom} {pre.users?.nom}</div>
                        <div style={{fontSize:11,color:'var(--muted)'}}>Déposé le {new Date(pre.heure_depot).toLocaleDateString('fr-FR')} · {pre.classes?.nom}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        })()}


        {tab === 'profs' && (
          <>
            <div className="section-head">
              <div className="section-title">Equipe</div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn-sm" style={{background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)'}} onClick={()=>{setPosteDraft(postes.map(p=>({...p})));setShowModal('postes')}}>💼 Postes & salaires</button>
                <button className="btn-sm" onClick={()=>{setNewProf({prenom:'',nom:'',role:'professeur',langue:'fr',code_acces:'', plafond_salaire: 180000, classe_ids: []});setShowModal('prof')}}>+ Ajouter</button>
              </div>
            </div>
            {profs.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">👥</div><p>Aucun membre. Ajoutez des professeurs et surveillants.</p></div>
            ) : profs.map((p, i) => (
              <div key={p.id} className="card" style={{marginBottom:10}}>
                <div className="user-row">
                  <div className={`avatar ${['av-blue','av-green','av-amber','av-pink'][i%4]}`}>{(p.prenom[0]||'')+((p.nom||'')[0]||'')}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{p.prenom} {p.nom}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                      Code: <b style={{color:'var(--accent)'}}>{p.code_acces}</b> &middot; {p.role}
                    </div>
                    {p.role === 'professeur' && (
                      <div style={{display:'flex', gap:4, flexWrap:'wrap', marginTop:6}}>
                        {(p.classe_ids || []).map(cid => (
                          <span key={cid} style={{fontSize:9, background:'rgba(26,175,224,.1)', color:'var(--accent)', padding:'2px 6px', borderRadius:6, fontWeight:700}}>
                            {classes.find(c => c.id === cid)?.nom}
                          </span>
                        ))}
                        {(p.classe_ids || []).length === 0 && <span style={{fontSize:9, color:'var(--red)', fontStyle:'italic'}}>Aucune classe attribuée</span>}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <div style={{display:'flex',gap:6,flexDirection:'column',alignItems:'flex-end'}}>
                      <span className={`chip ${p.role==='professeur'?'chip-blue':'chip-amber'}`}>{p.role}</span>
                      {p.langue && <span className="chip chip-green">{p.langue==='fr'?'FR':p.langue==='en'?'EN':'FR+EN'}</span>}
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <button aria-label="Modifier" className="btn-sm" onClick={() => {setNewProf({...p}); setShowModal('prof')}} style={{background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px'}}>✏️</button>
                      <button aria-label="Supprimer" className="btn-sm" onClick={() => {if(confirm('Supprimer ce compte?')) deleteProf(p.id)}} style={{background:'rgba(237,28,36,.1)', border:'1px solid var(--red)', color:'var(--red)', padding:'6px'}}>🗑️</button>
                    </div>
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
                          <button aria-label="Désactiver" onClick={async () => { if(confirm('Sûr ?')) { await supabase.from('eleves').update({actif:false}).eq('id', el.id); loadData() } }} style={{background:'none', border:'none', color:'var(--red)', fontSize:18, cursor:'pointer'}}>×</button>
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
          <AgendaCalendrier checkpoints={checkpoints} classes={classes} periodes={periodes} isAdmin={true} anniversaires={eleves} />
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

        {tab === 'pedagogie' && (
          <div>
            <div className="section-title" style={{marginBottom:12}}>Outils pédagogiques</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <a href="/pedago-archive/" style={{textDecoration:'none'}}>
                <div style={{background:'linear-gradient(135deg,#1AAFE0,#0d6fa8)', color:'#fff', borderRadius:14, padding:'18px 16px'}}>
                  <div style={{fontSize:28}} aria-hidden="true">🗂️</div>
                  <div style={{fontWeight:700, marginTop:6}}>Pédago-Archive</div>
                  <div style={{fontSize:12, opacity:.85, marginTop:2}}>Devoirs, fiches et archives pédagogiques</div>
                </div>
              </a>
              <a href="/rapports.html" style={{textDecoration:'none'}}>
                <div style={{background:'linear-gradient(135deg,#F7941D,#d97706)', color:'#fff', borderRadius:14, padding:'18px 16px'}}>
                  <div style={{fontSize:28}} aria-hidden="true">📄</div>
                  <div style={{fontWeight:700, marginTop:6}}>Rapports hebdomadaires élèves</div>
                  <div style={{fontSize:12, opacity:.85, marginTop:2}}>Bulletin de suivi hebdomadaire à transmettre aux parents</div>
                </div>
              </a>
            </div>
          </div>
        )}

        {tab === 'discipline' && (
          <>
            <div className="section-head"><div className="section-title">⚖️ Registre de Discipline</div></div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
              <div className="kpi-card kpi-pink" style={{padding:15}}>
                <div style={{fontSize:24, fontWeight:900}}>{eleves.filter(e => e.points_discipline <= 20).length}</div>
                <div style={{fontSize:11}}>Élèves sous le seuil critique (Samedi)</div>
              </div>
              <div className="kpi-card kpi-amber" style={{padding:15}}>
                <div style={{fontSize:24, fontWeight:900}}>{eleves.filter(e => e.points_discipline < 100).length}</div>
                <div style={{fontSize:11}}>Total élèves avec signalements</div>
              </div>
            </div>

            <div className="card-header" style={{background:'transparent', padding:'0 0 10px 4px', fontSize:13, fontWeight:800}}>📜 Historique des Sanctions (Toutes classes)</div>
            {disciplines.length === 0 ? (
              <div className="empty-state">Aucun incident enregistré.</div>
            ) : disciplines.map(d => (
              <div key={d.id} className="card" style={{marginBottom:10, padding:15, borderLeft: `4px solid ${d.statut==='validé'?'#4caf50':'#ff9800'}`}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                  <div>
                    <span style={{fontSize:14, fontWeight:800}}>{d.eleves?.prenom} {d.eleves?.nom}</span>
                    <div style={{fontSize:11, color:'var(--muted)'}}>Classe: {d.eleves?.classes?.nom}</div>
                  </div>
                  <div className={`chip ${d.statut==='validé'?'chip-green':'chip-amber'}`}>{d.statut === 'validé' ? 'Validé' : 'En attente'}</div>
                </div>
                <div style={{background:'rgba(0,0,0,0.03)', padding:10, borderRadius:10, fontSize:12, marginBottom:10}}>
                  <b>Motif:</b> {d.motif}
                  {d.statut === 'validé' && (
                    <div style={{marginTop:8, paddingTop:8, borderTop:'1px dashed #ccc', color:'var(--accent)', fontWeight:600}}>
                      Sanction: {d.sanction_type} {d.sanction_duree ? `(${d.sanction_duree} min)` : ''} - Détails: {d.sanction_details || 'RAS'}
                    </div>
                  )}
                </div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--muted)'}}>
                  <span>Prof: {(d.users?.prenom || '') + ' ' + (d.users?.nom || '')}</span>
                  <span>{new Date(d.created_at).toLocaleDateString('fr-FR')} {new Date(d.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="bottom-nav" role="tablist">
        {BOTTOM_TABS.map(t => (
          <button 
            key={t.id} 
            className={`nav-item ${tab===t.id?'active':''}`} 
            onClick={()=>setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
            aria-label={t.label}
          >
            <div className="nav-icon" aria-hidden="true">{t.icon}</div>
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
                <option value="conseiller_vie_scolaire">Conseiller Vie Scolaire</option>
                <option value="comptable">Comptable</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Poste / Catégorie de paie</label>
              <select className="form-select" value={newProf.poste_id || postes.find(p => p.mensuel === newProf.plafond_salaire)?.id || ''}
                onChange={e => {
                  const p = postes.find(x => x.id === e.target.value)
                  setNewProf({ ...newProf, poste_id: e.target.value, plafond_salaire: p ? p.mensuel : newProf.plafond_salaire })
                }}>
                <option value="">— Choisir un poste —</option>
                {postes.map(p => <option key={p.id} value={p.id}>{p.label} ({fmtFCFA(p.mensuel)}/mois)</option>)}
              </select>
              <div style={{fontSize:10, color:'var(--muted)', marginTop:4}}>Liste modifiable via « 💼 Postes & salaires » (onglet Équipe) — synchronisée avec la comptabilité.</div>
            </div>

            {newProf.role === 'professeur' && (
              <>
                <div className="form-group">
                  <label className="form-label">Langue enseignée</label>
                  <select className="form-select" value={newProf.langue} onChange={e=>setNewProf({...newProf,langue:e.target.value})}>
                    <option value="fr">Français</option>
                    <option value="en">Anglais</option>
                    <option value="both">Les deux</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Classes attribuées</label>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, background:'rgba(255,255,255,0.05)', padding:12, borderRadius:12, border:'1px solid var(--border)'}}>
                    {classes.map(c => (
                      <label key={c.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer'}}>
                        <input 
                          type="checkbox" 
                          checked={newProf.classe_ids?.includes(c.id)} 
                          onChange={e => {
                            const ids = e.target.checked 
                              ? [...(newProf.classe_ids||[]), c.id]
                              : (newProf.classe_ids||[]).filter(id => id !== c.id)
                            setNewProf({...newProf, classe_ids: ids})
                          }} 
                        />
                        {c.nom}
                      </label>
                    ))}
                  </div>
                </div>
              </>
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

      {showModal === 'postes' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal" style={{maxHeight:'85vh', overflowY:'auto'}}>
            <div className="modal-handle"></div>
            <div className="modal-title">💼 Postes & salaires</div>
            <div style={{fontSize:11, color:'var(--muted)', marginBottom:12}}>
              Référentiel unique des postes de l'école. Les montants alimentent la masse salariale de la comptabilité et le formulaire d'ajout de membre.
            </div>
            {posteDraft.map((p, i) => (
              <div key={i} style={{display:'flex', gap:6, alignItems:'center', marginBottom:8}}>
                <div style={{flex:1}}>
                  <input className="form-input" style={{marginBottom:4}} placeholder="Intitulé du poste" value={p.label}
                    onChange={e=>{const d=[...posteDraft]; d[i]={...d[i], label:e.target.value}; setPosteDraft(d)}} />
                  <input className="form-input" style={{fontSize:11}} placeholder="Commentaire (optionnel)" value={p.commentaire || ''}
                    onChange={e=>{const d=[...posteDraft]; d[i]={...d[i], commentaire:e.target.value}; setPosteDraft(d)}} />
                </div>
                <input className="form-input" type="number" min="0" step="5000" style={{width:110, textAlign:'right'}} placeholder="FCFA/mois" value={p.mensuel}
                  onChange={e=>{const d=[...posteDraft]; d[i]={...d[i], mensuel:e.target.value}; setPosteDraft(d)}} />
                <button aria-label="Supprimer ce poste" className="btn-sm" style={{background:'rgba(237,28,36,.1)', border:'1px solid var(--red)', color:'var(--red)', padding:'6px 8px'}}
                  onClick={()=>{if(confirm(`Supprimer le poste « ${p.label || 'sans nom'} » ?`)) setPosteDraft(posteDraft.filter((_,j)=>j!==i))}}>🗑️</button>
              </div>
            ))}
            <button className="btn-sm" style={{background:'var(--bg)', border:'1px dashed var(--border)', color:'var(--text)', width:'100%', marginBottom:12}}
              onClick={()=>setPosteDraft([...posteDraft, { id:'', label:'', mensuel:0, commentaire:'' }])}>+ Ajouter un poste</button>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, padding:'10px 0', borderTop:'1px solid var(--border)', marginBottom:10}}>
              <span>Masse salariale mensuelle</span>
              <span style={{color:'var(--accent)'}}>{fmtFCFA(posteDraft.reduce((s,p)=>s+(parseInt(p.mensuel,10)||0),0))}</span>
            </div>
            <button className="btn btn-primary" onClick={savePostes} disabled={loading}>{loading?'...':'Enregistrer le référentiel'}</button>
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
            <div className="form-group">
              <label className="form-label">Téléphone Parent (WhatsApp)</label>
              <input className="form-input" value={newEleve.parent_phone} onChange={e=>setNewEleve({...newEleve,parent_phone:e.target.value})} placeholder="+223..." />
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

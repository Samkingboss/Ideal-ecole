import AgendaCalendrier from './AgendaCalendrier'
import PreparationIA from './PreparationIA'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const RECREE_CHECKS = [
  { id:'outils', label:'Outils pédagogiques rangés' },
  { id:'tables', label:'Tables-bancs bien rangés' },
  { id:'ventilo', label:'Ventilateur éteint' },
  { id:'fermee', label:'Salle fermée à clé' },
  { id:'cle', label:'Clé déposée à l\'heure' },
]

const TABS = [
  { id:'checkpoint', icon:'✅', label:'Check-point' },
  { id:'progression', icon:'📈', label:'Progression' },
  { id:'messages', icon:'💬', label:'Messages' },
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'perfs', icon:'⭐', label:'Mes Perfs' },
]

export default function ProfApp({ user, onLogout }) {
  const [tab, setTab] = useState('perfs')
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
  const [msgPreview, setMsgPreview] = useState(false)
  const [msgDetails, setMsgDetails] = useState({})
  const [schoolNum] = useState('22390190007')
  const [loading, setLoading] = useState(false)
  const [myPerfs, setMyPerfs] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresForce, setJoursOuvresForce] = useState(null)
  const [preparations, setPreparations] = useState([])
  const [newPrepa, setNewPrepa] = useState({ classe_id: '', date_cours: new Date().toISOString().slice(0, 10), heure_cours: '08:00', file: null })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [{ data: cl }, { data: per }, { data: profClasses }, { data: ev }, { data: docs }, { data: paramMois }] = await Promise.all([
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('periodes').select('*').order('ordre'),
      supabase.from('prof_classes').select('*, classes(*)').eq('user_id', user.id),
      supabase.from('evenements').select('*').order('date_event', { ascending: true }),
      supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
      supabase.from('parametres_mois').select('*').eq('mois', currentMoisStr).maybeSingle()
    ])
    setJoursOuvresForce(paramMois?.jours_ouvres || null)
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
      .select('*, recrees(*)').eq('prof_id', user.id).order('date_jour', { ascending: false }).limit(30)
    setMyPerfs(perfsData || [])

    // Load preparations
    const { data: prepData } = await supabase.from('preparations')
      .select('*, classes(nom)')
      .eq('user_id', user.id)
      .order('heure_depot', { ascending: false })
    setPreparations(prepData || [])
  }

  const getCurrentPlan = () => {
    if (!selectedClasse || !selectedPeriode) return null
    return planifications.find(p => p.classe_id === selectedClasse.id && p.periode_id === selectedPeriode.id)
  }

  const getClasseEleves = () => {
    if (!selectedClasse) return []
    return eleves.filter(e => e.classe_id === selectedClasse.id)
  }


  const analyzeWithGemini = async (base64Data, mimeType) => {
    const GEMINI_API_KEY = "";
    const prompt = `Tu es un inspecteur pédagogique rigoureux pour l'école IDEAL. 
    Analyse cette préparation de cours (image ou PDF joint). 
    Critères : 
    1. Présence d'objectifs pédagogiques clairs (5 pts)
    2. Pertinence des activités proposées (5 pts)
    3. Utilisation de matériel didactique (5 pts)
    4. Qualité de la langue et structure (5 pts)
    Donne une note sur 20 et un commentaire constructif court (2 phrases max).
    Réponds EXCLUSIVEMENT au format JSON : {"note": 18, "commentaire": "Texte ici"}`;

    try {
      const resp = await fetch(`/.netlify/functions/analyze-prepa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType, prompt })
      });
      
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Erreur Serveur ${resp.status}`);
      }
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("L'IA n'a pas pu générer de réponse.");
      }

      const resultText = data.candidates[0].content.parts[0].text;
      const jsonMatch = resultText.match(/\{.*\}/s);
      return JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
    } catch (e) {
      console.error("Gemini Proxy Error:", e);
      return { note: 10, commentaire: `Erreur IA (Proxy) : ${e.message.substring(0, 50)}...` };
    }
  }

  const uploadPrepa = async () => {
    if (!newPrepa.file || !newPrepa.classe_id) return alert("Fichier et classe requis");
    setLoading(true);
    try {
      const file = newPrepa.file;
      
      // Lecture du fichier en base64 pour Gemini
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `preparations/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

      // Appel IA avec le vrai contenu du fichier
      const iaResult = await analyzeWithGemini(base64Data, file.type);

      const dateCours = new Date(`${newPrepa.date_cours}T${newPrepa.heure_cours}`);
      const limitDate = new Date(dateCours.getTime() - (10 * 60 * 60 * 1000));
      const now = new Date();
      
      let noteFinale = iaResult.note;
      let status = 'acceptable';
      if (now > limitDate) {
        noteFinale = Math.max(0, noteFinale - 5); 
        status = 'rejeté (retard)';
      }

      const { error } = await supabase.from('preparations').insert({
        user_id: user.id,
        classe_id: newPrepa.classe_id,
        date_cours: newPrepa.date_cours,
        heure_cours: newPrepa.heure_cours,
        url_doc: publicUrl,
        note_ia: noteFinale,
        commentaire_ia: iaResult.commentaire,
        status: status
      });

      if (error) throw error;
      setMsgEleve("Préparation envoyée et notée par l'IA !");
      loadData();
      setNewPrepa({ ...newPrepa, file: null });
    } catch (e) {
      alert("Erreur: " + e.message);
    }
    setLoading(false);
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
    const classCps2 = checkpoints.filter(cp => {      const p = planifications.find(pl => pl.id === cp.planification_id)      return p && p.classe_id === selectedClasse.id && p.periode_id === selectedPeriode.id    }).sort((a,b) => b.date_checkpoint.localeCompare(a.date_checkpoint))    const lastCp = classCps2[0]
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
          <AgendaCalendrier checkpoints={checkpoints} selectedClasse={selectedClasse} periodes={periodes} />
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
            {!msgPreview ? (
              <>
                <div className="form-group">
                  <label className="form-label">Eleve</label>
                  <select className="form-select" value={msgEleve?.id||''} onChange={e=>{setMsgEleve(classEleves.find(el=>el.id===e.target.value));setMsgBody('');setMsgType('');setMsgDetails({});}}>
                    <option value="">-- Selectionnez un eleve --</option>
                    {classEleves.map(el=><option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
                  </select>
                </div>
                {msgEleve && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Situation</label>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                        {[['comportement','Comportement'],['resultats','Resultats'],['absence','Absence/Retard'],['felicitations','Felicitations'],['convocation','Convocation'],['sante','Sante']].map(([v,label])=>(
                          <div key={v} onClick={()=>{setMsgType(v);setMsgDetails({});}}
                            style={{background:msgType===v?'rgba(26,175,224,.1)':'var(--bg)',border:'1.5px solid '+(msgType===v?'var(--accent)':'var(--border)'),borderRadius:12,padding:'.7rem',textAlign:'center',cursor:'pointer'}}>
                            <div style={{fontSize:12,fontWeight:600,color:msgType===v?'var(--accent)':'var(--muted)'}}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {msgType === 'comportement' && (
                      <div className="form-group">
                        <label className="form-label">Decrivez le comportement</label>
                        <textarea className="form-input" rows={3} placeholder="Ex: bagarre, refus de travailler..." value={msgDetails.desc||''} onChange={e=>setMsgDetails({...msgDetails,desc:e.target.value})} style={{lineHeight:1.6,resize:'vertical'}} />
                        <label className="form-label" style={{marginTop:8}}>Gravite</label>
                        <div style={{display:'flex',gap:8}}>
                          {[['leger','Leger'],['moyen','Moyen'],['grave','Grave']].map(([v,l])=>(
                            <div key={v} onClick={()=>setMsgDetails({...msgDetails,gravite:v})} style={{flex:1,padding:'6px',textAlign:'center',borderRadius:10,border:'1.5px solid '+(msgDetails.gravite===v?'var(--accent)':'var(--border)'),background:msgDetails.gravite===v?'rgba(26,175,224,.1)':'var(--bg)',cursor:'pointer',fontSize:12,fontWeight:600,color:msgDetails.gravite===v?'var(--accent)':'var(--muted)'}}>{l}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msgType === 'resultats' && (
                      <div className="form-group">
                        <label className="form-label">Matiere</label>
                        <input className="form-input" placeholder="Ex: Mathematiques..." value={msgDetails.matiere||''} onChange={e=>setMsgDetails({...msgDetails,matiere:e.target.value})} />
                        <label className="form-label" style={{marginTop:8}}>Appreciation</label>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {[['excellent','Excellent'],['bien','Bien'],['moyen','Peut mieux faire'],['insuffisant','Insuffisant']].map(([v,l])=>(
                            <div key={v} onClick={()=>setMsgDetails({...msgDetails,appreciation:v})} style={{flex:1,minWidth:80,padding:'6px',textAlign:'center',borderRadius:10,border:'1.5px solid '+(msgDetails.appreciation===v?'var(--accent)':'var(--border)'),background:msgDetails.appreciation===v?'rgba(26,175,224,.1)':'var(--bg)',cursor:'pointer',fontSize:11,fontWeight:600,color:msgDetails.appreciation===v?'var(--accent)':'var(--muted)'}}>{l}</div>
                          ))}
                        </div>
                        <label className="form-label" style={{marginTop:8}}>Precision (optionnel)</label>
                        <input className="form-input" placeholder="Ex: tres bons progres..." value={msgDetails.precision||''} onChange={e=>setMsgDetails({...msgDetails,precision:e.target.value})} />
                      </div>
                    )}
                    {msgType === 'absence' && (
                      <div className="form-group">
                        <label className="form-label">Type</label>
                        <div style={{display:'flex',gap:8}}>
                          {[['absence','Absence'],['retard','Retard'],['depart','Depart anticipe']].map(([v,l])=>(
                            <div key={v} onClick={()=>setMsgDetails({...msgDetails,type_abs:v})} style={{flex:1,padding:'6px',textAlign:'center',borderRadius:10,border:'1.5px solid '+(msgDetails.type_abs===v?'var(--accent)':'var(--border)'),background:msgDetails.type_abs===v?'rgba(26,175,224,.1)':'var(--bg)',cursor:'pointer',fontSize:11,fontWeight:600,color:msgDetails.type_abs===v?'var(--accent)':'var(--muted)'}}>{l}</div>
                          ))}
                        </div>
                        <label className="form-label" style={{marginTop:8}}>Duree</label>
                        <input className="form-input" placeholder="Ex: 2 jours, ce matin..." value={msgDetails.duree||''} onChange={e=>setMsgDetails({...msgDetails,duree:e.target.value})} />
                      </div>
                    )}
                    {msgType === 'felicitations' && (
                      <div className="form-group">
                        <label className="form-label">Raison</label>
                        <textarea className="form-input" rows={2} placeholder="Ex: premier de classe, progres remarquables..." value={msgDetails.raison||''} onChange={e=>setMsgDetails({...msgDetails,raison:e.target.value})} style={{lineHeight:1.6,resize:'vertical'}} />
                      </div>
                    )}
                    {msgType === 'convocation' && (
                      <div className="form-group">
                        <label className="form-label">Objet</label>
                        <textarea className="form-input" rows={2} placeholder="Ex: situation scolaire, incident..." value={msgDetails.objet||''} onChange={e=>setMsgDetails({...msgDetails,objet:e.target.value})} style={{lineHeight:1.6,resize:'vertical'}} />
                        <label className="form-label" style={{marginTop:8}}>Urgence</label>
                        <div style={{display:'flex',gap:8}}>
                          {[['normal','Normal'],['urgent','Urgent']].map(([v,l])=>(
                            <div key={v} onClick={()=>setMsgDetails({...msgDetails,urgence:v})} style={{flex:1,padding:'6px',textAlign:'center',borderRadius:10,border:'1.5px solid '+(msgDetails.urgence===v?'var(--accent)':'var(--border)'),background:msgDetails.urgence===v?'rgba(26,175,224,.1)':'var(--bg)',cursor:'pointer',fontSize:12,fontWeight:600,color:msgDetails.urgence===v?'var(--accent)':'var(--muted)'}}>{l}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msgType === 'sante' && (
                      <div className="form-group">
                        <label className="form-label">Situation</label>
                        <textarea className="form-input" rows={3} placeholder="Ex: leger malaise, chute..." value={msgDetails.desc||''} onChange={e=>setMsgDetails({...msgDetails,desc:e.target.value})} style={{lineHeight:1.6,resize:'vertical'}} />
                        <label className="form-label" style={{marginTop:8}}>Etat actuel</label>
                        <div style={{display:'flex',gap:8}}>
                          {[['bien','Va bien'],['soigne','Soigne'],['medecin','Medecin requis']].map(([v,l])=>(
                            <div key={v} onClick={()=>setMsgDetails({...msgDetails,etat:v})} style={{flex:1,padding:'6px',textAlign:'center',borderRadius:10,border:'1.5px solid '+(msgDetails.etat===v?'var(--accent)':'var(--border)'),background:msgDetails.etat===v?'rgba(26,175,224,.1)':'var(--bg)',cursor:'pointer',fontSize:11,fontWeight:600,color:msgDetails.etat===v?'var(--accent)':'var(--muted)'}}>{l}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msgType && (
                      <button className="btn btn-primary" onClick={()=>{
                        const nl = '\n';
                        const prenom = msgEleve.prenom;
                        const nom = msgEleve.prenom + ' ' + msgEleve.nom;
                        const sig = 'Cordialement,' + nl + (user.prenom||'') + ' ' + (user.nom||'') + nl + 'IDEAL Ecole Internationale Bilingue' + nl + '+223 90 19 00 07';
                        let corps = '';
                        if(msgType==='comportement'){
                          const grav = msgDetails.gravite==='grave'?'un incident grave':msgDetails.gravite==='moyen'?'un incident':'un incident';
                          corps = 'Nous souhaitons vous informer que votre enfant ' + prenom + ' a ete implique(e) dans ' + grav + ' aujourd hui.' + (msgDetails.desc?' Il s agit de : ' + msgDetails.desc+'.' : '') + (msgDetails.gravite==='grave'?' Nous vous demandons de nous contacter dans les plus brefs delais.':' Nous restons disponibles pour en discuter.');
                        } else if(msgType==='resultats'){
                          const app = msgDetails.appreciation==='excellent'?'d excellents resultats':msgDetails.appreciation==='bien'?'de bons resultats':msgDetails.appreciation==='moyen'?'des resultats qui peuvent etre ameliores':'des resultats insuffisants';
                          corps = 'Nous vous informons que votre enfant ' + prenom + ' obtient ' + app + (msgDetails.matiere?' en '+msgDetails.matiere:'') + '.' + (msgDetails.precision?' '+msgDetails.precision:'') + ' N hesitez pas a nous contacter pour plus d informations.';
                        } else if(msgType==='absence'){
                          const ta = msgDetails.type_abs==='retard'?'un retard':msgDetails.type_abs==='depart'?'un depart anticipe':'une absence';
                          corps = 'Nous avons constate ' + ta + ' de votre enfant ' + prenom + (msgDetails.duree?' de '+msgDetails.duree:'') + '. Merci de nous informer des raisons et de fournir un justificatif si necessaire.';
                        } else if(msgType==='felicitations'){
                          corps = 'Nous avons le plaisir de vous informer que votre enfant ' + prenom + ' s est particulierement distingue(e).' + (msgDetails.raison?' '+msgDetails.raison+'.':'') + ' Felicitations a votre famille !';
                        } else if(msgType==='convocation'){
                          corps = (msgDetails.urgence==='urgent'?'URGENT - ':'') + 'Nous vous prions de bien vouloir vous presenter a l ecole' + (msgDetails.objet?' concernant : '+msgDetails.objet:'') + '. Merci de nous contacter pour convenir d un rendez-vous.';
                        } else if(msgType==='sante'){
                          const etat = msgDetails.etat==='medecin'?'Nous vous recommandons de consulter un medecin.':msgDetails.etat==='soigne'?'Votre enfant a ete pris(e) en charge.':'Votre enfant va bien.';
                          corps = 'Nous vous informons que votre enfant ' + prenom + ' a eu un souci de sante aujourd hui.' + (msgDetails.desc?' '+msgDetails.desc+'.':'') + ' ' + etat;
                        }
                        setMsgBody('Chers parents de ' + nom + ',' + nl + nl + corps + nl + nl + sig);
                        setMsgPreview(true);
                      }}>
                        Generer le message
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'1rem'}}>
                  <button onClick={()=>setMsgPreview(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'6px 12px',cursor:'pointer',fontSize:13}}>Modifier</button>
                  <div style={{fontSize:14,fontWeight:700}}>Apercu du message</div>
                </div>
                <div style={{background:'rgba(26,175,224,.05)',border:'1px solid rgba(26,175,224,.2)',borderRadius:14,padding:'1rem',marginBottom:'1rem'}}>
                  <textarea className="form-input" rows={12} value={msgBody} onChange={e=>setMsgBody(e.target.value)} style={{lineHeight:1.8,resize:'vertical',fontFamily:'inherit',background:'transparent',border:'none',padding:0,width:'100%'}} />
                </div>
                <button className="btn btn-wa btn-primary" onClick={()=>window.open('https://wa.me/'+schoolNum+'?text='+encodeURIComponent(msgBody),'_blank')} disabled={!msgBody.trim()}>
                  Envoyer via WhatsApp
                </button>
              </>
            )}
          </>
        )}






        {tab === 'preparation' && (
          <PreparationIA user={user} />
        )}

        {tab === 'perfs' && (
          <>
            <div className="section-head"><div className="section-title">Mes Performances</div></div>
            
            {/* Tableau de bord financier mensuel */}
            {(() => {
              const currentMonth = new Date().getMonth();
              const currentYear = new Date().getFullYear();
              const monthPerfs = myPerfs.filter(p => {
                const d = new Date(p.date_jour);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.valide;
              });
              
              const totalMonthPoints = monthPerfs.reduce((acc, perf) => {
                const ponct = perf.heure_arrivee ? (perf.heure_arrivee <= '07:30' ? 30 : perf.heure_arrivee <= '08:00' ? 25 : 0) : 0;
                let gestion = perf.sacs_accroches ? 4 : 0;
                (perf.recrees || []).forEach(r => {
                  const checkedCount = RECREE_CHECKS.filter(c => r[c.id]).length;
                  gestion += checkedCount + (checkedCount === 5 ? 2 : 0);
                });
                const preparation = perf.preparation || 0;
                return acc + (ponct + gestion + preparation);
              }, 0);

              // Calcul des jours ouvrés du mois (Lundi à Vendredi)
              const getWorkDays = (year, month) => {
                let count = 0;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                  const day = new Date(year, month, i).getDay();
                  if (day !== 0 && day !== 6) count++; 
                }
                return count;
              };
              const joursOuvres = joursOuvresForce !== null ? joursOuvresForce : getWorkDays(currentYear, currentMonth);

              // 75 points max par jour ouvré dans tout le mois
              const maxPointsMensuel = joursOuvres * 75; 
              const pourcentage = maxPointsMensuel > 0 ? (totalMonthPoints / maxPointsMensuel) : 0;
              
              // Base de salaire max selon le statut. Fallback à 180000.
              const plafondSalaire = user.plafond_salaire || 180000; 
              
              const gainAccumule = Math.round(plafondSalaire * pourcentage);
              const pourcentageAffiche = Math.round(pourcentage * 100);
              const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

              return (
                <div className="card" style={{marginBottom: 20, background: 'linear-gradient(135deg, #1565a0, #0d2a3b)', color: '#fff', border: 'none'}}>
                  <div style={{padding: '1.2rem', textAlign: 'center'}}>
                    <div style={{fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,.7)', marginBottom: 12}}>Progression de {moisNoms[currentMonth]} {currentYear}</div>
                    
                    <div style={{display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16}}>
                      <div>
                        <div style={{fontSize: 28, fontWeight: 900}}>{totalMonthPoints} <span style={{fontSize:14,color:'rgba(255,255,255,.5)'}}>/{maxPointsMensuel}</span></div>
                        <div style={{fontSize: 11, color: 'rgba(255,255,255,.7)'}}>Points validés / Mois</div>
                      </div>
                      <div style={{height: 40, width: 1, background: 'rgba(255,255,255,.2)'}}></div>
                      <div>
                        <div style={{fontSize: 28, fontWeight: 900, color: '#4caf50'}}>{pourcentageAffiche}%</div>
                        <div style={{fontSize: 11, color: 'rgba(255,255,255,.7)'}}>Plafond atteint</div>
                      </div>
                    </div>
                    
                    <div style={{background: 'rgba(0,0,0,.3)', borderRadius: 12, padding: '12px', marginTop: 10}}>
                      <div style={{fontSize: 12, color: 'rgba(255,255,255,.7)', marginBottom: 6}}>Salaire accumulé à ce jour</div>
                      <div style={{fontSize: 28, fontWeight: 900, color: '#ffd700'}}>{gainAccumule.toLocaleString('fr-FR')} FCFA</div>
                      <div style={{fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 6, fontStyle: 'italic'}}>(Plafond mensuel fixé à {plafondSalaire.toLocaleString('fr-FR')} FCFA)</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {myPerfs.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">⭐</div><p>Aucune donnée de performance. Le surveillant saisit les informations quotidiennes.</p></div>
            ) : myPerfs.slice(0,10).map(perf => {
              const ponct = perf.heure_arrivee ? (perf.heure_arrivee <= '07:30' ? 30 : perf.heure_arrivee <= '08:00' ? 25 : 0) : 0;
              let gestion = perf.sacs_accroches ? 4 : 0;
              (perf.recrees || []).forEach(r => {
                const checkedCount = RECREE_CHECKS.filter(c => r[c.id]).length;
                gestion += checkedCount + (checkedCount === 5 ? 2 : 0); // Bonus +2 if all 5 are checked
              });
              const preparation = perf.preparation || 0;
              const total = ponct + gestion + preparation;
              const barColor = total >= 60 ? 'var(--green)' : total >= 40 ? 'var(--amber)' : 'var(--red)';
              
              let msgMotivation = "";
              if (total >= 60) msgMotivation = "Excellent travail aujourd'hui ! Votre rigueur est un modèle pour tous. Continuez sur cette belle lancée ! 🌟";
              else if (total >= 40) msgMotivation = "C'est une bonne journée ! Vous êtes sur la bonne voie. Quelques petits détails à peaufiner pour atteindre l'excellence demain. 💪";
              else msgMotivation = "Courage ! Aujourd'hui a peut-être été plus difficile, mais chaque jour est une occasion de faire mieux. L'équipe est là pour vous soutenir ! ❤️";

              return (
                <div key={perf.id} className="card" style={{marginBottom:12, borderTop: `4px solid ${barColor}`}}>
                  <div style={{padding:'.8rem 1rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:800}}>{new Date(perf.date_jour).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'})}</div>
                        <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>Arrivée : {perf.heure_arrivee||'—'} · Départ : {perf.heure_depart||'—'}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:18,fontWeight:900,color:barColor}}>{total}/75</div>
                        <div style={{fontSize:10,color:'var(--muted)'}}>TOTAL</div>
                      </div>
                    </div>
                    
                    <div style={{background:'var(--bg)', borderRadius:8, padding:'10px', marginBottom:12}}>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6}}>
                        <span style={{color:'var(--muted)'}}>⏱️ Ponctualité</span>
                        <span style={{fontWeight:700}}>{ponct}/30 pts</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6}}>
                        <span style={{color:'var(--muted)'}}>🧹 Gestion de classe</span>
                        <span style={{fontWeight:700}}>{gestion}/25 pts</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
                        <span style={{color:'var(--muted)'}}>📚 Préparation</span>
                        <span style={{fontWeight:700}}>{preparation}/20 pts</span>
                      </div>
                    </div>

                    <div style={{fontSize:12, fontStyle:'italic', color:'var(--muted)', lineHeight:1.4, textAlign:'center'}}>
                      "{msgMotivation}"
                    </div>
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
          <div className="modal" style={{maxHeight:'88vh',overflowY:'auto'}}>
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
                        {(selectedClasse?.nom === 'Petite Section' || selectedClasse?.nom === 'Grande Section') ? (
                          <select value={cpEntries[el.id]?.[obj.id] || 0} onChange={e => setCpEntries(prev => ({...prev, [el.id]: {...(prev[el.id]||{}), [obj.id]: parseInt(e.target.value)}}))} style={{padding:'4px 8px',borderRadius:8,border:'1px solid var(--border)',fontSize:12,background:'var(--bg)'}}>
                            <option value={0}>-- Choisir --</option>
                            <option value={25}>Debut d acquisition</option>
                            <option value={50}>En cours d acquisition</option>
                            <option value={75}>Acquis</option>
                            <option value={100}>Bien acquis</option>
                          </select>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <input type="number" min="0" max="100" value={cpEntries[el.id]?.[obj.id] || ''} placeholder="0" onChange={e => setCpEntries(prev => ({...prev, [el.id]: {...(prev[el.id]||{}), [obj.id]: Math.min(100,Math.max(0,parseInt(e.target.value)||0))}}))} style={{width:60,padding:'4px 8px',borderRadius:8,border:'1px solid var(--border)',fontSize:13,textAlign:'center'}} />
                            <span style={{fontSize:12,color:'var(--muted)'}}>%</span>
                          </div>
                        )}
                        <div className="obj-pct" style={{fontSize:11}}>
                          {(selectedClasse?.nom === 'Petite Section' || selectedClasse?.nom === 'Grande Section') ? (cpEntries[el.id]?.[obj.id] === 25 ? 'Debut' : cpEntries[el.id]?.[obj.id] === 50 ? 'En cours' : cpEntries[el.id]?.[obj.id] === 75 ? 'Acquis' : cpEntries[el.id]?.[obj.id] === 100 ? 'Bien acquis' : '--') : (cpEntries[el.id]?.[obj.id] || 0) + '%'}
                        </div>
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

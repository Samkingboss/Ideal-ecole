import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'
import NotificationCenter from './NotificationCenter'
import DossierPersonnel from './DossierPersonnel'
import DemandesEnseignant from './DemandesEnseignant'
import { objectifsMaternelle } from '../lib/programmes/maternelle'

const DOMAINES = [
  'Langage & prélecture', 'Écriture & motricité fine', 'Mathématiques & logique',
  'Sciences & découverte du monde', 'Art & expression artistique',
  'Motricité globale', 'Éducation civique & vivre ensemble'
]
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const CRENEAUX = ['08:00', '08:30', '09:00', '09:30', '10:15', '10:45', '11:15', '13:30', '14:00', '14:30']
const fonction = u => String(u?.fonction || '').toLowerCase()
const estAssistante = u => fonction(u).includes('assistante')
const langueDe = u => fonction(u).includes('-en-') || u?.langue === 'en' ? 'en' : 'fr'
const estObjectifAnglais = texte => /^(Mastered|Names?|Identifies|Writes?|Counts?|Recognizes|Performs?|Responds?|Draws?|Demonstrates|Washes|Throws|Eats|Flushes|Traces|Executes|Sorts|Conducts|Participates|Coordinates|Explores|Uses|Takes|Revises|Associates|Knows|Sings|Respects)\b/i.test(texte)
const lundiDe = d => { const x = new Date(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); x.setHours(0,0,0,0); return x }
const semaineA = d => Math.floor((lundiDe(d) - new Date('2026-09-07T00:00:00')) / 604800000) % 2 === 0
const classePour = (date, langue) => {
  const d = new Date(`${date}T12:00:00`); const idx = Math.max(0, Math.min(4, (d.getDay() || 7) - 1))
  const psFrancais = semaineA(d) ? idx % 2 === 0 : idx % 2 !== 0
  return (langue === 'fr') === psFrancais ? 'PS' : 'GS'
}
const dateISO = d => d.toISOString().slice(0,10)
const lundi = lundiDe(new Date())
const datesSemaine = Array.from({length:5}, (_,i) => { const d=new Date(lundi); d.setDate(d.getDate()+i); return dateISO(d) })
const carte = { background:'#fff', border:'1px solid #dbe7ee', borderRadius:16, padding:16, boxShadow:'0 8px 24px rgba(13,42,59,.06)' }
const bouton = { border:0, borderRadius:10, padding:'10px 14px', fontWeight:800, cursor:'pointer' }

export default function MaternelleApp({ user, onLogout }) {
  const assistant = estAssistante(user)
  const langue = langueDe(user)
  const [tab, setTab] = useState('semaine')
  const [preps, setPreps] = useState([])
  const [lectures, setLectures] = useState([])
  const [controles, setControles] = useState([])
  const [alertes, setAlertes] = useState([])
  const [referentiel, setReferentiel] = useState([])
  const [erreurSchema, setErreurSchema] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ date_cours:datesSemaine[0], heure_debut:'08:00', heure_fin:'08:30', trimestre:'t1', domaine:DOMAINES[0], objectif:'', deroulement:'', materiels:'', consignes_assistante:'' })
  const [lecture, setLecture] = useState({ objectif_compris:'', role_pendant_activite:'', lieu_recuperation:'', risque_identifie:'', observation:'' })

  const charger = async () => {
    const [p,l,c,a,classes] = await Promise.all([
      supabase.from('maternelle_preparations').select('*, users!maitresse_id(prenom,nom)').order('date_cours').order('heure_debut'),
      supabase.from('maternelle_lectures_assistantes').select('*'),
      supabase.from('maternelle_controles_materiel').select('*'),
      supabase.from('maternelle_alertes_accompagnement').select('*').order('constatee_le',{ascending:false}),
      supabase.from('classes').select('id,nom')
    ])
    const err = p.error || l.error || c.error || a.error
    if (err) setErreurSchema("Le module attend le script SQL « maternelle_workflow.sql » dans Supabase.")
    else setErreurSchema('')
    const L = (r) => Array.isArray(r?.data) ? r.data : []
    setPreps(L(p)); setLectures(L(l)); setControles(L(c)); setAlertes(L(a))
    const idsClasses = (Array.isArray(classes.data) ? classes.data : []).filter(x => /^(PS|GS|Petite Section|Grande Section)$/i.test(x.nom)).map(x=>x.id)
    if (idsClasses.length) {
      const {data:plans}=await supabase.from('planifications').select('id').in('classe_id',idsClasses)
      const ids=(plans||[]).map(x=>x.id)
      if (ids.length) {
        const {data:objs}=await supabase.from('objectifs').select('id,discipline,description,ordre').in('planification_id',ids).order('ordre')
        setReferentiel(objs||[])
      }
    }
  }
  useEffect(() => { charger() }, [])

  const mesPreps = useMemo(() => preps.filter(p => assistant ? p.langue === langue && p.statut !== 'brouillon' : p.maitresse_id === user.id), [preps, assistant, langue, user.id])
  const classeForm = classePour(form.date_cours, langue)
  const objectifsOfficiels = useMemo(() => objectifsMaternelle(classeForm, form.trimestre)
    .filter(o => langue === 'en' ? estObjectifAnglais(o.description) : !estObjectifAnglais(o.description)), [classeForm, form.trimestre, langue])

  const publier = async e => {
    e.preventDefault(); setMessage('')
    const materiels = form.materiels.split('\n').map(x=>x.trim()).filter(Boolean).map(nom=>({nom}))
    if (!form.objectif.trim() || !form.deroulement.trim()) return setMessage("L’objectif et le déroulement sont obligatoires.")
    const ligne = { ...form, classe_code:classePour(form.date_cours, langue), langue, maitresse_id:user.id, materiels, statut:'publiee', publiee_le:new Date().toISOString() }
    delete ligne.materielsTexte
    const { error } = await supabase.from('maternelle_preparations').upsert(ligne,{onConflict:'maitresse_id,date_cours,heure_debut'})
    if (error) return setMessage(error.message)
    await pushNotification(langue === 'fr' ? 'assistante_fr_maternelle' : 'assistante_en_maternelle', {
      titre:'📘 Nouvelle préparation maternelle', message:`${ligne.classe_code} · ${ligne.date_cours} à ${ligne.heure_debut}`, type:'maternelle', tabTarget:'maternelle'
    })
    setMessage('Préparation publiée et transmise à l’assistante et à la Direction.'); charger()
  }

  const confirmerLecture = async prep => {
    if (!lecture.objectif_compris.trim() || !lecture.role_pendant_activite.trim()) return setMessage('Répondez au minimum aux deux premières questions.')
    const { error } = await supabase.from('maternelle_lectures_assistantes').upsert({
      preparation_id:prep.id, assistante_id:user.id, ...lecture, lue_le:new Date().toISOString(), updated_at:new Date().toISOString()
    },{onConflict:'preparation_id'})
    if (error) return setMessage(error.message)
    setMessage('Lecture et réponses transmises à la maîtresse et à la Direction.'); charger()
  }

  const materielInstalle = async (prep, checked) => {
    const exist = lectures.find(x=>x.preparation_id===prep.id)
    if (!exist) return setMessage('Vous devez d’abord lire la préparation et répondre aux questions.')
    const { error } = await supabase.from('maternelle_lectures_assistantes').update({materiel_recupere:checked,materiel_installe:checked,installe_le:checked?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',exist.id)
    if (error) return setMessage(error.message); charger()
  }

  const controler = async (prep, statut) => {
    const debut = new Date(`${prep.date_cours}T${prep.heure_debut}`)
    const maintenant = new Date(); const delta = (debut-maintenant)/60000
    const dans_delai = delta >= 0 && delta <= 10
    const elements = (prep.materiels || []).map(m=>({nom:m.nom||m, present:statut==='complet'}))
    const { error } = await supabase.from('maternelle_controles_materiel').upsert({preparation_id:prep.id,maitresse_id:user.id,controle_le:maintenant.toISOString(),elements,statut,dans_delai},{onConflict:'preparation_id'})
    if (error) return setMessage(error.message)
    setMessage(dans_delai ? 'Contrôle enregistré dans le créneau des 10 minutes.' : 'Contrôle enregistré hors du créneau des 10 minutes.'); charger()
  }

  const prendreEnCharge = async alerte => {
    const { error } = await supabase.from('maternelle_alertes_accompagnement').update({assistante_id:user.id,statut:'prise_en_charge',prise_en_charge_le:new Date().toISOString(),reponse_assistante:'Enfant pris en charge.'}).eq('id',alerte.id)
    if (error) return setMessage(error.message); charger()
  }

  return <div className="app-shell">
    <div className="topbar"><div><div className="topbar-logo">IDEAL MATERNELLE</div><div className="topbar-sub">{assistant?'Assistante':'Maîtresse'} · {langue==='fr'?'Français':'English'}</div></div><div className="topbar-user"><NotificationCenter user={user} role={assistant?`assistante_${langue}_maternelle`:'professeur'} onNavigateTab={setTab}/><button className="btn-logout" onClick={onLogout}>Déconnexion</button></div></div>
    <div className="bottom-nav" role="tablist">
      {[['semaine','🗓️','Semaine'],[assistant?'lecture':'preparation',assistant?'📖':'✍️',assistant?'Lectures':'Préparer'],['materiel','🧰','Matériel'],['alertes','🚨','Enfants'],['rh','💼','RH']].map(([id,ic,label])=><button key={id} className={`nav-item ${tab===id?'active':''}`} onClick={()=>setTab(id)}><div className="nav-icon">{ic}</div><span>{label}</span></button>)}
    </div>
    <main className="page-content" style={{paddingBottom:100}}>
      {erreurSchema&&<div className="error-msg">⚙️ {erreurSchema}</div>}{message&&<div style={{...carte,borderColor:'#7dd3fc',background:'#f0f9ff',marginBottom:14}}>{message}</div>}
      {tab==='semaine'&&<><div className="section-head"><div><div className="section-title">Rotation de la semaine {semaineA(new Date())?'A':'B'}</div><div style={{fontSize:12,color:'var(--muted)'}}>Alternance équilibrée sur deux semaines</div></div></div><div style={{display:'grid',gap:10}}>{datesSemaine.map((date,i)=>{const cl=classePour(date,langue);return <div key={date} style={{...carte,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><b>{JOURS[i]}</b><div style={{fontSize:12,color:'var(--muted)'}}>{new Date(date+'T12:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})}</div></div><div style={{fontWeight:900,color:cl==='PS'?'#d97706':'#0369a1'}}>{cl} · {langue==='fr'?'FRANÇAIS':'ENGLISH'}</div></div>})}</div></>}
      {tab==='preparation'&&!assistant&&<><div className="section-title" style={{marginBottom:12}}>Nouvelle préparation</div><form onSubmit={publier} style={{...carte,display:'grid',gap:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}><input className="form-input" type="date" value={form.date_cours} onChange={e=>setForm({...form,date_cours:e.target.value})}/><select className="form-select" value={form.heure_debut} onChange={e=>setForm({...form,heure_debut:e.target.value})}>{CRENEAUX.map(x=><option key={x}>{x}</option>)}</select><input className="form-input" type="time" value={form.heure_fin} onChange={e=>setForm({...form,heure_fin:e.target.value})}/></div><div style={{fontWeight:900}}>Classe calculée par rotation : {classeForm}</div><select className="form-select" value={form.trimestre} onChange={e=>setForm({...form,trimestre:e.target.value,objectif:''})}><option value="t1">1er trimestre</option><option value="t2">2e trimestre</option><option value="t3">3e trimestre</option></select><select className="form-select" value={form.domaine} onChange={e=>setForm({...form,domaine:e.target.value,objectif:''})}>{DOMAINES.map(x=><option key={x}>{x}</option>)}</select><select className="form-select" value={form.objectif} onChange={e=>setForm({...form,objectif:e.target.value})}><option value="">Choisir un objectif officiel ({objectifsOfficiels.length})</option>{objectifsOfficiels.filter(o=>form.domaine.toLowerCase().includes(o.domaine.toLowerCase().split(' ')[0])).map(o=><option key={o.id} value={o.description}>{o.description}</option>)}</select>{referentiel.length>0&&<div style={{fontSize:11,color:'#64748b'}}>Le référentiel Supabase est également synchronisé : {referentiel.length} objectif(s) disponible(s).</div>}<textarea className="form-input" rows="2" placeholder="Objectif officiel sélectionné" value={form.objectif} readOnly/><textarea className="form-input" rows="4" placeholder="Déroulement du cours" value={form.deroulement} onChange={e=>setForm({...form,deroulement:e.target.value})}/><textarea className="form-input" rows="4" placeholder={'Matériel nécessaire — un élément par ligne\nEx. Cartes-images\nPeinture rouge'} value={form.materiels} onChange={e=>setForm({...form,materiels:e.target.value})}/><textarea className="form-input" rows="2" placeholder="Consignes particulières à l’assistante" value={form.consignes_assistante} onChange={e=>setForm({...form,consignes_assistante:e.target.value})}/><button style={{...bouton,background:'#00a8e0',color:'#fff'}}>Publier la préparation</button></form></>}
      {tab==='lecture'&&assistant&&<ListePreps preps={mesPreps} lectures={lectures} renderActions={p=><div style={{display:'grid',gap:8,marginTop:12}}><textarea className="form-input" placeholder="Quel est l’objectif principal ?" onChange={e=>setLecture({...lecture,objectif_compris:e.target.value})}/><textarea className="form-input" placeholder="Quel sera votre rôle pendant l’activité ?" onChange={e=>setLecture({...lecture,role_pendant_activite:e.target.value})}/><input className="form-input" placeholder="Où récupérer le matériel ?" onChange={e=>setLecture({...lecture,lieu_recuperation:e.target.value})}/><input className="form-input" placeholder="Difficulté ou risque identifié" onChange={e=>setLecture({...lecture,risque_identifie:e.target.value})}/><button style={{...bouton,background:'#0f766e',color:'#fff'}} onClick={()=>confirmerLecture(p)}>Confirmer la lecture et envoyer</button></div>}/>} 
      {tab==='materiel'&&<ListePreps preps={mesPreps} lectures={lectures} controles={controles} renderActions={p=>assistant?<label style={{display:'flex',gap:8,marginTop:12,fontWeight:800}}><input type="checkbox" checked={!!lectures.find(x=>x.preparation_id===p.id)?.materiel_installe} onChange={e=>materielInstalle(p,e.target.checked)}/> Matériel récupéré et installé en classe</label>:<div style={{display:'flex',gap:8,marginTop:12}}><button style={{...bouton,background:'#16a34a',color:'#fff'}} onClick={()=>controler(p,'complet')}>Tout est présent</button><button style={{...bouton,background:'#f59e0b',color:'#fff'}} onClick={()=>controler(p,'incomplet')}>Incomplet</button><button style={{...bouton,background:'#dc2626',color:'#fff'}} onClick={()=>controler(p,'absent')}>Absent</button></div>}/>} 
      {tab==='alertes'&&<><div className="section-title" style={{marginBottom:12}}>Alertes d’accompagnement</div>{alertes.length===0?<div className="empty-state">Aucune alerte active.</div>:alertes.map(a=><div key={a.id} style={{...carte,marginBottom:10,borderLeft:`5px solid ${a.urgence==='critique'?'#dc2626':'#f59e0b'}`}}><b>{a.eleve_nom} · {a.classe_code}</b><div>{a.toilette} — {a.situation}</div><small>{new Date(a.constatee_le).toLocaleString('fr-FR')} · {a.statut}</small>{assistant&&a.statut==='signalee'&&<button style={{...bouton,display:'block',marginTop:10,background:'#dc2626',color:'#fff'}} onClick={()=>prendreEnCharge(a)}>Je prends en charge maintenant</button>}</div>)}</>}
      {tab==='rh'&&<div style={{display:'grid',gap:18}}><DossierPersonnel user={user} roleLabel={assistant?'Assistante maternelle':'Maîtresse maternelle'}/><DemandesEnseignant user={user} portalLabel="Portail maternelle" personnelLabel={assistant?'Assistante maternelle':'Maîtresse maternelle'}/></div>}
    </main>
  </div>
}

function ListePreps({preps,lectures=[],controles=[],renderActions}) {
  return <><div className="section-title" style={{marginBottom:12}}>Séances publiées</div>{preps.length===0?<div className="empty-state">Aucune préparation publiée.</div>:preps.map(p=>{const l=lectures.find(x=>x.preparation_id===p.id),c=controles.find(x=>x.preparation_id===p.id);return <article key={p.id} style={{...carte,marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{p.classe_code} · {p.date_cours} à {String(p.heure_debut).slice(0,5)}</b><span>{p.langue==='fr'?'🇫🇷':'🇬🇧'}</span></div><h3 style={{margin:'8px 0 4px'}}>{p.objectif}</h3><div style={{fontSize:12,color:'#475569'}}>{p.domaine}</div><p>{p.deroulement}</p><div style={{background:'#f8fafc',padding:10,borderRadius:10}}><b>Matériel :</b> {(p.materiels||[]).map(x=>x.nom||x).join(', ')||'Aucun'}</div><div style={{fontSize:11,marginTop:8,color:'#64748b'}}>Assistante : {l?`lu le ${new Date(l.lue_le).toLocaleString('fr-FR')}`:'lecture en attente'} · Contrôle maîtresse : {c?`${c.statut}${c.dans_delai?' · à temps':' · hors délai'}`:'en attente'}</div>{renderActions?.(p)}</article>})}</>
}

export function MaternelleDirection() {
  const [data,setData]=useState({preps:[],lectures:[],controles:[],rondes:[],alertes:[]})
  const charger=async()=>{const [p,l,c,r,a]=await Promise.all([supabase.from('maternelle_preparations').select('*,users!maitresse_id(prenom,nom)').order('date_cours',{ascending:false}),supabase.from('maternelle_lectures_assistantes').select('*'),supabase.from('maternelle_controles_materiel').select('*'),supabase.from('maternelle_rondes_classes').select('*').order('effectuee_le',{ascending:false}),supabase.from('maternelle_alertes_accompagnement').select('*').order('constatee_le',{ascending:false})]);setData({preps:p.data||[],lectures:l.data||[],controles:c.data||[],rondes:r.data||[],alertes:a.data||[]})}
  useEffect(()=>{charger()},[])
  const cloturer=async id=>{await supabase.from('maternelle_alertes_accompagnement').update({statut:'cloturee',cloturee_le:new Date().toISOString()}).eq('id',id);charger()}
  const kpis=[['Préparations',data.preps.length],['Lues par les assistantes',data.lectures.length],['Contrôles à temps',data.controles.filter(x=>x.dans_delai).length],['Rondes conformes',data.rondes.filter(x=>x.resultat==='conforme').length],['Alertes ouvertes',data.alertes.filter(x=>x.statut!=='cloturee').length]]
  return <div><div className="section-head"><div><div className="section-title">Pilotage de la maternelle</div><div style={{fontSize:12,color:'var(--muted)'}}>Préparations, responsabilités et respect des délais</div></div><button className="btn-sm" onClick={charger}>Actualiser</button></div><div className="kpi-grid">{kpis.map(([l,v])=><div className="kpi-card" key={l}><div className="kpi-value">{v}</div><div className="kpi-label">{l}</div></div>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:14,marginTop:16}}><div style={carte}><h3>Dernières séances</h3>{data.preps.slice(0,8).map(p=>{const l=data.lectures.find(x=>x.preparation_id===p.id),c=data.controles.find(x=>x.preparation_id===p.id);return <div key={p.id} style={{padding:'10px 0',borderBottom:'1px solid #e2e8f0'}}><b>{p.date_cours} · {p.classe_code} · {p.objectif}</b><div style={{fontSize:11,color:'#64748b'}}>{p.users?.prenom} {p.users?.nom} · Assistante {l?'✓':'—'} · Matériel {c?(c.dans_delai?'✓ à temps':'⚠ hors délai'):'—'}</div></div>})}</div><div style={carte}><h3>Rondes et alertes</h3>{data.rondes.slice(0,5).map(r=><div key={r.id} style={{padding:'8px 0'}}><b>{r.date_ronde} · {r.classe_code}</b> — {r.resultat}</div>)}{data.alertes.slice(0,5).map(a=><div key={a.id} style={{padding:'8px 0',color:a.statut==='cloturee'?'#64748b':'#b91c1c'}}><b>{a.eleve_nom}</b> · {a.toilette} · {a.statut}{a.statut!=='cloturee'&&<button className="btn-sm" style={{marginLeft:8}} onClick={()=>cloturer(a.id)}>Clôturer</button>}</div>)}</div></div></div>
}

export function MaternelleSurveillance({user}) {
  const [classe,setClasse]=useState('PS'),[assistantes,setAssistantes]=useState([]),[eleves,setEleves]=useState([]),[msg,setMsg]=useState('')
  const [ronde,setRonde]=useState({tables_rangees:false,classe_propre:false,materiel_range:false,effets_personnels_ranges:false,passages_degages:false,aucun_danger:false,observation:''})
  const [alerte,setAlerte]=useState({eleve_id:'',eleve_nom:'',toilette:'Toilettes PS',situation:'Enfant appelant depuis les toilettes',urgence:'haute',assistante_id:''})
  useEffect(()=>{(async()=>{const [{data:u},{data:e}]=await Promise.all([supabase.from('users').select('*').ilike('fonction','assistante%').eq('actif',true),supabase.from('eleves').select('id,prenom,nom,classes(nom)').eq('actif',true)]);setAssistantes(u||[]);setEleves((e||[]).filter(x=>['PS','GS','Petite Section','Grande Section'].includes(x.classes?.nom)))})()},[])
  const envoyerRonde=async()=>{const score=['tables_rangees','classe_propre','materiel_range','effets_personnels_ranges','passages_degages','aucun_danger'].filter(k=>ronde[k]).length;const resultat=score===6?'conforme':score>=4?'a_ameliorer':score>=2?'non_conforme':'urgent';const {error}=await supabase.from('maternelle_rondes_classes').upsert({...ronde,date_ronde:dateISO(new Date()),classe_code:classe,surveillant_id:user.id,assistante_id:alerte.assistante_id||null,resultat,effectuee_le:new Date().toISOString()},{onConflict:'date_ronde,classe_code'});setMsg(error?error.message:`Ronde enregistrée : ${resultat}.`)}
  const signaler=async()=>{const e=eleves.find(x=>x.id===alerte.eleve_id);const ligne={...alerte,eleve_nom:alerte.eleve_nom||(e?`${e.prenom} ${e.nom}`:''),classe_code:classe,signalee_par:user.id,constatee_le:new Date().toISOString(),statut:'signalee'};if(!ligne.eleve_nom)return setMsg("Choisissez ou indiquez l’enfant.");const {data,error}=await supabase.from('maternelle_alertes_accompagnement').insert(ligne).select().single();if(error)return setMsg(error.message);await pushNotification([ligne.assistante_id,'directeur'].filter(Boolean),{titre:'🚨 Alerte accompagnement enfant',message:`${ligne.eleve_nom} · ${ligne.toilette}`,type:'maternelle',tabTarget:'maternelle',ref:data.id});setMsg('Alerte horodatée et transmise immédiatement.')}
  return <div><div className="section-title" style={{marginBottom:12}}>Contrôle maternelle</div><div style={{display:'flex',gap:8,marginBottom:12}}>{['PS','GS'].map(x=><button key={x} style={{...bouton,background:classe===x?'#0d2a3b':'#e2e8f0',color:classe===x?'#fff':'#0d2a3b'}} onClick={()=>setClasse(x)}>{x}</button>)}</div>{msg&&<div style={{...carte,marginBottom:12}}>{msg}</div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(310px,1fr))',gap:14}}><div style={carte}><h3>Ronde avant la montée des couleurs</h3>{[['tables_rangees','Tables et bancs rangés'],['classe_propre','Classe propre'],['materiel_range','Matériel pédagogique rangé'],['effets_personnels_ranges','Effets personnels rangés'],['passages_degages','Passages dégagés'],['aucun_danger','Aucun danger visible']].map(([k,l])=><label key={k} style={{display:'flex',gap:8,padding:'8px 0'}}><input type="checkbox" checked={ronde[k]} onChange={e=>setRonde({...ronde,[k]:e.target.checked})}/>{l}</label>)}<select className="form-select" value={alerte.assistante_id} onChange={e=>setAlerte({...alerte,assistante_id:e.target.value})}><option value="">Assistante responsable</option>{assistantes.map(a=><option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>)}</select><textarea className="form-input" style={{marginTop:8}} placeholder="Observation" value={ronde.observation} onChange={e=>setRonde({...ronde,observation:e.target.value})}/><button style={{...bouton,background:'#0f766e',color:'#fff',marginTop:8}} onClick={envoyerRonde}>Enregistrer la ronde</button></div><div style={{...carte,borderColor:'#fecaca'}}><h3>🚨 Alerte accompagnement enfant</h3><select className="form-select" value={alerte.eleve_id} onChange={e=>setAlerte({...alerte,eleve_id:e.target.value})}><option value="">Choisir l’enfant</option>{eleves.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}</select><input className="form-input" style={{marginTop:8}} placeholder="Ou saisir le nom de l’enfant" value={alerte.eleve_nom} onChange={e=>setAlerte({...alerte,eleve_nom:e.target.value})}/><input className="form-input" style={{marginTop:8}} value={alerte.toilette} onChange={e=>setAlerte({...alerte,toilette:e.target.value})}/><textarea className="form-input" style={{marginTop:8}} value={alerte.situation} onChange={e=>setAlerte({...alerte,situation:e.target.value})}/><select className="form-select" style={{marginTop:8}} value={alerte.urgence} onChange={e=>setAlerte({...alerte,urgence:e.target.value})}><option value="normale">Normale</option><option value="haute">Haute</option><option value="critique">Critique</option></select><button style={{...bouton,background:'#dc2626',color:'#fff',marginTop:8}} onClick={signaler}>Signaler maintenant</button></div></div></div>
}

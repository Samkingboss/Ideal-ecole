import ProgrammeManuel from './ProgrammeManuel'
import CheckpointModal from './CheckpointModal'
import AgendaCalendrier from './AgendaCalendrier'
import PreparationIA from './PreparationIA'
import MaPrime from './MaPrime'
import FinDeCours from './FinDeCours'
import MonEmploiDuTemps from './MonEmploiDuTemps'
import DossierPersonnel from './DossierPersonnel'
import DemandesEnseignant from './DemandesEnseignant'
import DemandeMateriel from './DemandeMateriel'
import NotificationCenter from './NotificationCenter'
import DevoirsDocument from './DevoirsDocument'
import SommaireBoscherDocument from './SommaireBoscherDocument'
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

// ═══════════════════════════════════════════════════════════════════
// SESSIONS ENSEIGNANT (Refonte 6 Sessions pour simplifier la navigation)
// ═══════════════════════════════════════════════════════════════════
const PROF_SESSIONS = [
  { id: 'emploi',     icon: '🗓️', label: 'Emploi du Temps & Agenda' },
  { id: 'pedagogie',  icon: '📚', label: 'Pédagogie & Cours' },
  { id: 'classe',     icon: '🏫', label: 'Ma Classe & Évaluations' },
  { id: 'discipline', icon: '⚖️', label: 'Discipline' },
  { id: 'perfs',      icon: '🏆', label: 'Perfs & Ma Prime' },
  { id: 'rh',         icon: '💼', label: 'Dossier RH & Demandes' },
]

export default function ProfApp({ user, onLogout }) {
  const [activeProfSession, setActiveProfSession] = useState('emploi')
  const [tab, setTab] = useState('edt')
  const [showBoscherModal, setShowBoscherModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [periodes, setPeriodes] = useState([])
  const [eleves, setEleves] = useState([])
  const [planifications, setPlanifications] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [selectedClasse, setSelectedClasse] = useState(null)
  const [selectedPeriode, setSelectedPeriode] = useState(null)
  const [activeProgObjId, setActiveProgObjId] = useState(null)
  const [activeCpObjId, setActiveCpObjId] = useState(null)
  const [showCpModal, setShowCpModal] = useState(false)
  const [cpEntries, setCpEntries] = useState({})
  const [cpDate, setCpDate] = useState(new Date().toISOString().slice(0,10))
  const [programmeData, setProgrammeData] = useState([])
  const [msgEleve, setMsgEleve] = useState(null)
  const [msgType, setMsgType] = useState('comportement')
  const [msgBody, setMsgBody] = useState('')
  const [selectedCpDate, setSelectedCpDate] = useState(null)
  const [msgPreview, setMsgPreview] = useState(false)
  const [msgDetails, setMsgDetails] = useState({})
  const [schoolNum] = useState('22390190007')
  const [selectedMatiere, setSelectedMatiere] = useState(null)
  const [myPerfs, setMyPerfs] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresForce, setJoursOuvresForce] = useState(null)
  const [preparations, setPreparations] = useState([])
  const [newPrepa, setNewPrepa] = useState({ classe_id: '', date_cours: new Date().toISOString().slice(0, 10), heure_cours: '08:00', file: null })
  
  // Devoirs states
  const [devoirs, setDevoirs] = useState([
    { id: 1, matiere: 'Mathématiques', titre: 'Exercices de Calcul & Problèmes', consignes: 'Résoudre les exercices 1, 2 et 3 page 45 dans le cahier de devoirs.', aRendrePour: 'Lundi' },
    { id: 2, matiere: 'Lecture & Français', titre: 'Lecture accompagnée', consignes: 'Lire le chapitre 3 et répondre aux questions 1 à 4.', aRendrePour: 'Mardi' }
  ])
  const [newDevoir, setNewDevoir] = useState({ matiere: '', titre: '', consignes: '', aRendrePour: '' })
  const [showDevoirsModal, setShowDevoirsModal] = useState(false)

  // Discipline states
  const [allEleves, setAllEleves] = useState([])
  const [searchDisc, setSearchDisc] = useState('')
  const [foundDiscEleves, setFoundDiscEleves] = useState([])
  const [selectedDiscEleve, setSelectedDiscEleve] = useState(null)
  const [selectedDiscClassId, setSelectedDiscClassId] = useState('')
  const [discGravite, setDiscGravite] = useState('mineure')
  const [discMotif, setDiscMotif] = useState('')
  const [discLoading, setDiscLoading] = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => { loadProgramme() }, [selectedClasse])

  // Objectifs de la classe, pour les checkpoints et la fiche de fin de cours.
  //
  // Un objectif n'appartient pas à une matière : il pend à une planification de
  // la classe (`objectifs.planification_id`) et porte lui-même sa discipline.
  // L'ancienne requête filtrait sur `objectifs.matiere_id`, colonne qui
  // n'existe pas : elle échouait en 400 à chaque changement de classe et le
  // programme s'affichait vide pour tout le monde, sans qu'aucune erreur ne
  // soit visible.
  const loadProgramme = async () => {
    if (!selectedClasse || !user) return
    const { data: plans, error: ePlans } = await supabase
      .from('planifications').select('id').eq('classe_id', selectedClasse.id)
    if (ePlans) { console.error('planifications', ePlans); setProgrammeData([]); return }

    const ids = (plans || []).map(p => p.id)
    if (!ids.length) { setProgrammeData([]); return }

    const { data: objs, error: eObjs } = await supabase
      .from('objectifs').select('id, discipline, description, ordre')
      .in('planification_id', ids).order('ordre')
    if (eObjs) { console.error('objectifs', eObjs); setProgrammeData([]); return }

    // Regroupement par discipline : c'est ce que les écrans appellent « matière ».
    const parDiscipline = new Map()
    ;(objs || []).forEach(o => {
      const cle = o.discipline || 'Sans discipline'
      if (!parDiscipline.has(cle)) parDiscipline.set(cle, [])
      parDiscipline.get(cle).push({ id: o.id, nom: o.description })
    })
    setProgrammeData([...parDiscipline].map(([nom, objectifs]) => ({ id: nom, nom, objectifs })))
  }

  const loadData = async () => {
    try {
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
      const { data: allEl } = await supabase.from('eleves').select('*, classes(nom)').eq('actif', true).order('nom')
      setAllEleves(allEl || [])
      
      const myClasses = (profClasses || []).map(pc => pc.classes).filter(Boolean)
      setClasses(myClasses)
      setAllClasses(cl || [])
      setPeriodes(per || [])
      setEvenements(ev || [])
      if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)
      
      if (myClasses.length > 0) setSelectedClasse(myClasses[0])
      if (per && per.length > 0) setSelectedPeriode(per[0])

      if (myClasses.length > 0) {
        const { data: el } = await supabase.from('eleves').select('*').eq('classe_id', myClasses[0].id).order('nom')
        setEleves(el || [])
      }

      // `planifications` n'a pas de colonne `prof_id` : l'auteur est `created_by`.
      const { data: plans } = await supabase.from('planifications').select('*').eq('created_by', user.id)
      setPlanifications(plans || [])

      const { data: cps } = await supabase.from('checkpoints').select('*, progressions(*, objectifs(*, matieres(*)))').order('date_checkpoint')
      setCheckpoints(cps || [])

      const { data: perfs } = await supabase.from('performances').select('*').eq('prof_id', user.id)
      setMyPerfs(perfs || [])

      // La colonne est `user_id`, pas `prof_id` : filtrer sur `prof_id`
      // renvoyait un 400 et la liste des préparations restait vide.
      const { data: preps } = await supabase.from('preparations').select('*').eq('user_id', user.id).order('heure_depot', { ascending: false })
      setPreparations(preps || [])

      const { data: devData } = await supabase.from('devoirs').select('*').order('date_rendu', { ascending: true })
      if (devData && devData.length > 0) setDevoirs(devData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDevoir = () => {
    if (!newDevoir.matiere || !newDevoir.titre) return alert('Matière et Titre requis.')
    const item = {
      id: Date.now(),
      matiere: newDevoir.matiere,
      titre: newDevoir.titre,
      consignes: newDevoir.consignes || 'Exercices du soir.',
      aRendrePour: newDevoir.aRendrePour || 'Prochain cours'
    }
    setDevoirs([item, ...devoirs])
    setNewDevoir({ matiere: '', titre: '', consignes: '', aRendrePour: '' })
  }

  const getClasseEleves = () => {
    if (!selectedClasse) return []
    return eleves.filter(e => e.classe_id === selectedClasse.id)
  }

  const getCurrentPlan = () => {
    if (!selectedClasse || !selectedPeriode) return null
    return planifications.find(p => p.classe_id === selectedClasse.id && p.periode_id === selectedPeriode.id)
  }

  const reportIncident = async () => {
    if (!selectedDiscEleve || !discMotif.trim()) return
    setDiscLoading(true)
    const { error } = await supabase.from('disciplines').insert({
      eleve_id: selectedDiscEleve.id,
      prof_id: user.id,
      motif: discMotif,
      gravite: discGravite,
      statut: 'signalé'
    })
    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      alert('Incident signalé au surveillant !')
      setDiscMotif('')
      setSelectedDiscEleve(null)
      setSelectedDiscClassId('')
      setSearchDisc('')
    }
    setDiscLoading(false)
  }

  const sendWhatsApp = (eleve) => {
    if (!eleve) return
    const msg = msgBody || `Chers parents de *${eleve.prenom} ${eleve.nom}*,\n\n${msgType === 'comportement' ? 'Nous souhaitons vous informer d un incident.' : 'Voici les resultats de votre enfant.'}\n\n— IDEAL Ecole Internationale Bilingue\n+223 90 19 00 07`
    window.open(`https://wa.me/${schoolNum}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const classEleves = getClasseEleves()

  return (
    <div className="app-shell">
      {/* Topbar principale */}
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">ESPACE ENSEIGNANT • {user.prenom} {user.nom}</div>
          </div>
        </div>
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationCenter user={user} role="prof" onNavigateTab={setTab} />
          <span className="role-badge role-professeur">{user.langue === 'en' ? 'English' : 'Français'}</span>
          <button className="btn-logout" onClick={onLogout}>Déconnexion</button>
        </div>
      </div>

      {/* Barre de navigation des 6 SESSIONS ENSEIGNANT.
          Un seul conteneur de défilement, et c'est `.top-nav-secondary`.
          Il y en avait deux, imbriqués : la classe défile déjà (overflow-x
          auto), et on l'avait enfermée dans un second conteneur défilant en
          lui imposant `width: max-content`. La classe n'avait alors plus rien
          à faire défiler, et son `overscroll-behavior-x: contain` empêchait le
          geste de remonter au conteneur parent, seul à déborder vraiment. Le
          doigt ne déplaçait donc plus rien, alors que le défilement par le
          code fonctionnait — d'où une barre qui paraissait figée.
          `.top-nav-item` porte déjà `flex-shrink: 0`, les boutons gardent leur
          largeur et la barre déborde comme il faut. */}
      <div className="top-nav-secondary" style={{ borderBottom: '2px solid var(--border)', boxShadow: 'none', padding: '6px 8px' }}>
          {PROF_SESSIONS.map(s => {
            const isActive = activeProfSession === s.id
            return (
              <button
                key={s.id}
                className={`top-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveProfSession(s.id)
                  if (s.id === 'emploi') setTab('edt')
                  else if (s.id === 'pedagogie') setTab('programme')
                  else if (s.id === 'classe') setTab('classe')
                  else if (s.id === 'discipline') setTab('discipline')
                  else if (s.id === 'perfs') setTab('prime')
                  else if (s.id === 'rh') setTab('dossier')
                }}
                style={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  padding: '9px 16px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{s.icon}</span> <span>{s.label}</span>
              </button>
            )
          })}
      </div>

      {/* Sub-Nav Bar (Sous-Onglets de la Session Active)
          La rangée coulisse, elle ne se comprime pas. Sans `width: max-content`,
          les boutons se partagent la largeur de l'écran et rétrécissent jusqu'à
          couper leur libellé sur quatre lignes — la barre paraît alors bloquée
          puisqu'il n'y a plus rien à faire défiler. `white-space: nowrap` est
          posé ici une seule fois : la propriété s'hérite jusqu'aux boutons.
          C'est exactement ce que fait la barre des sessions au-dessus. */}
      <div style={{ background: 'var(--card)', padding: '8px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: 8, width: 'max-content', whiteSpace: 'nowrap' }}>
        {activeProfSession === 'emploi' && (
          <>
            <button onClick={() => setTab('edt')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'edt' ? '#00a8e0' : 'var(--bg)', color: tab === 'edt' ? '#fff' : 'var(--muted)' }}>🗓️ Mon Emploi du Temps</button>
            <button onClick={() => setTab('agenda')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'agenda' ? '#00a8e0' : 'var(--bg)', color: tab === 'agenda' ? '#fff' : 'var(--muted)' }}>📅 Agenda &amp; Événements</button>
          </>
        )}

        {activeProfSession === 'pedagogie' && (
          <>
            <button onClick={() => setTab('programme')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'programme' ? '#00a8e0' : 'var(--bg)', color: tab === 'programme' ? '#fff' : 'var(--muted)' }}>📘 Programme du manuel</button>
            <button onClick={() => setShowBoscherModal(true)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: '#047857', color: '#fff', boxShadow: '0 2px 8px rgba(4,120,87,0.3)' }}>📖 Sommaire Boscher (Pages 4-72)</button>
            <button onClick={() => setTab('progression')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'progression' ? '#00a8e0' : 'var(--bg)', color: tab === 'progression' ? '#fff' : 'var(--muted)' }}>📈 Progressions &amp; Checkpoints</button>
            <button onClick={() => setTab('fincours')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'fincours' ? '#00a8e0' : 'var(--bg)', color: tab === 'fincours' ? '#fff' : 'var(--muted)' }}>🎯 Fin de cours &amp; Clés</button>
          </>
        )}

        {activeProfSession === 'classe' && (
          <>
            <button onClick={() => setTab('classe')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'classe' ? '#00a8e0' : 'var(--bg)', color: tab === 'classe' ? '#fff' : 'var(--muted)' }}>📋 Présence &amp; Liste Classe</button>
            <button onClick={() => setTab('devoirs')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'devoirs' ? '#00a8e0' : 'var(--bg)', color: tab === 'devoirs' ? '#fff' : 'var(--muted)' }}>📖 Cahier de Devoirs du Soir</button>
            <button onClick={() => setTab('messages')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'messages' ? '#00a8e0' : 'var(--bg)', color: tab === 'messages' ? '#fff' : 'var(--muted)' }}>💬 Messages Parents (WhatsApp)</button>
          </>
        )}

        {activeProfSession === 'discipline' && (
          <button onClick={() => setTab('discipline')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: '#00a8e0', color: '#fff' }}>⚖️ Signalements &amp; Discipline</button>
        )}

        {activeProfSession === 'perfs' && (
          <>
            <button onClick={() => setTab('prime')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'prime' ? '#00a8e0' : 'var(--bg)', color: tab === 'prime' ? '#fff' : 'var(--muted)' }}>🏆 Ma Prime d'été</button>
            <button onClick={() => setTab('perfs')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'perfs' ? '#00a8e0' : 'var(--bg)', color: tab === 'perfs' ? '#fff' : 'var(--muted)' }}>⭐ Mes Performances</button>
          </>
        )}

        {activeProfSession === 'rh' && (
          <>
            <button onClick={() => setTab('dossier')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'dossier' ? '#00a8e0' : 'var(--bg)', color: tab === 'dossier' ? '#fff' : 'var(--muted)' }}>📂 Mon Dossier RH</button>
            <button onClick={() => setTab('demandes')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'demandes' ? '#00a8e0' : 'var(--bg)', color: tab === 'demandes' ? '#fff' : 'var(--muted)' }}>📩 Demandes &amp; Justificatifs</button>
            <button onClick={() => setTab('materiel')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'materiel' ? '#00a8e0' : 'var(--bg)', color: tab === 'materiel' ? '#fff' : 'var(--muted)' }}>📦 Demande de matériel</button>
          </>
        )}
        </div>
      </div>

      <div className="page-content" style={{ padding: '1.5rem 1.2rem calc(130px + env(safe-area-inset-bottom))' }}>
        {/* Bandeau permanent prime d'été */}
        {tab !== 'prime' && <MaPrime user={user} compact onOuvrir={() => { setActiveProfSession('perfs'); setTab('prime'); }} />}

        {/* ════════ SESSION 1 : EMPLOI DU TEMPS & AGENDA ════════ */}
        {tab === 'edt' && <MonEmploiDuTemps user={user} />}

        {tab === 'agenda' && (
          <AgendaCalendrier checkpoints={checkpoints} selectedClasse={selectedClasse} periodes={periodes} anniversaires={eleves} />
        )}

        {/* ════════ SESSION 2 : PÉDAGOGIE & COURS ════════ */}
        {/* Le programme du manuel ne dépend ni de la classe ni du trimestre :
            il se lit sur les affectations de l'enseignant. Afficher ces deux
            listes sur cet onglet laisserait croire qu'elles le filtrent. */}
        {!loading && classes.length > 0 && (tab === 'progression' || tab === 'fincours' || tab === 'classe' || tab === 'devoirs') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1, minWidth: 140 }} value={selectedClasse?.id || ''} onChange={e => setSelectedClasse(classes.find(c => c.id === e.target.value))}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select className="form-select" style={{ flex: 1, minWidth: 140 }} value={selectedPeriode?.id || ''} onChange={e => setSelectedPeriode(periodes.find(p => p.id === e.target.value))}>
              {periodes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
        )}

        {tab === 'programme' && <ProgrammeManuel user={user} />}

        {tab === 'progression' && (
          <div>
            <div className="section-head"><div className="section-title">Progressions &amp; Checkpoints</div></div>
            {programmeData.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📚</div><p>Aucun programme défini.</p></div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {programmeData.map(mat => (
                    <button key={mat.id} onClick={() => setSelectedMatiere(mat.id === selectedMatiere ? null : mat.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: '2px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        borderColor: selectedMatiere === mat.id ? 'var(--accent)' : 'var(--border)',
                        background: selectedMatiere === mat.id ? 'var(--accent)' : 'var(--bg)',
                        color: selectedMatiere === mat.id ? '#fff' : 'var(--muted)'
                      }}>
                      {mat.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'fincours' && (
          <FinDeCours user={user} selectedClasse={selectedClasse} classEleves={classEleves} programmeData={programmeData} supabase={supabase} />
        )}

        {/* ════════ SESSION 3 : MA CLASSE & ÉLÈVES ════════ */}
        {tab === 'classe' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <button onClick={() => window.print()} style={{ background: '#0d2a3b', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🖨️ Imprimer Liste Classe</button>
            </div>
            <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ background: '#0d2a3b', color: '#fff', padding: '12px 16px', fontSize: 13, fontWeight: 800 }}>
                ÉLÈVES DE LA CLASSE DE {selectedClasse?.nom || ''} ({classEleves.length} élèves)
              </div>
              {classEleves.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{e.prenom} {e.nom}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Matricule: {e.matricule}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAHIER DE DEVOIRS DE MAISON (BLEU OCÉAN STUDIO) */}
        {tab === 'devoirs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0d2a3b', margin: 0 }}>📖 Cahier de Devoirs de Maison (Classe : {selectedClasse?.nom})</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Planifiez et imprimez les devoirs du soir aux standards de l'École IDEAL.</p>
              </div>

              <button
                onClick={() => setShowDevoirsModal(true)}
                style={{ background: 'linear-gradient(135deg, #0284c7, #0078b4)', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(2,132,199,0.3)' }}
              >
                🖨️ Aperçu &amp; Imprimer Fiche (Code Bleu Océan)
              </button>
            </div>

            {/* Saisie d'un Devoir */}
            <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 16 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 900 }}>+ Ajouter un Devoir de Maison</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <input className="form-input" placeholder="Matière (ex: Mathématiques)" value={newDevoir.matiere} onChange={e => setNewDevoir({ ...newDevoir, matiere: e.target.value })} />
                <input className="form-input" placeholder="Titre du devoir" value={newDevoir.titre} onChange={e => setNewDevoir({ ...newDevoir, titre: e.target.value })} />
                <input className="form-input" placeholder="À rendre pour (ex: Lundi)" value={newDevoir.aRendrePour} onChange={e => setNewDevoir({ ...newDevoir, aRendrePour: e.target.value })} />
              </div>
              <textarea className="form-input" rows={2} style={{ marginTop: 10 }} placeholder="Consignes précises pour l'élève..." value={newDevoir.consignes} onChange={e => setNewDevoir({ ...newDevoir, consignes: e.target.value })} />
              <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={handleAddDevoir}>Ajouter au Cahier de Devoirs</button>
            </div>

            {/* Liste des Devoirs Enregistrés */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {devoirs.map((d, i) => (
                <div key={d.id || i} className="card" style={{ padding: 16, borderLeft: '4px solid #0284c7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 900, color: '#0284c7', fontSize: 14 }}>📖 {d.matiere}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>⏰ Pour : {d.aRendrePour}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 6, color: '#0f172a' }}>{d.titre}</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{d.consignes}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div>
            <div className="section-head"><div className="section-title">Messages parents (WhatsApp)</div></div>
            <div className="form-group">
              <label className="form-label">Sélectionnez un élève</label>
              <select className="form-select" value={msgEleve?.id || ''} onChange={e => { setMsgEleve(classEleves.find(el => el.id === e.target.value)); setMsgBody(''); }}>
                <option value="">-- Sélectionnez un élève --</option>
                {classEleves.map(el => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
              </select>
            </div>
            {msgEleve && (
              <div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => sendWhatsApp(msgEleve)}>📲 Envoyer Message WhatsApp au Parent</button>
              </div>
            )}
          </div>
        )}

        {/* ════════ SESSION 4 : DISCIPLINE ════════ */}
        {tab === 'discipline' && (
          <div>
            <div className="section-head"><div className="section-title">⚖️ Signalement Incident Discipline</div></div>
            <div className="form-group">
              <label className="form-label">Motif de l'incident</label>
              <textarea className="form-input" rows={3} placeholder="Description..." value={discMotif} onChange={e => setDiscMotif(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={reportIncident}>Signaler au Surveillant Général</button>
          </div>
        )}

        {/* ════════ SESSION 5 : PERFORMANCES & MA PRIME ════════ */}
        {tab === 'prime' && <MaPrime user={user} />}
        {tab === 'perfs' && (
          <div className="card" style={{ padding: 20 }}>
            <h3>⭐ Mes Performances Enseignant</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Assiduité, dépôts des fiches de préparation et points de prime cumulés.</p>
          </div>
        )}

        {/* ════════ SESSION 6 : DOSSIER RH & DEMANDES ════════ */}
        {tab === 'dossier' && <DossierPersonnel user={user} profInfo={user} />}
        {tab === 'demandes' && <DemandesEnseignant user={user} />}

        {tab === 'materiel' && <DemandeMateriel user={user} />}
      </div>

      {/* MODAL APERÇU ET IMPRESSION CAHIER DE DEVOIRS (CODE COULEUR BLEU OCÉAN) */}
      {showDevoirsModal && (
        <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setShowDevoirsModal(false)} style={{ zIndex: 999999 }}>
          <div style={{ background: '#fff', borderRadius: 24, maxWidth: 880, width: '95%', maxHeight: '92vh', overflowY: 'auto', padding: 24, margin: '20px auto', position: 'relative' }}>
            <DevoirsDocument
              devoirsList={devoirs}
              classeNom={selectedClasse?.nom || 'CP1 Bilingue'}
              onClose={() => setShowDevoirsModal(false)}
            />
          </div>
        </div>
      )}

      {/* MODAL APERÇU ET TÉLÉCHARGEMENT SOMMAIRE BOSCHER */}
      {showBoscherModal && (
        <SommaireBoscherDocument onClose={() => setShowBoscherModal(false)} />
      )}
    </div>
  )
}

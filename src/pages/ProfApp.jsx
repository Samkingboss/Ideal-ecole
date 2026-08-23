import ProgrammeManuel from './ProgrammeManuel'
import CheckpointModal from './CheckpointModal'
import AgendaCalendrier from './AgendaCalendrier'
import PreparationIA from './PreparationIA'
import MaPrime from './MaPrime'
import FinDeCours from './FinDeCours'
import MonEmploiDuTemps from './MonEmploiDuTemps'
import DossierPersonnel from './DossierPersonnel'
import DemandesEnseignant from './DemandesEnseignant'
import SignalementIncident from './SignalementIncident'
import DemandeMateriel from './DemandeMateriel'
import NotificationCenter from './NotificationCenter'
import DevoirsDocument from './DevoirsDocument'
import SommaireBoscherDocument from './SommaireBoscherDocument'
import AccordionCard from '../components/ui/AccordionCard'
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

const MESSAGE_PARENT_INITIAL = {
  date: new Date().toISOString().slice(0, 10),
  heure: new Date().toTimeString().slice(0, 5),
  gravite: 'mineur',
  lieu: 'en classe',
  nature: 'a perturbé le déroulement du cours',
  description: '', sanction: '', matiere: '', note: '',
  appreciation: 'Très bien', libre: '',
}

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
  const [msgDetails, setMsgDetails] = useState(MESSAGE_PARENT_INITIAL)
  const [schoolNum] = useState('22390190007')
  const [selectedMatiere, setSelectedMatiere] = useState(null)
  const [myPerfs, setMyPerfs] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresForce, setJoursOuvresForce] = useState(null)
  const [preparations, setPreparations] = useState([])
  const [newPrepa, setNewPrepa] = useState({ classe_id: '', date_cours: new Date().toISOString().slice(0, 10), heure_cours: '08:00', file: null })
  
  // Devoirs states
  //
  // La liste part vide et vient de la base. Elle contenait auparavant un
  // devoir d'exemple codé en dur, qui s'affichait dans toutes les classes et
  // faisait croire que le cahier fonctionnait.
  const [devoirs, setDevoirs] = useState([])
  const [newDevoir, setNewDevoir] = useState({ matiere: '', objectif: '', aRendrePour: '', fichiers: [], destinataire_mode: 'classe', eleve_ids: [] })
  // Les matières que l'enseignant assure réellement. Il n'a pas à les
  // retaper : elles sont déjà dans ses affectations, et une matière saisie à
  // la main finit toujours par diverger de celle de l'emploi du temps
  // (« Maths » contre « Mathématiques »), ce qui casse tout rapprochement.
  const [mesMatieres, setMesMatieres] = useState([])
  const [devoirEnCours, setDevoirEnCours] = useState(false)
  const [devoirErreur, setDevoirErreur] = useState('')
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

  // Les devoirs de la classe ouverte, et d'elle seule.
  useEffect(() => {
    if (!selectedClasse) { setDevoirs([]); return }
    let annule = false
    ;(async () => {
      const { data } = await supabase
        .from('devoirs').select('*')
        .eq('classe_id', selectedClasse.id)
        .order('date_rendu', { ascending: false })
      if (!annule) setDevoirs(Array.isArray(data) ? data : [])
    })()
    return () => { annule = true }
  }, [selectedClasse])

  // Matières de l'enseignant pour la classe choisie. L'emploi du temps
  // raisonne en groupes (« CP1 »), la table des classes en identifiants : le
  // rapprochement se fait donc sur le nom de la classe.
  useEffect(() => {
    if (!user?.id) return
    let annule = false
    ;(async () => {
      const { data } = await supabase
        .from('affectations_matieres').select('groupe, matiere').eq('prof_id', user.id)
      if (annule) return
      const affectations = Array.isArray(data) ? data : []
      const pourLaClasse = affectations.filter(a => !selectedClasse || a.groupe === selectedClasse.nom)
      const liste = [...new Set((pourLaClasse.length ? pourLaClasse : affectations).map(a => a.matiere))].sort()
      setMesMatieres(liste)
      setNewDevoir(d => (d.matiere && !liste.includes(d.matiere) ? { ...d, matiere: '' } : d))
    })()
    return () => { annule = true }
  }, [user?.id, selectedClasse])

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

      // Chargés sans filtre, les devoirs de toutes les classes de l'école
      // s'affichaient dans le cahier de chacune. On ne garde que ceux de la
      // classe ouverte — voir l'effet ci-dessous, qui recharge à chaque
      // changement de classe.
      setDevoirs([])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Enregistrement d'un devoir.
  //
  // La version précédente n'écrivait que dans l'état local : le devoir
  // disparaissait au rechargement, sans le moindre message. Elle employait de
  // surcroît des noms de champs que la table ne connaît pas — `consignes` et
  // `aRendrePour` n'existent pas, la colonne s'appelle `description` et la
  // date de remise `date_rendu`.
  //
  // L'exercice photographié part dans le bucket `devoirs`, séparé de celui des
  // préparations : deux usages, deux durées de vie, deux publics.
  // Enregistrement d'un devoir.
  //
  // La version d'origine n'écrivait que dans l'état local : le devoir
  // disparaissait au rechargement, sans message. Elle employait de surcroît
  // des champs que la table ne connaît pas.
  //
  // Les exercices photographiés partent dans le bucket `devoirs`, séparé de
  // celui des préparations. Plusieurs images sont acceptées : un devoir tient
  // rarement sur une seule page de cahier.
  const handleAddDevoir = async () => {
    setDevoirErreur('')
    if (!newDevoir.matiere)          { setDevoirErreur('Choisissez la matière.'); return }
    if (!newDevoir.objectif.trim())  { setDevoirErreur("Indiquez l'objectif du devoir."); return }
    // `date_rendu` est obligatoire en base. Sans ce contrôle, l'enregistrement
    // partait quand même et revenait avec « null value violates not-null
    // constraint », que l'enseignant n'a aucun moyen d'interpréter.
    if (!newDevoir.aRendrePour)      { setDevoirErreur('Indiquez la date de remise.'); return }
    if (!selectedClasse)             { setDevoirErreur('Sélectionnez d’abord une classe.'); return }
    if (newDevoir.destinataire_mode === 'choix' && newDevoir.eleve_ids.length === 0) {
      setDevoirErreur('Sélectionnez au moins un élève, ou choisissez toute la classe.'); return
    }

    setDevoirEnCours(true)
    try {
      const fichiers = []
      for (const f of newDevoir.fichiers) {
        const chemin = `${selectedClasse.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: errUp } = await supabase.storage.from('devoirs').upload(chemin, f)
        if (errUp) throw new Error(`« ${f.name} » n’a pas pu être déposé : ${errUp.message}`)
        fichiers.push({
          url: supabase.storage.from('devoirs').getPublicUrl(chemin).data.publicUrl,
          nom: f.name,
        })
      }

      const { data, error } = await supabase.from('devoirs').insert({
        user_id: user.id,
        classe_id: selectedClasse.id,
        groupe: selectedClasse.nom,
        matiere: newDevoir.matiere,
        description: newDevoir.objectif.trim(),
        date_donne: new Date().toISOString().slice(0, 10),
        date_rendu: newDevoir.aRendrePour,
        // La table porte déjà `contenu` (jsonb), utilisé par la plateforme
        // historique. On y conserve le ciblage sans ajouter une seconde table.
        contenu: {
          destinataire_mode: newDevoir.destinataire_mode,
          eleve_ids: newDevoir.destinataire_mode === 'classe' ? [] : newDevoir.eleve_ids,
        },
        // `fichiers` porte la liste complète ; `fichier_url` et `fichier_nom`
        // gardent la première image, pour les écrans qui ne lisent qu'elle.
        fichiers,
        fichier_url: fichiers[0]?.url || null,
        fichier_nom: fichiers[0]?.nom || null,
      }).select().single()
      if (error) throw new Error("Enregistrement refusé : " + error.message)

      setDevoirs([data, ...devoirs])
      setNewDevoir({ matiere: '', objectif: '', aRendrePour: '', fichiers: [], destinataire_mode: 'classe', eleve_ids: [] })
      const champ = document.getElementById('devoir-fichier')
      if (champ) champ.value = ''
    } catch (e) {
      setDevoirErreur(e.message)
    } finally {
      setDevoirEnCours(false)
    }
  }


  // Les prochains jours de classe, pour choisir une date de remise d'un geste.
  //
  // Un devoir se rend presque toujours au cours suivant : obliger l'enseignant
  // à ouvrir un calendrier pour dire « demain » est une friction inutile. Le
  // calendrier reste là pour les cas particuliers.
  //
  // L'école ne travaille ni le samedi ni le dimanche : les proposer ferait
  // tomber la remise un jour où personne ne peut rendre.
  const prochainsJoursDeClasse = (nb = 5) => {
    const jours = []
    const d = new Date()
    while (jours.length < nb) {
      d.setDate(d.getDate() + 1)
      const j = d.getDay()
      if (j === 0 || j === 6) continue
      jours.push(new Date(d))
    }
    return jours
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

  const buildParentMessage = (eleve) => {
    if (!eleve) return
    const classe = eleve.classes?.nom || selectedClasse?.nom || 'classe non renseignée'
    const signature = `\n\n— ${user?.prenom || ''} ${user?.nom || ''}\nIdeal École Internationale Bilingue`
    let corps = ''
    if (msgType === 'comportement') {
      const date = msgDetails.date ? new Date(`${msgDetails.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' }) : "aujourd’hui"
      const gravites = { mineur:'🟡 Mineur', modere:'🟠 Modéré', grave:'🔴 Grave' }
      const positif = msgDetails.nature?.includes('exemplaire')
      corps = `Chers parents de *${eleve.prenom} ${eleve.nom}* (${classe}),\n\n`
      if (positif) {
        corps += `Nous avons le plaisir de vous informer que votre enfant ${msgDetails.nature} le ${date}${msgDetails.heure ? ` à ${msgDetails.heure}` : ''} ${msgDetails.lieu}.`
        if (msgDetails.description.trim()) corps += `\n\n📝 *Détails :* ${msgDetails.description.trim()}`
        corps += `\n\nContinuez à l’encourager dans cette belle direction ! 🌟`
      } else {
        corps += `Nous vous informons d’un incident survenu le ${date}${msgDetails.heure ? ` à ${msgDetails.heure}` : ''} ${msgDetails.lieu}.\n\n`
        corps += `⚠️ *Niveau de gravité :* ${gravites[msgDetails.gravite]}\n📌 *Nature :* ${msgDetails.nature}`
        if (msgDetails.description.trim()) corps += `\n\n📝 *Description :* ${msgDetails.description.trim()}`
        if (msgDetails.sanction) corps += `\n\n🔔 *Mesure appliquée :* ${msgDetails.sanction}`
        corps += `\n\nNous comptons sur votre soutien pour accompagner votre enfant.`
      }
    } else if (msgType === 'resultats') {
      corps = `Chers parents de *${eleve.prenom} ${eleve.nom}* (${classe}),\n\nVoici les résultats de votre enfant :\n\n📚 *Matière :* ${msgDetails.matiere || '[matière]'}\n📝 *Note :* ${msgDetails.note || '[note]'}\n⭐ *Appréciation :* ${msgDetails.appreciation}\n\nPour toute question, n’hésitez pas à nous contacter.`
    } else {
      corps = `Chers parents de *${eleve.prenom} ${eleve.nom}* (${classe}),\n\n${msgDetails.libre.trim() || '[Votre message ici]'}`
    }
    return corps + signature
  }

  const sendWhatsApp = (eleve) => {
    if (!eleve) return
    const msg = msgBody || buildParentMessage(eleve)
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
            {/* La plateforme des devoirs vit dans une page à part,
                /pedago-archive/, depuis bien avant la refonte du portail en
                six sessions. Cette refonte a reconstruit la navigation sans
                reprendre le lien : la page est restée en ligne et
                fonctionnelle, mais plus aucun compte n'y menait. */}
            <a href="/pedago-archive/" target="_blank" rel="noreferrer"
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, textDecoration: 'none', background: '#047857', color: '#fff', whiteSpace: 'nowrap' }}>
              🗂️ Plateforme Devoirs &amp; Élèves
            </a>
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

      <div className="page-content ux-page" style={{ padding: '1.5rem 1.2rem calc(130px + env(safe-area-inset-bottom))' }}>
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
            <AccordionCard
              title="Ajouter un devoir de maison"
              subtitle="Matière, objectif, date de remise, élèves et pièces jointes"
              icon="➕"
              defaultOpen
            >

              <div style={{ display: 'grid', gap: 12 }}>
                {/* La matière se choisit, elle ne se tape pas : l'enseignant
                    n'assure qu'un petit nombre de matières et elles sont déjà
                    connues de la plateforme. */}
                <div>
                  <label className="form-label">Matière</label>
                  {mesMatieres.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                      Aucune matière ne vous est affectée pour cette classe. La direction doit la renseigner.
                    </div>
                  ) : (
                    <select className="form-select" value={newDevoir.matiere}
                      onChange={e => setNewDevoir({ ...newDevoir, matiere: e.target.value })}>
                      <option value="">— choisir la matière —</option>
                      {mesMatieres.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label className="form-label">Objectif du devoir</label>
                  <textarea className="form-input" rows={3}
                    placeholder="Ce que l’élève doit savoir faire après ce devoir…"
                    value={newDevoir.objectif}
                    onChange={e => setNewDevoir({ ...newDevoir, objectif: e.target.value })} />
                </div>

                <div>
                  <label className="form-label">À rendre pour le</label>

                  {/* Les prochains jours de classe, d'un geste. */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {prochainsJoursDeClasse().map((d, i) => {
                      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                      const actif = newDevoir.aRendrePour === iso
                      return (
                        <button key={iso} type="button"
                          onClick={() => setNewDevoir({ ...newDevoir, aRendrePour: iso })}
                          style={{
                            padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                            fontWeight: actif ? 900 : 700, fontFamily: 'inherit',
                            border: '1.5px solid ' + (actif ? 'var(--accent)' : 'var(--border)'),
                            background: actif ? 'var(--accent)' : 'var(--bg)',
                            color: actif ? '#04121b' : 'var(--muted)',
                          }}>
                          {i === 0 ? 'Demain' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                        </button>
                      )
                    })}
                  </div>

                  {/* Le calendrier, pour tout le reste. */}
                  <input className="form-input" type="date" value={newDevoir.aRendrePour}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setNewDevoir({ ...newDevoir, aRendrePour: e.target.value })} />

                  {newDevoir.aRendrePour && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      Remise le <b>{new Date(newDevoir.aRendrePour + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">Élèves concernés *</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
                    <button type="button" className="btn-sm" onClick={() => setNewDevoir({ ...newDevoir, destinataire_mode: 'classe', eleve_ids: [] })}
                      style={{ background: newDevoir.destinataire_mode === 'classe' ? '#0284c7' : 'var(--bg)', color: newDevoir.destinataire_mode === 'classe' ? '#fff' : 'var(--text)' }}>
                      Toute la classe ({classEleves.length})
                    </button>
                    <button type="button" className="btn-sm" onClick={() => setNewDevoir({ ...newDevoir, destinataire_mode: 'choix' })}
                      style={{ background: newDevoir.destinataire_mode === 'choix' ? '#0284c7' : 'var(--bg)', color: newDevoir.destinataire_mode === 'choix' ? '#fff' : 'var(--text)' }}>
                      Choisir certains élèves
                    </button>
                  </div>
                  {newDevoir.destinataire_mode === 'choix' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 7, background: 'var(--bg)', padding: 10, borderRadius: 10, maxHeight: 190, overflowY: 'auto' }}>
                      {classEleves.map(el => {
                        const actif = newDevoir.eleve_ids.includes(el.id)
                        return <label key={el.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700 }}>
                          <input type="checkbox" checked={actif} onChange={() => setNewDevoir({ ...newDevoir, eleve_ids: actif ? newDevoir.eleve_ids.filter(id => id !== el.id) : [...newDevoir.eleve_ids, el.id] })} />
                          {el.prenom} {el.nom}
                        </label>
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Les fiches porteront automatiquement le nom de chaque élève concerné.
                  </div>
                </div>

                {/* `multiple` ouvre la photothèque en sélection multiple : un
                    devoir tient rarement sur une seule page de cahier. */}
                <div>
                  <label className="form-label">
                    Exercices à joindre <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(photos ou PDF, plusieurs possibles — facultatif)</span>
                  </label>
                  <input id="devoir-fichier" className="form-input" type="file" multiple
                    accept="image/*,.pdf"
                    onChange={e => setNewDevoir({ ...newDevoir, fichiers: [...e.target.files] })} />
                  {newDevoir.fichiers.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      {newDevoir.fichiers.length} fichier{newDevoir.fichiers.length > 1 ? 's' : ''} : {newDevoir.fichiers.map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {devoirErreur && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'rgba(237,28,36,.1)', color: 'var(--red)' }}>{devoirErreur}</div>
              )}

              <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }}
                disabled={devoirEnCours} onClick={handleAddDevoir}>
                {devoirEnCours ? 'Enregistrement…' : 'Ajouter au Cahier de Devoirs'}
              </button>
            </AccordionCard>

            {/* Liste des Devoirs Enregistrés */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {devoirs.length === 0 && (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p style={{ fontSize: 13 }}>Aucun devoir enregistré pour l’instant.</p>
                </div>
              )}
              {devoirs.map((d, i) => (
                <div key={d.id || i} className="card" style={{ padding: 16, borderLeft: '4px solid #0284c7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 900, color: '#0284c7', fontSize: 14 }}>📖 {d.matiere}</span>
                    {d.date_rendu && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                        ⏰ Pour le {new Date(d.date_rendu + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    )}
                  </div>
                  {d.description && (
                    <div style={{ fontSize: 14, color: '#0f172a', marginTop: 6, fontWeight: 600 }}>
                      <span style={{ color: '#64748b', fontWeight: 800, fontSize: 11 }}>OBJECTIF · </span>{d.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 7, fontWeight: 700 }}>
                    👥 {d.contenu?.destinataire_mode === 'choix'
                      ? `${d.contenu?.eleve_ids?.length || 0} élève(s) sélectionné(s)`
                      : `Toute la classe (${classEleves.length} élèves)`}
                  </div>
                  {(d.fichiers?.length ? d.fichiers : (d.fichier_url ? [{ url: d.fichier_url, nom: d.fichier_nom }] : [])).map((f, k) => (
                    <a key={k} href={f.url} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-block', marginTop: 8, marginRight: 12, fontSize: 12, fontWeight: 800, color: '#0284c7' }}>
                      📎 {f.nom || 'Voir l’exercice'}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div>
            <div className="section-head"><div className="section-title">Messages parents (WhatsApp)</div></div>
            <div style={{background:'var(--dark)', color:'#fff', borderRadius:14, padding:14, marginBottom:14, display:'flex', gap:10, alignItems:'center'}}>
              <span style={{fontSize:24}}>💬</span><div><b>Via le WhatsApp officiel de l’école</b><div style={{fontSize:11, opacity:.7}}>Le message arrive au +223 90 19 00 07, puis l’école le transmet aux parents.</div></div>
            </div>
            <div className="card" style={{padding:14, marginBottom:12}}>
              <div className="form-label">1. Choisir l’élève</div>
              <select className="form-select" value={msgEleve?.id || ''} onChange={e => { setMsgEleve(classEleves.find(el => el.id === e.target.value)); setMsgBody('') }}>
                <option value="">-- Sélectionnez un élève --</option>
                {classEleves.map(el => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
              </select>
            </div>
            {msgEleve && (
              <>
                <div className="card" style={{padding:14, marginBottom:12}}>
                  <div className="form-label">2. Type de message</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7}}>
                    {[['comportement','📋','Comportement'],['resultats','📊','Résultats'],['libre','✍️','Libre']].map(([value, icon, label]) => (
                      <button key={value} type="button" onClick={() => { setMsgType(value); setMsgBody('') }} style={{padding:'10px 4px', borderRadius:10, border:`1.5px solid ${msgType===value?'var(--accent)':'var(--border)'}`, background:msgType===value?'rgba(26,175,224,.1)':'var(--bg)', color:'var(--text)', fontWeight:800}}>{icon}<br/><span style={{fontSize:10}}>{label}</span></button>
                    ))}
                  </div>
                </div>

                <div className="card" style={{padding:14, marginBottom:12}}>
                  <div className="form-label">3. Composer le message</div>
                  {msgType === 'comportement' && <div style={{display:'grid', gap:10}}>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                      <label><span className="form-label">Date</span><input className="form-input" type="date" value={msgDetails.date} onChange={e=>{setMsgDetails({...msgDetails,date:e.target.value});setMsgBody('')}}/></label>
                      <label><span className="form-label">Heure</span><input className="form-input" type="time" value={msgDetails.heure} onChange={e=>{setMsgDetails({...msgDetails,heure:e.target.value});setMsgBody('')}}/></label>
                    </div>
                    <label><span className="form-label">Gravité</span><select className="form-select" value={msgDetails.gravite} onChange={e=>{setMsgDetails({...msgDetails,gravite:e.target.value});setMsgBody('')}}><option value="mineur">🟡 Mineur</option><option value="modere">🟠 Modéré</option><option value="grave">🔴 Grave</option></select></label>
                    <label><span className="form-label">Lieu</span><select className="form-select" value={msgDetails.lieu} onChange={e=>{setMsgDetails({...msgDetails,lieu:e.target.value});setMsgBody('')}}><option>en classe</option><option>en récréation</option><option>dans le couloir</option><option>à la cantine</option><option>dans la cour</option></select></label>
                    <label><span className="form-label">Nature du comportement</span><select className="form-select" value={msgDetails.nature} onChange={e=>{setMsgDetails({...msgDetails,nature:e.target.value});setMsgBody('')}}><option value="a perturbé le déroulement du cours">Perturbation du cours</option><option value="a fait preuve d’irrespect envers l’enseignant">Irrespect envers l’enseignant</option><option value="a été impliqué(e) dans une bagarre">Bagarre</option><option value="a tenu des propos inappropriés">Propos inappropriés</option><option value="a refusé de travailler">Refus de travailler</option><option value="a adopté un comportement exemplaire">Comportement exemplaire ✓</option></select></label>
                    <label><span className="form-label">Description précise</span><textarea className="form-input" rows={3} value={msgDetails.description} onChange={e=>{setMsgDetails({...msgDetails,description:e.target.value});setMsgBody('')}} placeholder="Décrivez précisément les faits…"/></label>
                    <label><span className="form-label">Mesure appliquée</span><select className="form-select" value={msgDetails.sanction} onChange={e=>{setMsgDetails({...msgDetails,sanction:e.target.value});setMsgBody('')}}><option value="">Aucune mesure</option><option value="un avertissement verbal">Avertissement verbal</option><option value="un avertissement écrit">Avertissement écrit</option><option value="une retenue">Retenue</option><option value="une convocation des parents">Convocation des parents</option><option value="une suspension temporaire">Suspension temporaire</option></select></label>
                  </div>}
                  {msgType === 'resultats' && <div style={{display:'grid', gap:10}}>
                    <label><span className="form-label">Matière</span><input className="form-input" value={msgDetails.matiere} onChange={e=>{setMsgDetails({...msgDetails,matiere:e.target.value});setMsgBody('')}}/></label>
                    <label><span className="form-label">Note obtenue</span><input className="form-input" value={msgDetails.note} onChange={e=>{setMsgDetails({...msgDetails,note:e.target.value});setMsgBody('')}} placeholder="Ex. 15/20"/></label>
                    <label><span className="form-label">Appréciation</span><select className="form-select" value={msgDetails.appreciation} onChange={e=>{setMsgDetails({...msgDetails,appreciation:e.target.value});setMsgBody('')}}><option>Très bien</option><option>Bien</option><option>Assez bien</option><option>Passable</option><option>Insuffisant</option></select></label>
                  </div>}
                  {msgType === 'libre' && <label><span className="form-label">Votre message</span><textarea className="form-input" rows={5} value={msgDetails.libre} onChange={e=>{setMsgDetails({...msgDetails,libre:e.target.value});setMsgBody('')}} placeholder="Écrivez votre message ici…"/></label>}
                </div>

                <div className="card" style={{padding:14}}>
                  <div className="form-label">4. Aperçu et envoi</div>
                  <textarea className="form-input" rows={10} value={msgBody || buildParentMessage(msgEleve)} onChange={e=>setMsgBody(e.target.value)} style={{lineHeight:1.5, resize:'vertical'}}/>
                  <button className="btn btn-primary" style={{width:'100%', marginTop:10, background:'#25D366'}} onClick={() => sendWhatsApp(msgEleve)}>📲 Envoyer via WhatsApp</button>
                  <div style={{fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:6}}>WhatsApp s’ouvrira sur le numéro officiel de l’école.</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════ SESSION 4 : DISCIPLINE ════════ */}
        {tab === 'discipline' && (
          <SignalementIncident user={user} />
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
              eleves={getClasseEleves()}
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

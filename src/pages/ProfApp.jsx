import ProgrammePedagogique from './ProgrammePedagogique'
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
import { lienWhatsAppEcole, WHATSAPP_ECOLE_LISIBLE } from '../lib/ecole'
import { signatureLigne } from '../lib/identiteProfessionnelle'
import AccordionCard from '../components/ui/AccordionCard'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { messageLisible } from '../lib/chargement'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import FrisePreparation from '../components/FrisePreparation'
import { statutDe as statutDePrep, libelleStatut as libelleStatutPrep } from '../lib/preparations'
import { CHAMPS_ELEVE_AVEC_CLASSE } from '../lib/eleves'
import { CHAMPS_DEVOIR, TYPES_DEVOIR, TYPE_PAR_DEFAUT, contenuCanonique, refusDeSaisie, lireDevoir, auteurAuthentifie } from '../lib/devoirs'
import { classerDevoirs, devoirsSelectionnes, selectionRaccourci, aujourdHuiISO } from '../lib/devoirsSelection'
import { coursDisponibles, coursDeReference, SANS_COURS, LIBELLE_SANS_COURS } from '../lib/coursAssocie'
import { periodePourDate, periodesUtilisables, libellePeriode, MESSAGE_HORS_CALENDRIER } from '../lib/periodeScolaire'
import { pdfEnImages, estFichierPdf } from '../lib/pdfEnImages'

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

// Échanger deux pièces de place. Rendu d'une liste neuve : muter le tableau
// d'état laisserait React croire que rien n'a changé.
const permuter = (liste, a, b) => {
  const copie = [...(liste || [])]
  const t = copie[a]; copie[a] = copie[b]; copie[b] = t
  return copie
}

// Une pièce jointe dans la liste de saisie : son rang, son nom, son aperçu,
// et de quoi la remonter, la descendre ou la retirer AVANT d'enregistrer.
// Sans ces trois boutons, un enseignant qui s'était trompé de photo devait
// supprimer le devoir et tout ressaisir.
function ListeFichier({ rang, nom, apercu, fichier, onMonter, onDescendre, onRetirer }) {
  const [apercuLocal, setApercuLocal] = useState(null)
  useEffect(() => {
    if (!fichier || !String(fichier.type || '').startsWith('image/')) { setApercuLocal(null); return }
    const url = URL.createObjectURL(fichier)
    setApercuLocal(url)
    return () => URL.revokeObjectURL(url)
  }, [fichier])
  const sourceApercu = apercu || apercuLocal
  const bouton = (libelle, action, titre) => (
    <button type="button" className="btn-sm" title={titre} disabled={!action}
      onClick={action || undefined}
      style={{ minHeight: 34, minWidth: 34, padding: '4px 8px', fontSize: 13,
               opacity: action ? 1 : .3, cursor: action ? 'pointer' : 'default' }}>{libelle}</button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 10, padding: '6px 8px' }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: '#0284c7', minWidth: 18 }}>{rang}.</span>
      {sourceApercu
        ? <img src={sourceApercu} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
        : <span style={{ fontSize: 16 }}>📎</span>}
      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere', lineHeight: 1.3 }}>{nom}</span>
      {bouton('↑', onMonter, 'Monter')}
      {bouton('↓', onDescendre, 'Descendre')}
      <button type="button" className="btn-sm" title="Retirer" onClick={onRetirer}
        style={{ minHeight: 34, minWidth: 34, padding: '4px 8px', fontSize: 13, color: 'var(--red)' }}>✕</button>
    </div>
  )
}

export default function ProfApp({ user, onLogout }) {
  const [activeProfSession, setActiveProfSession] = useState('emploi')
  const [tab, setTab] = useState('edt')
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
  // « Transmis à l'école » est le seul statut qu'IDEAL puisse affirmer.
  const [msgTransmis, setMsgTransmis] = useState(false)
  const [selectedMatiere, setSelectedMatiere] = useState(null)
  const [myPerfs, setMyPerfs] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresForce, setJoursOuvresForce] = useState(null)
  const [preparations, setPreparations] = useState([])
  // Une correction demandée doit se retrouver sans dépendre d'une
  // notification ni de la bonne semaine de l'emploi du temps.
  const [prepFiltre, setPrepFiltre] = useState('a_corriger')
  const [prepCiblee, setPrepCiblee] = useState(null)
  const [newPrepa, setNewPrepa] = useState({ classe_id: '', date_cours: new Date().toISOString().slice(0, 10), heure_cours: '08:00', file: null })
  
  // Devoirs states
  //
  // La liste part vide et vient de la base. Elle contenait auparavant un
  // devoir d'exemple codé en dur, qui s'affichait dans toutes les classes et
  // faisait croire que le cahier fonctionnait.
  const [devoirs, setDevoirs] = useState([])
  // Les champs viennent de l'ancien module, qui était le plus riche : type,
  // période, énoncé et barème n'existaient pas ici. `devoirEdite` porte
  // l'identifiant quand on modifie — modifier n'est pas recréer.
  const DEVOIR_VIDE = {
    matiere: '', objectif: '', enonce: '', bareme: '',
    type: TYPE_PAR_DEFAUT, periode: '', aRendrePour: '',
    fichiers: [], pieces_existantes: [], destinataire_mode: 'classe', eleve_ids: [], candidat_matricules: [],
    // Le cours de référence, FACULTATIF. Vide = devoir libre.
    preparation_id: SANS_COURS,
  }
  const [newDevoir, setNewDevoir] = useState(DEVOIR_VIDE)
  const [devoirEdite, setDevoirEdite] = useState(null)
  const [rechercheEleve, setRechercheEleve] = useState('')
  // Les matières que l'enseignant assure réellement. Il n'a pas à les
  // retaper : elles sont déjà dans ses affectations, et une matière saisie à
  // la main finit toujours par diverger de celle de l'emploi du temps
  // (« Maths » contre « Mathématiques »), ce qui casse tout rapprochement.
  const [mesMatieres, setMesMatieres] = useState([])
  const [devoirEnCours, setDevoirEnCours] = useState(false)
  const [devoirErreur, setDevoirErreur] = useState('')
  const [showDevoirsModal, setShowDevoirsModal] = useState(false)
  // La sélection d'impression : des IDENTIFIANTS, jamais des objets. Elle
  // survit à un rechargement de la liste, et l'écran ne peut pas en détenir
  // une copie divergente de celle qu'on imprime.
  const [selectionDevoirs, setSelectionDevoirs] = useState([])

  // Discipline states
  // `allEleves` chargeait les élèves de TOUTE l'école et n'était jamais lu :
  // une requête inutile et une exposition sans usage. Retiré.
  //
  // LOADING ≠ EMPTY ≠ ERROR : sans ces trois états, un refus RLS sur `eleves`
  // se lirait « aucun élève affecté ».
  const [elevesEtat, setElevesEtat] = useState('chargement')
  const [elevesErreur, setElevesErreur] = useState('')
  const [msgRecherche, setMsgRecherche] = useState('')
  const [searchDisc, setSearchDisc] = useState('')
  const [foundDiscEleves, setFoundDiscEleves] = useState([])
  const [selectedDiscEleve, setSelectedDiscEleve] = useState(null)
  const [selectedDiscClassId, setSelectedDiscClassId] = useState('')
  const [discGravite, setDiscGravite] = useState('mineure')
  const [discMotif, setDiscMotif] = useState('')
  const [discLoading, setDiscLoading] = useState(false)
  const prepRefreshEnVol = useRef(false)
  const prepRefreshEnAttente = useRef(false)

  const rechargerMesPreparations = async () => {
    if (!user?.id) return
    if (prepRefreshEnVol.current) {
      prepRefreshEnAttente.current = true
      return
    }
    prepRefreshEnVol.current = true
    try {
      do {
        prepRefreshEnAttente.current = false
        const { data, error } = await supabase.from('preparations')
          .select('id, classe_id, date_cours, heure_cours, sequence, matiere, groupe, status, contenu, historique_statuts, heure_depot')
          .eq('user_id', user.id).order('heure_depot', { ascending: false })
        if (!error) setPreparations(data || [])
      } while (prepRefreshEnAttente.current)
    } finally {
      prepRefreshEnVol.current = false
    }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { loadProgramme() }, [selectedClasse])

  // ── Les cours préparés proposables au rattachement d'un devoir ───────────
  //
  // Requête à part, et pour deux raisons. `contenu` porte la fiche entière —
  // on ne la ramène pas pour toute l'année, d'où la borne. Et la liste déjà
  // chargée pour « Mes préparations » ne demande pas `contenu` : y toucher
  // alourdirait un écran qui n'en a pas besoin.
  //
  // Le filtre serveur porte sur l'enseignant SEUL. Le groupe se compare côté
  // client, sans accents ni casse : `preparations.groupe` vient de l'emploi du
  // temps et le nom de classe peut s'en écarter (« PS » contre « Petite
  // Section »). Un filtre serveur strict masquerait des cours réels.
  //
  // `null` n'est pas `[]` : une lecture refusée ne doit pas se lire « aucun
  // cours préparé ».
  const [coursPrepares, setCoursPrepares] = useState([])
  useEffect(() => {
    if (tab !== 'devoirs' || !user?.id) return undefined
    let annule = false
    ;(async () => {
      const { data, error } = await supabase.from('preparations')
        .select('id, user_id, date_cours, sequence, matiere, groupe, status, contenu')
        .eq('user_id', user.id)
        .order('date_cours', { ascending: false })
        .limit(60)
      if (annule) return
      // Ni `data || []` : le motif confond une erreur avec un vide, et le
      // cliquet le compte à juste titre. Ici l'erreur a déjà sa branche.
      setCoursPrepares(error ? null : (Array.isArray(data) ? data : []))
    })()
    return () => { annule = true }
  }, [tab, user?.id])

  useEffect(() => {
    if (!user?.id) return undefined
    const auRetour = () => {
      if (document.visibilityState === 'visible') rechargerMesPreparations()
    }
    document.addEventListener('visibilitychange', auRetour)
    const canal = supabase.channel(`preparations-prof-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'preparations',
        filter: `user_id=eq.${user.id}`,
      }, rechargerMesPreparations)
      .subscribe()
    return () => {
      document.removeEventListener('visibilitychange', auRetour)
      supabase.removeChannel(canal)
    }
  }, [user?.id])

  // Les devoirs de la classe ouverte, et d'elle seule.
  useEffect(() => {
    if (!selectedClasse) { setDevoirs([]); return }
    let annule = false
    ;(async () => {
      const { data } = await supabase
        .from('devoirs').select(CHAMPS_DEVOIR)
        .eq('classe_id', selectedClasse.id)
        .order('date_rendu', { ascending: false })
      if (!annule) {
        const liste = Array.isArray(data) ? data : []
        setDevoirs(liste)
        // Par défaut, ce qui se rend AUJOURD'HUI — et rien d'autre. Le défaut
        // d'origine était l'inverse : tout l'historique partait à l'impression
        // sans que personne ne l'ait demandé.
        setSelectionDevoirs(selectionRaccourci(liste, 'aujourdhui'))
      }
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
      const myClasses = (profClasses || []).map(pc => pc.classes).filter(Boolean)
      setClasses(myClasses)
      setAllClasses(cl || [])
      setPeriodes(per || [])
      setEvenements(ev || [])
      if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)
      
      if (myClasses.length > 0) setSelectedClasse(myClasses[0])
      if (per && per.length > 0) setSelectedPeriode(per[0])

      // ── Les élèves des classes affectées, tous en une fois ────────────
      //
      // Ce chargement ne portait que sur `myClasses[0]`, et n'était jamais
      // rejoué au changement de classe. Le filtre `classe_id === selectedClasse.id`
      // ne trouvait alors plus rien : le menu « Choisir l'élève » était vide
      // pour toute classe autre que la première. Tous les enseignants ont
      // entre deux et quatre classes — ils étaient donc tous concernés.
      //
      // Une seule requête pour l'ensemble des classes autorisées : c'est
      // correct au changement de classe, et c'est une requête au lieu de N
      // sur un réseau instable.
      //
      // Le responsable est résolu par la même requête, via le dossier
      // d'inscription : eleves.inscription_id → inscriptions → responsables.
      // Deux clés étrangères relient ces tables, d'où l'indication explicite
      // de celle qu'on emprunte.
      if (myClasses.length > 0) {
        const { data: el, error: eEleves } = await supabase
          .from('eleves')
          // Colonnes explicites, jamais `*`.
          //
          // Cette requête chargeait toute la table, donc `photo_url` — 1,7 Mo
          // de base64 sur un seul élève. Elle mettait plus de deux minutes, et
          // comme `loadData` l'attend, TOUT ce qui la suit ne partait jamais :
          // planifications, checkpoints, performances, préparations. L'écran
          // « Mes préparations » restait à zéro alors que la base en portait
          // dix-huit.
          //
          // La même correction a été faite sur les cinq autres écrans ; celui-ci
          // avait échappé au relevé parce qu'il écrit son `select` entre accents
          // graves et non entre apostrophes.
          .select(`${CHAMPS_ELEVE_AVEC_CLASSE},
                   dossier:inscriptions!eleves_inscription_id_fkey(
                     matricule,
                     r1:responsables!responsable1_id(prenom, nom, tel1, whatsapp, lien_parente),
                     r2:responsables!responsable2_id(prenom, nom, tel1, whatsapp, lien_parente))`)
          .in('classe_id', myClasses.map(c => c.id))
          .eq('actif', true)
          .order('nom')

        if (eEleves) {
          setElevesEtat('erreur')
          setElevesErreur(messageLisible(eEleves))
          setEleves([])
        } else {
          const liste = Array.isArray(el) ? el : []
          setEleves(liste)
          setElevesEtat(liste.length ? 'ok' : 'vide')
        }
      } else {
        // Aucune classe affectée : ce n'est ni une panne ni un chargement.
        setEleves([])
        setElevesEtat('sans_classe')
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
      // Colonnes explicites : `contenu` porte toute la fiche et n'est pas
      // nécessaire pour lister. `historique_statuts` l'est — c'est là que vit
      // la remarque de la direction.
      const { data: preps } = await supabase.from('preparations')
        .select('id, classe_id, date_cours, heure_cours, sequence, matiere, groupe, status, contenu, historique_statuts, heure_depot')
        .eq('user_id', user.id).order('heure_depot', { ascending: false })
      setPreparations(preps || [])

      // Les devoirs ne sont PAS vidés ici.
      //
      // `setDevoirs([])` s'y trouvait, et il courait contre l'effet qui charge
      // les devoirs de la classe ouverte : celui-ci partait dès que
      // `selectedClasse` était posée, quelques lignes plus haut, tandis que
      // `loadData` continuait sa douzaine de requêtes. Le vidage arrivait
      // APRÈS le chargement et effaçait les douze devoirs.
      //
      // Le défaut était masqué : `loadData` restait bloquée sur les 1,7 Mo de
      // `eleves.photo_url` et n'atteignait jamais cette ligne. Le corriger l'a
      // fait apparaître.
      //
      // Cet état appartient à l'effet de classe, et à lui seul.
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
  // Ouvrir un devoir existant dans le formulaire. Les champs sont relus par la
  // couche de compatibilité : un devoir historique s'édite comme un autre, et
  // sa richesse — type, période, énoncé, barème — remonte intacte.
  const ouvrirEnModification = (ligne) => {
    const d = lireDevoir(ligne)
    setDevoirEdite(ligne)
    setNewDevoir({
      matiere: d.matiere || '',
      objectif: d.objectif || '',
      enonce: d.enonce || '',
      bareme: d.bareme || '',
      type: d.type || TYPE_PAR_DEFAUT,
      periode: d.periode || '',
      aRendrePour: d.dateRendu || '',
      fichiers: [],
      // Les pièces déjà en ligne, désormais retirables et réordonnables.
      pieces_existantes: d.piecesJointes.map(f => ({ url: f.url, nom: f.nom })),
      destinataire_mode: d.destinataireMode,
      eleve_ids: d.eleveIds,
      // Transporté sans être modifiable : l'écran ne sait pas afficher un
      // candidat, mais il ne doit pas l'effacer pour autant.
      candidat_matricules: d.candidatMatricules,
      preparation_id: d.preparationId || SANS_COURS,
    })
    setDevoirErreur('')
    setRechercheEleve('')
    document.getElementById('saisie-devoir')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const annulerModification = () => {
    setDevoirEdite(null)
    setNewDevoir(DEVOIR_VIDE)
    setDevoirErreur('')
  }

  const supprimerDevoir = async (ligne) => {
    const d = lireDevoir(ligne)
    if (!confirm(`Supprimer le devoir de ${d.matiere || 'cette matière'} du ${d.dateRendu || '—'} ?\n\nCette action est définitive.`)) return
    const { error } = await supabase.from('devoirs').delete().eq('id', ligne.id)
    if (error) { setDevoirErreur('Suppression refusée : ' + error.message); return }
    setDevoirs(devoirs.filter(x => x.id !== ligne.id))
    if (devoirEdite?.id === ligne.id) annulerModification()
  }

  const handleAddDevoir = async () => {
    setDevoirErreur('')
    // Les règles de saisie vivent dans `lib/devoirs` : l'écran et les tests
    // jugent avec la même, et un refus ne peut pas diverger de l'autre côté.
    const refus = refusDeSaisie({
      matiere: newDevoir.matiere,
      objectif: newDevoir.objectif,
      dateRendu: newDevoir.aRendrePour,
      classeId: selectedClasse?.id,
      destinataireMode: newDevoir.destinataire_mode,
      eleveIds: newDevoir.eleve_ids,
    })
    if (refus) { setDevoirErreur(refus); return }

    setDevoirEnCours(true)
    try {
      // ── Un PDF devient N images, une par page ─────────────────────────
      //
      // Le document imprimable ne sait manipuler que des images : c'est ce
      // que toute la chaîne traite déjà — pagination, pleine page, JPEG,
      // WhatsApp. Un PDF rendu par une balise image ne s'affichait pas du
      // tout : le navigateur refuse de le décoder, et le papier ne montrait
      // qu'un cadre vide.
      //
      // La conversion se fait ICI, au dépôt, et non à l'impression : sinon le
      // téléphone de l'enseignant referait le travail à chaque aperçu, pour
      // chaque élève du publipostage.
      const aDeposer = []
      for (const f of newDevoir.fichiers) {
        if (!estFichierPdf(f)) { aDeposer.push(f); continue }
        setDevoirErreur(`Lecture de « ${f.name} »…`)
        const { pages, images, erreur } = await pdfEnImages(f, (n, total) =>
          setDevoirErreur(`« ${f.name} » — page ${n} sur ${total}…`))
        if (erreur) throw new Error(erreur)
        // Le contrôle qui compte : un PDF de trois pages qui n'en rendrait
        // qu'une passerait pour un document complet.
        if (images.length !== pages) {
          throw new Error(`« ${f.name} » compte ${pages} page(s), ${images.length} rendue(s) : dépôt annulé.`)
        }
        aDeposer.push(...images)
      }
      setDevoirErreur('')

      const fichiers = []
      // Le rang est dans le chemin : l'ordre ne dépend jamais de ce que
      // Storage renvoie, qui ne garantit rien.
      const marque = Date.now()
      for (const [rang, f] of aDeposer.entries()) {
        const chemin = `${selectedClasse.id}/${marque}_${String(rang).padStart(2, '0')}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: errUp } = await supabase.storage.from('devoirs').upload(chemin, f)
        if (errUp) throw new Error(`« ${f.name} » n’a pas pu être déposé : ${errUp.message}`)
        fichiers.push({
          url: supabase.storage.from('devoirs').getPublicUrl(chemin).data.publicUrl,
          nom: f.name,
        })
      }

      // Les pièces jointes déjà déposées sont conservées à la modification :
      // rouvrir un devoir pour corriger une date ne doit pas effacer ses
      // images.
      // L'ordre enregistré est celui que l'enseignant a sous les yeux, et
      // non celui, arbitraire, que Storage renvoie. Les pièces retirées à
      // l'écran ne sont pas réécrites : `pieces_existantes` fait foi, et non
      // ce que portait la ligne d'origine.
      const toutesPieces = [...(newDevoir.pieces_existantes || []), ...fichiers]

      // ── L'auteur ────────────────────────────────────────────────────────
      //
      // Ni saisi, ni lu dans le `localStorage` : demandé au serveur, qui le
      // déduit du jeton. Sans identité confirmée, on n'enregistre pas — un
      // devoir sans auteur est exactement la dette que laisse l'ancienne
      // plateforme, et elle ne se répare pas après coup.
      //
      // À la MODIFICATION, `user_id` n'est pas réécrit : corriger la date d'un
      // devoir ne fait pas de vous son auteur. Les treize devoirs historiques
      // gardent donc leur attribution textuelle, même retouchés.
      let auteurId = null
      if (!devoirEdite) {
        const auteur = await auteurAuthentifie(supabase)
        if (!auteur.id) throw new Error(`Enregistrement refusé : ${auteur.refus}`)
        auteurId = auteur.id
      }

      const ligne = {
        classe_id: selectedClasse.id,
        groupe: selectedClasse.nom,
        matiere: newDevoir.matiere,
        description: newDevoir.objectif.trim(),
        date_rendu: newDevoir.aRendrePour,
        // Forme canonique — voir `lib/devoirs`. Rien de ce qui vit en colonne
        // n'y est recopié.
        contenu: contenuCanonique({
          type: newDevoir.type,
          // Calculée, jamais saisie. Si la date ne tombe dans aucune période,
          // on écrit `null` — on n'invente pas la plus proche.
          periode: libellePeriode(periodePourDate(newDevoir.aRendrePour, periodes)),
          enonce: newDevoir.enonce,
          bareme: newDevoir.bareme,
          destinataireMode: newDevoir.destinataire_mode,
          eleveIds: newDevoir.eleve_ids,
          candidatMatricules: newDevoir.candidat_matricules || [],
          preparationId: newDevoir.preparation_id,
        }),
        fichiers: toutesPieces,
        fichier_url: toutesPieces[0]?.url || null,
        fichier_nom: toutesPieces[0]?.nom || null,
      }

      // ── Modifier, et non recréer ────────────────────────────────────────
      //
      // L'ancien module n'avait aucun PATCH : son bouton « modifier »
      // rechargeait le formulaire, et réenregistrer créait une SECONDE ligne.
      // Deux devoirs identiques apparaissaient, l'ancien restait, et personne
      // ne savait lequel faisait foi.
      //
      // `date_donne` n'est pas réécrite : c'est la date à laquelle le devoir a
      // été donné, pas celle de sa dernière retouche.
      const { data, error } = devoirEdite
        ? await supabase.from('devoirs').update(ligne).eq('id', devoirEdite.id)
            .select(CHAMPS_DEVOIR).single()
        : await supabase.from('devoirs')
            .insert({ ...ligne, user_id: auteurId,
                      date_donne: new Date().toISOString().slice(0, 10) })
            .select(CHAMPS_DEVOIR).single()
      if (error) throw new Error((devoirEdite ? 'Modification refusée : ' : 'Enregistrement refusé : ') + error.message)

      setDevoirs(devoirEdite
        ? devoirs.map(d => (d.id === devoirEdite.id ? data : d))
        : [data, ...devoirs])
      setDevoirEdite(null)
      setNewDevoir(DEVOIR_VIDE)
      setRechercheEleve('')
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

  // Les élèves proposés à la messagerie : ceux de la classe choisie, filtrés
  // par la recherche. Jamais toute l'école — l'enseignant ne voit que les
  // classes qui lui sont affectées, et `eleves` ne contient qu'elles.
  const elevesMessagerie = () => {
    const base = getClasseEleves()
    const q = msgRecherche.trim().toLowerCase()
    if (!q) return base
    return base.filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(q))
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

  // Les responsables d'un élève, tels que le dossier d'inscription les
  // enregistre. Aucune ressaisie, aucune source parallèle : c'est la règle
  // d'or du V2.1 — une information, une source, plusieurs usages.
  const responsablesDe = (eleve) => {
    const d = eleve?.dossier
    if (!d) return []
    return [d.r1, d.r2].filter(Boolean).map(r => ({
      ...r,
      telephone: r.whatsapp || r.tel1 || null,
    }))
  }

  // Le message part vers le WhatsApp officiel de l'école, pas vers le
  // parent : le V2.1 §8 interdit aux enseignants d'utiliser leur numéro
  // personnel, et l'école reste l'émetteur officiel.
  //
  // IDEAL ne peut donc pas confirmer qu'un parent a reçu quoi que ce soit.
  // Le statut le dit : préparé, puis transmis à l'école, et rien de plus.
  const sendWhatsApp = (eleve) => {
    if (!eleve) return
    const msg = msgBody || buildParentMessage(eleve)
    const resp = responsablesDe(eleve)
    const entete = resp.length
      ? `[${eleve.prenom} ${eleve.nom} — ${eleve.classes?.nom || ''}]\n`
        + `À transmettre à : ${resp.map(r => `${r.prenom} ${r.nom} (${r.lien_parente || 'responsable'})`
            + (r.telephone ? ` — ${r.telephone}` : ' — numéro absent du dossier')).join(' · ')}\n\n`
      : `[${eleve.prenom} ${eleve.nom} — ${eleve.classes?.nom || ''}]\n`
        + `⚠️ Aucun responsable enregistré au dossier : destinataire à identifier par l'école.\n\n`
    // Le parent doit savoir qui lui écrit, et à quel titre. La fonction vient
    // du profil : elle suit la personne si elle change de poste, alors qu'une
    // signature tapée dans le message resterait celle d'hier.
    const pied = `\n\n${signatureLigne(user, { role: 'professeur' })}`
    window.open(lienWhatsAppEcole(entete + msg + pied), '_blank')
    setMsgTransmis(true)
  }

  // Combien de ses préparations attendent une correction de sa part.
  const prepsACorriger = preparations.filter(p => p.status === 'a_corriger').length

  const naviguerDepuisNotification = (cible, ref) => {
    if (['preparation', 'mespreps'].includes(cible)) {
      setActiveProfSession('pedagogie')
      setTab('mespreps')
      setPrepFiltre('a_corriger')
      setPrepCiblee(ref || null)
      return
    }
    setTab(cible)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cible = params.get('notificationTab')
    if (!cible) return
    naviguerDepuisNotification(cible, params.get('notificationRef'))
    params.delete('notificationTab'); params.delete('notificationRef')
    const reste = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${reste ? `?${reste}` : ''}${window.location.hash}`)
  }, [])

  useEffect(() => {
    if (!prepCiblee || tab !== 'mespreps') return
    const timer = setTimeout(() => document.getElementById(`preparation-prof-${prepCiblee}`)?.scrollIntoView({ behavior:'smooth', block:'center' }), 250)
    const fin = setTimeout(() => setPrepCiblee(null), 6000)
    return () => { clearTimeout(timer); clearTimeout(fin) }
  }, [prepCiblee, preparations, tab])

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
          <NotificationCenter user={user} role="prof" onNavigateTab={naviguerDepuisNotification} />
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
            <button onClick={() => setTab('programme')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'programme' ? '#00a8e0' : 'var(--bg)', color: tab === 'programme' ? '#fff' : 'var(--muted)' }}>📘 Programme &amp; Matières</button>
            <button onClick={() => setTab('mespreps')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'mespreps' ? '#00a8e0' : 'var(--bg)', color: tab === 'mespreps' ? '#fff' : 'var(--muted)' }}>
              📝 Mes préparations{prepsACorriger > 0 ? ` · ${prepsACorriger}` : ''}
            </button>
            <button onClick={() => setTab('progression')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'progression' ? '#00a8e0' : 'var(--bg)', color: tab === 'progression' ? '#fff' : 'var(--muted)' }}>📈 Progressions du programme</button>
            <button onClick={() => setTab('fincours')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'fincours' ? '#00a8e0' : 'var(--bg)', color: tab === 'fincours' ? '#fff' : 'var(--muted)' }}>✅ Check-points de fin de leçon</button>
          </>
        )}

        {activeProfSession === 'classe' && (
          <>
            <button onClick={() => setTab('classe')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'classe' ? '#00a8e0' : 'var(--bg)', color: tab === 'classe' ? '#fff' : 'var(--muted)' }}>📋 Présence &amp; Liste Classe</button>
            <button onClick={() => setTab('devoirs')} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: tab === 'devoirs' ? '#00a8e0' : 'var(--bg)', color: tab === 'devoirs' ? '#fff' : 'var(--muted)' }}>📖 Devoirs de maison</button>
            {/* BASCULE — « 📖 Devoirs de maison » ci-dessus est désormais le
                seul chemin. Le lien vers /pedago-archive/ a été retiré une
                fois la parité prouvée : lecture des quatorze devoirs
                historiques sans perte, ciblages et candidats préservés,
                format canonique, auteur authentifié, modification par
                UPDATE, suppression sûre, documents et carte parents.

                La page /pedago-archive/ RESTE EN LIGNE et intacte : c'est le
                retour arrière. Le rétablir tient au rétablissement de ce
                bloc. Elle ne sera retirée qu'après une période de preuve en
                production. Voir docs/constitution/parite-devoirs.md. */}
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
            {/* La table `periodes` porte 15 lignes = 5 périodes × 3 exemplaires
                identiques, toutes en 2024-2025 : un seed passé trois fois, sans
                contrainte d'unicité. Le filtre ci-dessous n'est pas le
                correctif — la cause est en base et se répare par une migration.
                Il empêche l'écran d'afficher trois fois « 1er Trimestre » en
                attendant, et il dédoublonne sur (année, ordre), jamais sur le
                libellé : deux années peuvent porter les mêmes noms. */}
            <select className="form-select" style={{ flex: 1, minWidth: 140 }} value={selectedPeriode?.id || ''} onChange={e => setSelectedPeriode(periodes.find(p => p.id === e.target.value))}>
              {periodesUtilisables(periodes).map(p => <option key={p.id || p.ordre} value={p.id || ''}>{p.nom}</option>)}
            </select>
          </div>
        )}

        {tab === 'mespreps' && (
          <div>
            <div className="entete-ecran">
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0d2a3b', margin: 0, lineHeight: 1.25 }}>
                  Mes préparations
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  {prepsACorriger > 0
                    ? `${prepsACorriger} préparation${prepsACorriger > 1 ? 's' : ''} à corriger`
                    : 'Aucune correction demandée.'}
                </p>
              </div>
            </div>

            {/* Retrouver une correction demandée ne doit dépendre ni d'une
                notification, ni de la bonne semaine de l'emploi du temps. */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6, marginBottom: 14 }}>
              {[['a_corriger', `À corriger (${prepsACorriger})`],
                ['toutes', `Toutes (${preparations.length})`]].map(([id, libelle]) => (
                <button key={id} onClick={() => setPrepFiltre(id)} style={{
                  padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800,
                  cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
                  border: '2px solid ' + (prepFiltre === id ? 'var(--accent)' : 'var(--border)'),
                  background: prepFiltre === id ? 'var(--accent)' : 'var(--bg)',
                  color: prepFiltre === id ? '#fff' : 'var(--muted)',
                }}>{libelle}</button>
              ))}
            </div>

            {(() => {
              const visibles = prepFiltre === 'a_corriger'
                ? preparations.filter(p => p.status === 'a_corriger')
                : preparations
              if (!visibles.length) return (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p style={{ fontSize: 13 }}>
                    {prepFiltre === 'a_corriger'
                      ? (preparations.length ? 'Aucune de vos préparations n’attend de correction. ✓'
                                             : 'Aucune préparation déposée pour le moment.')
                      : 'Aucune préparation déposée pour le moment.'}
                  </p>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {visibles.map(p => {
                    const st = statutDePrep(p.status)
                    const aCorriger = p.status === 'a_corriger'
                    return (
                      <div key={p.id} id={`preparation-prof-${p.id}`} className="card" style={{
                        padding: 15,
                        borderLeft: `4px solid ${aCorriger ? '#b45309' : st.couleur}`,
                        background: String(prepCiblee) === String(p.id) ? 'rgba(0,168,224,0.12)' : undefined,
                        outline: String(prepCiblee) === String(p.id) ? '2px solid var(--accent)' : undefined,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 900, fontSize: 14, color: '#0d2a3b' }}>
                            {p.matiere || 'Préparation'}{p.sequence ? ` · séquence ${p.sequence}` : ''}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                                         color: st.couleur, border: `1px solid ${st.couleur}` }}>
                            {st.icone} {libelleStatutPrep(p.status)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                          {p.groupe || ''}{p.groupe && p.date_cours ? ' · ' : ''}
                          {p.date_cours ? `cours du ${new Date(p.date_cours + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
                        </div>

                        {/* La remarque, lisible sans ouvrir quoi que ce soit. */}
                        {Array.isArray(p.historique_statuts) && p.historique_statuts.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <FrisePreparation historique={p.historique_statuts} titre="Suivi" compact />
                          </div>
                        )}

                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                          Pour corriger : ouvrez la séance du {p.date_cours
                            ? new Date(p.date_cours + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                            : 'cours'} dans <b>Mon Emploi du Temps</b>.
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'programme' && <ProgrammePedagogique user={user} />}

        {tab === 'progression' && (
          <div>
            <div className="section-head"><div className="section-title">Progressions du programme</div></div>
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
          <FinDeCours user={user} selectedClasse={selectedClasse} classEleves={classEleves} preparations={preparations} supabase={supabase} />
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
            <div className="entete-ecran">
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0d2a3b', margin: 0, lineHeight: 1.25 }}>
                  Devoirs de maison
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                  Classe {selectedClasse?.nom} · {devoirs.length} devoir{devoirs.length > 1 ? 's' : ''} enregistré{devoirs.length > 1 ? 's' : ''}
                  {selectionDevoirs.length > 0 && <> · <b style={{ color: '#0284c7' }}>{selectionDevoirs.length} sélectionné{selectionDevoirs.length > 1 ? 's' : ''}</b></>}
                </p>
              </div>

              {/* Action secondaire : l'action principale de cet écran est
                  d'enregistrer un devoir, pas d'en imprimer le cahier. */}
              {/* Le bouton n'imprime plus « les devoirs » : il imprime LA
                  SÉLECTION, et il le dit. Sans sélection il ne s'active pas —
                  un document vide se voit tout de suite, vingt-cinq pages
                  d'archives ne se voient qu'au moment de les distribuer. */}
              {/* Le bouton était `disabled` tant qu'aucun devoir n'était coché.
                  Un bouton désactivé n'explique rien : le navigateur avale le
                  clic, il ne se passe RIEN — pas de message, pas de raison. Et
                  comme la sélection par défaut est « aujourd'hui », tout jour
                  sans devoir à rendre laissait l'enseignant devant un bouton
                  inerte, avec toutes les raisons de croire l'impression
                  cassée.
                  Le bouton reste cliquable et dit ce qui manque. La règle de
                  fond ne change pas : une sélection vide n'imprime rien —
                  c'est elle qui évite les vingt-cinq pages d'archives. */}
              <button
                onClick={() => {
                  if (selectionDevoirs.length === 0) {
                    alert('Aucun devoir n’est coché.\n\n'
                        + 'Cochez les devoirs à imprimer, ou utilisez « Aujourd’hui », '
                        + '« Cette semaine » ou « Tout sélectionner » au-dessus de la liste.')
                    return
                  }
                  setShowDevoirsModal(true)
                }}
                title={selectionDevoirs.length === 0
                  ? 'Cochez au moins un devoir avant d’imprimer'
                  : `Imprimer ${selectionDevoirs.length} devoir(s)`}
                style={{ background: selectionDevoirs.length === 0 ? 'var(--bg)' : 'linear-gradient(135deg, #0284c7, #0078b4)',
                         color: selectionDevoirs.length === 0 ? 'var(--muted)' : '#fff',
                         border: selectionDevoirs.length === 0 ? '1px solid var(--border)' : 'none',
                         padding: '11px 18px', borderRadius: 12, fontWeight: 800, fontSize: 13,
                         cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                🖨️ Imprimer {selectionDevoirs.length > 0 ? `${selectionDevoirs.length} devoir${selectionDevoirs.length > 1 ? 's' : ''}` : 'la sélection'}
              </button>
            </div>

            {/* Saisie d'un Devoir */}
            <div id="saisie-devoir" />
            <AccordionCard
              title={devoirEdite ? 'Modifier ce devoir de maison' : 'Ajouter un devoir de maison'}
              subtitle={devoirEdite
                ? 'Vos changements remplacent le devoir existant — aucun doublon n’est créé.'
                : 'Type, matière, objectif, énoncé, barème, date de remise, élèves et pièces jointes'}
              icon={devoirEdite ? '✏️' : '➕'}
              defaultOpen
            >

              <div style={{ display: 'grid', gap: 12 }}>
                {/* La matière se choisit, elle ne se tape pas : l'enseignant
                    n'assure qu'un petit nombre de matières et elles sont déjà
                    connues de la plateforme. */}
                {/* Type et période viennent de l'ancien module : l'écran
                    intégré ne les connaissait pas, et un devoir y perdait sa
                    nature et son trimestre. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  <div>
                    <label className="form-label">Type de devoir</label>
                    <select className="form-select" value={newDevoir.type}
                      onChange={e => setNewDevoir({ ...newDevoir, type: e.target.value })}>
                      {TYPES_DEVOIR.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {/* Le champ « Période » a été retiré.
                      Il n'était pas saisissable : il affichait la période
                      déduite de la date de remise, dans une boîte qui
                      ressemblait à un champ. Cliquer dessus ne proposait rien,
                      et l'enseignant y cherchait un choix qui n'existe pas.

                      LA DÉDUCTION, ELLE, RESTE. La période est toujours
                      calculée à l'enregistrement à partir de la date de
                      remise, et le cahier l'imprime comme avant. C'est la
                      boîte qui disparaît, pas la donnée. */}
                </div>

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

                {/* ── Cours associé ────────────────────────────────────────
                    FACULTATIF, et volontairement placé APRÈS la matière : le
                    rattachement est une aide, pas une contrainte. Choisir un
                    cours ne change JAMAIS la matière du devoir — un enseignant
                    qui a fait Écriture peut donner un devoir libre de Maths. */}
                <div>
                  <label className="form-label">
                    Cours associé <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(facultatif)</span>
                  </label>
                  {coursPrepares === null ? (
                    <div style={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>
                      Vos cours préparés n’ont pas pu être lus. Le devoir reste enregistrable sans cours associé.
                    </div>
                  ) : (() => {
                    const liste = coursDisponibles(coursPrepares, {
                      userId: user?.id, groupe: selectedClasse?.nom, matiere: newDevoir.matiere,
                    })
                    return <>
                      <select className="form-select" value={newDevoir.preparation_id}
                        onChange={e => setNewDevoir({ ...newDevoir, preparation_id: e.target.value })}>
                        <option value={SANS_COURS}>{LIBELLE_SANS_COURS}</option>
                        {liste.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.intitule} · {c.date}{c.statut && c.statut !== 'validee' ? ` · ${c.statut}` : ''}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                        {liste.length === 0
                          ? 'Aucun cours préparé pour cette classe parmi vos 60 derniers. Le devoir reste libre.'
                          : 'Vos cours, les plus récents d’abord. La matière du devoir n’est pas modifiée par ce choix.'}
                      </div>
                    </>
                  })()}
                </div>

                {/* Une date de remise hors calendrier scolaire enregistre une
                    période nulle, et le cahier s'imprime alors sans période.
                    Ce message vivait dans la boîte « Période » qui vient
                    d'être retirée. Le supprimer avec elle aurait rendu la
                    panne muette : il se lit maintenant sous la date, et
                    seulement quand il a lieu d'être. */}
                {newDevoir.aRendrePour && !periodePourDate(newDevoir.aRendrePour, periodes) && (
                  <div style={{ fontSize: 12, background: 'rgba(237,28,36,.07)', color: 'var(--red)',
                                fontWeight: 700, lineHeight: 1.35, padding: '9px 12px', borderRadius: 10 }}>
                    {MESSAGE_HORS_CALENDRIER}
                  </div>
                )}

                <div>
                  <label className="form-label">Objectif du devoir</label>
                  <textarea className="form-input" rows={3}
                    placeholder="Ce que l’élève doit savoir faire après ce devoir…"
                    value={newDevoir.objectif}
                    onChange={e => setNewDevoir({ ...newDevoir, objectif: e.target.value })} />
                </div>

                <div>
                  <label className="form-label">
                    Énoncé du devoir <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(ce que l’élève doit faire)</span>
                  </label>
                  <textarea className="form-input" rows={4}
                    placeholder="Les exercices, les consignes, les questions…"
                    value={newDevoir.enonce}
                    onChange={e => setNewDevoir({ ...newDevoir, enonce: e.target.value })} />
                </div>

                <div>
                  <label className="form-label">
                    Barème <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(facultatif)</span>
                  </label>
                  <textarea className="form-input" rows={2}
                    placeholder="Exercice 1 : 10 · Propreté : 5…"
                    value={newDevoir.bareme}
                    onChange={e => setNewDevoir({ ...newDevoir, bareme: e.target.value })} />
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
                  {/* Deux choix exclusifs : une grille à colonnes fluides
                      plutôt que deux boutons côte à côte, qui se chevauchaient
                      dès que le nom de la classe s'allongeait. */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 9 }}>
                    <button type="button" className="btn-sm" onClick={() => setNewDevoir({ ...newDevoir, destinataire_mode: 'classe', eleve_ids: [] })}
                      style={{ width: '100%', background: newDevoir.destinataire_mode === 'classe' ? '#0284c7' : 'var(--bg)', color: newDevoir.destinataire_mode === 'classe' ? '#fff' : 'var(--text)' }}>
                      Toute la classe ({classEleves.length})
                    </button>
                    <button type="button" className="btn-sm" onClick={() => setNewDevoir({ ...newDevoir, destinataire_mode: 'choix' })}
                      style={{ width: '100%', background: newDevoir.destinataire_mode === 'choix' ? '#0284c7' : 'var(--bg)', color: newDevoir.destinataire_mode === 'choix' ? '#fff' : 'var(--text)' }}>
                      Certains élèves
                    </button>
                  </div>
                  {newDevoir.destinataire_mode === 'choix' && (() => {
                    const visibles = classEleves.filter(el =>
                      !rechercheEleve.trim() ||
                      `${el.prenom} ${el.nom}`.toLowerCase().includes(rechercheEleve.trim().toLowerCase()))
                    const tousCoches = visibles.length > 0 &&
                      visibles.every(el => newDevoir.eleve_ids.includes(el.id))
                    return (
                    <div style={{ marginBottom: 8 }}>
                      {/* Recherche et cases groupées : l'ancien module les avait,
                          l'intégré non. Au-delà d'une dizaine d'élèves, une liste
                          sans recherche devient inutilisable au doigt. */}
                      {classEleves.length > 8 && (
                        <input className="form-input" type="search"
                          placeholder="Rechercher un élève…"
                          value={rechercheEleve}
                          onChange={e => setRechercheEleve(e.target.value)}
                          style={{ marginBottom: 8 }} />
                      )}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn-sm" style={{ flex: '1 1 130px' }}
                          onClick={() => setNewDevoir({ ...newDevoir, eleve_ids: tousCoches
                            ? newDevoir.eleve_ids.filter(id => !visibles.some(el => el.id === id))
                            : [...new Set([...newDevoir.eleve_ids, ...visibles.map(el => el.id)])] })}>
                          {tousCoches ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                        <span style={{ flex: '1 1 130px', fontSize: 12, fontWeight: 700,
                                       color: 'var(--muted)', alignSelf: 'center' }}>
                          {newDevoir.eleve_ids.length} sélectionné{newDevoir.eleve_ids.length > 1 ? 's' : ''} sur {classEleves.length}
                        </span>
                      </div>
                      {visibles.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>
                          {classEleves.length ? 'Aucun élève ne correspond à cette recherche.' : 'Aucun élève dans cette classe.'}
                        </div>
                      )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 7, background: 'var(--bg)', padding: 10, borderRadius: 10, maxHeight: 190, overflowY: 'auto' }}>
                      {visibles.map(el => {
                        const actif = newDevoir.eleve_ids.includes(el.id)
                        return <label key={el.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, minHeight: 32 }}>
                          <input type="checkbox" checked={actif} onChange={() => setNewDevoir({ ...newDevoir, eleve_ids: actif ? newDevoir.eleve_ids.filter(id => id !== el.id) : [...newDevoir.eleve_ids, el.id] })} />
                          {el.prenom} {el.nom}
                        </label>
                      })}
                    </div>
                    </div>
                    )
                  })()}
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
                  {/* Le choix AJOUTE, il ne remplace pas. Un enseignant qui
                      revenait chercher une deuxieme fiche perdait la premiere
                      sans que rien ne le lui dise. Le champ est vide apres
                      chaque prise, sinon le navigateur refuse de reproposer le
                      meme fichier. */}
                  <input id="devoir-fichier" className="form-input" type="file" multiple
                    accept="image/*,.pdf"
                    onChange={e => {
                      const ajoutes = [...e.target.files]
                      setNewDevoir(d => ({ ...d, fichiers: [...d.fichiers, ...ajoutes] }))
                      e.target.value = ''
                    }} />

                  {/* Les pieces DEJA DEPOSEES, a la modification. Elles ne se
                      retiraient pas : rouvrir un devoir pour remplacer une
                      fiche obligeait a le supprimer et a tout ressaisir. */}
                  {(newDevoir.pieces_existantes || []).length > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>DEJA JOINTES</div>
                      {newDevoir.pieces_existantes.map((f, k) => (
                        <ListeFichier key={f.url || k} rang={k + 1} nom={f.nom || 'fiche ' + (k + 1)}
                          apercu={f.url}
                          onMonter={k > 0 ? () => setNewDevoir(d => ({ ...d, pieces_existantes: permuter(d.pieces_existantes, k, k - 1) })) : null}
                          onDescendre={k < newDevoir.pieces_existantes.length - 1 ? () => setNewDevoir(d => ({ ...d, pieces_existantes: permuter(d.pieces_existantes, k, k + 1) })) : null}
                          onRetirer={() => setNewDevoir(d => ({ ...d, pieces_existantes: d.pieces_existantes.filter((_, i) => i !== k) }))} />
                      ))}
                    </div>
                  )}

                  {newDevoir.fichiers.length > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>
                        A ENVOYER — {newDevoir.fichiers.length} fichier{newDevoir.fichiers.length > 1 ? 's' : ''}
                      </div>
                      {newDevoir.fichiers.map((f, k) => (
                        <ListeFichier key={f.name + k} rang={(newDevoir.pieces_existantes || []).length + k + 1} nom={f.name}
                          fichier={f}
                          onMonter={k > 0 ? () => setNewDevoir(d => ({ ...d, fichiers: permuter(d.fichiers, k, k - 1) })) : null}
                          onDescendre={k < newDevoir.fichiers.length - 1 ? () => setNewDevoir(d => ({ ...d, fichiers: permuter(d.fichiers, k, k + 1) })) : null}
                          onRetirer={() => setNewDevoir(d => ({ ...d, fichiers: d.fichiers.filter((_, i) => i !== k) }))} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {devoirErreur && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'rgba(237,28,36,.1)', color: 'var(--red)' }}>{devoirErreur}</div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ flex: '1 1 100%', minHeight: 42 }}
                  disabled={devoirEnCours} onClick={handleAddDevoir}>
                  {devoirEnCours
                    ? 'Enregistrement…'
                    : devoirEdite ? 'Enregistrer les modifications' : 'Enregistrer le devoir'}
                </button>
                {devoirEdite && (
                  <button className="btn-sm" style={{ flex: '1 1 100%', minHeight: 38 }}
                    onClick={annulerModification}>Annuler la modification</button>
                )}
              </div>
            </AccordionCard>

            {/* Sélection d'impression — visible AVANT de générer, jamais
                après. Les raccourcis reprennent les mots de l'enseignant :
                « aujourd'hui », « cette semaine ». « Tout sélectionner » ne
                prend PAS les archives : les archives se cochent une par une,
                délibérément. */}
            {devoirs.length > 0 && (
              <div className="no-print" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center',
                                                 background: 'var(--bg)', border: '1px solid var(--border)',
                                                 borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', marginRight: 2 }}>À IMPRIMER :</span>
                {[['aujourdhui', "Aujourd’hui"], ['semaine', 'Cette semaine'], ['actifs', 'Tout sélectionner'], ['rien', 'Effacer']].map(([cle, libelle]) => (
                  <button key={cle} className="btn-sm" style={{ minHeight: 34, padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setSelectionDevoirs(selectionRaccourci(devoirs, cle))}>{libelle}</button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800,
                               color: selectionDevoirs.length ? '#0284c7' : 'var(--muted)' }}>
                  {selectionDevoirs.length} sélectionné{selectionDevoirs.length > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Liste des Devoirs Enregistrés */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {devoirs.length === 0 && (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p style={{ fontSize: 13 }}>Aucun devoir enregistré pour l’instant.</p>
                </div>
              )}
              {(() => {
                // Un flux continu de devoirs sur téléphone ne se lit pas : on
                // range. `date_rendu` est la référence — c'est la date que
                // l'élève et le parent ont en tête.
                const groupes = classerDevoirs(devoirs, aujourdHuiISO())
                const rubriques = [
                  ['enRetard',  '⚠️ En retard',            '#b45309'],
                  ['aujourdhui', '📌 Aujourd’hui',          '#0284c7'],
                  ['aVenir',    '🗓 À venir',               '#0284c7'],
                  ['sansDate',  '• Sans date de remise',    '#64748b'],
                  ['archives',  '🗄 Archives',              '#64748b'],
                ]
                return rubriques.filter(([cle]) => groupes[cle].length > 0).map(([cle, titre, couleur]) => (
                  <div key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: couleur, letterSpacing: '.04em' }}>
                        {titre} · {groupes[cle].length}
                      </span>
                      {cle === 'archives' && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                          consultables — jamais imprimées ni envoyées sans être cochées
                        </span>
                      )}
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                    {groupes[cle].map((d, i) => (
                <div key={d.id || i} className="card" style={{ padding: 16,
                       borderLeft: `4px solid ${selectionDevoirs.includes(String(d.id)) ? '#0284c7' : 'var(--border)'}`,
                       background: selectionDevoirs.includes(String(d.id)) ? 'rgba(2,132,199,.04)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    {/* La zone tactile est le LABEL entier, pas la case :
                        17 px se ratent au pouce. 40 px de haut, le nom de la
                        matiere compris, se touchent sans viser. */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                                    minHeight: 40, paddingRight: 6, margin: '-4px 0' }}>
                      <input type="checkbox" style={{ width: 20, height: 20, flex: 'none' }}
                        checked={selectionDevoirs.includes(String(d.id))}
                        onChange={() => setSelectionDevoirs(sel => sel.includes(String(d.id))
                          ? sel.filter(x => x !== String(d.id))
                          : [...sel, String(d.id)])} />
                      <span style={{ fontWeight: 900, color: '#0284c7', fontSize: 14 }}>📖 {d.matiere}</span>
                    </label>
                    {d.date_rendu && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                        ⏰ Pour le {new Date(d.date_rendu + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    )}
                  </div>
                  {/* Le cours de référence, LU sur la préparation liée — jamais
                      un texte recopié dans le devoir. Si la préparation n'est
                      plus lisible, la ligne disparaît et le devoir reste entier.
                      Cet affichage est celui de l'ÉCRAN de l'enseignant ; le
                      cahier imprimé, validé et gelé, n'est pas touché. */}
                  {(() => {
                    const cours = coursDeReference(coursPrepares, lireDevoir(d).preparationId)
                    // Un devoir libre n'affiche RIEN. Les quatorze devoirs déjà
                    // en base sont tous libres : leur coller « Devoir libre »
                    // ajouterait une ligne à chaque carte pour ne rien
                    // apprendre. L'absence de mention dit déjà l'absence de
                    // cours.
                    if (!cours) return null
                    return (
                      <div style={{ marginTop: 8, padding: '8px 11px', background: '#f0f9ff',
                                    borderLeft: '3px solid #0284c7', borderRadius: '0 8px 8px 0' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 900, color: '#0284c7',
                                      letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          Exercices de maison du cours
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                          {cours.intitule}
                        </div>
                      </div>
                    )
                  })()}
                  {d.description && (
                    <div style={{ fontSize: 14, color: '#0f172a', marginTop: 6, fontWeight: 600 }}>
                      <span style={{ color: '#64748b', fontWeight: 800, fontSize: 11 }}>OBJECTIF · </span>{d.description}
                    </div>
                  )}
                  {(() => {
                    const v = lireDevoir(d)
                    const cibles = v.eleveIds.length + v.candidatMatricules.length
                    return (
                      <>
                        {v.enonce && (
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                            <span style={{ color: '#64748b', fontWeight: 800, fontSize: 11 }}>ÉNONCÉ · </span>{v.enonce}
                          </div>
                        )}
                        {v.bareme && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 5, whiteSpace: 'pre-wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: 11 }}>BARÈME · </span>{v.bareme}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 9px' }}>{v.type}</span>
                          {v.periode && <span style={{ fontSize: 10.5, fontWeight: 800, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 9px' }}>Période {v.periode}</span>}
                          <span style={{ fontSize: 10.5, fontWeight: 800, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 9px' }}>
                            👥 {v.destinataireMode === 'choix'
                              ? `${cibles} élève${cibles > 1 ? 's' : ''} ciblé${cibles > 1 ? 's' : ''}`
                              : 'Toute la classe'}
                          </span>
                          {/* L'auteur historique n'est pas un compte : on le dit. */}
                          {!v.auteurId && v.auteurNomHistorique && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 20, padding: '2px 9px' }}>
                              {v.auteurNomHistorique} · attribution historique
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <button className="btn-sm" style={{ flex: '1 1 130px', minHeight: 36 }}
                            onClick={() => ouvrirEnModification(d)}>✏️ Modifier</button>
                          <button className="btn-sm" style={{ flex: '1 1 130px', minHeight: 36, color: 'var(--red)' }}
                            onClick={() => supprimerDevoir(d)}>🗑 Supprimer</button>
                        </div>
                      </>
                    )
                  })()}
                  {(d.fichiers?.length ? d.fichiers : (d.fichier_url ? [{ url: d.fichier_url, nom: d.fichier_nom }] : [])).map((f, k) => (
                    <a key={k} href={f.url} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-block', marginTop: 8, marginRight: 12, fontSize: 12, fontWeight: 800, color: '#0284c7' }}>
                      📎 {f.nom || 'Voir l’exercice'}
                    </a>
                  ))}
                </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div>
            <div className="section-head"><div className="section-title">Messages parents (WhatsApp)</div></div>
            <div style={{background:'var(--dark)', color:'#fff', borderRadius:14, padding:14, marginBottom:14, display:'flex', gap:10, alignItems:'center'}}>
              <span style={{fontSize:24}}>💬</span><div><b>Via le WhatsApp officiel de l’école</b><div style={{fontSize:11, opacity:.7}}>Le message arrive au {WHATSAPP_ECOLE_LISIBLE}, puis l’école le transmet aux parents.</div></div>
            </div>
            {/* ── Quatre états, jamais confondus ─────────────────────────
                Un refus RLS ou une coupure réseau se lisait « aucun élève ».
                L'enseignant en concluait qu'il n'a pas de classe. */}
            {elevesEtat === 'chargement' && (
              <div className="card" style={{padding:14, marginBottom:12, color:'var(--muted)', fontSize:13}}>
                Chargement de vos élèves…
              </div>
            )}

            {elevesEtat === 'erreur' && (
              <div className="card" style={{padding:14, marginBottom:12, background:'#fef2f2',
                                            border:'1px solid #fca5a5', borderLeft:'5px solid #dc2626'}}>
                <div style={{fontWeight:900, color:'#991b1b', fontSize:13.5}}>⛔ Vos élèves n'ont pas pu être chargés</div>
                <div style={{fontSize:12.5, color:'#7f1d1d', marginTop:4}}>{elevesErreur}</div>
                <div style={{fontSize:12, color:'#7f1d1d', marginTop:5}}>
                  Cette liste est vide parce que la lecture a échoué, pas parce que vous n'avez pas d'élèves.
                </div>
                <button className="btn-sm" style={{marginTop:9}} onClick={loadData}>Réessayer</button>
              </div>
            )}

            {elevesEtat === 'sans_classe' && (
              <div className="card" style={{padding:14, marginBottom:12, background:'#fffbeb',
                                            border:'1px solid #fcd34d'}}>
                <div style={{fontWeight:800, color:'#92400e', fontSize:13}}>Aucune classe ne vous est affectée</div>
                <div style={{fontSize:12, color:'#92400e', marginTop:4}}>
                  Les affectations sont définies par la direction. Signalez-le si cela vous semble erroné.
                </div>
              </div>
            )}

            {(elevesEtat === 'ok' || elevesEtat === 'vide') && (
              <div className="card" style={{padding:14, marginBottom:12}}>
                {/* Une seule classe : on n'impose pas une étape pour rien. */}
                {classes.length > 1 && (
                  <>
                    <div className="form-label">1. Choisir la classe</div>
                    <select className="form-select" style={{marginBottom:12}}
                            value={selectedClasse?.id || ''}
                            onChange={e => { setSelectedClasse(classes.find(c => c.id === e.target.value)); setMsgEleve(null); setMsgBody(''); setMsgRecherche(''); setMsgTransmis(false) }}>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </>
                )}

                <div className="form-label">{classes.length > 1 ? '2.' : '1.'} Choisir l’élève</div>

                {getClasseEleves().length > 8 && (
                  <input className="form-input" style={{marginBottom:8}} value={msgRecherche}
                         onChange={e => setMsgRecherche(e.target.value)}
                         placeholder="🔍 Rechercher un élève…" />
                )}

                {elevesMessagerie().length === 0 ? (
                  <div style={{fontSize:12.5, color:'var(--muted)', padding:'8px 0'}}>
                    {msgRecherche
                      ? `Aucun élève ne correspond à « ${msgRecherche} ».`
                      : `Aucun élève inscrit dans ${selectedClasse?.nom || 'cette classe'}.`}
                  </div>
                ) : (
                  <select className="form-select" value={msgEleve?.id || ''}
                          onChange={e => { setMsgEleve(elevesMessagerie().find(el => el.id === e.target.value)); setMsgBody(''); setMsgTransmis(false) }}>
                    <option value="">-- Sélectionnez un élève --</option>
                    {elevesMessagerie().map(el => <option key={el.id} value={el.id}>{el.prenom} {el.nom}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* ── Le contexte de l'élève choisi ────────────────────────── */}
            {msgEleve && (
              <div className="card" style={{padding:14, marginBottom:12, background:'var(--bg)'}}>
                <div style={{fontSize:14, fontWeight:900, color:'var(--dark)'}}>
                  {msgEleve.prenom} {(msgEleve.nom || '').toUpperCase()}
                </div>
                <div style={{fontSize:11.5, color:'var(--muted)', marginTop:2}}>
                  Classe : {msgEleve.classes?.nom || selectedClasse?.nom || '—'}
                  {msgEleve.dossier?.matricule ? ` · ${msgEleve.dossier.matricule}` : ''}
                </div>
                <div style={{marginTop:9, paddingTop:9, borderTop:'1px solid var(--border)'}}>
                  <div className="form-label" style={{marginBottom:4}}>Responsable(s) au dossier</div>
                  {responsablesDe(msgEleve).length === 0 ? (
                    <div style={{fontSize:12, color:'#b45309', background:'#fffbeb',
                                 border:'1px solid #fcd34d', borderRadius:6, padding:'7px 10px'}}>
                      ⚠️ Aucun responsable rattaché à cet élève. Son dossier d'inscription n'est pas lié
                      — l'école devra identifier le destinataire.
                    </div>
                  ) : responsablesDe(msgEleve).map((r, i) => (
                    <div key={i} style={{fontSize:12.5, marginBottom:3}}>
                      <b>{r.prenom} {r.nom}</b>
                      <span style={{color:'var(--muted)'}}> · {r.lien_parente || 'responsable'}</span>
                      {r.telephone
                        ? <span style={{color:'var(--muted)'}}> · {r.telephone}</span>
                        : <span style={{color:'#b45309'}}> · numéro absent du dossier</span>}
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11, color:'var(--muted)', marginTop:8}}>
                  Canal : WhatsApp officiel de l’école
                </div>
              </div>
            )}
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
                  {/* « Envoyer » laissait croire que le parent recevait le
                      message. IDEAL ne peut pas le savoir : le message part
                      vers le WhatsApp de l'école, qui le transmet ensuite.
                      Trois états, dont un seul est vérifiable par IDEAL. */}
                  <button className="btn btn-primary" style={{width:'100%', marginTop:10, background:'#25D366'}}
                          onClick={() => sendWhatsApp(msgEleve)}>
                    📲 Transmettre au WhatsApp de l’école
                  </button>

                  {msgTransmis ? (
                    <div style={{marginTop:10, padding:'9px 12px', borderRadius:8,
                                 background:'#ecfdf5', border:'1px solid #6ee7b7', fontSize:12}}>
                      <b style={{color:'#065f46'}}>✓ Transmis à l’école</b>
                      <div style={{color:'#047857', marginTop:3}}>
                        WhatsApp a été ouvert avec le message préparé. IDEAL ne peut pas confirmer
                        que le parent l’a reçu : l’école reste l’émetteur officiel.
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:10.5, color:'var(--muted)', textAlign:'center', marginTop:6}}>
                      Préparé — pas encore transmis. Le message partira vers le numéro officiel de
                      l’école, jamais depuis votre numéro personnel.
                    </div>
                  )}
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
        /* Le moteur documentaire porte lui-même sa surcouche depuis qu'il en
           a une : l'enveloppe qui existait ici faisait doublon et imposait au
           document une largeur fixe de 880 px sur un téléphone. */
        <DevoirsDocument
          devoirsList={devoirsSelectionnes(devoirs, selectionDevoirs)}
          idsSelectionnes={selectionDevoirs}
          classeNom={selectedClasse?.nom || 'CP1 Bilingue'}
          eleves={getClasseEleves()}
          user={user}
          onClose={() => setShowDevoirsModal(false)}
        />
      )}

    </div>
  )
}

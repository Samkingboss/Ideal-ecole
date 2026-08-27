import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PerformancesDirecteur from './PerformancesDirecteur'
import AgendaCalendrier from './AgendaCalendrier'
import NotificationCenter from './NotificationCenter'
import {
  CONFIG_DEFAUT, calculerPoints, montantEte, valeurAction,
  avantagesDe, ancienneteAnnees, pointsMaxAnnee,
} from '../lib/points'
import { lireJournal } from '../lib/audit'
import { pushNotification } from '../lib/notifications'
import AffectationsMatieres from './AffectationsMatieres'
import ActivitePersonnel from './ActivitePersonnel'
import CartesScolaires from './CartesScolaires'
import CertificatScolarite from './CertificatScolarite'
import FichesEffectifs from './FichesEffectifs'
import InscriptionsValidation from './InscriptionsValidation'
import { FicheAlimentaire } from './CuisiniereApp'
import { agreger, messageLisible } from '../lib/chargement'
import DocumentPrintStudio from './DocumentPrintStudio'
import { statutDe, libelleStatut, ponctualiteAuDepot, CRITERES, APPRECIATIONS, noteDeduite, ajouterHistorique, ACTIONS, peutPasser, A_CONTROLER, dateDeCours, heureDeCours, momentDeDepot } from '../lib/preparations'
import { MaternelleDirection } from './MaternelleApp'
import { CHAMPS_ELEVE_AVEC_CLASSE } from '../lib/eleves'
import FrisePreparation from '../components/FrisePreparation'
import BlocCommentable from '../components/BlocCommentable'
import ComptabiliteRA from './ComptabiliteRA'
import { remarquesParSection, remarquesGenerales, nbCorrectionsOuvertes, entreeRemarque, cleEtape, SECTION_PROGRAMME } from '../lib/remarques'
import { RUBRIQUES as RUBRIQUES_PREPA } from './FichePreparation'
import { fonctionProfessionnelle } from '../lib/identiteProfessionnelle'

const BOTTOM_TABS = [
  { id:'dashboard', icon:'📊', label:'Bord' },
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'perfs', icon:'⭐', label:'Perfs' },
]

const TOP_TABS = [
  { id:'profs', icon:'👥', label:'Équipe' },
  { id:'rh', icon:'💼', label:'RH & Paie' },
  { id:'points', icon:'🏆', label:'Points & prime' },
  { id:'eleves', icon:'🎒', label:'Élèves' },
  { id:'cartes', icon:'💳', label:'Cartes Scolaires' },
  { id:'certificat', icon:'📜', label:'Certificat Scolarité' },
  { id:'synthese', icon:'📊', label:'Synthèse' },
  { id:'discipline', icon:'⚖️', label:'Discipline' },
  { id:'pedagogie', icon:'📚', label:'Pédagogie' },
  { id:'emploi', icon:'🗓️', label:'Emploi du temps' },
  { id:'maternelle', icon:'🧸', label:'Maternelle' },
]

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

// Un indicateur dont la source a échoué affiche « — ». Un zéro serait une
// valeur, et quelqu'un déciderait avec.
const Kpi = ({ v, echec }) => (echec || v === null || v === undefined)
  ? <span title="Donnée indisponible — le chargement a échoué" style={{ opacity: .55 }}>—</span>
  : <>{v}</>

const fmtRole = r => {
  const map = {
    'directeur': 'Directeur',
    'professeur': 'Enseignant',
    'surveillant': 'Surveillant',
    'conseiller_vie_scolaire': 'Conseiller Vie Scolaire',
    'responsable_administratif': 'Responsable Administratif',
    'cuisiniere': 'Chef Cuisinière / Cantine'
  }
  return map[r] || r
}

const FONCTIONS_MATERNELLE = {
  maitresse_fr_maternelle: { role: 'professeur', fonction: 'maitresse-fr-mat', langue: 'fr', label: 'Maîtresse de français — Maternelle' },
  maitresse_en_maternelle: { role: 'professeur', fonction: 'maitresse-en-mat', langue: 'en', label: 'English Teacher — Kindergarten' },
  assistante_fr_maternelle: { role: 'professeur', fonction: 'assistante-fr-mat', langue: 'fr', label: 'Assistante de français — Maternelle' },
  assistante_en_maternelle: { role: 'professeur', fonction: 'assistante-en-mat', langue: 'en', label: 'English Teaching Assistant — Kindergarten' },
}

const libelleFonction = user => {
  const entree = Object.values(FONCTIONS_MATERNELLE).find(x => x.fonction === user?.fonction)
  return entree?.label || fmtRole(user?.role)
}

// Référentiel par défaut des postes (seed si app_state rh/postes est vide).
// Doit rester aligné avec SALAIRES_DETAIL de public/comptabilite.html.
const DEFAULT_POSTES = [
  { id:'directeur',              label:'Directeur',                       mensuel:400000, commentaire:'Direction générale' },
  { id:'resp-administratif',     label:'Responsable administratif',       mensuel:150000, commentaire:'Secrétariat et suivi' },
  { id:'conseillere-vie-scol',   label:'Conseillère de vie scolaire',     mensuel:75000,  commentaire:'' },
  { id:'surveillant',            label:'Surveillant(e)',                  mensuel:75000,  commentaire:'Sécurité et discipline' },
  { id:'cuisiniere',             label:'Chef Cuisinière / Cantine',       mensuel:90000,  commentaire:'Restauration et gestion cantine' },
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

const ROUTES_ADMINISTRATION = {
  '/administration/cartes-scolaires': 'cartes',
  '/administration/certificats-scolarite': 'certificat',
  '/administration/effectifs': 'liste',
  '/administration/cantine': 'cantine',
  '/administration/budget-cuisine': 'budget-cuisine',
}
const moduleAdministrationDepuisUrl = () => ROUTES_ADMINISTRATION[window.location.pathname] || null

export default function DirecteurApp({ user, onLogout }) {
  const [tab, setTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('tab') || 'dashboard'
  })
  const [stats, setStats] = useState({ profs:0, eleves:0, checkpoints:0 })
  const [moduleAdministration, setModuleAdministration] = useState(moduleAdministrationDepuisUrl)
  const [profs, setProfs] = useState([])
  const [eleves, setEleves] = useState([])
  const [inscriptions, setInscriptions] = useState([])
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
  // Carte de préparation dépliée pour montrer sa frise d'historique.
  const [prepOuverte, setPrepOuverte] = useState(null)
  const [prepDetail, setPrepDetail] = useState(null)
  // La direction ouvre cet écran pour savoir ce qu'elle doit traiter, pas pour
  // parcourir un historique. On montre d'abord ce qui attend une décision.
  const [prepFiltre, setPrepFiltre] = useState('a_controler')
  const [prepAvis, setPrepAvis] = useState({ appreciations: {}, commentaire: '' })
  const [checkpoints, setCheckpoints] = useState([])
  const [syntheseData, setSyntheseData] = useState([])
  const [activeSyntheseClass, setActiveSyntheseClass] = useState(null)
  const [activeEleveClass, setActiveEleveClass] = useState(null)
  const [disciplines, setDisciplines] = useState([])
  const [postes, setPostes] = useState(DEFAULT_POSTES)
  const [posteDraft, setPosteDraft] = useState([])
  const [demandesRH, setDemandesRH] = useState([])
  const [demandeRHDetail, setDemandeRHDetail] = useState(null)

  // Demande désignée par une notification. La cloche transmet son identifiant ;
  // l'écran déroule jusqu'à elle et l'encadre quelques secondes. Sans cela, le
  // clic ouvrait la session RH et déposait le directeur en haut de la page,
  // devant les indicateurs de masse salariale, à lui de retrouver de quelle
  // demande on lui parlait.
  const [demandeCiblee, setDemandeCiblee] = useState(null)

  useEffect(() => {
    if (!demandeCiblee) return
    const demande = demandesRH.find(d => String(d.id) === String(demandeCiblee))
    if (demande) setDemandeRHDetail(demande)
    // On laisse le temps à la session RH de se rendre avant de chercher la ligne.
    const t = setTimeout(() => {
      const el = document.getElementById(`demande-${demandeCiblee}`) || document.getElementById(`preparation-${demandeCiblee}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    // La mise en évidence s'efface d'elle-même : elle sert à trouver, pas à rester.
    const fin = setTimeout(() => setDemandeCiblee(null), 6000)
    return () => { clearTimeout(t); clearTimeout(fin) }
  }, [demandeCiblee, demandesRH])

  useEffect(() => {
    if (!demandeCiblee || tab !== 'pedagogie') return
    const prep = preparations.find(p => String(p.id) === String(demandeCiblee))
    if (prep) {
      setPrepDetail(prep)
      setPrepAvis({ appreciations: prep.appreciations || {}, commentaire: '' })
    }
  }, [demandeCiblee, preparations, tab])

  // Reponse de la direction a une demande RH.
  //
  // Trois choses doivent se produire ensemble, et c'est la troisieme qui
  // manquait : enregistrer la decision, verifier qu'elle est bien partie, et
  // prevenir l'enseignant. Sans notification, la demande restait « en cours de
  // traitement » sur son ecran et il n'apprenait jamais la reponse.
  //
  // La notification vise `d.user_id` et non un role : c'est l'enseignant
  // concerne qu'on informe, pas la salle des profs.
  const repondreDemande = async (d, statut, reponse) => {
    const updated = demandesRH.map(x => (x.id === d.id ? { ...x, statut, reponse_direction: reponse } : x))
    setDemandesRH(updated)

    const { error } = await supabase.from('app_state').upsert({
      app: 'rh', key: 'demandes_rh_global', value: updated, updated_at: new Date().toISOString(),
    }, { onConflict: 'app,key' })

    if (error) {
      setDemandesRH(demandesRH)   // on remet l'ecran dans l'etat de la base
      alert("La reponse n'a pas ete enregistree : " + error.message)
      return
    }

    const transmise = await pushNotification(d.user_id, {
      titre: /refus/i.test(statut) ? 'Votre demande a été refusée' : 'Votre demande a été approuvée',
      message: reponse ? `${statut} — ${reponse}` : String(statut),
      type: 'rh',
      tabTarget: 'demandes',
    })

    // La decision est enregistree quoi qu'il arrive ; seule l'alerte a pu
    // echouer. Le dire, plutot que de laisser croire l'enseignant prevenu.
    if (!transmise) {
      alert("Reponse enregistree, mais la notification n'a pas pu etre envoyee a l'enseignant. Prevenez-le de vive voix.")
    }
  }

  // Ajouter une remarque à une rubrique. Elle rejoint l'historique de la
  // préparation — pas une table à part, pas un état local : une remarque est
  // une donnée institutionnelle, elle doit survivre à la fermeture de l'écran.
  const ajouterRemarque = async (section, texte) => {
    if (!prepDetail) return
    const entree = entreeRemarque({
      section, texte, utilisateur: user,
      fonction: fonctionProfessionnelle(user, { role: user.role }),
    })
    const historique = [...(Array.isArray(prepDetail.historique_statuts) ? prepDetail.historique_statuts : []), entree]
    const { error } = await supabase.from('preparations')
      .update({ historique_statuts: historique })
      .eq('id', prepDetail.id)
    if (error) { alert(`Remarque non enregistrée : ${error.message}`); return }
    // L'écran reflète immédiatement ce que la base porte désormais.
    setPrepDetail({ ...prepDetail, historique_statuts: historique })
    setPreparations(prev => prev.map(p =>
      p.id === prepDetail.id ? { ...p, historique_statuts: historique } : p))
  }

  const traiterPreparation = async (decision) => {
    if (!prepDetail) return
    const statutActuel = prepDetail.status === 'en_attente' ? 'deposee' : prepDetail.status === 'retard' ? 'en_retard' : prepDetail.status
    const statutSuivant = decision === 'valider' ? 'validee' : 'a_corriger'
    if (!peutPasser(statutActuel, statutSuivant)) {
      alert(`Cette préparation ne peut pas passer de « ${libelleStatut(statutActuel)} » à « ${libelleStatut(statutSuivant)} ».`)
      return
    }
    // Une remarque générale n'est exigée que si AUCUNE remarque de rubrique
    // n'a été posée : dans ce cas seulement, l'enseignante n'aurait rien pour
    // savoir quoi corriger.
    const nbRubriquesCommentees = nbCorrectionsOuvertes(prepDetail.historique_statuts)
    if (decision === 'corriger' && !prepAvis.commentaire.trim() && nbRubriquesCommentees === 0) {
      alert('Indiquez ce qui doit être corrigé : ajoutez une remarque sous la rubrique concernée, ou une remarque générale.')
      return
    }
    const note = noteDeduite(prepAvis.appreciations)
    if (decision === 'valider' && note === null) {
      alert('Évaluez les cinq critères avant de valider la préparation.')
      return
    }
    setLoading(true)
    const historique = ajouterHistorique(prepDetail.historique_statuts, {
      statut: statutSuivant,
      action: decision === 'valider' ? ACTIONS.validation : ACTIONS.correction_demandee,
      commentaire: prepAvis.commentaire.trim() || `Contrôle pédagogique : ${note}/20`,
      utilisateur: user,
      // La direction signe au titre de la direction, même si elle enseigne
      // par ailleurs : c'est un acte de contrôle, pas un acte pédagogique.
      contexte: { role: user.role },
    })
    const { error } = await supabase.from('preparations').update({
      status: statutSuivant,
      appreciations: prepAvis.appreciations,
      note_ia: note,
      historique_statuts: historique,
    }).eq('id', prepDetail.id)
    if (error) {
      alert(`Décision non enregistrée : ${error.message}`)
      setLoading(false)
      return
    }
    await pushNotification(prepDetail.user_id, {
      titre: decision === 'valider' ? '✅ Préparation validée' : '↩️ Préparation à corriger',
      message: prepAvis.commentaire.trim() || `Votre préparation a été validée avec la note de ${note}/20.`,
      type: 'preparation', tabTarget: 'preparation', ref: prepDetail.id,
    })
    setPrepDetail(null)
    setDemandeCiblee(null)
    await loadData()
    setLoading(false)
  }
  const [pointsConfig, setPointsConfig] = useState(CONFIG_DEFAUT)
  const [personnelRH, setPersonnelRH] = useState({})
  const [sourcesPoints, setSourcesPoints] = useState({ preparations: [], checkpoints: [], performances: [], rapports: [], saisieManuelle: {} })
  const [profSelectionne, setProfSelectionne] = useState(null)
  const [journal, setJournal] = useState([])
  const [journalOuvert, setJournalOuvert] = useState(false)
  const [subTabEleve, setSubTabEleve] = useState('dossiers')
  const [inscriptionCiblee, setInscriptionCiblee] = useState(null)
  const [allergenesRef, setAllergenesRef] = useState([])
  // Trois états, jamais deux : on distingue « en cours », « échoué » et
  // « abouti mais vide ». Les confondre, c'est ce qui produit un « 0 élève »
  // indiscernable d'un vrai zéro.
  const [chargement, setChargement] = useState(true)
  const [blocsEnEchec, setBlocsEnEchec] = useState([])
  const [erreurGlobale, setErreurGlobale] = useState('')

  useEffect(() => {
    const suivreNavigation = () => setModuleAdministration(moduleAdministrationDepuisUrl())
    window.addEventListener('popstate', suivreNavigation)
    return () => window.removeEventListener('popstate', suivreNavigation)
  }, [])

  const ouvrirModuleAdministration = (event, chemin) => {
    event.preventDefault()
    window.history.pushState({}, '', chemin)
    setModuleAdministration(ROUTES_ADMINISTRATION[chemin] || null)
    setTab('eleves')
    window.scrollTo({ top:0, behavior:'auto' })
  }

  const ouvrirAccueilAdministration = event => {
    if (event) event.preventDefault()
    window.history.pushState({}, '', '/administration')
    setModuleAdministration(null)
    setTab('eleves')
    window.scrollTo({ top:0, behavior:'auto' })
  }
  const ouvrirSessionAdministration = session => {
    window.history.pushState({}, '', '/administration')
    setModuleAdministration(null)
    setTab(session)
  }

  // Une notification système peut ouvrir l'application après sa fermeture.
  // Sa cible voyage alors dans l'URL, puisque le service worker ne partage pas
  // l'état React. On rejoue exactement la même navigation que pour la cloche.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const target = params.get('notificationTab')
    const ref = params.get('notificationRef')
    if (!target) return
    setTab(target)
    if (target === 'eleves') {
      setSubTabEleve('dossiers')
      setInscriptionCiblee(ref || null)
    } else {
      setDemandeCiblee(ref || null)
    }
    params.delete('notificationTab')
    params.delete('notificationRef')
    const reste = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${reste ? `?${reste}` : ''}${window.location.hash}`)
  }, [])
  const [subTabPersonnel, setSubTabPersonnel] = useState('profs')
  const [ficheMarcheCantine, setFicheMarcheCantine] = useState({ budget: 0, articles: [] })
  const [justificatifsCuisine, setJustificatifsCuisine] = useState([])
  const [selectedJustificatif, setSelectedJustificatif] = useState(null)

  useEffect(() => { 
    loadData() 
  }, [])

  const loadData = async () => {
    setChargement(true)
    setErreurGlobale('')
    setBlocsEnEchec([])
    try {
      const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const results = await Promise.all([
        supabase.from('users').select('*').neq('role','directeur').eq('actif',true),
        supabase.from('eleves').select(CHAMPS_ELEVE_AVEC_CLASSE).eq('actif',true),
        supabase.from('classes').select('*').order('ordre'),
        supabase.from('periodes').select('*').order('ordre'),
        supabase.from('evenements').select('*').order('date_event', { ascending: true }),
        supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
        supabase.from('parametres_mois').select('*').eq('mois', currentMoisStr).maybeSingle(),
        supabase.from('preparations').select('*, users(prenom, nom), classes(nom)').order('heure_depot', { ascending: false }),
        supabase.from('checkpoints').select('*'),
        supabase.from('prof_classes').select('*'),
        supabase.from('disciplines').select('*, eleves(prenom, nom, classe_id, classes(nom)), users!prof_id(prenom, nom)').order('created_at', { ascending: false }),
        supabase.from('inscriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('allergenes').select('code, libelle, ordre').eq('actif', true).order('ordre')
      ])

      // Douze requêtes en parallèle, et jusqu'ici douze `|| []`. Une seule
      // en échec — un refus RLS, une session non prête — et le tableau de
      // bord annonçait « 0 élève » avec le même aplomb qu'il aurait annoncé
      // 12. On nomme désormais chaque bloc et on relève ceux qui ont échoué.
      const parBloc = {
        personnel:    results[0],
        eleves:       results[1],
        classes:      results[2],
        periodes:     results[3],
        evenements:   results[4],
        documents:    results[5],
        parametres:   results[6],
        preparations: results[7],
        checkpoints:  results[8],
        affectations: results[9],
        discipline:   results[10],
        inscriptions: results[11],
        allergenes:   results[12],
      }
      const bilan = agreger(parBloc)
      setBlocsEnEchec(bilan.blocsEnEchec)

      // On continue avec ce qui a abouti : signaler par bloc, jamais par
      // page. Perdre les onze autres parce que l'une échoue remplacerait
      // une panne discrète par une panne totale.
      const liste = (r) => Array.isArray(r?.data) ? r.data : []
      const u     = liste(results[0])
      const el    = liste(results[1])
      const cl    = liste(results[2])
      const ev    = liste(results[4])
      const docs  = liste(results[5])
      const param = results[6]?.data
      const prep  = liste(results[7])
      const cp    = liste(results[8])
      const pc    = liste(results[9])
      const disc  = liste(results[10])
      const inscs = liste(results[11])
      setAllergenesRef(liste(results[12]))

      // Les données médicales et l'inscription cantine appartiennent au
      // dossier d'inscription. On les rattache à l'élève actif sans créer une
      // seconde source de vérité dans `eleves`.
      const elevesEnrichis = el.map(e => {
        const dossier = inscs.find(i => String(i.id) === String(e.inscription_id) || (e.matricule && i.matricule === e.matricule))
        return {
          ...e,
          // `?? false` transformait l'inconnu en « non inscrit » et écrasait
          // la colonne à trois états posée en phase 1. Le dossier élève fait
          // foi ; l'inscription ne sert qu'à combler ce qu'il ignore encore.
          cantine: e.cantine ?? dossier?.cantine ?? null,
          // `allergies` et `restrictions` ne sont plus lues ici : la fiche
          // validée vit sur `eleves`, avec son statut. Seule la déclaration
          // brute du parent remonte, et jamais comme une validation.
          declaration_alim_parent: e.declaration_alim_parent
            || [dossier?.allergies, dossier?.restrictions].filter(Boolean).join(' · ')
            || null,
          inscription_id: e.inscription_id || dossier?.id || null,
          matricule: e.matricule || dossier?.matricule || null,
        }
      })

      // Seuls les dossiers signés par la Direction deviennent des élèves
      // actifs. Un dossier « en attente » reste visible dans le registre de
      // validation, mais ne gonfle ni les effectifs ni la cantine.
      const elevesExistants = new Set(elevesEnrichis.flatMap(e => [e.matricule, e.inscription_id].filter(Boolean).map(String)))
      const elInscs = inscs.filter(i => i.statut === 'validee' && !elevesExistants.has(String(i.matricule)) && !elevesExistants.has(String(i.id))).map(i => {
        const matchingCl = cl.find(c => (c.nom || '').toLowerCase().trim() === (i.classe_demandee || '').toLowerCase().trim());
        return {
          id: i.id,
          nom: i.nom,
          prenom: i.prenom,
          matricule: i.matricule,
          date_naissance: i.date_naissance,
          sexe: i.sexe,
          classe_id: matchingCl ? matchingCl.id : null,
          classe_nom: i.classe_demandee,
          points_discipline: 100,
          actif: true,
          is_inscription: true
        };
      });

      const allCombinedEleves = [...elevesEnrichis, ...elInscs];

      setDisciplines(disc)
      if (param) setJoursOuvresGlobal(param.jours_ouvres);
      setPreparations(prep)

      setEleves(allCombinedEleves)
      setInscriptions(inscs)
      setClasses(cl)
      setEvenements(ev)
      if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)
      // Un indicateur en échec vaut `null`, pas zéro : l'écran affichera
      // « — » plutôt qu'un chiffre faux sur lequel on déciderait.
      setStats({
        profs:       parBloc.personnel?.error   ? null : u.length,
        eleves:      (parBloc.eleves?.error || parBloc.inscriptions?.error) ? null : allCombinedEleves.length,
        checkpoints: parBloc.checkpoints?.error ? null : cp.length,
        classes:     parBloc.classes?.error     ? null : cl.length,
      })
      setCheckpoints(cp)
      
      const enrichedProfs = u.map(p => ({
        ...p,
        role: p.fonction === 'cuisiniere' ? 'cuisiniere' : p.role,
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
      if (Array.isArray(rhPostes?.value) && rhPostes.value.length > 0) {
        const cleaned = rhPostes.value.map(p => ({
          ...p,
          commentaire: (p.commentaire || '').replace(/Fati\s*DJIRÉ/gi, '').replace(/\(–\s*trilingue\)/gi, '').replace(/\(Fati\s*DJIRÉ\s*–\s*trilingue\)/gi, '').trim()
        }))
        setPostes(cleaned)
        // Nettoyage cosmétique rejoué à chaque chargement : un refus n'a pas
        // de conséquence pour l'utilisateur, la version nettoyée reste
        // affichée et la tentative recommencera. On lit tout de même le
        // résultat plutôt que de l'ignorer — une écriture dont personne ne
        // regarde l'issue est une écriture dont personne ne sait qu'elle
        // échoue depuis des mois.
        const { error: errNettoyage } = await supabase.from('app_state').upsert(
          { app: 'rh', key: 'postes', value: cleaned, updated_at: new Date().toISOString() },
          { onConflict: 'app,key' }
        )
        if (errNettoyage) console.warn('Nettoyage des postes non persisté :', errNettoyage.message)
      }

      // Demandes RH soumises par les enseignants
      const { data: globalDem } = await supabase.from('app_state')
        .select('value').eq('app', 'rh').eq('key', 'demandes_rh_global').maybeSingle()
      if (globalDem && globalDem.value && Array.isArray(globalDem.value)) setDemandesRH(globalDem.value)

      // Fiche du marché cantine de la Cuisinière
      const { data: stateMarche } = await supabase.from('app_state')
        .select('value').eq('key', 'cantine_fiche_marche').maybeSingle()
      if (stateMarche && stateMarche.value) setFicheMarcheCantine(stateMarche.value)

      // Historique des Justificatifs du Jour transmis par la Cuisinière
      const { data: stateJustifs } = await supabase.from('app_state')
        .select('value').eq('key', 'cantine_justificatifs_historique').maybeSingle()
      if (stateJustifs && Array.isArray(stateJustifs.value)) {
        setJustificatifsCuisine(stateJustifs.value)
      }

      // ─── Points & prime d'été ───
      const [cfgRes, persRes, manRes, perfRes, rapRes] = await Promise.all([
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'points_config').maybeSingle(),
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'personnel').maybeSingle(),
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'saisie_manuelle').maybeSingle(),
        supabase.from('performances').select('prof_id, date_jour, heure_arrivee'),
        supabase.from('app_state').select('value').eq('app', 'rapports_eleves'),
      ])
      if (cfgRes.data?.value) setPointsConfig({ ...CONFIG_DEFAUT, ...cfgRes.data.value })
      if (persRes.data?.value) setPersonnelRH(persRes.data.value)
      setSourcesPoints({
        preparations: prep || [],
        checkpoints: cp || [],
        performances: Array.isArray(perfRes.data) ? perfRes.data : [],
        rapports: (Array.isArray(rapRes.data) ? rapRes.data : []).map(r => r.value).filter(Boolean),
        saisieManuelle: manRes.data?.value || {},
      })
    } catch (e) {
      // Une exception ici ne laisse aucune donnée : c'est le seul cas où
      // l'écran entier doit se déclarer en panne.
      console.error('Error loading data:', e)
      setErreurGlobale(messageLisible(e))
    } finally {
      setChargement(false)
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

  // ─── Points & prime d'été : persistance dans app_state ───
  const sauverRH = async (key, value, message) => {
    const { error } = await supabase.from('app_state').upsert(
      { app: 'rh', key, value, updated_at: new Date().toISOString() },
      { onConflict: 'app,key' }
    )
    if (error) { setMsg('Erreur: ' + error.message); return false }
    if (message) setMsg(message)
    return true
  }

  const majConfig = (patch) => {
    const next = { ...pointsConfig, ...patch }
    setPointsConfig(next)
    sauverRH('points_config', next)
  }

  const majPersonnel = (userId, patch) => {
    const next = { ...personnelRH, [userId]: { ...(personnelRH[userId] || {}), ...patch } }
    setPersonnelRH(next)
    sauverRH('personnel', next)
  }

  const majSaisie = (userId, triId, indId, valeur) => {
    const sm = sourcesPoints.saisieManuelle || {}
    const next = {
      ...sm,
      [userId]: {
        ...(sm[userId] || {}),
        [triId]: { ...((sm[userId] || {})[triId] || {}), [indId]: parseInt(valeur, 10) || 0 },
      },
    }
    setSourcesPoints(s => ({ ...s, saisieManuelle: next }))
    sauverRH('saisie_manuelle', next)
  }

  /** Enseignants avec leurs points calculés — recalculé à chaque rendu */
  const equipePoints = profs
    .filter(p => p.role === 'professeur')
    .map(p => {
      const nomComplet = `${p.prenom || ''} ${p.nom || ''}`.trim()
      const calc = calculerPoints(pointsConfig, sourcesPoints, p.id, nomComplet)
      const ete = montantEte(calc.pourcentage, pointsConfig)
      const av = avantagesDe(calc.pourcentage, (personnelRH[p.id] || {}).dateEmbauche, personnelRH[p.id], pointsConfig)
      return { prof: p, nomComplet, calc, ete, av }
    })
    .sort((a, b) => b.calc.total - a.calc.total)

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
      const fonctionMaternelle = FONCTIONS_MATERNELLE[newProf.role]
      const roleCompte = fonctionMaternelle?.role || newProf.role
      const fonctionCompte = fonctionMaternelle?.fonction || null
      const langueCompte = fonctionMaternelle?.langue || newProf.langue
      // `users` n'est plus accessible en écriture à la clé anonyme, et le
      // code d'accès a quitté la table. L'enregistrement passe donc par une
      // fonction SECURITY DEFINER qui écrit `users` et `users_secrets` dans
      // une seule transaction, et refuse le rôle `directeur`.
      //
      // Le repli sur `users_role_check` n'a pas disparu : il a été déplacé
      // dans la fonction SQL, où il s'exécute à l'intérieur de la même
      // transaction. Vu d'ici, le comportement est inchangé.
      const { data: userData, error } = await supabase.rpc('enregistrer_utilisateur', {
        p_id: newProf.id || null,
        p_prenom: newProf.prenom,
        p_nom: newProf.nom,
        p_role: roleCompte,
        p_langue: langueCompte,
        p_fonction: fonctionCompte,
        p_code: code,
        p_plafond: newProf.plafond_salaire ?? null,
      })

      if (error) {
        alert('❌ Compte non enregistré : ' + (error.message || 'Erreur inattendue'))
        setMsg('Erreur: ' + error.message)
      } else if (userData) {
        if (roleCompte === 'professeur') {
          await supabase.from('prof_classes').delete().eq('user_id', userData.id)
          if (newProf.classe_ids?.length > 0) {
            const links = newProf.classe_ids.map(cid => ({ 
              user_id: userData.id, 
              classe_id: cid,
              langue: langueCompte || 'fr'
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

  const majDossierCantine = async (eleve, changements) => {
    const avant = eleves
    setEleves(liste => liste.map(item => item.id === eleve.id ? { ...item, ...changements } : item))
    let requete = supabase.from('inscriptions').update(changements)
    requete = eleve.inscription_id
      ? requete.eq('id', eleve.inscription_id)
      : requete.eq('matricule', eleve.matricule || '__sans_matricule__')
    const { error } = await requete
    if (error) {
      setEleves(avant)
      setMsg(`Mise à jour cantine impossible : ${error.message}`)
      return false
    }
    setMsg('Dossier cantine mis à jour.')
    return true
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
    // Désactivation, jamais suppression — et par RPC, `users` étant
    // désormais fermée en écriture à la clé anonyme.
    const { error } = await supabase.rpc('desactiver_utilisateur', { p_id: id })

    // L'échec était déjà silencieux avant ce changement. Il ne doit plus
    // l'être : un compte qu'on croit désactivé et qui ne l'est pas est
    // exactement le genre de panne qu'on découvre trop tard.
    if (error) {
      alert('❌ Compte non désactivé : ' + (error.message || 'Erreur inattendue'))
      return
    }
    loadData()
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERFACE DÉDIÉE : RESPONSABLE ADMINISTRATIF (3 SESSIONS DISTINCTES)
  // ═══════════════════════════════════════════════════════════════════
  if (user.role === 'responsable_administratif') {
    const masseSalariale = (postes || []).reduce((s, p) => s + (p.mensuel || 0), 0)
    const nbInscrits = eleves.filter(e => e.is_inscription).length
    const nbEleves = eleves.filter(e => !e.is_inscription).length

    // Active session among the 3 distinct sessions: 'eleves', 'rh', 'compta'
    const activeSession = ['eleves', 'rh', 'compta'].includes(tab) ? tab : 'eleves'

    return (
      <div className="app-shell">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-brand">
            <div>
              <div className="topbar-logo">IDEAL</div>
              <div className="topbar-sub">ADMINISTRATION & GESTION</div>
            </div>
          </div>
          <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationCenter user={user} role={user.role} onNavigateTab={(t, ref) => {
              setTab(t)
              if (t === 'eleves') {
                setSubTabEleve('dossiers')
                setInscriptionCiblee(ref || null)
              } else {
                setDemandeCiblee(ref || null)
              }
            }} />
            <span className="role-badge" style={{ background: 'rgba(0,168,224,0.18)', color: '#00a8e0', border: '1px solid #00a8e0', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
              Responsable Admin
            </span>
            <button className="btn-logout" onClick={onLogout}>Déconnexion</button>
          </div>
        </div>

        {/* Navigation des 3 SESSIONS DISTINCTES.
            Cette barre était un simple `flex` sans défilement : sur un
            téléphone de 375 px, la troisième session sortait de l'écran et
            restait inatteignable. Elle défile désormais horizontalement,
            comme les barres des autres comptes. */}
        <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '2px solid var(--border)', padding: '6px 12px', gap: 8, position: 'sticky', top: 51, zIndex: 99, overflowX: 'auto', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap' }}>
          <button 
            className={`top-nav-item ${activeSession === 'eleves' ? 'active' : ''}`}
            onClick={() => ouvrirSessionAdministration('eleves')}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            🎓 1. Gestion Élèves
          </button>
          <button 
            className={`top-nav-item ${activeSession === 'rh' ? 'active' : ''}`}
            onClick={() => ouvrirSessionAdministration('rh')}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            💼 2. RH & Paie
          </button>
          <button 
            className={`top-nav-item ${activeSession === 'compta' ? 'active' : ''}`}
            onClick={() => ouvrirSessionAdministration('compta')}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            💰 3. Comptabilité
          </button>
        </div>

        <div className="page-content ux-page" style={{ padding: '1.5rem 1.2rem 40px' }}>
          {/* Rendre la panne observable. Sans ce bandeau, un refus RLS ou
              une coupure réseau se lisait « 0 élève » — un chiffre faux
              présenté avec le même aplomb qu'un vrai. */}
          {chargement && (
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10,
                          padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#475569' }}>
              Chargement des données…
            </div>
          )}
          {!chargement && erreurGlobale && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '5px solid #dc2626',
                          borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: '#991b1b', fontSize: 14 }}>⛔ Aucune donnée n'a pu être chargée</div>
              <div style={{ fontSize: 12.5, color: '#7f1d1d', marginTop: 4 }}>{erreurGlobale}</div>
              <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 6 }}>
                Les chiffres affichés ne sont pas fiables. Ne décidez pas sur cette base.
              </div>
              <button className="btn-sm" style={{ marginTop: 10 }} onClick={loadData}>Réessayer</button>
            </div>
          )}
          {!chargement && !erreurGlobale && blocsEnEchec.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '5px solid #f59e0b',
                          borderRadius: 10, padding: '12px 18px', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: '#92400e', fontSize: 13.5 }}>
                ⚠️ {blocsEnEchec.length} source(s) de données indisponible(s)
              </div>
              <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 4 }}>
                {blocsEnEchec.join(' · ')} — les indicateurs correspondants affichent «&nbsp;—&nbsp;»
                plutôt qu'un chiffre. Le reste de la page est à jour.
              </div>
              <button className="btn-sm" style={{ marginTop: 8 }} onClick={loadData}>Réessayer</button>
            </div>
          )}


          {/* ════════════════ SESSION 1 : GESTION ÉLÈVES ════════════════ */}
          {activeSession === 'eleves' && (
            <div>
              {!moduleAdministration && <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>🎓 Session : Gestion Élèves</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Gestion complète des élèves : inscriptions, dossiers numériques, cartes scolaires et certificats de scolarité.</p>
              </div>

              {/* Raccourcis et modules pour la Gestion Élèves */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                <a href="/inscription.html" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'linear-gradient(135deg,#00a8e0,#0078b4)', color: '#fff', padding: '18px 16px', borderRadius: 14, boxShadow: '0 4px 14px rgba(0,168,224,0.25)', cursor: 'pointer' }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>📝</div>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>Inscriptions &amp; Dossiers</div>
                    <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>{nbInscrits} nouvelles demandes</div>
                  </div>
                </a>
                <a href="/administration/cartes-scolaires" onClick={event => ouvrirModuleAdministration(event, '/administration/cartes-scolaires')} style={{ textDecoration:'none', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', padding:'18px 16px', borderRadius:14, boxShadow:'0 4px 14px rgba(16,185,129,0.25)', cursor:'pointer' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>💳</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Cartes Scolaires</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>Génération &amp; impression PDF</div>
                </a>
                <a href="/administration/certificats-scolarite" onClick={event => ouvrirModuleAdministration(event, '/administration/certificats-scolarite')} style={{ textDecoration:'none', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', color:'#fff', padding:'18px 16px', borderRadius:14, boxShadow:'0 4px 14px rgba(59,130,246,0.25)', cursor:'pointer' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>📜</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Certificat de Scolarité</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>Format portrait A4 officiel</div>
                </a>
                <a href="/administration/effectifs" onClick={event => ouvrirModuleAdministration(event, '/administration/effectifs')} style={{ textDecoration:'none', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', padding:'18px 16px', borderRadius:14, boxShadow:'0 4px 14px rgba(245,158,11,0.25)', cursor:'pointer' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🎒</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Fiches &amp; Effectifs</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>{nbEleves} élèves actifs</div>
                </a>
                <a href="/administration/cantine" onClick={event => ouvrirModuleAdministration(event, '/administration/cantine')} style={{ textDecoration:'none', background:'linear-gradient(135deg,#0d2a3b,#155e75)', color:'#fff', padding:'18px 16px', borderRadius:14, boxShadow:'0 4px 14px rgba(13,42,59,0.3)', cursor:'pointer' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🥗</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Cantine</div><div style={{ fontSize:11, opacity:.9, marginTop:2 }}>Inscriptions &amp; allergies</div>
                </a>
                <a href="/administration/budget-cuisine" onClick={event => ouvrirModuleAdministration(event, '/administration/budget-cuisine')} style={{ textDecoration:'none', background:'linear-gradient(135deg,#7bc142,#4d8f22)', color:'#fff', padding:'18px 16px', borderRadius:14, boxShadow:'0 4px 14px rgba(123,193,66,0.28)', cursor:'pointer' }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>🧾</div><div style={{ fontWeight:900, fontSize:15 }}>Budget cuisine</div><div style={{ fontSize:11, opacity:.9, marginTop:2 }}>Marché &amp; justificatifs</div>
                </a>
              </div>

              </>}

              {moduleAdministration && <div style={{ marginBottom:20 }}>
                <a href="/administration" onClick={ouvrirAccueilAdministration} style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--accent)', fontWeight:800, fontSize:13, textDecoration:'none', marginBottom:14 }}>← Administration &amp; Gestion</a>
              </div>}

              {/* Pages métier dédiées : les composants existants sont réutilisés sans duplication. */}
              {moduleAdministration === 'cartes' && <CartesScolaires eleves={eleves} classes={classes} />}
              {moduleAdministration === 'certificat' && <CertificatScolarite eleves={eleves} classes={classes} user={user} />}

              {['cantine','budget-cuisine'].includes(moduleAdministration) && (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>{moduleAdministration === 'cantine' ? '🥗 Cantine — Inscriptions & Allergies' : '🧾 Budget cuisine — Marché & Justificatifs'}</h2>
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{moduleAdministration === 'cantine' ? 'Suivi des inscriptions cantine, allergies médicales et restrictions alimentaires.' : 'Allocation budgétaire, achats du marché et justificatifs transmis par la Cuisinière.'}</p>
                  </div>

                  {/* Section Budget & Fiche d'Utilisation du Marché */}
                  {moduleAdministration === 'budget-cuisine' && <>
                  <div className="card" style={{ padding: '1.2rem', marginBottom: 20, borderLeft: '4px solid #7bc142' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0d2a3b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span>💵 Gestion du Budget &amp; Justificatif des Dépenses de la Cuisine</span>
                      <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(0,168,224,0.12)', color: 'var(--accent)', padding: '4px 12px', borderRadius: 8 }}>
                        {(ficheMarcheCantine.type_periode || 'journalier') === 'journalier' ? `📅 Budget Journalier (${ficheMarcheCantine.date_du_jour || 'Aujourd\'hui'})` : `🗓️ Budget Hebdomadaire (${ficheMarcheCantine.periode_semaine || 'Semaine'})`}
                      </span>
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'rgba(0,168,224,0.06)', border: '1px solid #00a8e0', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>BUDGET CANTINE ALLOUÉ (FCFA)</div>
                        <input
                          type="number"
                          className="form-input"
                          value={ficheMarcheCantine.budget || 0}
                          onChange={async (e) => {
                            const b = Number(e.target.value) || 0
                            const updated = { ...ficheMarcheCantine, budget: b }
                            setFicheMarcheCantine(updated)
                            // Sans lecture du résultat, le budget s'affichait
                            // modifié à l'écran sans avoir été enregistré.
                            const { error: errBudget } = await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_fiche_marche', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
                            if (errBudget) setErreurGlobale("Le budget du marché n'a pas été enregistré : " + errBudget.message)
                          }}
                          style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}
                        />
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Défini par le Responsable Administratif</div>
                      </div>

                      <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid #ef4444', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>DÉPENSES RÉELLES DU MARCHÉ</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>
                          {fcfa((ficheMarcheCantine.articles || []).reduce((s, a) => a.en_stock ? s : s + (Number(a.pu) * (parseFloat(a.quantite) || 1)), 0))}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{(ficheMarcheCantine.articles || []).length} achats saisis par la cuisinière</div>
                      </div>

                      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid #10b981', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>SOLDE DISPONIBLE (RESTE)</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', margin: '4px 0' }}>
                          {fcfa((ficheMarcheCantine.budget || 0) - (ficheMarcheCantine.articles || []).reduce((s, a) => a.en_stock ? s : s + (Number(a.pu) * (parseFloat(a.quantite) || 1)), 0))}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Synchronisé en temps réel</div>
                      </div>
                    </div>

                    {/* Tableau des Ingrédients / Fiche d'Utilisation du Marché */}
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 800 }}>🧾 Fiche d'Utilisation du Budget (Achats de la Cuisinière)</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Aliment / Ingrédient</th>
                              <th style={{ textAlign: 'center', padding: '8px 10px' }}>Quantité</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>P.U (FCFA)</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>Total (FCFA)</th>
                              <th style={{ textAlign: 'center', padding: '8px 10px' }}>Statut Payé</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ficheMarcheCantine.articles || []).map((art, idx) => {
                              const totalArt = art.en_stock ? 0 : Number(art.pu) * (parseFloat(art.quantite) || 1)
                              return (
                                <tr key={art.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{art.nom}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{art.quantite}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fcfa(art.pu)}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{fcfa(totalArt)}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <span className={`chip ${art.en_stock || art.achete ? 'chip-green' : 'chip-amber'}`}>{art.en_stock ? 'En stock' : art.achete ? '✓ Acheté' : 'À acheter'}</span>
                                  </td>
                                </tr>
                              )
                            })}
                            {(ficheMarcheCantine.articles || []).length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)' }}>Aucun achat saisi par la Cuisinière pour le moment.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Section Registre des Justificatifs du Jour Transmis par la Cuisine */}
                  <div className="card" style={{ padding: '1.2rem', marginBottom: 20, borderLeft: '4px solid #f59e0b', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0d2a3b' }}>
                          🧾 Registre des Justificatifs du Jour &amp; Fiches de Marché Transmises
                        </h3>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Feuilles d'achats validées, signées électroniquement par la Cuisinière et répertoriées dans les justificatifs du Responsable Administratif.
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', padding: '4px 12px', borderRadius: 8 }}>
                        📜 {justificatifsCuisine.length} Justificatif(s) Enregistré(s)
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Période / Date</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Signataire (Chef Cuisinière)</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px' }}>Budget Alloué</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px' }}>Total Achats</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px' }}>Solde Restant</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px' }}>Horodatage Transmission</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {justificatifsCuisine.map(justif => (
                            <tr key={justif.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0d2a3b' }}>
                                {justif.type_periode === 'journalier' ? `📅 Jour du ${justif.date_du_jour || justif.date}` : `🗓️ ${justif.periode_semaine || 'Semaine'}`}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: '#d97706' }}>
                                ✍️ {justif.signature_nom || 'Chef Cuisinière IDEAL'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                                {fcfa(justif.budget)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#dc2626' }}>
                                {fcfa(justif.total_depense)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: justif.solde >= 0 ? '#16a34a' : '#dc2626' }}>
                                {fcfa(justif.solde)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                                {justif.timestamp || justif.date}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => setSelectedJustificatif(justif)}
                                  style={{ background: '#0d2a3b', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  👁️ Voir / Imprimer
                                </button>
                              </td>
                            </tr>
                          ))}

                          {justificatifsCuisine.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                <div style={{ fontSize: 32, marginBottom: 6 }}>🧾</div>
                                <div style={{ fontWeight: 800, fontSize: 13 }}>Aucun justificatif transmis par la cuisine pour le moment.</div>
                                <div style={{ fontSize: 11, marginTop: 4 }}>Dès que la Cuisinière valide et signe sa fiche du marché, elle s'affichera automatiquement ici.</div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  </>}

                  {/* Section Inscriptions Cantine & Allergies */}
                  {moduleAdministration === 'cantine' && (
                  <div className="card" style={{ padding: '1.2rem' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}>🎒 Synchronisation des Inscriptions Cantine &amp; Allergies Élèves</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Nom &amp; Prénom</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Classe</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px' }}>Inscrit à la Cantine</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Allergies Médicales</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Restrictions Alimentaires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eleves.map(e => {
                            const estInscrit = e.cantine !== false
                            return (
                              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 800 }}>{e.prenom} {e.nom}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span className="chip chip-blue">{e.classe_nom || classes.find(c => c.id === e.classe_id)?.nom || '—'}</span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <button
                                    onClick={async () => {
                                      await majDossierCantine(e, { cantine: !estInscrit })
                                    }}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: 20,
                                      fontWeight: 800,
                                      fontSize: 11,
                                      border: 'none',
                                      cursor: 'pointer',
                                      background: estInscrit ? 'linear-gradient(135deg,#10b981,#059669)' : '#e2e8f0',
                                      color: estInscrit ? '#fff' : '#64748b'
                                    }}
                                  >
                                    {estInscrit ? '🟢 Inscrit' : '⚪ Non inscrit'}
                                  </button>
                                </td>
                                {/* Ces deux champs affichaient `e.allergies || 'Aucune'`
                                    sur une colonne qui n'existe pas : tout enfant
                                    apparaissait donc « Aucune », validé ou non. Ils
                                    écrivaient de surcroît dans `inscriptions`, fermée
                                    en écriture depuis la phase 0.
                                    La direction lit désormais la fiche validée ; la
                                    validation elle-même a lieu au module cantine,
                                    pour qu'il n'existe qu'un seul endroit où l'on
                                    engage sa responsabilité. */}
                                <td style={{ padding: '10px 12px' }} colSpan={2}>
                                  <FicheAlimentaire el={e} referentiel={allergenesRef} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}
                </div>
              )}
              {moduleAdministration === 'liste' && <FichesEffectifs eleves={eleves} classes={classes} onCertificat={() => { window.history.pushState({}, '', '/administration/certificats-scolarite'); setModuleAdministration('certificat') }} onCarte={() => { window.history.pushState({}, '', '/administration/cartes-scolaires'); setModuleAdministration('cartes') }} />}
            </div>
          )}

          {/* ════════════════ SESSION 2 : RH & PAIE ════════════════ */}
          {activeSession === 'rh' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>💼 Session : RH &amp; Paie du Personnel</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Référentiel des postes, masse salariale, émargement mensuel et fiches de paie du personnel.</p>
              </div>

              {/* Demandes RH — le responsable administratif reçoit les mêmes
                  notifications que la direction, il doit donc voir les demandes
                  et pouvoir y répondre. Sa cloche menait jusqu'ici à cet écran
                  où il n'y en avait aucune trace. */}
              <div className="card" style={{ marginBottom: 20, padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📑 Demandes RH du personnel</h3>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>
                    {(demandesRH || []).filter(d => d.statut === 'En attente').length} en attente
                  </span>
                </div>

                {(demandesRH || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>Aucune demande soumise.</div>
                ) : (demandesRH || []).map(d => (
                  <div
                    key={d.id}
                    id={`demande-${d.id}`}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', marginBottom: 8,
                      background: demandeCiblee === d.id ? 'rgba(0,168,224,0.12)' : 'transparent',
                      outline: demandeCiblee === d.id ? '2px solid var(--accent)' : 'none',
                      transition: 'background .3s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{d.user_name || 'Enseignant'}</div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                        background: d.statut === 'Approuvée' ? 'rgba(16,185,129,0.12)' : d.statut === 'Refusée' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                        color: d.statut === 'Approuvée' ? 'var(--green)' : d.statut === 'Refusée' ? 'var(--red)' : 'var(--amber)',
                      }}>{d.statut}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {d.type}{d.details?.montant ? ` · ${Number(d.details.montant).toLocaleString('fr-FR')} F` : ''}
                      {' · '}{new Date(d.date_soumission).toLocaleDateString('fr-FR')}
                    </div>
                    {d.details?.motif && <div style={{ fontSize: 12, marginTop: 4 }}>« {d.details.motif} »</div>}
                    {d.reponse_direction && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <b style={{ color: 'var(--accent)' }}>Réponse :</b> {d.reponse_direction}
                      </div>
                    )}
                    {d.statut === 'En attente' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn-sm" style={{ background: 'var(--green)', color: '#fff' }}
                          onClick={async () => { const r = prompt("Commentaire d'approbation :", 'Approuvé'); if (r !== null) await repondreDemande(d, 'Approuvée', r) }}>
                          ✓ Approuver
                        </button>
                        <button className="btn-sm" style={{ background: 'var(--red)', color: '#fff' }}
                          onClick={async () => { const r = prompt('Motif du refus :', 'Refusé'); if (r) await repondreDemande(d, 'Refusée', r) }}>
                          ✖ Refuser
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* KPI Masse Salariale */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'rgba(142,68,173,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(142,68,173,0.2)' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#8e44ad' }}><Kpi v={stats.profs} echec={blocsEnEchec.includes('personnel')} /></div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Employés actifs</div>
                </div>
                <div style={{ background: 'rgba(141,198,63,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(141,198,63,0.2)' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{fcfa(masseSalariale)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Masse salariale / mois</div>
                </div>
                <div style={{ background: 'rgba(236,0,140,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(236,0,140,0.2)' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--pink)' }}>{fcfa(masseSalariale * 12)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Masse salariale / an</div>
                </div>
              </div>

              {/* 📂 DOSSIERS DU PERSONNEL */}
              <div className="card" style={{ marginBottom: 20, padding: '1.2rem', borderLeft: '4px solid #8e44ad' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--dark)' }}>📂 Dossiers du Personnel Enseignant &amp; Administratif</h3>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Fiches individuelles, informations renseignées, codes d'accès et classes attribuées</div>
                  </div>
                  <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => { setNewProf({ prenom: '', nom: '', role: 'professeur', langue: 'fr', code_acces: '', plafond_salaire: 180000, classe_ids: [] }); setShowModal('prof') }}>
                    + Nouveau Dossier Personnel
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {(profs || []).map((p, i) => (
                    <div key={p.id || i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#8e44ad,#6c3483)', color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          {(p.prenom?.[0] || '') + (p.nom?.[0] || '')}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--dark)' }}>{p.prenom} {p.nom}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Rôle: <b style={{ color: 'var(--accent)' }}>{libelleFonction(p)}</b> {p.langue ? `(${p.langue.toUpperCase()})` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Le code d'accès a quitté `users` : il vit dans
                          `users_secrets`, hors de portée de la clé anonyme.
                          Il n'est donc plus affichable ici — et c'est le but.
                          Il se montre une seule fois, à la création du compte.
                          Un code perdu ne se retrouve pas : il se remplace. */}
                      <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
                        🔑 Code d'accès : <b style={{ fontFamily: 'monospace', letterSpacing: 2 }}>••••••••</b>
                        <span style={{ display: 'block', fontSize: 10, marginTop: 2 }}>
                          Communiqué une seule fois, à la création du compte.
                        </span>
                      </div>

                      {p.role === 'professeur' && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Classes attribuées :</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(p.classe_ids || []).map(cid => (
                              <span key={cid} style={{ fontSize: 10, background: 'rgba(0,168,224,0.12)', color: '#00a8e0', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                                {classes.find(c => c.id === cid)?.nom || cid}
                              </span>
                            ))}
                            {(p.classe_ids || []).length === 0 && <span style={{ fontSize: 10, color: 'var(--red)', fontStyle: 'italic' }}>Aucune classe</span>}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11 }}>
                        {/* Le plafond salarial ne figure plus dans une liste
                            générale : il reste modifiable au formulaire, mais
                            n'est plus renvoyé aux lecteurs non habilités. */}
                        <span style={{ color: 'var(--muted)' }}>{p.role ? fmtRole(p.role) : ''}</span>
                        <button
                          className="btn-sm"
                          style={{ background: 'rgba(142,68,173,0.1)', color: '#8e44ad', border: '1px solid #8e44ad', padding: '3px 8px', fontSize: 10 }}
                          onClick={() => alert(`Dossier de ${p.prenom} ${p.nom}\n- Rôle: ${fmtRole(p.role)}\n- Statut: ${p.actif ? 'Actif' : 'Inactif'}\n\nLe code d'accès n'est plus consultable. En cas de perte, il faut en attribuer un nouveau.`)}
                        >
                          👁️ Voir Fiche
                        </button>
                      </div>
                    </div>
                  ))}
                  {(profs || []).length === 0 && (
                    <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '2rem' }}>
                      Aucun dossier personnel enregistré.
                    </div>
                  )}
                </div>
              </div>

              {/* Grille Salariale complète */}
              <div className="card" style={{ marginBottom: 20, padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💼 Référentiel des Postes &amp; Salaires</h3>
                  <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => { setPosteDraft(postes.map(p => ({ ...p }))); setShowModal('postes') }}>
                    ✏️ Éditer les Postes
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Poste / Emploi</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px' }}>Salaire Mensuel</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px' }}>Cumul Annuel (12 mois)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(postes || []).map((p, i) => (
                        <tr key={p.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.label}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fcfa(p.mensuel)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fcfa((p.mensuel || 0) * 12)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ SESSION 3 : COMPTABILITÉ ════════════════ */}
          {activeSession === 'compta' && (
            <ComptabiliteRA supabase={supabase} user={user} />
          )}

        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERFACE DIRECTEUR (Organisée en 6 sessions distinctes et structurées)
  // ═══════════════════════════════════════════════════════════════════
  const DIRECTOR_SESSIONS = [
    // `eleves` manquait ici, et manquait aussi à la liste blanche ci-dessous.
    // Conséquence : la validation des dossiers d'inscription était
    // INATTEIGNABLE depuis le compte directeur — `setTab('eleves')` retombait
    // sans un mot sur « Synthèse ». Les sept dossiers déposés sont restés
    // « en attente » faute d'un écran pour les signer, et toute la chaîne qui
    // en dépend — élève, responsables, date de naissance, messagerie,
    // anniversaires — n'a jamais pu démarrer.
    { id: 'eleves',     icon: '🎒', label: 'Élèves & Inscriptions' },
    { id: 'agenda',     icon: '🗓️', label: 'Emploi du temps & Agenda' },
    { id: 'rh',         icon: '💼', label: 'RH' },
    { id: 'personnel',  icon: '👥', label: 'Gestion du Personnel' },
    { id: 'pedagogie',  icon: '📚', label: 'Pédagogie' },
    { id: 'maternelle', icon: '🧸', label: 'Maternelle' },
    { id: 'discipline', icon: '⚖️', label: 'Discipline' },
    { id: 'synthese',   icon: '📊', label: 'Synthèse' },
  ]

  // Combien de dossiers attendent la signature de la direction. Affiché sur
  // l'onglet : un dossier en attente n'a aucune raison d'être invisible.
  const enAttenteSignature = (inscriptions || []).filter(i => i.statut !== 'validee').length

  const activeDirectorTab = ['eleves', 'agenda', 'rh', 'personnel', 'profs', 'points', 'pedagogie', 'discipline', 'synthese', 'dashboard', 'emploi', 'maternelle'].includes(tab)
    ? tab
    : 'synthese'

  return (
    <div className="app-shell">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">ÉCOLE INTERNATIONALE BILINGUE</div>
          </div>
        </div>
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationCenter user={user} role={user.role || 'directeur'} onNavigateTab={(t, ref) => {
            setTab(t)
            if (t === 'eleves') {
              setSubTabEleve('dossiers')
              setInscriptionCiblee(ref || null)
            } else {
              setDemandeCiblee(ref || null)
            }
          }} />
          <span className="role-badge role-directeur">Directeur v2.5</span>
          <button className="btn-logout" onClick={onLogout}>Deconnexion</button>
        </div>
      </div>

      {/* Barre de navigation des 6 SESSIONS DIRECTEUR (Mobile-friendly Scroll horizontal sans chevauchement) */}
      {/* Un seul conteneur de defilement, et c'est `.top-nav-secondary`.
          Il y en avait deux, imbriques : la classe defile deja (overflow-x
          auto), et on l'avait enfermee dans un second conteneur defilant en
          lui imposant `width: max-content`. La classe n'avait alors plus rien
          a faire defiler, et son `overscroll-behavior-x: contain` empechait le
          geste de remonter au parent, seul a deborder vraiment : le doigt ne
          deplacait plus rien. */}
      <div className="top-nav-secondary" style={{ borderBottom: '2px solid var(--border)', boxShadow: 'none', padding: '6px 8px' }}>
          {DIRECTOR_SESSIONS.map(t => {
            const isActive = activeDirectorTab === t.id ||
              (t.id === 'agenda' && activeDirectorTab === 'emploi') ||
              (t.id === 'personnel' && (activeDirectorTab === 'profs' || activeDirectorTab === 'points')) ||
              (t.id === 'synthese' && activeDirectorTab === 'dashboard')

            return (
              <button 
                key={t.id} 
                className={`top-nav-item ${isActive ? 'active' : ''}`} 
                onClick={() => setTab(t.id)}
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
                <span>{t.icon}</span> <span>{t.label}</span>
              </button>
            )
          })}
      </div>

      <div className="page-content ux-page" style={{ padding: '1.5rem 1.2rem calc(130px + env(safe-area-inset-bottom))' }}>
          {/* Rendre la panne observable. Sans ce bandeau, un refus RLS ou
              une coupure réseau se lisait « 0 élève » — un chiffre faux
              présenté avec le même aplomb qu'un vrai. */}
          {chargement && (
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10,
                          padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#475569' }}>
              Chargement des données…
            </div>
          )}
          {!chargement && erreurGlobale && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '5px solid #dc2626',
                          borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: '#991b1b', fontSize: 14 }}>⛔ Aucune donnée n'a pu être chargée</div>
              <div style={{ fontSize: 12.5, color: '#7f1d1d', marginTop: 4 }}>{erreurGlobale}</div>
              <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 6 }}>
                Les chiffres affichés ne sont pas fiables. Ne décidez pas sur cette base.
              </div>
              <button className="btn-sm" style={{ marginTop: 10 }} onClick={loadData}>Réessayer</button>
            </div>
          )}
          {!chargement && !erreurGlobale && blocsEnEchec.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '5px solid #f59e0b',
                          borderRadius: 10, padding: '12px 18px', marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: '#92400e', fontSize: 13.5 }}>
                ⚠️ {blocsEnEchec.length} source(s) de données indisponible(s)
              </div>
              <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 4 }}>
                {blocsEnEchec.join(' · ')} — les indicateurs correspondants affichent «&nbsp;—&nbsp;»
                plutôt qu'un chiffre. Le reste de la page est à jour.
              </div>
              <button className="btn-sm" style={{ marginTop: 8 }} onClick={loadData}>Réessayer</button>
            </div>
          )}

        {msg && <div className="error-msg" style={{background:'rgba(141,198,63,.1)',borderColor:'var(--green)',color:'var(--green)',marginBottom:'1rem'}} onClick={()=>setMsg('')}>{msg}</div>}

        {/* ════════════════ 1. EMPLOI DU TEMPS & AGENDA ════════════════ */}
        {activeDirectorTab === 'eleves' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>🎒 Élèves &amp; Inscriptions</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                Dossiers à signer, effectifs, cartes scolaires et certificats.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6, marginBottom: 14 }}>
              {[
                ['dossiers',   `📝 Dossiers à signer${enAttenteSignature ? ` · ${enAttenteSignature}` : ''}`],
                ['liste',      '📋 Effectifs'],
                ['cartes',     '💳 Cartes scolaires'],
                ['certificat', '📜 Certificats'],
              ].map(([id, libelle]) => (
                <button key={id} onClick={() => setSubTabEleve(id)} style={{
                  padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800,
                  cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
                  border: '2px solid ' + (subTabEleve === id ? 'var(--accent)' : 'var(--border)'),
                  background: subTabEleve === id ? 'var(--accent)' : 'var(--bg)',
                  color: subTabEleve === id ? '#fff' : 'var(--muted)',
                }}>{libelle}</button>
              ))}
            </div>

            {subTabEleve === 'dossiers' && <InscriptionsValidation inscriptions={inscriptions} directeur={user} onValidated={loadData} inscriptionCiblee={inscriptionCiblee} />}
            {subTabEleve === 'liste' && <FichesEffectifs eleves={eleves} classes={classes} onCertificat={() => setSubTabEleve('certificat')} onCarte={() => setSubTabEleve('cartes')} />}
            {subTabEleve === 'cartes' && <CartesScolaires eleves={eleves} classes={classes} />}
            {subTabEleve === 'certificat' && <CertificatScolarite eleves={eleves} classes={classes} user={user} />}
          </div>
        )}

        {(activeDirectorTab === 'agenda' || activeDirectorTab === 'emploi') && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>🗓️ Session : Emploi du Temps &amp; Agenda</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Gestion de l'agenda de l'établissement, événements, calendrier scolaire et plannings des cours.</p>
            </div>

            {/* Agenda & Événements */}
            <div style={{ marginBottom: 20 }}>
              <AgendaCalendrier checkpoints={checkpoints} classes={classes} periodes={periodes} isAdmin={true} anniversaires={eleves} />
            </div>

            {/* Emplois du temps par classe */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 800 }}>🗓️ Emplois du Temps par Classe</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {classes.map(c => (
                  <div key={c.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 6 }}>🏫 Classe : {c.nom}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Planning &amp; enseignants référents</div>
                    <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff', marginTop: 10, width: '100%' }} onClick={() => alert(`Emploi du temps officiel de la classe ${c.nom}`)}>
                      👁️ Voir Planning
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ 2. RH ════════════════ */}
        {activeDirectorTab === 'rh' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>💼 Session : Ressources Humaines (RH)</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Demandes RH, congés et suivi administratif du personnel.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(142,68,173,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(142,68,173,0.2)' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#8e44ad' }}><Kpi v={stats.profs} echec={blocsEnEchec.includes('personnel')} /></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Employés actifs</div>
              </div>
            </div>

            {/* Demandes RH en attente */}
            <div className="card" style={{ marginBottom: 20, padding: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📑 Demandes RH &amp; Congés du Personnel</h3>
                <span className="badge" style={{ background: 'rgba(0,168,224,0.1)', color: 'var(--accent)', fontWeight: 700, padding: '4px 10px', borderRadius: 20, fontSize: 11 }}>{(demandesRH || []).filter(d => d.statut === 'En attente').length} En attente</span>
              </div>
              {(demandesRH || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>Aucune demande RH soumise.</div>
              ) : (demandesRH || []).map(d => (
                <div
                  key={d.id}
                  id={`demande-${d.id}`}
                  onClick={() => setDemandeRHDetail(d)}
                  style={{
                    border: String(demandeCiblee) === String(d.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 12, padding: '12px 14px', marginBottom: 9, cursor: 'pointer',
                    background: String(demandeCiblee) === String(d.id) ? 'rgba(0,168,224,0.12)' : '#fff',
                    transition: 'background .3s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{d.user_name || 'Personnel'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {d.type}{d.details?.montant ? ` · ${Number(d.details.montant).toLocaleString('fr-FR')} F` : ''}
                        {d.date_soumission ? ` · ${new Date(d.date_soumission).toLocaleDateString('fr-FR')}` : ''}
                      </div>
                    </div>
                    <span style={{
                      flex: 'none', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 7,
                      background: d.statut === 'Approuvée' ? 'rgba(16,185,129,0.12)' : d.statut === 'Refusée' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: d.statut === 'Approuvée' ? 'var(--green)' : d.statut === 'Refusée' ? 'var(--red)' : 'var(--amber)',
                    }}>{d.statut}</span>
                  </div>

                  <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                    {d.details?.motif ? `« ${d.details.motif} »` : 'Aucun motif renseigné.'}
                  </div>
                  {d.reponse_direction && <div style={{ fontSize: 12, marginTop: 5 }}><b style={{ color: 'var(--accent)' }}>Réponse :</b> {d.reponse_direction}</div>}

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                    <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => setDemandeRHDetail(d)}>👁 Voir tous les détails</button>
                    {d.statut === 'En attente' && <>
                      <button className="btn-sm" style={{ background: 'var(--green)', color: '#fff' }} onClick={async () => { const rep = prompt('Commentaire d\'approbation :', 'Approuvé'); if (rep !== null) await repondreDemande(d, 'Approuvée', rep) }}>✓ Approuver</button>
                      <button className="btn-sm" style={{ background: 'var(--red)', color: '#fff' }} onClick={async () => { const rep = prompt('Motif du refus :', 'Refusé'); if (rep) await repondreDemande(d, 'Refusée', rep) }}>✖ Refuser</button>
                    </>}
                  </div>
                </div>
              ))}
            </div>

            {demandeRHDetail && (() => {
              const d = demandesRH.find(x => String(x.id) === String(demandeRHDetail.id)) || demandeRHDetail
              const infos = d.details || {}
              const typeLabel = {
                pret: 'Demande de prêt', avance: 'Avance sur salaire', absence: 'Justificatif d’absence',
                permission: 'Demande de permission', achat: 'Achat de matériel pédagogique', maternite: 'Congé maternité',
              }[d.type] || d.type
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(13,42,59,.68)', display: 'grid', placeItems: 'center', padding: 16 }} onClick={() => setDemandeRHDetail(null)}>
                  <div className="card" style={{ width: 'min(620px, 100%)', maxHeight: '88vh', overflowY: 'auto', padding: '1.3rem', borderRadius: 18 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Détail de la demande RH</div>
                        <h3 style={{ margin: '3px 0 2px', fontSize: 19 }}>{typeLabel}</h3>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{d.user_name || 'Personnel'} · {d.date_soumission ? new Date(d.date_soumission).toLocaleString('fr-FR') : ''}</div>
                      </div>
                      <button className="btn-sm" onClick={() => setDemandeRHDetail(null)} style={{ background: 'var(--bg)', color: 'var(--dark)', fontSize: 18 }}>×</button>
                    </div>

                    <div style={{ display: 'grid', gap: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13 }}>
                      {infos.montant && <div>💵 <b>Montant :</b> {Number(infos.montant).toLocaleString('fr-FR')} FCFA</div>}
                      {infos.duree_mois && d.type === 'pret' && <div>🗓️ <b>Remboursement :</b> {infos.duree_mois} mois</div>}
                      {infos.mois_paie && <div>🗓️ <b>Mois de paie :</b> {infos.mois_paie}</div>}
                      {infos.type_permission && <div>📝 <b>Nature :</b> {infos.type_permission}</div>}
                      {infos.date_debut && <div>📅 <b>{d.type === 'permission' ? 'Date' : 'Début'} :</b> {infos.date_debut}</div>}
                      {infos.date_fin && d.type !== 'permission' && <div>📅 <b>Fin :</b> {infos.date_fin}</div>}
                      {infos.heure_debut && d.type === 'permission' && <div>🕐 <b>Horaire :</b> {infos.heure_debut} – {infos.heure_fin || '—'}</div>}
                      {infos.remplacant && <div>👤 <b>Remplaçant :</b> {infos.remplacant}</div>}
                      {infos.materiel_nom && <div>📦 <b>Matériel :</b> {infos.materiel_nom} · quantité {infos.materiel_quantite || 1}</div>}
                      {infos.materiel_estimation && <div>💰 <b>Coût estimé :</b> {Number(infos.materiel_estimation).toLocaleString('fr-FR')} FCFA</div>}
                      {infos.urgence && <div>⚠️ <b>Urgence :</b> {infos.urgence}</div>}
                      {d.type === 'maternite' && infos.stade_grossesse && <div>🤰 <b>Stade de grossesse :</b> {infos.stade_grossesse}</div>}
                      {d.type === 'maternite' && infos.date_dpa && <div>👶 <b>DPA prévisionnelle :</b> {infos.date_dpa}</div>}
                      {infos.motif && <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>💬 <b>Motif détaillé :</b><div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{infos.motif}</div></div>}
                      {infos.fichier_nom && <div>📎 <b>Pièce jointe :</b> {infos.fichier_nom}</div>}
                      {d.reponse_direction && <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>🏛️ <b>Réponse enregistrée :</b> {d.reponse_direction}</div>}
                    </div>

                    {d.statut === 'En attente' && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button className="btn-sm" style={{ flex: 1, background: 'var(--green)', color: '#fff', padding: 12 }} onClick={async () => { const rep = prompt('Commentaire d\'approbation :', 'Approuvé'); if (rep !== null) { await repondreDemande(d, 'Approuvée', rep); setDemandeRHDetail(null) } }}>✓ Approuver</button>
                        <button className="btn-sm" style={{ flex: 1, background: 'var(--red)', color: '#fff', padding: 12 }} onClick={async () => { const rep = prompt('Motif du refus :', 'Refusé'); if (rep) { await repondreDemande(d, 'Refusée', rep); setDemandeRHDetail(null) } }}>✖ Refuser</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

          </div>
        )}

        {/* ════════════════ 3. GESTION DU PERSONNEL ════════════════ */}
        {(activeDirectorTab === 'personnel' || activeDirectorTab === 'profs' || activeDirectorTab === 'points') && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>👥 Session : Gestion du Personnel</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Gestion de l'équipe enseignante, affectations des matières/classes et système de points de performance.</p>
            </div>

            {/* Sous-onglets de Gestion du Personnel */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <button 
                className={`btn-sm ${subTabPersonnel === 'profs' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('profs')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                👥 Équipe &amp; Fiches Staff
              </button>
              <button 
                className={`btn-sm ${subTabPersonnel === 'activite' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('activite')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                📊 Activité du Personnel
              </button>
              <button 
                className={`btn-sm ${subTabPersonnel === 'matieres' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('matieres')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                📚 Affectations des Matières
              </button>
              <button 
                className={`btn-sm ${subTabPersonnel === 'points' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('points')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                🏆 Points &amp; Primes
              </button>
            </div>

            {/* Sous-module Équipe */}
            {subTabPersonnel === 'profs' && (
              <div className="card" style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>👥 Équipe Enseignante &amp; Personnel ({profs.length})</h3>
                  <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => setShowModal('prof')}>
                    + Ajouter un membre
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {profs.map(p => (
                    <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)' }}>{p.prenom} {p.nom}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 8px' }}>Rôle: <b style={{ color: 'var(--accent)' }}>{fmtRole(p.role)}</b></div>
                      {/* Masqué : voir le commentaire de la liste principale. */}
                      <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
                        🔑 Code : <b style={{ fontFamily: 'monospace', letterSpacing: 2 }}>••••••••</b>
                      </div>
                      <button className="btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid var(--red)', width: '100%' }} onClick={() => deleteProf(p.id)}>
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sous-module Affectations */}
            {subTabPersonnel === 'activite' && <ActivitePersonnel user={user} />}

            {subTabPersonnel === 'matieres' && (
              <AffectationsMatieres classes={classes} profs={profs} disciplines={disciplines} />
            )}

            {/* Sous-module Points & Primes */}
            {subTabPersonnel === 'points' && (() => {
              const maxAnnee = pointsMaxAnnee(pointsConfig)
              const n = equipePoints.length
              const moyenne = n ? equipePoints.reduce((s, e) => s + e.calc.pourcentage, 0) / n : 0
              const coutActuel = equipePoints.reduce((s, e) => s + e.ete.total, 0)
              const plafond = n * pointsConfig.enveloppeEte
              return (
                <div>
                  <div className="section-head" style={{ marginBottom: 14 }}>
                    <div className="section-title">Points &amp; prime d'été</div>
                    <button className="btn-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => setShowModal('bareme')}>⚙️ Barème</button>
                  </div>

                  <div className="kpi-grid" style={{ marginBottom: 16 }}>
                    <div className="kpi-card kpi-accent">
                      <div className="kpi-value">{Math.round(moyenne)}%</div>
                      <div className="kpi-label">Moyenne de l'équipe</div>
                    </div>
                    <div className="kpi-card kpi-green">
                      <div className="kpi-value" style={{ fontSize: 18 }}>{fcfa(coutActuel)}</div>
                      <div className="kpi-label">Prime d'été actuelle</div>
                    </div>
                    <div className="kpi-card kpi-amber">
                      <div className="kpi-value" style={{ fontSize: 18 }}>{fcfa(plafond)}</div>
                      <div className="kpi-label">Plafond à 100 %</div>
                    </div>
                    <div className="kpi-card kpi-pink">
                      <div className="kpi-value">{maxAnnee}</div>
                      <div className="kpi-label">Points max / an</div>
                    </div>
                  </div>

                  {/* Classement des enseignants */}
                  {equipePoints.map((e, i) => (
                    <div key={e.prof.id} className="card" style={{ marginBottom: 10, padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{e.nomComplet}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.calc.total} / {e.calc.max} pts · {e.calc.pourcentage}%</div>
                        </div>
                        <span className="chip chip-green" style={{ fontSize: 12, fontWeight: 800 }}>{fcfa(e.ete.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* ════════════════ 4. PÉDAGOGIE ════════════════ */}
        {activeDirectorTab === 'pedagogie' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>📚 Session : Suivi Pédagogique</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Fiches de préparations de cours déposées par les professeurs et avancement des programmes.</p>
            </div>

            <div className="card" style={{ padding: '1.2rem' }}>
              <div className="entete-ecran" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  📚 Fiches de préparation
                  {' '}
                  <span style={{ fontWeight: 600, color: 'var(--muted)' }}>
                    · {preparations.filter(p => A_CONTROLER.includes(p.status)).length} à contrôler sur {preparations.length}
                  </span>
                </h3>
                {/* Une notification perdue ne doit pas arrêter le travail : la
                    file existe et se trouve sans qu'on ait cliqué sur une
                    cloche. C'est la file qui fait foi, la notification n'est
                    qu'un raccourci. */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['a_controler', `À contrôler (${preparations.filter(p => A_CONTROLER.includes(p.status)).length})`],
                    ['toutes', `Toutes (${preparations.length})`]].map(([id, libelle]) => (
                    <button key={id} onClick={() => setPrepFiltre(id)} style={{
                      padding: '7px 13px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      border: '2px solid ' + (prepFiltre === id ? 'var(--accent)' : 'var(--border)'),
                      background: prepFiltre === id ? 'var(--accent)' : 'var(--bg)',
                      color: prepFiltre === id ? '#fff' : 'var(--muted)',
                    }}>{libelle}</button>
                  ))}
                </div>
              </div>
              {(() => {
                const visibles = prepFiltre === 'a_controler'
                  ? preparations.filter(p => A_CONTROLER.includes(p.status))
                  : preparations
                return visibles.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
                  {prepFiltre === 'a_controler'
                    ? (preparations.length
                        ? 'Aucune préparation n’attend votre décision. ✓'
                        : 'Aucune préparation de cours enregistrée.')
                    : 'Aucune préparation de cours enregistrée.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {visibles.map((prep, i) => {
                    // `prep.titre` et `prep.classe_nom` n'ont jamais existé dans
                    // la table : les dix-sept cartes affichaient « Préparation
                    // sans titre » et « Classe : — ». Les données étaient là,
                    // sous d'autres noms.
                    //
                    // Deux formes de préparation coexistent, et la carte doit
                    // lire les deux. Les quinze dépôts d'origine portent un
                    // fichier et une classe liée, sans matière ni contenu. Les
                    // fiches saisies depuis l'emploi du temps portent matière,
                    // groupe et rubriques, mais pas de classe liée.
                    const st   = statutDe(prep.status)
                    const aTemps = ponctualiteAuDepot(prep)
                    const classe = prep.classes?.nom || prep.groupe || '—'
                    const prof = prep.users ? `${prep.users.prenom || ''} ${prep.users.nom || ''}`.trim() : null
                    const objectif = prep.contenu?.objectif
                    const frise = Array.isArray(prep.historique_statuts) ? prep.historique_statuts : []
                    const ouverte = prepOuverte === prep.id
                    return (
                    <div
                      key={prep.id || i}
                      id={`preparation-${prep.id}`}
                      style={{
                        background: String(demandeCiblee) === String(prep.id) ? 'rgba(0,168,224,0.12)' : 'var(--bg)',
                        border: String(demandeCiblee) === String(prep.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--dark)', minWidth: 0 }}>
                          {prep.matiere || 'Préparation'}{prep.sequence ? ` · séquence ${prep.sequence}` : ''}
                        </div>
                        <span style={{ flex: 'none', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                                       color: st.couleur, background: 'var(--card)', border: `1px solid ${st.couleur}` }}>
                          {st.icone} {libelleStatut(prep.status)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        Classe : <b>{classe}</b>{prof && <> · Enseignant : <b>{prof}</b></>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {/* Deux notions, deux lignes. Confondues, une préparation
                            déposée à 17h34 semblait porter l'heure 15:30 — qui
                            est celle du COURS, et qui était juste. */}
                        Cours prévu <b>{dateDeCours(prep) || prep.date_cours || '—'}</b>{heureDeCours(prep) ? ` à ${heureDeCours(prep)}` : ''}
                        {momentDeDepot(prep) && <span style={{ color: 'var(--muted)' }}> · déposé le {momentDeDepot(prep)}</span>}
                        {aTemps !== null && (
                          <> · <span style={{ color: aTemps ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>
                            {aTemps ? 'déposée à temps' : 'déposée après l’échéance'}
                          </span></>
                        )}
                      </div>
                      {objectif && (
                        <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 6, lineHeight: 1.4 }}>{objectif}</div>
                      )}
                      {prep.url_doc && (
                        <a href={prep.url_doc} target="_blank" rel="noreferrer"
                           style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                          Ouvrir le document déposé
                        </a>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setPrepDetail(prep)
                          setPrepAvis({ appreciations: prep.appreciations || {}, commentaire: '' })
                        }}
                        style={{ width: '100%', marginTop: 10, padding: '9px 12px', fontSize: 12 }}
                      >
                        👁 Voir, corriger et valider
                      </button>
                      {frise.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <button onClick={() => setPrepOuverte(ouverte ? null : prep.id)}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                           fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                            {ouverte ? '▾' : '▸'} Historique ({frise.length})
                          </button>
                          {/* Le même composant que la fiche de l'enseignante.
                              Deux rendus séparés auraient fini par diverger ;
                              celui-ci lit la même source par la même fonction. */}
                          {ouverte && (
                            <div style={{ marginTop: 8 }}>
                              <FrisePreparation historique={frise} titre="Suivi" compact />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
                )})()}
            </div>
          </div>
        )}

        {/* ════════════════ 5. DISCIPLINE ════════════════ */}
        {activeDirectorTab === 'discipline' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>⚖️ Session : Discipline &amp; Suivi de Conduite</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Registre des fautes, alertes pour fautes graves et avertissements de conduite.</p>
            </div>

            <div className="card" style={{ padding: '1.2rem' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800 }}>⚖️ Registre des Signalements &amp; Incidents</h3>
              {disciplines.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Aucun incident disciplinaire signalé.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Élève</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Motif</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Gravité</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disciplines.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.eleve_nom || 'Élève'}</td>
                          <td style={{ padding: '10px 12px' }}>{d.description || d.motif}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700, background: d.gravite === 'grave' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: d.gravite === 'grave' ? 'var(--red)' : 'var(--amber)' }}>
                              {d.gravite}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{d.statut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeDirectorTab === 'maternelle' && (
          <div className="page-content ux-page" style={{ paddingBottom: 100 }}>
            <MaternelleDirection />
          </div>
        )}

        {/* ════════════════ 6. SYNTHÈSE ════════════════ */}
        {(activeDirectorTab === 'synthese' || activeDirectorTab === 'dashboard') && (() => {
          const cpParClasse = classes.map(cl => {
            const elevesCl = eleves.filter(e => e.classe_id === cl.id)
            const cpCl = checkpoints.filter(cp => elevesCl.some(e => e.id === cp.eleve_id))
            const total = elevesCl.length * 3
            const fait = cpCl.filter(cp => cp.statut === 'validé' || cp.note !== null).length
            return { classe: cl.nom, pct: total > 0 ? Math.round(fait / total * 100) : 0, fait, total: elevesCl.length }
          })

          return (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>📊 Session : Synthèse &amp; Bilan Global</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Tableau de bord général de l'établissement et indicateurs clés de performance.</p>
              </div>

              {/* KPI Cards */}
              <div className="kpi-grid" style={{ marginBottom: 20 }}>
                <div className="kpi-card kpi-accent">
                  <div className="kpi-value"><Kpi v={stats.profs} echec={blocsEnEchec.includes('personnel')} /></div>
                  <div className="kpi-label">Enseignants</div>
                </div>
                <div className="kpi-card kpi-green">
                  <div className="kpi-value"><Kpi v={stats.eleves} echec={blocsEnEchec.includes('eleves')} /></div>
                  <div className="kpi-label">Élèves</div>
                </div>
                <div className="kpi-card kpi-amber">
                  <div className="kpi-value"><Kpi v={stats.classes ?? classes.length} echec={blocsEnEchec.includes('classes')} /></div>
                  <div className="kpi-label">Classes</div>
                </div>
                <div className="kpi-card kpi-pink">
                  <div className="kpi-value"><Kpi v={preparations.length} echec={blocsEnEchec.includes('preparations')} /></div>
                  <div className="kpi-label">Préparations</div>
                </div>
              </div>

              {/* Avancement des Check-points */}
              <div className="card" style={{ padding: '1.2rem', marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800 }}>📌 Avancement des Check-points par Classe</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {cpParClasse.map(c => (
                    <div key={c.classe} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{c.classe}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', margin: '4px 0' }}>{c.pct}%</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.fait} check-points validés</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Globale */}
              <PerformancesDirecteur />
            </div>
          )
        })()}

      </div>

      <div className="bottom-nav" role="tablist">
        {BOTTOM_TABS
          .filter(t => {
            if (user.role === 'responsable_administratif') {
              return t.id !== 'agenda'
            }
            return true
          })
          .map(t => (
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
            <div className="form-group"><label className="form-label">Rôle / fonction</label>
              <select className="form-select" value={newProf.role} onChange={e=>{
                const config = FONCTIONS_MATERNELLE[e.target.value]
                setNewProf({...newProf, role:e.target.value, ...(config ? { langue:config.langue } : {})})
              }}>
                <option value="professeur">Enseignant</option>
                <optgroup label="Maternelle — Français">
                  <option value="maitresse_fr_maternelle">Maîtresse de français</option>
                  <option value="assistante_fr_maternelle">Assistante de français</option>
                </optgroup>
                <optgroup label="Kindergarten — English">
                  <option value="maitresse_en_maternelle">English Teacher</option>
                  <option value="assistante_en_maternelle">English Teaching Assistant</option>
                </optgroup>
                <option value="surveillant">Surveillant</option>
                <option value="conseiller_vie_scolaire">Conseiller de vie scolaire</option>
                <option value="responsable_administratif">Responsable administratif</option>
                <option value="cuisiniere">Chef Cuisinière / Cantine</option>
              </select>
            </div>

            {(['professeur', ...Object.keys(FONCTIONS_MATERNELLE)].includes(newProf.role)) && (
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

      {showModal === 'bareme' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">⚙️ Barème des points</div>
            <p style={{fontSize:12, color:'var(--muted)', marginBottom:'1rem', lineHeight:1.5}}>
              Tout est modifiable. Les montants s'appliquent immédiatement au calcul de l'équipe.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Salaire de base mensuel</label>
                <input type="number" className="form-input" defaultValue={pointsConfig.salaireBase}
                  onBlur={e=>majConfig({ salaireBase: parseInt(e.target.value,10)||0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Enveloppe d'été max.</label>
                <input type="number" className="form-input" defaultValue={pointsConfig.enveloppeEte}
                  onBlur={e=>majConfig({ enveloppeEte: parseInt(e.target.value,10)||0 })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Coefficients par trimestre</label>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                {pointsConfig.trimestres.map((t, i) => (
                  <div key={t.id}>
                    <div style={{fontSize:10, color:'var(--muted)', marginBottom:3}}>{t.label}</div>
                    <input type="number" step="0.1" min="0.1" className="form-input" defaultValue={t.coef}
                      onBlur={e=>{
                        const tri = pointsConfig.trimestres.map((x,k)=> k===i ? {...x, coef: parseFloat(e.target.value)||1} : x)
                        majConfig({ trimestres: tri })
                      }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Indicateurs — points et objectif par trimestre</label>
              {pointsConfig.indicateurs.map((ind, i) => (
                <div key={ind.id} style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                  <span style={{flex:1, fontSize:12}}>{ind.label}</span>
                  <input type="number" min="0" className="form-input" style={{width:62, padding:'.4rem'}} defaultValue={ind.points}
                    onBlur={e=>{
                      const list = pointsConfig.indicateurs.map((x,k)=> k===i ? {...x, points: parseInt(e.target.value,10)||0} : x)
                      majConfig({ indicateurs: list })
                    }} />
                  <span style={{fontSize:11, color:'var(--muted)'}}>pts /</span>
                  <input type="number" min="1" className="form-input" style={{width:62, padding:'.4rem'}} defaultValue={ind.cible}
                    onBlur={e=>{
                      const list = pointsConfig.indicateurs.map((x,k)=> k===i ? {...x, cible: parseInt(e.target.value,10)||1} : x)
                      majConfig({ indicateurs: list })
                    }} />
                </div>
              ))}
              <div style={{fontSize:11, color: pointsConfig.indicateurs.reduce((s,i)=>s+i.points,0)===100 ? 'var(--green)' : 'var(--red)', marginTop:4}}>
                Total : {pointsConfig.indicateurs.reduce((s,i)=>s+i.points,0)} points bruts par trimestre {pointsConfig.indicateurs.reduce((s,i)=>s+i.points,0)===100 ? '✓' : '(viser 100)'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Paliers — seuil, bourse enfant, formation</label>
              {pointsConfig.paliers.map((p, i) => (
                <div key={p.id} style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                  <span style={{flex:1, fontSize:12}}>{p.label}</span>
                  <input type="number" className="form-input" style={{width:56, padding:'.4rem'}} defaultValue={p.seuil}
                    onBlur={e=>{
                      const l = pointsConfig.paliers.map((x,k)=> k===i ? {...x, seuil: parseInt(e.target.value,10)||0} : x)
                      majConfig({ paliers: l })
                    }} />
                  <input type="number" className="form-input" style={{width:56, padding:'.4rem'}} defaultValue={p.bourseEnfant}
                    onBlur={e=>{
                      const l = pointsConfig.paliers.map((x,k)=> k===i ? {...x, bourseEnfant: parseInt(e.target.value,10)||0} : x)
                      majConfig({ paliers: l })
                    }} />
                  <input type="number" className="form-input" style={{width:56, padding:'.4rem'}} defaultValue={p.formation}
                    onBlur={e=>{
                      const l = pointsConfig.paliers.map((x,k)=> k===i ? {...x, formation: parseInt(e.target.value,10)||0} : x)
                      majConfig({ paliers: l })
                    }} />
                </div>
              ))}
              <div style={{fontSize:10, color:'var(--muted)'}}>seuil % · bourse enfant % · formation %</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ancienneté bourse enfant</label>
                <input type="number" min="0" className="form-input" defaultValue={pointsConfig.anciennete.bourseEnfant}
                  onBlur={e=>majConfig({ anciennete: {...pointsConfig.anciennete, bourseEnfant: parseInt(e.target.value,10)||0} })} />
              </div>
              <div className="form-group">
                <label className="form-label">Ancienneté formation</label>
                <input type="number" min="0" className="form-input" defaultValue={pointsConfig.anciennete.formation}
                  onBlur={e=>majConfig({ anciennete: {...pointsConfig.anciennete, formation: parseInt(e.target.value,10)||0} })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Plafond annuel de la bourse d'études</label>
              <input type="number" className="form-input" defaultValue={pointsConfig.bourseEtudesPlafond}
                onBlur={e=>majConfig({ bourseEtudesPlafond: parseInt(e.target.value,10)||0 })} />
            </div>

            <button className="btn btn-primary" onClick={()=>setShowModal(null)}>Fermer</button>
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

      {prepDetail && (() => {
        const contenu = prepDetail.contenu || {}
        // ── L'auteur de la préparation ──────────────────────────────────
        //
        // Il venait de la ressource imbriquée `users(prenom, nom)`. Or une
        // ressource imbriquée revient NULL dès que le lecteur ne peut pas lire
        // la table jointe — et l'écran affichait alors « Enseignant non
        // renseigné » pour une préparation dont `user_id` était pourtant bien
        // renseigné.
        //
        // Vérifié en base : les VINGT-QUATRE préparations portent un
        // `user_id`. L'identité n'est jamais perdue dans la donnée ; elle
        // l'était à l'affichage.
        //
        // On résout donc sur la liste du personnel déjà chargée par cet
        // écran, et l'on ne retombe sur la jointure que si elle a répondu.
        const auteur = (profs || []).find(u => u.id === prepDetail.user_id)
        const prof = auteur
          ? `${auteur.prenom || ''} ${auteur.nom || ''}`.trim()
          : prepDetail.users
            ? `${prepDetail.users.prenom || ''} ${prepDetail.users.nom || ''}`.trim()
            : prepDetail.user_id
              // Un auteur existe, mais son profil n'a pas pu être lu. Le dire
              // ainsi plutôt que « non renseigné », qui est faux et envoie
              // chercher au mauvais endroit.
              ? 'Enseignant — profil non chargé'
              : 'Enseignant non renseigné'
        const classe = prepDetail.classes?.nom || prepDetail.groupe || '—'
        const pieces = Array.isArray(prepDetail.pieces_jointes) ? prepDetail.pieces_jointes : []
        const sequences = Array.isArray(contenu.sequences) ? contenu.sequences : []
        const note = noteDeduite(prepAvis.appreciations)
        const statutNormalise = prepDetail.status === 'en_attente' ? 'deposee' : prepDetail.status === 'retard' ? 'en_retard' : prepDetail.status
        const peutDecider = ['deposee', 'en_retard'].includes(statutNormalise)
        // Les rubriques viennent du formulaire lui-même, avec leur clé métier.
        // L'ancien tableau de libellés écrits ici aurait fait dériver les
        // remarques dès qu'un intitulé changeait.
        const rubriques = RUBRIQUES_PREPA
          .map(r => ({ cle: r.id, label: r.label, valeur: contenu[r.id] }))
          .filter(r => r.valeur)
        const parSection = remarquesParSection(prepDetail.historique_statuts)
        const generales = remarquesGenerales(prepDetail.historique_statuts)
        const nbOuvertes = nbCorrectionsOuvertes(prepDetail.historique_statuts)
        return (
          <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setPrepDetail(null)} style={{ zIndex: 999999 }}>
            <div style={{ background: '#fff', borderRadius: 24, width: 'min(94%, 920px)', maxHeight: '92vh', overflowY: 'auto', padding: 24, margin: '20px auto' }}>
              <div className="modal-handle"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--dark)', fontSize: 23 }}>📚 Contrôle de la préparation</h2>
                  <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 5 }}>
                    <b>{prof}</b> · {classe} · {prepDetail.matiere || 'Matière non renseignée'}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                    <span>Cours prévu {dateDeCours(prepDetail) || prepDetail.date_cours || '—'}{heureDeCours(prepDetail) ? ` à ${heureDeCours(prepDetail)}` : ''} · {libelleStatut(prepDetail.status)}</span>
                    {momentDeDepot(prepDetail) && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Déposé le {momentDeDepot(prepDetail)} <span style={{ opacity: .7 }}>(heure de Bamako)</span>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setPrepDetail(null)} aria-label="Fermer" style={{ border: 0, background: 'var(--bg)', borderRadius: 50, width: 38, height: 38, fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>

              {contenu.programme?.titre && (
                <div style={{ background: 'rgba(0,168,224,.08)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <b>Programme :</b> {contenu.programme.titre}
                  {contenu.programme.domaines && <div style={{ fontSize: 12, marginTop: 4 }}>{contenu.programme.domaines}</div>}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 16 }}>
                {rubriques.map(r => (
                  <BlocCommentable key={r.cle} label={r.label}
                    remarques={parSection.get(r.cle) || []}
                    onAjouter={peutDecider ? (t => ajouterRemarque(r.cle, t)) : null}>
                    {r.valeur}
                  </BlocCommentable>
                ))}
              </div>

              {sequences.map((sequence, index) => (
                <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 15, padding: 14, marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 10px', color: 'var(--dark)' }}>Séquence {index + 1}{sequence.titre ? ` — ${sequence.titre}` : ''}</h4>
                  {Object.entries(sequence.etapes || {}).map(([nom, etape]) => etape?.texte ? (
                    <div key={nom} style={{ marginTop: 9 }}>
                      {/* La clé porte la séquence : une remarque sur la
                          découverte de la séquence 1 ne doit pas s'afficher
                          sous celle de la séquence 2. */}
                      <BlocCommentable compact
                        label={`${nom.replaceAll('_', ' ')}${etape.minutes ? ` · ${etape.minutes} min` : ''}`}
                        remarques={parSection.get(cleEtape(index + 1, nom)) || []}
                        onAjouter={peutDecider ? (t => ajouterRemarque(cleEtape(index + 1, nom), t)) : null}>
                        {etape.texte}
                      </BlocCommentable>
                    </div>
                  ) : null)}
                </div>
              ))}

              {(prepDetail.url_doc || pieces.length > 0) && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 13, marginBottom: 18 }}>
                  <b>📎 Pièces jointes</b>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
                    {prepDetail.url_doc && <a className="btn btn-secondary" href={prepDetail.url_doc} target="_blank" rel="noreferrer">Document principal</a>}
                    {pieces.map((piece, index) => <a key={index} className="btn btn-secondary" href={piece.url} target="_blank" rel="noreferrer">{piece.nom || `Pièce ${index + 1}`}</a>)}
                  </div>
                </div>
              )}

              <h3 style={{ margin: '0 0 10px', color: 'var(--dark)', fontSize: 17 }}>Grille de correction pédagogique</h3>
              <div style={{ border: '1px solid var(--border)', borderRadius: 15, overflow: 'hidden', marginBottom: 14 }}>
                {CRITERES.map((critere, index) => (
                  <div key={critere.id} style={{ padding: 12, borderTop: index ? '1px solid var(--border)' : 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{critere.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {Object.values(APPRECIATIONS).map(appreciation => {
                        const active = prepAvis.appreciations?.[critere.id] === appreciation.code
                        return <button key={appreciation.code} onClick={() => setPrepAvis(v => ({ ...v, appreciations: { ...v.appreciations, [critere.id]: appreciation.code } }))}
                          style={{ border: `2px solid ${active ? appreciation.couleur : 'var(--border)'}`, color: active ? appreciation.couleur : 'var(--muted)', background: active ? 'var(--bg)' : '#fff', borderRadius: 20, padding: '7px 11px', fontWeight: 800, cursor: 'pointer' }}>
                          {appreciation.libelle} · {appreciation.points}/4
                        </button>
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 900, color: note === null ? 'var(--amber)' : 'var(--dark)', marginBottom: 12 }}>
                Note : {note === null ? 'complétez les 5 critères' : `${note}/20`}
              </div>
              {/* Les remarques déjà posées sous les rubriques, récapitulées :
                  la direction doit voir ce qu'elle a demandé avant de décider. */}
              {nbOuvertes > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a',
                              borderRadius: 12, padding: '11px 13px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#92400e' }}>
                    {nbOuvertes} remarque{nbOuvertes > 1 ? 's' : ''} posée{nbOuvertes > 1 ? 's' : ''} sous les rubriques
                  </div>
                  <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 3 }}>
                    Elles constituent les corrections demandées. La remarque générale
                    ci-dessous ne sert qu'aux observations d'ensemble.
                  </div>
                </div>
              )}

              {generales.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)',
                                textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Remarques générales déjà émises
                  </div>
                  {generales.map((r, k) => (
                    <div key={k} style={{ background: 'var(--bg)', border: '1px solid var(--border)',
                                          borderRadius: 9, padding: '9px 11px', marginBottom: 6 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700 }}>
                        {r.parNom || 'Direction'}{r.parFonction ? ` (${r.parFonction})` : ''}
                        {r.heritee ? ' · remarque générale' : ''}
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.texte}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Remarque générale — observation d’ensemble (facultative)</label>
                <textarea className="form-input" rows={5} value={prepAvis.commentaire} onChange={e => setPrepAvis(v => ({ ...v, commentaire: e.target.value }))} placeholder="Indiquez précisément les améliorations attendues ou votre appréciation..." />
              </div>
              {peutDecider ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button className="btn" onClick={() => traiterPreparation('corriger')} disabled={loading} style={{ flex: '1 1 230px', background: 'var(--amber)', color: '#fff' }}>↩️ Demander une correction</button>
                  <button className="btn btn-primary" onClick={() => traiterPreparation('valider')} disabled={loading} style={{ flex: '1 1 230px' }}>✅ Valider la préparation</button>
                </div>
              ) : (
                <div style={{ padding: 12, borderRadius: 12, background: 'var(--bg)', textAlign: 'center', fontWeight: 800 }}>
                  Cette préparation est déjà au statut « {libelleStatut(statutNormalise)} ».
                </div>
              )}
              <button className="btn-cancel" onClick={() => setPrepDetail(null)}>Fermer</button>
            </div>
          </div>
        )
      })()}

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

      {/* MODAL FICHE DE JUSTIFICATIF MARCHÉ SÉLECTIONNÉ (RESPONSABLE ADMINISTRATIF) */}
      {selectedJustificatif && (
        <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setSelectedJustificatif(null)} style={{ zIndex: 999999 }}>
          <div style={{ background: '#fff', borderRadius: 24, maxWidth: 880, width: '95%', maxHeight: '92vh', overflowY: 'auto', padding: 24, margin: '20px auto', position: 'relative' }}>
            <DocumentPrintStudio
              type="restauration"
              documentTitle="JUSTIFICATIF DU MARCHÉ & DÉPENSES CUISINE"
              subTitlePill={`👑 FICHE VALIDÉE ET SIGNÉE LE ${selectedJustificatif.timestamp || selectedJustificatif.date}`}
              eleveInfo={{
                nom: `SIGNÉ PAR : ${selectedJustificatif.signature_nom || 'Chef Cuisinière'}`,
                matricule: `BUDGET : ${fcfa(selectedJustificatif.budget)}`,
                classe: selectedJustificatif.type_periode === 'journalier' ? `DU ${selectedJustificatif.date_du_jour || selectedJustificatif.date}` : selectedJustificatif.periode_semaine,
                date: selectedJustificatif.timestamp || selectedJustificatif.date
              }}
              onClose={() => setSelectedJustificatif(null)}
            >
              <div style={{ background: '#fffbeb', borderRadius: 20, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#b45309' }}>BUDGET CANTINE ALLOUÉ</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0d2a3b' }}>{fcfa(selectedJustificatif.budget)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#dc2626' }}>TOTAL ACHATS DU MARCHÉ</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626' }}>{fcfa(selectedJustificatif.total_depense)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#16a34a' }}>SOLDE RESTANT (RESTE)</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: selectedJustificatif.solde >= 0 ? '#16a34a' : '#dc2626' }}>{fcfa(selectedJustificatif.solde)}</div>
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#0d2a3b' }}>🛒 Détail des Ingrédients / Aliments Achetés</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#0d2a3b', color: '#fff', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Aliment / Ingrédient</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Quantité</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Prix Unitaire</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Prix Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedJustificatif.articles || []).map((art, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>{art.nom}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{art.quantite}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fcfa(art.pu)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#16a34a' }}>
                        {fcfa((Number(art.pu) || 0) * (parseFloat(art.quantite) || 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTop: '1.5px solid #fde68a' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#047857' }}>STATUT DE TRANSMISSION :</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2a3b', marginTop: 2 }}>
                    ✅ Validé &amp; Signé par {selectedJustificatif.signature_nom || 'la Chef Cuisinière'}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#d97706', marginBottom: 4 }}>SIGNATURE ÉLECTRONIQUE</div>
                  <div style={{ border: '2px solid #d97706', borderRadius: 12, padding: '10px 20px', background: '#fffbeb', fontWeight: 900, color: '#b45309' }}>
                    ✍️ {selectedJustificatif.signature_nom || 'Chef Cuisinière IDEAL'}
                  </div>
                </div>
              </div>
            </DocumentPrintStudio>
          </div>
        </div>
      )}

    </div>
  )
}

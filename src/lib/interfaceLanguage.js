import { useEffect } from 'react'

// Les données (noms, remarques, contenus saisis) ne sont jamais traduites.
// Seuls les libellés connus de l'interface et leurs attributs d'aide le sont.
const EN = new Map(Object.entries({
  'Déconnexion':'Log out', 'Notifications':'Notifications', 'Tout lire':'Mark all as read',
  'Aucune notification pour le moment.':'No notifications at the moment.',
  'Les demandes RH et alertes scolaires apparaîtront ici.':'HR requests and school alerts will appear here.',
  'Activer':'Enable', 'Actualiser':'Refresh', 'Annuler':'Cancel', 'Enregistrer':'Save',
  'Valider':'Confirm', 'Supprimer':'Delete', 'Modifier':'Edit', 'Fermer':'Close',
  'Semaine':'Week', 'Préparer':'Plan', 'Lectures':'Readings', 'Matériel':'Resources',
  'Enfants':'Children', 'Mon espace RH':'My HR area', 'RH':'HR',
  'Emploi du Temps & Agenda':'Timetable & Calendar', 'Pédagogie & Cours':'Teaching & Lessons',
  'Ma Classe & Évaluations':'My Class & Assessments', 'Discipline':'Discipline',
  'Perfs & Ma Prime':'Performance & Bonus', 'Dossier RH & Demandes':'HR File & Requests',
  'Emploi du temps & Agenda':'Timetable & Calendar', 'Gestion du Personnel':'Staff Management',
  'Pédagogie':'Teaching', 'Synthèse':'Overview', 'Maternelle':'Kindergarten',
  'Mon emploi du temps':'My timetable', 'Programme':'Curriculum', 'Préparations':'Lesson plans',
  'Préparation':'Lesson plan', 'Évaluations':'Assessments', 'Messages Parents (WhatsApp)':'Parent Messages (WhatsApp)',
  'Signalements & Discipline':'Reports & Discipline', 'Mon dossier':'My file', 'Mes demandes':'My requests',
  'Rotation de la semaine A':'Week A rotation', 'Rotation de la semaine B':'Week B rotation',
  'Alternance équilibrée sur deux semaines':'Balanced two-week rotation',
  'Nouvelle préparation':'New lesson plan', 'Classe calculée par rotation :':'Class determined by rotation:',
  '1er trimestre':'Term 1', '2e trimestre':'Term 2', '3e trimestre':'Term 3',
  'Publier la préparation':'Publish lesson plan', 'Séances publiées':'Published lessons',
  'Aucune préparation publiée.':'No lesson plan has been published.',
  'Matériel récupéré et installé en classe':'Resources collected and set up in the classroom',
  'Tout est présent':'Everything is ready', 'Incomplet':'Incomplete', 'Absent':'Missing',
  'Confirmer la lecture et envoyer':'Confirm reading and submit',
  'Alertes d’accompagnement':'Child support alerts', 'Aucune alerte active.':'No active alert.',
  'Je prends en charge maintenant':'I am taking care of this now',
  'Assistante':'Teaching Assistant', 'Maîtresse':'Teacher', 'Français':'French', 'Anglais':'English',
  'Petite Section':'Preschool Class', 'Grande Section':'Reception Class',
  'Objectif':'Objective', 'Objectifs':'Objectives', 'Domaine':'Learning area',
  'Déroulement du cours':'Lesson procedure', 'Matériel nécessaire':'Required resources',
  'Consignes particulières à l’assistante':'Specific instructions for the teaching assistant',
  'Choisir un objectif du référentiel':'Select a curriculum objective',
  'Choisir un objectif officiel':'Select an official objective',
  'Objectif officiel sélectionné':'Selected official objective',
  'Quel est l’objectif principal ?':'What is the main objective?',
  'Quel sera votre rôle pendant l’activité ?':'What will your role be during the activity?',
  'Où récupérer le matériel ?':'Where should the resources be collected?',
  'Difficulté ou risque identifié':'Identified difficulty or risk',
  'Mon profil':'My profile', 'Informations personnelles':'Personal information',
  'Informations professionnelles':'Employment information', 'Documents administratifs':'Administrative documents',
  'Nouvelle demande':'New request', 'Historique':'History', 'Envoyer la demande':'Submit request',
  'Permission':'Leave permission', 'Absence':'Absence', 'Avance de salaire':'Salary advance',
  'Prêt':'Loan', 'Congé Maternité':'Maternity leave', 'Demande d’achat':'Purchase request',
  'Classe':'Class', 'Élève':'Pupil', 'Élèves':'Pupils', 'Matière':'Subject', 'Date':'Date',
  'Heure':'Time', 'Statut':'Status', 'En attente':'Pending', 'Validé':'Approved', 'Refusé':'Declined',
  'Aujourd’hui':'Today', 'Cette semaine':'This week', 'À venir':'Upcoming', 'Terminé':'Completed',
  'Charger':'Load', 'Télécharger':'Download', 'Imprimer':'Print', 'Retour':'Back', 'Suivant':'Next',
  'Précédent':'Previous', 'Rechercher':'Search', 'Aucun résultat':'No results',
  'Chargement…':'Loading…', 'Enregistrement…':'Saving…', 'Envoyer':'Submit',
  'Pointage':'Attendance', 'Stock':'Resources', 'Contrôle maternelle':'Kindergarten checks',
  'Ronde avant la montée des couleurs':'Morning classroom inspection',
  'Tables et bancs rangés':'Tables and benches are tidy', 'Classe propre':'Classroom is clean',
  'Matériel pédagogique rangé':'Teaching resources are stored',
  'Effets personnels rangés':'Personal belongings are organised', 'Passages dégagés':'Walkways are clear',
  'Aucun danger visible':'No visible hazard', 'Assistante responsable':'Teaching assistant responsible',
  'Enregistrer la ronde':'Save inspection', 'Alerte accompagnement enfant':'Child support alert',
  'Choisir l’enfant':'Select the child', 'Ou saisir le nom de l’enfant':'Or enter the child’s name',
  'Normale':'Normal', 'Haute':'High', 'Critique':'Critical', 'Signaler maintenant':'Report now',
  'Pilotage de la maternelle':'Kindergarten monitoring',
  'Préparations, responsabilités et respect des délais':'Lesson plans, responsibilities and deadline compliance',
  'Lues par les assistantes':'Read by teaching assistants', 'Contrôles à temps':'Checks completed on time',
  'Rondes conformes':'Compliant inspections', 'Alertes ouvertes':'Open alerts',
  'Dernières séances':'Latest lessons', 'Rondes et alertes':'Inspections and alerts', 'Clôturer':'Close alert',
  'Brouillon':'Draft', 'Publiée':'Published', 'Réalisée':'Completed', 'Reportée':'Postponed',
}))

const PHRASES = [
  [/Il y a (\d+) min/g, '$1 min ago'], [/Il y a (\d+)h/g, '$1h ago'],
  [/non lue\(s\)/g, 'unread'], [/Classe calculée par rotation\s*:/g, 'Class determined by rotation:'],
  [/Choisir un objectif officiel \((\d+)\)/g, 'Select an official objective ($1)'],
  [/Le référentiel Supabase est également synchronisé\s*:/g, 'The Supabase curriculum is also synchronised:'],
  [/(\d+) objectif\(s\) disponible\(s\)/g, '$1 objective(s) available'],
  [/Assistante\s*:/g, 'Teaching assistant:'], [/Contrôle maîtresse\s*:/g, 'Teacher check:'],
  [/lecture en attente/g, 'reading pending'], [/en attente/g, 'pending'],
  [/à temps/g, 'on time'], [/hors délai/g, 'late'], [/lu le/g, 'read on'],
]

const traduire = value => {
  const brut = String(value || '')
  const avant = brut.match(/^\s*/)?.[0] || ''
  const apres = brut.match(/\s*$/)?.[0] || ''
  const coeur = brut.trim()
  if (!coeur) return brut
  let resultat = EN.get(coeur) || coeur
  if (resultat === coeur) PHRASES.forEach(([pattern, remplacement]) => { resultat = resultat.replace(pattern, remplacement) })
  return avant + resultat + apres
}

const ATTRS = ['placeholder', 'title', 'aria-label']

function traduireNoeud(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    if (!parent || ['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName)) return
    const valeur = traduire(node.nodeValue)
    if (valeur !== node.nodeValue) node.nodeValue = valeur
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  ATTRS.forEach(attr => {
    if (node.hasAttribute(attr)) {
      const valeur = traduire(node.getAttribute(attr))
      if (valeur !== node.getAttribute(attr)) node.setAttribute(attr, valeur)
    }
  })
  if (node.tagName === 'INPUT' && ['button','submit','reset'].includes(node.type)) node.value = traduire(node.value)
  node.childNodes.forEach(traduireNoeud)
}

export const posteEnAnglais = user => {
  const poste = String(user?.fonction || user?.poste_id || user?.custom_role || '').toLowerCase()
  return user?.langue === 'en' || /-(en|english)-/.test(`-${poste}-`) || poste.includes('anglais')
}

export function useEnglishInterface(active) {
  useEffect(() => {
    document.documentElement.lang = active ? 'en' : 'fr'
    if (!active) return undefined
    const appliquer = () => traduireNoeud(document.body)
    appliquer()
    const observer = new MutationObserver(mutations => mutations.forEach(m => {
      if (m.type === 'characterData') traduireNoeud(m.target)
      m.addedNodes.forEach(traduireNoeud)
    }))
    observer.observe(document.body, { childList:true, subtree:true, characterData:true })
    return () => observer.disconnect()
  }, [active])
}


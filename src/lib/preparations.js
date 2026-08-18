// Source unique du workflow des préparations.
//
// Toute la logique métier des préparations vit ici : les statuts, leurs
// transitions, le délai de dépôt, le calcul du retard et les appréciations du
// contrôle qualité. Aucun composant ne compare un statut à une chaîne écrite
// en dur, aucun ne recalcule un retard dans son coin.
//
// Cette règle n'est pas une préférence de style. L'audit du 18 août 2026 a
// trouvé trois vocabulaires de statut qui ne se recouvraient pas, et surtout
// deux définitions contradictoires du retard, toutes deux en production :
// `points.js` tenait une préparation pour ponctuelle si elle était déposée
// avant le début du cours, `PreparationIA` exigeait dix heures d'avance. Une
// préparation remise deux heures avant le cours était donc à l'heure pour
// l'une et en retard de huit heures pour l'autre — et c'est la première qui
// alimentait la prime.

import { supabase } from './supabase'

// ─── Statuts ────────────────────────────────────────────────────────────────
//
// Un statut ne se choisit jamais dans une liste déroulante : il résulte d'une
// action. L'enseignant dépose, la direction valide ou demande une correction.

export const STATUTS = {
  brouillon:  { code: 'brouillon',  libelle: 'Brouillon',  couleur: 'var(--muted)',  icone: '✎',
                aide: "Commencée, pas encore déposée. Vous seul la voyez." },
  deposee:    { code: 'deposee',    libelle: 'Déposée',    couleur: 'var(--accent)', icone: '📤',
                aide: "Déposée dans les temps, en attente du contrôle de la direction." },
  en_retard:  { code: 'en_retard',  libelle: 'En retard',  couleur: 'var(--amber)',  icone: '⏰',
                aide: "Déposée après l'échéance. Le travail est enregistré, le retard est constaté." },
  a_corriger: { code: 'a_corriger', libelle: 'À corriger', couleur: 'var(--red)',    icone: '↩',
                aide: "La direction demande une reprise." },
  validee:    { code: 'validee',    libelle: 'Validée',    couleur: 'var(--green)',  icone: '✓',
                aide: "Contrôlée et validée par la direction." },
}

export const libelleStatut = code => STATUTS[code]?.libelle || code || '—'
export const statutDe = code => STATUTS[code] || STATUTS.deposee

// Statuts qui attendent une action de la direction.
export const A_CONTROLER = ['deposee', 'en_retard']

// Transitions permises. La clé est le statut de départ, la valeur la liste
// des arrivées possibles. Ce qui n'y figure pas est refusé.
const TRANSITIONS = {
  brouillon:  ['deposee', 'en_retard'],
  deposee:    ['validee', 'a_corriger'],
  en_retard:  ['validee', 'a_corriger'],
  a_corriger: ['deposee', 'en_retard'],
  // Réouverture d'une préparation validée : exceptionnelle, tracée, motivée.
  validee:    ['a_corriger'],
}

export const peutPasser = (depuis, vers) => (TRANSITIONS[depuis] || []).includes(vers)

// ─── Le délai de dépôt ──────────────────────────────────────────────────────
//
// Un seul paramètre, lu en base, qui alimente le calcul du retard, le tableau
// de bord, les notifications, les indicateurs de performance et les relances.
// Modifiable par l'administration sans toucher au code.

const DELAI_DEFAUT = { heures_avant_cours: 0, rappel_avant_heures: 24, relance_apres_heures: 2 }

let _delai = null          // cache mémoire : le paramètre change rarement
let _promesse = null

/** Le paramétrage du délai, lu une fois puis conservé. */
export async function chargerDelai() {
  if (_delai) return _delai
  if (_promesse) return _promesse
  _promesse = (async () => {
    try {
      const { data } = await supabase
        .from('parametres').select('valeur').eq('cle', 'preparations.delai').maybeSingle()
      _delai = { ...DELAI_DEFAUT, ...(data?.valeur || {}) }
    } catch (e) {
      // Le paramètre est indisponible : on retient la valeur par défaut plutôt
      // que d'empêcher l'enseignant de déposer sa préparation.
      console.warn('[préparations] délai indisponible, valeur par défaut retenue :', e.message)
      _delai = DELAI_DEFAUT
    }
    return _delai
  })()
  return _promesse
}

/** Force une relecture — après modification du paramètre par l'administration. */
export const oublierDelai = () => { _delai = null; _promesse = null }

/** Le délai déjà chargé, sans attendre. Pour les calculs synchrones. */
export const delaiConnu = () => _delai || DELAI_DEFAUT

/** Heure limite de dépôt pour un cours donné. */
export function echeance(dateCours, heureCours, delai = delaiConnu()) {
  if (!dateCours) return null
  const debut = new Date(`${dateCours}T${heureCours || '08:00'}:00`)
  if (isNaN(debut)) return null
  return new Date(debut.getTime() - (delai.heures_avant_cours || 0) * 3600 * 1000)
}

/**
 * Situation d'un dépôt par rapport à l'échéance.
 * Renvoie { aTemps, retardMinutes, echeance }.
 */
export function situationDepot(dateCours, heureCours, moment = new Date(), delai = delaiConnu()) {
  const limite = echeance(dateCours, heureCours, delai)
  if (!limite) return { aTemps: true, retardMinutes: 0, echeance: null }
  const retardMs = new Date(moment) - limite
  return {
    aTemps: retardMs <= 0,
    retardMinutes: Math.max(0, Math.round(retardMs / 60000)),
    echeance: limite,
  }
}

/** Le statut que prend une préparation au moment où elle est déposée. */
export const statutAuDepot = (dateCours, heureCours, moment) =>
  situationDepot(dateCours, heureCours, moment).aTemps ? 'deposee' : 'en_retard'

/**
 * Une préparation a-t-elle été déposée à temps ?
 *
 * Remplace `preparationATemps` de points.js, qui portait la seconde définition
 * concurrente. Les deux lisent désormais le même paramètre.
 */
export function deposeeATemps(prep) {
  if (!prep) return false
  // Le statut fait foi lorsqu'il a été posé au dépôt : il fige la règle en
  // vigueur ce jour-là, et ne bougera pas si le paramètre change ensuite.
  if (prep.status === 'deposee' || prep.status === 'validee') return true
  if (prep.status === 'en_retard') return false
  // Lignes antérieures à la nomenclature : on retombe sur le calcul.
  if (!prep.heure_depot || !prep.date_cours) return false
  return situationDepot(prep.date_cours, prep.heure_cours, prep.heure_depot).aTemps
}

// ─── Appréciations du contrôle qualité ──────────────────────────────────────
//
// Le contrôle est d'abord factuel : chaque critère reçoit une appréciation.
// La note, lorsqu'elle est nécessaire, en découle mécaniquement — elle n'est
// jamais saisie à la main, et l'on peut toujours expliquer d'où elle vient.

export const CRITERES = [
  { id: 'structure',  label: 'Structure et organisation' },
  { id: 'objectifs',  label: 'Clarté des objectifs' },
  { id: 'contenu',    label: 'Qualité du contenu' },
  { id: 'methodes',   label: 'Méthodes et activités' },
  { id: 'evaluation', label: 'Évaluation prévue' },
]

export const APPRECIATIONS = {
  conforme:    { code: 'conforme',    libelle: 'Conforme',    points: 4, couleur: 'var(--green)' },
  a_renforcer: { code: 'a_renforcer', libelle: 'À renforcer', points: 2, couleur: 'var(--amber)' },
  insuffisant: { code: 'insuffisant', libelle: 'Insuffisant', points: 0, couleur: 'var(--red)' },
}

/**
 * Note sur 20 déduite des appréciations. `null` tant que les cinq critères ne
 * sont pas renseignés : une note partielle induirait en erreur.
 */
export function noteDeduite(appreciations) {
  if (!appreciations) return null
  const valeurs = CRITERES.map(c => appreciations[c.id])
  if (valeurs.some(v => !APPRECIATIONS[v])) return null
  return valeurs.reduce((t, v) => t + APPRECIATIONS[v].points, 0)
}

/** Le détail du calcul, pour que le résultat reste explicable. */
export const detailNote = appreciations =>
  CRITERES.map(c => ({
    critere: c.label,
    appreciation: APPRECIATIONS[appreciations?.[c.id]]?.libelle || '—',
    points: APPRECIATIONS[appreciations?.[c.id]]?.points ?? null,
  }))

// ─── Historique ─────────────────────────────────────────────────────────────
//
// « Le système conserve l'historique des événements plutôt que d'écraser
// silencieusement les états précédents. » Déposée → À corriger → Modifiée →
// Validée reste lisible, avec sa date, son acteur et son commentaire.

/** Ajoute une entrée à l'historique et renvoie le tableau complet. */
export function ajouterHistorique(historique, { statut, action, commentaire, utilisateur }) {
  return [
    ...(Array.isArray(historique) ? historique : []),
    {
      statut: statut || null,
      action,
      commentaire: commentaire || null,
      le: new Date().toISOString(),
      par: utilisateur?.id || null,
      par_nom: utilisateur ? `${utilisateur.prenom || ''} ${utilisateur.nom || ''}`.trim() : null,
    },
  ]
}

/** Les sept événements tracés, tels que définis au blueprint. */
export const ACTIONS = {
  depot:               'depot',
  modification:        'modification',
  statut:              'statut',
  correction_demandee: 'correction_demandee',
  validation:          'validation',
  commentaire:         'commentaire',
  reouverture:         'reouverture',
}

/** Phrase lisible pour l'écran, à partir d'une entrée d'historique. */
export function raconter(entree) {
  const qui = entree.par_nom || 'Quelqu’un'
  const quand = entree.le
    ? new Date(entree.le).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''
  const phrases = {
    depot:               `${qui} a déposé la préparation`,
    modification:        `${qui} a modifié la préparation`,
    statut:              `${qui} a changé le statut pour « ${libelleStatut(entree.statut)} »`,
    correction_demandee: `${qui} a demandé une correction`,
    validation:          `${qui} a validé la préparation`,
    commentaire:         `${qui} a laissé un commentaire`,
    reouverture:         `${qui} a rouvert une préparation déjà validée`,
  }
  return { texte: phrases[entree.action] || `${qui} — ${entree.action}`, quand, commentaire: entree.commentaire }
}

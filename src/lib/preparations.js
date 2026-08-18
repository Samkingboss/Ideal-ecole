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

// ─── Le fuseau de l'école ───────────────────────────────────────────────────
//
// « 8h00 » sur un emploi du temps IDEAL, c'est huit heures à Bamako. Pas huit
// heures sur le téléphone de l'enseignant, qui peut être réglé sur un autre
// fuseau — en voyage, ou simplement mal configuré. Interpréter l'heure du
// cours dans le fuseau du navigateur ferait basculer un dépôt d'un côté ou de
// l'autre de l'échéance selon l'appareil, ce qui est inacceptable pour une
// donnée qui alimente le suivi du personnel.
//
// `heure_depot`, lui, reste un instant absolu horodaté en UTC : on compare
// donc une échéance située dans le temps réel à un instant réel.

const FUSEAU_ECOLE = 'Africa/Bamako'

const _formatEcole = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU_ECOLE, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Décalage du fuseau de l'école par rapport à UTC, en minutes, à un instant. */
function decalageEcole(instant) {
  const p = Object.fromEntries(
    _formatEcole.formatToParts(instant).map(x => [x.type, x.value])
  )
  // `hour` peut valoir « 24 » à minuit selon le moteur : le modulo l'absorbe.
  const mural = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return (mural - instant.getTime()) / 60000
}

/**
 * L'instant réel correspondant à une heure murale à Bamako.
 *
 * Deux passes : le décalage se mesure à un instant donné, et l'instant dépend
 * du décalage. La première approximation suffit à le déterminer, sauf à
 * cheval sur un changement d'heure — que Bamako ne pratique pas, mais la
 * seconde passe rend le calcul juste quand bien même.
 */
function instantABamako(annee, mois, jour, heures, minutes) {
  const approx = Date.UTC(annee, mois - 1, jour, heures, minutes, 0)
  const d1 = decalageEcole(new Date(approx))
  const t1 = approx - d1 * 60000
  const d2 = decalageEcole(new Date(t1))
  return new Date(d2 === d1 ? t1 : approx - d2 * 60000)
}

/**
 * Analyse une heure de cours. Deux formats coexistent réellement : la colonne
 * `heure_cours` renvoie « 08:00:00 », tandis que l'emploi du temps manipule
 * « 08:00 ». Les deux doivent produire exactement la même échéance.
 *
 * Renvoie `null` si l'heure est absente ou illisible — jamais une valeur par
 * défaut : inventer 8h00 reviendrait à inventer une ponctualité.
 */
export function normaliserHeure(heure) {
  if (typeof heure !== 'string') return null
  const m = heure.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1]), mn = Number(m[2])
  if (h > 23 || mn > 59) return null
  return { h, m: mn }
}

/** Analyse « 2026-08-20 ». `null` si illisible ou si la date n'existe pas. */
export function normaliserDate(date) {
  if (typeof date !== 'string') return null
  const m = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const a = Number(m[1]), mo = Number(m[2]), j = Number(m[3])
  const d = new Date(Date.UTC(a, mo - 1, j))
  // Rejette le 31 février et consorts, que Date normaliserait en silence.
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null
  return { a, mo, j }
}

/**
 * Heure limite de dépôt pour un cours donné, comme instant réel.
 * `null` si la date ou l'heure est absente, illisible ou impossible.
 */
export function echeance(dateCours, heureCours, delai = delaiConnu()) {
  const d = normaliserDate(dateCours)
  const h = normaliserHeure(heureCours)
  if (!d || !h) return null
  const debut = instantABamako(d.a, d.mo, d.j, h.h, h.m)
  return new Date(debut.getTime() - (delai.heures_avant_cours || 0) * 3600 * 1000)
}

/**
 * Situation d'un dépôt par rapport à l'échéance.
 * Renvoie { valide, aTemps, retardMinutes, echeance }.
 *
 * `valide: false` signale une échéance inconnue — date ou heure manquante,
 * illisible, ou instant de dépôt invalide. L'appelant doit alors refuser
 * l'enregistrement. Cette fonction retournait autrefois `aTemps: true` dans
 * ce cas : une donnée manquante devenait silencieusement un dépôt à l'heure.
 */
export function situationDepot(dateCours, heureCours, moment = new Date(), delai = delaiConnu()) {
  const limite = echeance(dateCours, heureCours, delai)

  // `new Date(null)` vaut le 1er janvier 1970, donc « avant tout cours ». Un
  // `heure_depot` absent produirait ainsi une ponctualité parfaite. Le
  // paramètre par défaut ne couvre que `undefined` : on écarte explicitement
  // tout ce qui n'est ni une date, ni une chaîne, ni un nombre.
  const instant =
    moment === undefined                                  ? new Date()
    : moment instanceof Date                              ? moment
    : (typeof moment === 'string' && moment.trim() !== '') ? new Date(moment)
    : typeof moment === 'number'                          ? new Date(moment)
    : null

  if (!limite || !instant || isNaN(instant.getTime())) {
    return { valide: false, aTemps: null, retardMinutes: null, echeance: null }
  }
  const retardMs = instant.getTime() - limite.getTime()
  return {
    valide: true,
    // Règle validée : déposée avant le début du cours, ou exactement à
    // l'heure du début, elle est à temps. Après, elle est en retard.
    aTemps: retardMs <= 0,
    retardMinutes: Math.max(0, Math.round(retardMs / 60000)),
    echeance: limite,
  }
}

/**
 * Le statut que prend une préparation au moment où elle est déposée.
 * `null` si l'échéance est inconnue — l'appelant refuse alors d'enregistrer
 * plutôt que d'inventer une ponctualité.
 */
export function statutAuDepot(dateCours, heureCours, moment) {
  const s = situationDepot(dateCours, heureCours, moment)
  if (!s.valide) return null
  return s.aTemps ? 'deposee' : 'en_retard'
}

// ─── Ponctualité au dépôt ───────────────────────────────────────────────────
//
// Qualité pédagogique et ponctualité sont deux dimensions indépendantes, et
// le code doit les tenir séparées.
//
// Le statut courant ne peut pas servir à mesurer la ponctualité. La
// transition `en_retard → validee` est autorisée : une préparation remise en
// retard puis jugée bonne par la direction reste une préparation remise en
// retard. Lire `status === 'validee'` comme une preuve de ponctualité
// reviendrait à faire disparaître le retard dès que la direction valide — et
// à fausser tout indicateur de suivi du personnel qui s'y appuierait.
//
// La ponctualité se lit donc à l'événement de dépôt, jamais à l'état présent.

// Les actions qui témoignent d'un dépôt, et elles seules.
//
// Une fonction et non un tableau constant : `ACTIONS` est déclaré plus bas
// dans ce fichier, et un `const` évalué au chargement du module le lirait
// dans sa zone morte temporelle — le module lèverait une ReferenceError à
// l'import, donc l'application entière refuserait de démarrer. Le corps
// d'une fonction, lui, n'est évalué qu'à l'appel.
const estActionDepot = action => action === ACTIONS.depot || action === ACTIONS.migration

/** Les statuts qu'un dépôt peut poser. Tout autre valeur n'est pas un dépôt. */
const STATUTS_DEPOT = ['deposee', 'en_retard']

/**
 * L'événement de dépôt initial, tel que l'historique le conserve.
 *
 * Deux actions en témoignent. `depot`, posée par l'écran de saisie. Et
 * `migration` : les 17 lignes normalisées le 18 août 2026 n'ont pas d'entrée
 * `depot` — elles sont antérieures à l'historique — mais la migration y a
 * inscrit le statut déduit de leur ponctualité réelle. C'est la seule trace
 * qu'elles possèdent, et elle est fiable.
 *
 * On retient la PREMIÈRE : après une demande de correction, l'enseignant
 * redépose, et ce second dépôt ne doit pas effacer le retard du premier.
 *
 * `null` si l'historique ne porte aucun témoignage exploitable — y compris
 * lorsqu'une entrée de dépôt existe mais porte un statut incohérent.
 */
export function evenementDepot(prep) {
  const histo = Array.isArray(prep?.historique_statuts) ? prep.historique_statuts : []
  // L'historique est construit par ajout en fin de tableau : l'ordre du
  // tableau est l'ordre chronologique, sans dépendre du champ `le`.
  const e = histo.find(x => x && estActionDepot(x.action))
  if (!e) return null
  // Une entrée de dépôt qui n'annonce ni « deposee » ni « en_retard » ne
  // prouve rien. On préfère la déclarer inexploitable et recalculer.
  return STATUTS_DEPOT.includes(e.statut) ? e : null
}

/**
 * La préparation a-t-elle été déposée à temps ?
 *
 *   true  — déposée à temps
 *   false — déposée en retard
 *   null  — indéterminable avec les données disponibles
 *
 * Source unique de la ponctualité. Ne consulte JAMAIS `prep.status` : ni
 * `validee`, ni `a_corriger`, ni aucune évolution postérieure au dépôt ne
 * peut valoir preuve de ponctualité.
 *
 * Une donnée manquante ne devient jamais `true`. Dans le doute, on ne
 * tranche pas — c'est à l'appelant de décider ce qu'il fait d'un `null`.
 */
export function ponctualiteAuDepot(prep) {
  if (!prep) return null

  // 1. L'historique fait foi : il fige la situation au moment du dépôt,
  //    avant toute validation ou demande de correction.
  const depot = evenementDepot(prep)
  if (depot) return depot.statut === 'deposee'

  // 2. Sans historique exploitable — les dépôts créés avant que l'écran ne
  //    trace ses événements —, on recalcule depuis les horodatages réels.
  const s = situationDepot(prep.date_cours, prep.heure_cours, prep.heure_depot)
  if (s.valide) return s.aTemps

  // 3. Ni trace, ni horodatage exploitable : on ne devine pas.
  return null
}

/**
 * Forme booléenne de `ponctualiteAuDepot`, pour les compteurs qui ne savent
 * pas représenter l'indétermination.
 *
 * Convention : `null` compte comme « pas à temps ». Une ponctualité qu'on ne
 * sait pas établir ne doit pas ouvrir droit à un avantage — mieux vaut ne pas
 * créditer que créditer à tort.
 */
export const deposeeATemps = prep => ponctualiteAuDepot(prep) === true

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

/**
 * Ajoute une entrée à l'historique et renvoie le tableau complet.
 *
 * `le` est optionnel et vaut l'instant courant par défaut. L'appelant le
 * fournit lorsque l'événement doit porter exactement le même horodatage
 * qu'une colonne — le dépôt inscrit ainsi le `heure_depot` de la ligne, à la
 * milliseconde près, plutôt qu'un instant recalculé qui en différerait.
 */
export function ajouterHistorique(historique, { statut, action, commentaire, utilisateur, le }) {
  return [
    ...(Array.isArray(historique) ? historique : []),
    {
      statut: statut || null,
      action,
      commentaire: commentaire || null,
      le: le || new Date().toISOString(),
      par: utilisateur?.id || null,
      par_nom: utilisateur ? `${utilisateur.prenom || ''} ${utilisateur.nom || ''}`.trim() : null,
    },
  ]
}

/** Les événements tracés. Les sept premiers viennent du blueprint ; le
 *  huitième est technique — voir ci-dessous. */
export const ACTIONS = {
  depot:               'depot',
  modification:        'modification',
  statut:              'statut',
  correction_demandee: 'correction_demandee',
  validation:          'validation',
  commentaire:         'commentaire',
  reouverture:         'reouverture',
  // Conversion des anciens statuts vers la nomenclature à cinq valeurs,
  // faite en base le 18 août 2026. Aucune personne n'en est l'auteur : les
  // 17 entrées portent `par: null`. L'ancien libellé est conservé dans le
  // commentaire de l'entrée, seul endroit où il subsiste après migration.
  migration:           'migration',
}

/**
 * L'ancien statut, extrait du commentaire d'une entrée de migration.
 *
 * La migration a écrit « Statut converti depuis « acceptable » lors de la
 * normalisation du 18/08/2026. ». Le libellé d'origine vit entre les
 * guillemets français : on le récupère plutôt que de le perdre à l'affichage.
 * Renvoie `null` si le commentaire ne suit pas cette forme — un commentaire
 * rédigé à la main reste alors affiché tel quel.
 */
const ancienStatutDe = commentaire => {
  if (typeof commentaire !== 'string') return null
  return commentaire.match(/«\s*([^»]+?)\s*»/)?.[1] || null
}

/** Phrase lisible pour l'écran, à partir d'une entrée d'historique. */
export function raconter(entree) {
  const qui = entree.par_nom || 'Quelqu’un'
  const quand = entree.le
    ? new Date(entree.le).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''
  // Une migration n'a pas d'auteur : la phrase ne dit donc pas « untel a… ».
  const ancien = entree.action === ACTIONS.migration
    ? ancienStatutDe(entree.commentaire)
    : null

  const phrases = {
    depot:               `${qui} a déposé la préparation`,
    modification:        `${qui} a modifié la préparation`,
    statut:              `${qui} a changé le statut pour « ${libelleStatut(entree.statut)} »`,
    correction_demandee: `${qui} a demandé une correction`,
    validation:          `${qui} a validé la préparation`,
    commentaire:         `${qui} a laissé un commentaire`,
    reouverture:         `${qui} a rouvert une préparation déjà validée`,
    migration:           ancien
      ? `Statut normalisé automatiquement depuis « ${ancien} »`
      : 'Statut normalisé automatiquement depuis l’ancien statut',
  }
  return {
    texte: phrases[entree.action] || `${qui} — ${entree.action}`,
    quand,
    // La phrase porte déjà l'ancien statut : réafficher le commentaire
    // d'origine ferait doublon. On ne l'efface que si l'extraction a
    // réussi — sinon le texte est conservé, aucune trace n'est perdue.
    commentaire: ancien ? null : entree.commentaire,
  }
}

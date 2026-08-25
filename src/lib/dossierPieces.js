// Les pièces d'un dossier d'inscription.
//
// ── La règle métier ────────────────────────────────────────────────────────
//
//   UNE PIÈCE MANQUANTE NE BLOQUE PAS L'INSCRIPTION.
//   LA COMPLÉTUDE EST CONTEXTUELLE.
//
// Un parent qui n'a pas encore l'extrait d'acte de naissance doit pouvoir
// inscrire son enfant, payer, et apporter la pièce plus tard.
//
// Et un enfant de petite section qui n'a jamais été scolarisé ne doit pas être
// marqué INCOMPLET faute d'un bulletin de l'année précédente qui n'existe pas.
//
// ── Pourquoi ce fichier ────────────────────────────────────────────────────
//
// Les quatre types étaient déclarés dans `public/inscription.html`, au milieu
// de la fonction d'envoi, et nulle part ailleurs. Rien ne les relisait : la
// table `documents_inscription` n'avait AUCUN lecteur dans tout le dépôt.
// C'est pourquoi personne ne pouvait voir ce qui manquait à un dossier.

export const PIECES = [
  // Suivies pour tous les dossiers.
  { id: 'acte_naissance', label: 'Acte de naissance',              portee: 'toujours' },
  { id: 'vaccination',    label: 'Carnet de vaccination',          portee: 'toujours' },
  // Exigées seulement d'un enfant venant d'un autre établissement.
  { id: 'bulletin',       label: 'Bulletin de l’année précédente', portee: 'venant_d_ailleurs' },
  { id: 'transfert',      label: 'Certificat de transfert',        portee: 'venant_d_ailleurs' },
]

export const libellePiece = (id) =>
  PIECES.find(p => p.id === id)?.label || String(id || 'Pièce non identifiée')

// ── Le contexte de scolarisation ───────────────────────────────────────────
//
// Ce que les données permettent d'établir, et ce qu'elles ne permettent pas.
//
//   FIABLE     `type_inscription = 'reinscription'` est posé par le parcours
//              lui-même, jamais saisi à la main. Un enfant qui se réinscrit
//              était déjà à IDEAL : l'école détient ses bulletins, et un
//              certificat de transfert n'a aucun sens.
//
//   FIABLE     `ancienne_ecole` renseignée et différente d'IDEAL : l'enfant
//              vient bien d'ailleurs. Les deux pièces sont alors exigibles.
//
//   PAS FIABLE `ancienne_ecole` vide. Le champ est libre et facultatif —
//              « Ancienne école (si applicable) ». Un vide peut signifier
//              « première scolarisation » comme « personne ne l'a rempli ».
//
// On ne devine donc pas ce troisième cas : il est déclaré INDÉTERMINÉ. Les
// pièces conditionnelles n'y sont pas comptées comme manquantes — un enfant de
// maternelle ne sera jamais marqué incomplet à tort — mais elles ne sont pas
// non plus affichées comme acquises. Le secrétariat voit « à confirmer ».
//
// La donnée qui lèverait l'ambiguïté est nommée dans
// `docs/constitution/dossier-pieces-contexte.md`.
export const contexteDossier = (inscription) => {
  const type = String(inscription?.type_inscription || '').toLowerCase()
  if (type === 'reinscription') return 'reinscription'

  const ancienne = String(inscription?.ancienne_ecole || '').trim()
  if (!ancienne) return 'indetermine'
  // La réinscription pré-remplit « École IDEAL » : ce n'est pas un ailleurs.
  if (/ideal/i.test(ancienne)) return 'reinscription'
  return 'venant_d_ailleurs'
}

// Une pièce est-elle exigible dans ce contexte ?
//   true  → exigible, son absence rend le dossier incomplet
//   false → sans objet, elle ne se compte pas
//   null  → indéterminé, elle ne se compte pas mais se signale
const exigibilite = (piece, contexte) => {
  if (piece.portee === 'toujours') return true
  if (contexte === 'venant_d_ailleurs') return true
  if (contexte === 'reinscription') return false
  return null   // indéterminé
}

/**
 * L'état d'un dossier, à partir des lignes de `documents_inscription` et du
 * contexte de l'inscription.
 */
export const etatDossier = (documents, inscription) => {
  const contexte = contexteDossier(inscription)
  const fournis = new Set((documents || []).map(d => d && d.type).filter(Boolean))

  const detail = PIECES.map(p => ({
    ...p,
    fournie: fournis.has(p.id),
    exigee: exigibilite(p, contexte),
  }))

  const manquantes = detail.filter(d => d.exigee === true && !d.fournie)
  const aConfirmer = detail.filter(d => d.exigee === null && !d.fournie)
  const sansObjet  = detail.filter(d => d.exigee === false && !d.fournie)

  return {
    contexte,
    complet: manquantes.length === 0,
    nbManquantes: manquantes.length,
    manquantes,
    aConfirmer,
    sansObjet,
    presentes: detail.filter(d => d.fournie),
    detail,
    inconnues: [...fournis].filter(t => !PIECES.some(p => p.id === t)),
  }
}

export const LIBELLE_CONTEXTE = {
  reinscription:      'Réinscription — l’école détient déjà la scolarité antérieure',
  venant_d_ailleurs:  'Vient d’un autre établissement',
  indetermine:        'Scolarisation antérieure non renseignée',
}

export const libelleEtat = (etat) =>
  etat.complet
    ? 'DOSSIER COMPLET'
    : `DOSSIER INCOMPLET · ${etat.nbManquantes} pièce${etat.nbManquantes > 1 ? 's' : ''} manquante${etat.nbManquantes > 1 ? 's' : ''}`

// L'état d'une pièce, tel qu'il s'affiche.
export const etatPiece = (d) =>
  d.fournie ? 'fournie'
  : d.exigee === true ? 'manquante'
  : d.exigee === null ? 'a_confirmer'
  : 'sans_objet'

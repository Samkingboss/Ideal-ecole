// Les pièces d'un dossier d'inscription.
//
// ── La règle métier ────────────────────────────────────────────────────────
//
//   UNE PIÈCE MANQUANTE NE BLOQUE PAS L'INSCRIPTION.
//
// Un parent qui n'a pas encore l'extrait d'acte de naissance doit pouvoir
// inscrire son enfant, payer, et apporter la pièce plus tard. Le dossier est
// alors INCOMPLET — ce qui se dit, se compte et se rattrape, mais n'interdit
// rien.
//
// ── Pourquoi ce fichier ────────────────────────────────────────────────────
//
// Les quatre types étaient déclarés dans `public/inscription.html`, au milieu
// de la fonction d'envoi, et nulle part ailleurs. Rien ne les relisait : la
// table `documents_inscription` n'avait AUCUN lecteur dans tout le dépôt.
// C'est pourquoi personne ne pouvait voir ce qui manquait à un dossier.
//
// Les libellés vivent désormais ici, et cette liste fait foi.

// ── Une réserve à arbitrer ─────────────────────────────────────────────────
//
// Les quatre pièces sont marquées requises, conformément à l'exemple donné
// par la direction — quatre lignes, deux manquantes.
//
// Mais « bulletin de l'année précédente » et « certificat de transfert » ne
// concernent qu'un enfant qui vient d'une autre école. Exigés de tous, ils
// marqueraient INCOMPLET tout dossier de première inscription, y compris en
// petite section où l'enfant n'a jamais été scolarisé.
//
// Passer `requise: false` sur ces deux lignes suffit à corriger, et rien
// d'autre ne bouge : `etatDossier` ne compte que les requises. La décision
// revient à la direction.
export const PIECES = [
  { id: 'acte_naissance', label: 'Acte de naissance',              requise: true },
  { id: 'vaccination',    label: 'Carnet de vaccination',          requise: true },
  { id: 'bulletin',       label: 'Bulletin de l’année précédente', requise: true },
  { id: 'transfert',      label: 'Certificat de transfert',        requise: true },
]

export const PIECES_REQUISES = PIECES.filter(p => p.requise)

// Le libellé d'un type, y compris pour un type inconnu venu de la base : on
// le montre tel quel plutôt que de le taire.
export const libellePiece = (id) =>
  PIECES.find(p => p.id === id)?.label || String(id || 'Pièce non identifiée')

/**
 * L'état d'un dossier, à partir des lignes de `documents_inscription`.
 *
 * Ne juge que sur les pièces REQUISES : un bulletin absent pour un enfant qui
 * n'a jamais été scolarisé ne rend pas son dossier incomplet.
 */
export const etatDossier = (documents) => {
  const fournis = new Set(
    (documents || []).map(d => d && d.type).filter(Boolean))

  const presentes = PIECES.filter(p => fournis.has(p.id))
  const manquantes = PIECES_REQUISES.filter(p => !fournis.has(p.id))
  // Les pièces facultatives absentes se distinguent des requises : elles se
  // montrent, mais ne comptent pas dans le manque.
  const facultativesAbsentes = PIECES.filter(p => !p.requise && !fournis.has(p.id))

  return {
    complet: manquantes.length === 0,
    nbManquantes: manquantes.length,
    manquantes,
    presentes,
    facultativesAbsentes,
    // Chaque pièce avec son état, dans l'ordre de la liste canonique.
    detail: PIECES.map(p => ({ ...p, fournie: fournis.has(p.id) })),
    // Les types trouvés en base qui ne sont pas dans la liste canonique.
    inconnues: [...fournis].filter(t => !PIECES.some(p => p.id === t)),
  }
}

export const libelleEtat = (etat) =>
  etat.complet
    ? 'DOSSIER COMPLET'
    : `DOSSIER INCOMPLET · ${etat.nbManquantes} pièce${etat.nbManquantes > 1 ? 's' : ''} manquante${etat.nbManquantes > 1 ? 's' : ''}`

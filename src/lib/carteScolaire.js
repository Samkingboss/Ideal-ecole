// La carte scolaire : format fini, et disposition des planches d'impression.
//
// ── Pourquoi ces valeurs sont ici ──────────────────────────────────────────
//
// Elles vivaient dans `CartesScolaires.jsx`, mêlées au rendu. La feuille de
// style d'impression en gardait sa propre copie, en dur — `repeat(3, 54mm)`,
// `repeat(3, 85.6mm)`, `190mm`, `277mm`. Deux jeux de nombres décrivant la
// même planche : c'est ainsi qu'une carte finit par ne plus tenir dans sa
// case sans que personne ne comprenne pourquoi.

// ── Format fini CR80 (ISO/IEC 7810 ID-1) ───────────────────────────────────
//
// 85,60 × 53,98 mm. La carte IDEAL est en PORTRAIT : le format tourné d'un
// quart de tour, comme une carte d'identité verticale. Le design validé
// repose sur cette orientation ; on ne la change pas, on nomme seulement le
// format exactement.
export const CR80 = { grand: 85.60, petit: 53.98 }
export const CARTE_L = CR80.petit    // 53,98 mm de large
export const CARTE_H = CR80.grand    // 85,60 mm de haut

// ── La planche A4 ──────────────────────────────────────────────────────────
export const A4 = { largeur: 210, hauteur: 297 }
export const COLONNES = 3
export const RANGEES  = 3
export const PAR_PLANCHE = COLONNES * RANGEES   // 9

// L'écart entre deux cartes. Assez pour donner un trait de coupe, assez peu
// pour que trois rangées tiennent en hauteur.
export const GOUTTIERE = 3

// La marge de la feuille est CALCULÉE, jamais choisie : c'est ce qui reste
// une fois les cartes et les gouttières posées. Un chiffre écrit à la main
// finit par ne plus correspondre.
export const grilleL = COLONNES * CARTE_L + (COLONNES - 1) * GOUTTIERE   // 167,94
export const grilleH = RANGEES  * CARTE_H + (RANGEES  - 1) * GOUTTIERE   // 262,80
export const MARGE_X = (A4.largeur - grilleL) / 2                        // 21,03
export const MARGE_Y = (A4.hauteur - grilleH) / 2                        //  17,10

/** Vrai si la planche tient sur la feuille. Faux = il ne faut pas imprimer. */
export const plancheTient = () =>
  grilleL <= A4.largeur && grilleH <= A4.hauteur && MARGE_X > 0 && MARGE_Y > 0

// ── Pagination ─────────────────────────────────────────────────────────────

/** Découpe la liste en planches de 9. La dernière peut être incomplète. */
export const planches = (eleves) => {
  const out = []
  for (let i = 0; i < (eleves || []).length; i += PAR_PLANCHE) {
    out.push((eleves || []).slice(i, i + PAR_PLANCHE))
  }
  return out
}

/**
 * L'ordre des versos, pour un retournement sur le GRAND CÔTÉ.
 *
 * La feuille pivote autour de son axe vertical : ce qui était à gauche se
 * retrouve à droite. Chaque rangée doit donc être inversée, et seulement la
 * rangée — inverser la planche entière mettrait la rangée du bas en haut.
 *
 * Les cases manquantes de la dernière planche sont comblées par `null` AVANT
 * l'inversion. Sans ce remplissage, une planche de 7 cartes verrait sa
 * dernière rangée décalée d'une colonne, et deux versos tomberaient derrière
 * le mauvais recto.
 */
export const miroirRangees = (planche) => {
  const out = []
  const liste = planche || []
  for (let i = 0; i < liste.length; i += COLONNES) {
    const rangee = liste.slice(i, i + COLONNES)
    while (rangee.length < COLONNES) rangee.push(null)
    out.push(...rangee.reverse())
  }
  return out
}

/** Le nombre de feuilles A4 réellement produites : un recto et un verso par planche. */
export const nombreDeFeuilles = (eleves) => planches(eleves).length * 2

// ── Unités ─────────────────────────────────────────────────────────────────
//
// Le même dessin sert à l'écran et au papier. À l'écran on veut des pixels
// pour pouvoir réduire l'aperçu ; sur le papier il faut des MILLIMÈTRES.
//
// La version précédente exprimait tout en pixels, y compris à l'impression,
// en tablant sur 96 px par pouce. Les navigateurs ne garantissent pas ce
// rapport en mode impression : la carte sortait légèrement plus haute que sa
// case de grille, et l'écart, multiplié par trois rangées, faisait déborder
// la dernière carte hors de la feuille. C'est le débordement du verso.
//
// `unites('mm')` rend des longueurs que le navigateur ne peut pas
// réinterpréter.
// Elle rend TOUJOURS une longueur CSS complète, unité comprise. Rendre un
// nombre nu marcherait pour `width` — React y ajoute « px » — mais pas dans
// une chaîne de gabarit : `${mm(.45)} solid` donnerait « 1.62 solid », que le
// navigateur ignore en silence. La bordure disparaîtrait sans erreur.
export const unites = (mode, echelle = 1) =>
  mode === 'mm'
    ? (v => `${+(v).toFixed(3)}mm`)
    : (v => `${+(v * echelle).toFixed(3)}px`)

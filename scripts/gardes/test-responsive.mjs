// Gardes de propriété responsive sur les écrans enseignants.
//
// Le personnel d'IDEAL travaille au téléphone. Un écran qui déborde
// horizontalement n'est pas un défaut cosmétique : un bouton hors champ est un
// bouton qui n'existe pas.
//
// ── Ce que ces gardes testent, et ce qu'elles ne testent pas ────────────────
//
// Elles ne rendent pas les pages : elles cherchent, dans le code, les MOTIFS
// qui produisent un débordement. C'est une analyse statique, donc faillible
// dans les deux sens — mais elle tourne en une seconde, à chaque édition, et
// elle attrape les régressions que personne ne reverra à la main.
//
// La vérification visuelle reste nécessaire et se fait dans le navigateur, à
// 375, 390 et 430 px. Ces gardes empêchent d'y revenir pour rien.
//
// Le plus étroit des trois est 375 px : iPhone SE et 12 mini. C'est la mesure
// de référence.

import { readFileSync, existsSync } from 'node:fs'

const LARGEUR_MIN = 375          // le plus étroit des appareils visés
const GOUTTIERE   = 32           // marges de `.page-content`, de part et d'autre
const UTILE       = LARGEUR_MIN - GOUTTIERE   // 343 px réellement disponibles

// Les écrans que le personnel enseignant ouvre depuis un téléphone.
const ECRANS = [
  ['tableau de bord enseignant', 'src/pages/ProfApp.jsx'],
  ['programme et matières',      'src/pages/ProgrammePedagogique.jsx'],
  ['fiche ressource / documents','src/pages/DocumentPrintStudio.jsx'],
  ['sommaire de manuel',         'src/pages/SommaireManuelDocument.jsx'],
  ['cahier de devoirs',          'src/pages/DevoirsDocument.jsx'],
  ['fiche de préparation',       'src/pages/FichePreparation.jsx'],
  ['emploi du temps',            'src/pages/MonEmploiDuTemps.jsx'],
]

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(52)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}

const lignesDe = chemin =>
  existsSync(chemin) ? readFileSync(chemin, 'utf8').split('\n') : null

// Une valeur en pixels écrite dans un style, sur une propriété de largeur.
const largeursFixes = (ligne) => {
  const trouve = []
  // width: 880 · minWidth: 900 · 'width: 820px'
  // `maxWidth` ne déborde pas : il plafonne. Le motif exige donc que rien ne
  // précède immédiatement le nom de la propriété — sans quoi « max-width »
  // et « maxWidth » seraient comptés comme des largeurs imposées.
  for (const m of ligne.matchAll(/(^|[^-\w])(minWidth|width|min-width)\s*:\s*'?(\d{3,4})(px)?'?/g)) {
    const px = Number(m[3])
    if (px > UTILE) trouve.push(`${m[2]}:${px}`)
  }
  return trouve
}

console.log(`\n${G}── RESPONSIVE · l'écran le plus étroit fait ${LARGEUR_MIN} px   [INV-UI]${F}`)

// ── R1 · aucune largeur fixe supérieure à la place disponible ───────────────
{
  const fautifs = []
  for (const [nom, chemin] of ECRANS) {
    const lignes = lignesDe(chemin)
    if (!lignes) { fautifs.push(`${nom} : fichier absent`); continue }
    lignes.forEach((l, i) => {
      // Le A4 du moteur documentaire est une mesure de papier, pas d'écran :
      // il est mis à l'échelle par `useEchelleFeuille`, et c'est justement ce
      // qui le rend inoffensif. On ne le compte pas.
      if (/A4|mm`|A4_PX/.test(l)) return
      const t = largeursFixes(l)
      if (!t.length) return
      // Un tableau plus large que l'écran n'est pas une faute s'il défile dans
      // son propre cadre : c'est justement la parade recommandée. On regarde
      // les lignes juste au-dessus pour savoir si un tel cadre l'enveloppe.
      const contexte = lignes.slice(Math.max(0, i - 4), i).join(' ')
      if (/overflowX:\s*'auto'|overflow-x:\s*auto/.test(contexte)) return
      fautifs.push(`${chemin.split('/').pop()}:${i + 1} ${t.join(' ')}`)
    })
  }
  verifier(`R1 · aucune largeur fixe > ${UTILE} px`, fautifs.length === 0,
    fautifs.length ? `\n      ${fautifs.join('\n      ')}` : `— ${ECRANS.length} écrans`)
}

// ── R2 · les grilles fluides savent tenir dans un téléphone ─────────────────
//
// `repeat(auto-fit, minmax(N, 1fr))` déborde dès que N dépasse la place
// disponible : la colonne ne peut pas se réduire sous son minimum.
{
  const fautifs = []
  for (const [, chemin] of ECRANS) {
    const lignes = lignesDe(chemin)
    if (!lignes) continue
    lignes.forEach((l, i) => {
      for (const m of l.matchAll(/minmax\(\s*(\d{2,4})px/g)) {
        if (Number(m[1]) > UTILE) fautifs.push(`${chemin.split('/').pop()}:${i + 1} minmax(${m[1]}px)`)
      }
    })
  }
  verifier('R2 · aucune colonne de grille plus large que l’écran', fautifs.length === 0,
    fautifs.length ? `\n      ${fautifs.join('\n      ')}` : '')
}

// ── R3 · un enfant de conteneur flex doit pouvoir se réduire ────────────────
//
// Motif classique du débordement : un titre long dans un `flex` sans
// `minWidth: 0`. L'enfant garde sa largeur de contenu et pousse la ligne
// entière hors de l'écran. On exige donc que chaque fichier qui compose des
// lignes flexibles connaisse au moins une fois la parade.
{
  const fautifs = []
  for (const [nom, chemin] of ECRANS) {
    const src = existsSync(chemin) ? readFileSync(chemin, 'utf8') : ''
    const composeDesLignes = /justifyContent:\s*'space-between'/.test(src)
    const saitSeReduire = /minWidth:\s*0|overflowWrap|textOverflow|entete-ecran|flexWrap/.test(src)
    if (composeDesLignes && !saitSeReduire) fautifs.push(nom)
  }
  verifier('R3 · les lignes flexibles savent se réduire', fautifs.length === 0,
    fautifs.length ? `— ${fautifs.join(', ')}` : '')
}

// ── R4 · le contenu large défile dans son cadre, pas dans la page ───────────
{
  const fautifs = []
  for (const [nom, chemin] of ECRANS) {
    const src = existsSync(chemin) ? readFileSync(chemin, 'utf8') : ''
    // Un tableau ou une bande de puces doit être posé dans un conteneur qui
    // défile, sinon c'est le corps de la page qui défile latéralement.
    // Les tableaux d'un gabarit d'impression sortent sur du papier : leur
    // largeur ne concerne pas l'écran. Ces gabarits sont écrits en littéraux
    // gabarits — des chaînes entre accents graves, ouvertes puis injectées
    // dans une fenêtre d'impression. Les retirer laisse le seul JSX, c'est-à-dire
    // ce que React rend vraiment à l'écran.
    const sansGabarits = src.replace(/`[\s\S]*?`/g, '``')
    const aDuLarge = /<table|whiteSpace:\s*'nowrap'/.test(sansGabarits)
    const contenu  = /overflowX:\s*'auto'|overflow-x:\s*auto|className="table-wrap"/.test(sansGabarits)
    if (aDuLarge && !contenu) fautifs.push(nom)
  }
  verifier('R4 · le contenu large défile dans son cadre', fautifs.length === 0,
    fautifs.length ? `— ${fautifs.join(', ')}` : '')
}

// ── R5 · la barre fixe du bas ne masque pas les derniers champs ─────────────
{
  const css = existsSync('src/App.css') ? readFileSync('src/App.css', 'utf8') : ''
  const barreFixe = /\.bottom-nav[^{]*\{[^}]*position:\s*fixed/s.test(css)
  // La réserve peut s'écrire en propriété dédiée ou dans le raccourci
  // `padding: haut côtés bas` — c'est la forme employée ici, avec en plus la
  // zone sûre de l'iPhone.
  const bloc = css.match(/\.page-content[^{]*\{([^}]*)\}/s)?.[1] || ''
  // La réserve doit être NON NULLE : accepter n'importe quel raccourci à trois
  // valeurs laisserait passer `padding: a b 0`, qui ne réserve rien du tout.
  // On exige donc une hauteur lisible — au moins 60 px, ou un calc() qui
  // additionne la zone sûre de l'appareil.
  const valeurBas = (bloc.match(/padding-bottom\s*:\s*([^;]+)/) ||
                     bloc.match(/padding\s*:\s*\S+\s+\S+\s+([^;]+)/) || [])[1] || ''
  const px = Number((valeurBas.match(/(\d+)px/) || [])[1] || 0)
  const reserve = px >= 60 || /env\(\s*safe-area/.test(valeurBas)
  verifier('R5 · une barre fixe réserve sa place au contenu',
    !barreFixe || reserve,
    barreFixe ? (reserve ? '— barre fixe, place réservée' : '— barre fixe SANS réserve') : '— pas de barre fixe')
}

// ── R6 · le moteur documentaire met le papier à l'échelle ───────────────────
//
// C'est la garde qui protège la correction de fond : un A4 de 210 mm injecté
// tel quel dans un écran de 375 px le débordait de plus du double.
{
  const src = existsSync('src/pages/DocumentPrintStudio.jsx')
    ? readFileSync('src/pages/DocumentPrintStudio.jsx', 'utf8') : ''
  const surcouche = /position:\s*'fixed'/.test(src)
  const echelle   = /scale\(\$\{echelle\}\)/.test(src) && /A4_PX/.test(src)
  const exportSain = /!enExport/.test(src)
  verifier('R6 · le document A4 est une surcouche mise à l’échelle',
    surcouche && echelle && exportSain,
    `— surcouche:${surcouche ? 'oui' : 'NON'} échelle:${echelle ? 'oui' : 'NON'} export:${exportSain ? 'protégé' : 'NON'}`)
}

console.log(echecs === 0
  ? `\n  ${V}6 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

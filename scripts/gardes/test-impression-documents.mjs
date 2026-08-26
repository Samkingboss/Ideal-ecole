// Gardes sur trois impressions : planches de cartes, certificat, bandeau
// d'effectifs.
//
// Les trois défauts venaient du même endroit : des longueurs écrites deux
// fois, ou écrites dans la mauvaise unité.
//
//   — la planche décrivait ses cases en millimètres et ses cartes en PIXELS ;
//   — le certificat imposait 297 mm à `html/body` ET à sa feuille ;
//   — le libellé des statistiques portait `white-space: nowrap` dans une
//     grille à trois colonnes de 105 px minimum.

import { readFileSync, existsSync } from 'node:fs'
import {
  CR80, CARTE_L, CARTE_H, COLONNES, RANGEES, PAR_PLANCHE, GOUTTIERE,
  A4, MARGE_X, MARGE_Y, grilleL, grilleH, plancheTient,
  planches, miroirRangees, nombreDeFeuilles, unites,
} from '../../src/lib/carteScolaire.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── IMPRESSION · planches, certificat, effectifs   [INV-UI]${F}`)

// ── P1 · le format fini est bien du CR80 ──────────────────────────────────
{
  verifier('P1 format CR80 (ISO 7810 ID-1) : 85,60 × 53,98',
    CR80.grand === 85.60 && CR80.petit === 53.98, `${CARTE_L} × ${CARTE_H} mm, en portrait`)
  verifier('P1 le rapport est celui d’une carte bancaire',
    Math.abs(CR80.grand / CR80.petit - 1.5858) < 0.001, (CR80.grand / CR80.petit).toFixed(4))
}

// ── P2 · la planche tient dans la feuille, avec ses marges ────────────────
//
// C'est la vérification que personne ne faisait : les nombres étaient posés à
// la main dans la feuille de style, et rien ne disait s'ils s'additionnaient
// correctement.
{
  verifier('P2 9 cartes par planche, 3 × 3', PAR_PLANCHE === 9 && COLONNES === 3 && RANGEES === 3)
  verifier('P2 la grille tient en largeur',
    grilleL <= A4.largeur, `${grilleL.toFixed(2)} ≤ ${A4.largeur} mm`)
  verifier('P2 la grille tient en hauteur',
    grilleH <= A4.hauteur, `${grilleH.toFixed(2)} ≤ ${A4.hauteur} mm`)
  verifier('P2 les marges restent imprimables',
    MARGE_X >= 8 && MARGE_Y >= 8,
    `${MARGE_X.toFixed(2)} × ${MARGE_Y.toFixed(2)} mm — au-delà de la zone morte des imprimantes`)
  verifier('P2 le verdict d’ensemble', plancheTient() === true)

  // AUTO-TEST : quatre rangées ne tiendraient pas, et le juge doit le voir.
  const hauteur4 = 4 * CARTE_H + 3 * GOUTTIERE
  verifier('P2 auto-test · une 4ᵉ rangée déborderait',
    hauteur4 > A4.hauteur, `${hauteur4.toFixed(1)} > ${A4.hauteur} mm`)
}

// ── P3 · pagination et ordre miroir ───────────────────────────────────────
{
  const eleves = n => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))
  const cas = [[1, 1, 2], [9, 1, 2], [10, 2, 4], [21, 3, 6], [0, 0, 0]]
  const rates = cas.filter(([n, p, f]) =>
    planches(eleves(n)).length !== p || nombreDeFeuilles(eleves(n)) !== f)
  verifier('P3 21 cartes → 3 planches → 6 feuilles A4',
    rates.length === 0, rates.length ? R + JSON.stringify(rates) + F : `${cas.length} cas`)

  // Le retournement se fait sur le GRAND CÔTÉ : chaque rangée s'inverse, et
  // seulement la rangée. Inverser la planche entière mettrait la rangée du
  // bas en haut, et neuf versos tomberaient derrière le mauvais recto.
  const complet = miroirRangees(eleves(9)).map(x => x.id)
  verifier('P3 planche pleine : rangées inversées, ordre des rangées gardé',
    complet.join(',') === '3,2,1,6,5,4,9,8,7', complet.join(' '))

  // Le cas qui casse en silence : une planche incomplète. Sans remplissage
  // AVANT inversion, la dernière rangée se décale d'une colonne.
  const partiel = miroirRangees(eleves(7)).map(x => (x ? x.id : '·'))
  verifier('P3 planche de 7 : la dernière rangée reste alignée',
    partiel.join(',') === '3,2,1,6,5,4,·,·,7', partiel.join(' '))
  // Ce qui doit être complété, c'est la RANGÉE, pas la planche : une planche
  // de 4 rend deux rangées, donc 6 cases. La carte 4, seule en tête de sa
  // rangée, doit retomber en bout de rangée au verso — c'est le miroir.
  const quatre = miroirRangees(eleves(4)).map(x => (x ? x.id : '·'))
  verifier('P3 planche de 4 : la carte isolée passe en bout de rangée',
    quatre.join(',') === '3,2,1,·,·,4', quatre.join(' '))
  const multiples = [1, 4, 7, 9].every(n => miroirRangees(eleves(n)).length % COLONNES === 0)
  verifier('P3 le nombre de cases est toujours un multiple de 3', multiples)

  // AUTO-TEST : l'inversion naïve — toute la planche d'un coup — se voit.
  const naif = [...eleves(9)].reverse().map(x => x.id).join(',')
  verifier('P3 auto-test · l’inversion globale serait différente',
    naif !== complet.join(','), naif)
}

// ── P4 · les cartes s’impriment en millimètres, pas en pixels ─────────────
//
// LE défaut d'origine. La grille posait des cases de 85,6 mm et les cartes
// étaient dessinées en pixels, en tablant sur 96 px par pouce. Les navigateurs
// ne garantissent pas ce rapport en impression : chaque carte sortait un peu
// plus haute que sa case, et l'écart, multiplié par trois rangées, faisait
// déborder la dernière hors de la feuille.
{
  const mm = unites('mm'), px = unites('px', 3.6)
  verifier('P4 le mode mm rend des millimètres', mm(53.98) === '53.98mm' && mm(0.45) === '0.45mm')
  verifier('P4 le mode px rend des pixels', px(10) === '36px')
  verifier('P4 les deux rendent une longueur COMPLÈTE',
    /[a-z]{2}$/.test(String(mm(1))) && /[a-z]{2}$/.test(String(px(1))),
    'un nombre nu casserait les gabarits : « 1.62 solid » est ignoré en silence')

  const src = lire('src/pages/CartesScolaires.jsx')
  verifier('P4 les planches rendent les cartes en mm',
    (src.match(/unite="mm"/g) || []).length >= 2)
  verifier('P4 plus aucune carte de planche en pixels d’impression',
    !/PX_MM/.test(src), 'l’échelle 96/25,4 a disparu')
  verifier('P4 la feuille de style ne réécrit plus les longueurs en dur',
    !/grid-template-columns: repeat\(3, 54mm\)/.test(src)
    && !/width: 190mm/.test(src) && !/height: 277mm/.test(src))
  verifier('P4 elle les dérive des constantes partagées',
    /repeat\(\$\{COLONNES\}, \$\{CARTE_L\}mm\)/.test(src)
    && /\$\{A4\.hauteur\}mm/.test(src))
}

// ── P5 · sauts de page et découpes ────────────────────────────────────────
{
  const src = lire('src/pages/CartesScolaires.jsx')
  verifier('P5 chaque feuille pousse la suivante',
    /break-after: page; page-break-after: always/.test(src))
  verifier('P5 la dernière n’éjecte pas de page blanche',
    /\.feuille:last-child \{\s*break-after: auto/.test(src))
  verifier('P5 aucune carte ne peut être coupée',
    /\.carte \{[\s\S]{0,220}break-inside: avoid; page-break-inside: avoid/.test(src))
  verifier('P5 la feuille elle-même ne se coupe pas',
    /\.feuille \{[\s\S]{0,320}break-inside: avoid; page-break-inside: avoid/.test(src))
  verifier('P5 marge @page nulle, marges portées par la feuille',
    /@page \{ size: A4 portrait; margin: 0; \}/.test(src)
    && /padding: \$\{MARGE_Y\}mm \$\{MARGE_X\}mm/.test(src),
    'une @page de 10 mm laissait 277 mm utiles à une feuille de 297')
  verifier('P5 le repère de planche ne s’imprime pas',
    /\.feuille-numero \{ display: none !important; \}/.test(src))
}

// ── C1 · le certificat tient sur UNE page ─────────────────────────────────
{
  const src = lire('src/pages/CertificatScolarite.jsx')
  verifier('C1 html/body ne sont plus hauts d’exactement une page',
    /html, body \{[^}]*height: auto !important/.test(src),
    'une page pleine plus un arrondi en réclame une seconde')
  verifier('C1 la feuille est bornée sous 297 mm',
    /height: 296\.8mm !important/.test(src) && /max-height: 296\.8mm !important/.test(src))
  verifier('C1 rien ne dépasse de la feuille',
    /#certificat-print-area \{[\s\S]{0,900}overflow: hidden !important/.test(src))
  verifier('C1 aucune page ne suit',
    /break-after: avoid !important; page-break-after: avoid !important/.test(src))
  verifier('C1 l’échelle d’aperçu est annulée au tirage',
    /transform: none !important/.test(src),
    'sinon le certificat sortirait réduit, calé en haut à gauche')

  // AUTO-TEST : le défaut d'origine doit être reconnaissable.
  const defaut = 'html, body { width: 210mm; height: 297mm; margin: 0 !important; }'
  verifier('C1 auto-test · la hauteur figée serait vue',
    /height: auto !important/.test(defaut) === false)
}

// ── C2 · le certificat ne déborde plus à l’écran ──────────────────────────
{
  const src = lire('src/pages/CertificatScolarite.jsx')
  verifier('C2 l’aperçu est mis à l’échelle', /useEchelleFeuille\(760\)/.test(src))
  verifier('C2 le défilement horizontal a disparu', !/overflowX: 'auto'/.test(src))
  verifier('C2 le cadre reprend la hauteur réduite',
    /hauteurDoc \* echelle/.test(src),
    'transform ne change pas la place occupée dans le flux')
  verifier('C2 le crochet est partagé, pas recopié',
    existsSync('src/lib/echelleApercu.js')
    && /from '\.\.\/lib\/echelleApercu'/.test(src))
}

// ── E1 · le bandeau d’effectifs ne déborde plus sur mobile ────────────────
{
  const src = lire('src/pages/FichesEffectifs.jsx')
  const bloc = (src.match(/\.effectifs-stat span\{[^}]*\}/) || [''])[0]
  verifier('E1 le libellé peut passer sur deux lignes',
    /white-space:normal/.test(bloc) && !/nowrap/.test(bloc), bloc.slice(0, 60) + '…')
  verifier('E1 il a une interligne propre', /line-height:1\.25/.test(bloc))
  verifier('E1 la carte autorise le rétrécissement',
    /\.effectifs-stat\{[^}]*min-width:0/.test(src),
    'sans min-width:0 une grille refuse de descendre sous le contenu')
  verifier('E1 la grille n’impose plus 3 × 105 px',
    /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(src)
    && !/minmax\(105px,1fr\)/.test(src),
    '3 × 105 + 2 × 10 = 335 px, au-delà d’un écran de 360')
  verifier('E1 les trois blocs restent de largeur égale',
    /repeat\(3,minmax\(0,1fr\)\)/.test(src))
  verifier('E1 le chiffre reste gros', /\.effectifs-stat strong\{font-size:22px/.test(src))

  // AUTO-TEST : le défaut d'origine doit être reconnu.
  const defaut = '.effectifs-stat span{font-size:9px;white-space:nowrap}'
  verifier('E1 auto-test · le nowrap d’origine serait vu',
    /nowrap/.test(defaut) === true && /white-space:normal/.test(defaut) === false)
}

// ── MESURES NAVIGATEUR, consignées ────────────────────────────────────────
//
// Prises sur un banc d'essai qui rendait les VRAIS composants de carte dans
// la VRAIE structure de planche, et la feuille de style RÉELLE du bandeau
// d'effectifs extraite de sa source. Recopier le CSS à la main n'aurait
// prouvé que la copie.
//
// PLANCHES · 21 cartes
//   feuilles produites ... 6            3 planches × recto/verso
//   feuille .............. 210 × 297 mm exactement
//   carte ................ 53,98 × 85,60 mm exactement
//   débordements ......... 0
//   cartes par feuille ... 9, 9, 9, 9, 3, 3
//
// MIROIR · planche 1
//   recto   A001 A002 A003 │ A004 A005 A006 │ A007 A008 A009
//   verso   A003 A002 A001 │ A006 A005 A004 │ A009 A008 A007
//   planche 3, incomplète : A019 A020 A021 → A021 A020 A019
//
// EFFECTIFS · quatre largeurs, libellés sur 1 ou 2 lignes, 0 débordement
//   360 px  grille 336  blocs 107  1/2/2 lignes
//   375 px  grille 351  blocs 112  1/2/2
//   390 px  grille 366  blocs 117  1/2/2
//   430 px  grille 406  blocs 130  1/1/1
//
// CERTIFICAT · non mesuré au navigateur. Le composant charge ses élèves
// depuis Supabase et la session de recette a expiré. Les corrections sont
// couvertes par C1 et C2 ci-dessus — par construction, pas par la mesure.

console.log(echecs === 0
  ? `\n  ${V}Impression : planches, certificat et effectifs conformes${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

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
  planches, miroirRangees, nombreDeFeuilles, unites, tailleNom, LARGEUR_NOM,
} from '../../src/lib/carteScolaire.js'
import { texteCertificat, dateEnLettres, lieuEtDate } from '../../src/lib/certificatTexte.js'

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

// ── N1 · le nom d'un élève n'est JAMAIS tronqué ──────────────────────────
//
// Mesuré sur un élève réel : la carte officielle sortait « Akotsi
// Abatsogad… ». Une carte d'identité scolaire qui ampute le nom qu'elle
// porte ne vaut rien.
{
  const src = lire('src/pages/CartesScolaires.jsx')
  verifier('N1 aucune ellipse ne subsiste sur la carte',
    !/textOverflow: 'ellipsis'/.test(src) && !/whiteSpace: 'nowrap'[^}]*prenom/.test(src))
  verifier('N1 le nom passe par le calcul de cran', /tailleNom\(/.test(src))

  // AUTO-TEST : le défaut d'origine doit être reconnaissable.
  const defaut = "whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'"
  verifier('N1 auto-test · l’ellipse d’origine serait vue',
    /textOverflow: 'ellipsis'/.test(defaut) === true)

  // Le cran doit TOUJOURS exister, et le nom réel tenir sans coupe.
  const noms = ['Alex SANVI', 'Aminata DIARRA', 'Akotsi Abatsogadaaa',
                'Marie-Christine ABOUBAKARY-TRAORÉ',
                'Jean-Baptiste de la Villemarqué du Plessis', 'X', '']
  const sansCran = noms.filter(n => {
    const c = tailleNom(n)
    return !c || !c.taille || !c.lignes
  })
  verifier('N1 chaque nom reçoit un cran', sansCran.length === 0, `${noms.length} noms`)

  // Le nom réel qui sortait tronqué : il doit tenir en deux lignes.
  const reel = tailleNom('Akotsi Abatsogadaaa')
  verifier('N1 « Akotsi Abatsogadaaa » tient sans coupe',
    reel.lignes === 2 && reel.taille < 3.75 && reel.texte === 'Akotsi Abatsogadaaa',
    `${reel.taille} mm × ${reel.lignes} lignes`)
  verifier('N1 un nom court garde la grande taille',
    tailleNom('Alex SANVI').taille === 3.75 && tailleNom('Alex SANVI').lignes === 1)

  // La capacité doit rester cohérente avec la largeur du bloc.
  const cap = n => LARGEUR_NOM / (0.58 * tailleNom(n).taille) * tailleNom(n).lignes
  const debordent = noms.filter(n => n.length > cap(n))
  verifier('N1 aucun nom ne dépasse la capacité de son cran',
    debordent.length === 0, debordent.length ? R + debordent.join(' · ') + F : '')
}

// ── N2 · l’aperçu de planche tient dans son conteneur ────────────────────
{
  const src = lire('src/pages/CartesScolaires.jsx')
  verifier('N2 l’échelle d’aperçu est mesurée, pas figée',
    /useEchelleFeuille\(A4_LARGEUR_PX\)/.test(src) && !/scale\(\.58\)/.test(src),
    'une valeur figée ne convient pas à la fois à 360 px et au bureau')
  verifier('N2 la feuille suit la variable mesurée',
    /transform: scale\(var\(--apercu, 1\)\)/.test(src)
    && /height: calc\(\$\{A4\.hauteur\}mm \* var\(--apercu, 1\)\)/.test(src))
  verifier('N2 aucun défilement horizontal possible',
    /#planche-impression \{ max-width: 100%; overflow-x: hidden; \}/.test(src))
  // LA cause du défaut, trouvée en mesurant et invisible à la lecture.
  // Une feuille de 794 px dans un conteneur de 360 ne se centre pas :
  // `margin: auto` se résout à zéro en débordement, la boîte statique occupe
  // 0…794 et son centre tombe à 397. Réduire autour de ce centre plaçait la
  // feuille visible à 217…577, hors du conteneur. Mesuré AVANT correctif :
  // 3 cartes sur 9 accessibles. APRÈS : 9 sur 9, feuille de 0 à 360.
  verifier('N2 la réduction est ancrée au bord gauche',
    /transform-origin: top left/.test(src) && !/transform-origin: top center/.test(src),
    'top center décalait la feuille réduite hors du conteneur')
  verifier('N2 l’impression garde les millimètres réels',
    /#planche-impression \.feuille \{\s*width: \$\{A4\.largeur\}mm; height: \$\{A4\.hauteur\}mm/.test(src),
    'la réduction ne concerne que l’écran')
}

// ── T1 · le certificat s’énonce, et ne dit jamais « null » ───────────────
{
  const directeur = { civilite: 'M.', nom: 'Samuel MOGADZI', fonction: 'Directeur' }
  const cas = [
    ['fille complète', { prenom: 'Aminata', nom: 'DIARRA', sexe: 'F', date_naissance: '2018-04-15',
                         lieu_naissance: 'Bamako', matricule: '26-27 A002', classe_nom: 'CP1 Bilingue' }],
    ['garçon sans lieu', { prenom: 'Alex', nom: 'SANVI', sexe: 'M', date_naissance: '2017-09-03',
                           lieu_naissance: null, matricule: '26-27 A007', classe_nom: 'CP2' }],
    ['sexe inconnu', { prenom: 'Akotsi', nom: 'Abatsogadaaa', date_naissance: '2018-01-20',
                       matricule: '26-27 A011', classe_nom: 'CP1' }],
    ['tout manque', { prenom: 'X', nom: 'Y' }],
    ['champs pollués', { prenom: 'Z', nom: 'W', date_naissance: 'null',
                         lieu_naissance: 'undefined', matricule: '   ', classe_nom: null }],
  ]
  const interdits = /\b(null|undefined|NaN|Invalid Date)\b/i
  const fautifs = cas.filter(([, e]) => {
    const t = texteCertificat({ eleve: e, directeur, anneeScolaire: '2026-2027' })
    const tout = `${t.entete} ${t.corps} ${t.formule}`
    return interdits.test(tout) || /\s,|,\s*\.|\s{2,}|à\s*\./.test(tout)
  }).map(([n]) => n)
  verifier('T1 aucun champ vide ne transparaît dans la phrase',
    fautifs.length === 0, fautifs.length ? R + fautifs.join(', ') + F : `${cas.length} cas`)

  // AUTO-TEST : le défaut d'origine — l'interpolation nue — doit être vu.
  const defaut = `15 avril 2018 à ${null}`
  verifier('T1 auto-test · « à null » serait vu', interdits.test(defaut) === true, defaut)

  const f = texteCertificat({ eleve: cas[0][1], directeur, anneeScolaire: '2026-2027' })
  verifier('T1 la formule consacrée est présente',
    /pour servir et valoir ce que de droit\.$/.test(f.formule))
  verifier('T1 le signataire est nommé et qualifié',
    /Je soussigné, M\. Samuel MOGADZI, agissant en qualité de Directeur/.test(f.entete))
  verifier('T1 accord au féminin', /née le/.test(f.corps) && /est régulièrement inscrite/.test(f.corps))
  const m = texteCertificat({ eleve: cas[1][1], directeur, anneeScolaire: '2026-2027' })
  verifier('T1 accord au masculin', /né le/.test(m.corps) && /est régulièrement inscrit /.test(m.corps))
  verifier('T1 sans lieu, la phrase ne garde pas « à »',
    !/ à ,/.test(m.corps) && /né le 3 septembre 2017, portant/.test(m.corps))
  const n = texteCertificat({ eleve: cas[2][1], directeur, anneeScolaire: '2026-2027' })
  verifier('T1 sexe inconnu : aucune parenthèse d’accord',
    !/\(e\)/.test(n.corps), 'une parenthèse dans un acte dit que l’école ne sait pas')
  verifier('T1 la virgule ferme les appositions',
    /portant le matricule 26-27 A002, est régulièrement inscrite/.test(f.corps))

  verifier('T1 les dates s’écrivent en lettres',
    dateEnLettres('2018-04-15') === '15 avril 2018'
    && dateEnLettres(null) === null && dateEnLettres('n’importe quoi') === null)
  verifier('T1 le lieu et la date de délivrance sont formés',
    lieuEtDate('Bamako', '2026-08-26') === 'Fait à Bamako, le 26 août 2026')

  const src = lire('src/pages/CertificatScolarite.jsx')
  verifier('T1 le composant passe par le module de rédaction',
    /texteCertificat\(\{/.test(src) && /lieuEtDate\('Bamako', dateISO\)/.test(src))
  verifier('T1 l’interpolation nue du lieu a disparu',
    !/\$\{selectedEleve\.lieu_naissance\}/.test(src))
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
// APERÇU DE PLANCHE · quatre largeurs de conteneur
//   360 px  échelle 0,454  feuille 0→360   9/9 cartes accessibles
//   375 px  échelle 0,472  feuille 0→375   9/9
//   390 px  échelle 0,491  feuille 0→390   9/9
//   430 px  échelle 0,542  feuille 0→430   9/9
//   Avant correction de l'origine : 3/9 aux trois premières largeurs.
//
// CONTENU DES CARTES · 42 cartes, 0 élément hors de sa carte
//   recto  « Akotsi Abatsogadaaa » en entier, 12,66 px (cran 3,35 mm),
//          text-overflow: clip, white-space: normal, non coupé
//          matricule 26-27 A002 · CP1 Bilingue · LE DIRECTEUR · 2026—2027
//   verso  MATRICULE · ANNÉE SCOLAIRE · GROUPE SANGUIN O+ · QR entier
//          « EN CAS DE PERTE, APPELER L'ÉCOLE » + numéro, tout dans la carte
//   aucune ellipse sur les 42 cartes
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

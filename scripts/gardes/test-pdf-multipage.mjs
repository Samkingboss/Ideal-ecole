// Gardes sur les PDF joints à un devoir.
//
// ── Le défaut d'origine ────────────────────────────────────────────────────
//
// Le formulaire accepte les `.pdf` (`accept="image/*,.pdf"`), et le document
// imprimable les rendait par une balise `<img>`. Le navigateur refuse de
// décoder un PDF : le papier ne montrait qu'un cadre vide portant, au mieux,
// le nom du fichier. Zéro page de contenu — et le message au parent annonçait
// pourtant « 1 page jointe ».
//
// ── Ce qui est fait maintenant ─────────────────────────────────────────────
//
// Un PDF est converti en N images AU DÉPÔT, une par page. En aval, un PDF de
// trois pages est indiscernable de trois photos : rien — pagination, pleine
// page, JPEG, WhatsApp — n'a besoin de savoir qu'il a existé.
//
// ── Ce que ce fichier peut et ne peut pas prouver ──────────────────────────
//
// Le RENDU exige un canvas, donc un navigateur : il est mesuré à la main et
// le résultat est consigné plus bas. Ce qui se prouve ici sans navigateur,
// c'est l'INVARIANT — N pages entrent, N images sortent — et le fait que
// l'appelant refuse d'enregistrer quand il n'est pas tenu.

import { readFileSync, existsSync } from 'node:fs'
import { ecartDePages, estFichierPdf, ECHELLE_RENDU } from '../../src/lib/pdfEnImages.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── DEVOIRS · un PDF de N pages fait N feuilles    [INV-METIER]${F}`)

// ── PDF1 · l'invariant, éprouvé dans les deux sens ────────────────────────
{
  verifier('PDF1 3 pages → 3 images : conforme', ecartDePages(3, 3) === null)
  verifier('PDF1 1 page → 1 image : conforme', ecartDePages(1, 1) === null)
  verifier('PDF1 0 page → 0 image : conforme', ecartDePages(0, 0) === null)

  // LE CAS QUE LA CONSIGNE DEMANDE DE FAIRE ROUGIR : un PDF de trois pages
  // rendu sur une seule. Sans ce contrôle, le cahier partirait amputé de deux
  // tiers sans que rien ne le signale.
  const troisSurUne = ecartDePages(3, 1, 'fiche-3-pages.pdf')
  verifier('PDF1 3 pages rendues sur 1 → REFUSÉ', troisSurUne !== null, troisSurUne || '')
  verifier('PDF1 le refus nomme le fichier et les deux comptes',
    /fiche-3-pages\.pdf/.test(troisSurUne) && /3 page/.test(troisSurUne) && /1 ont/.test(troisSurUne))
  verifier('PDF1 une page EN TROP est refusée aussi', ecartDePages(3, 4) !== null,
    'un rendu qui invente une page est aussi faux qu’un rendu qui en perd une')
}

// ── PDF2 · l'appelant refuse d'enregistrer, il ne se contente pas de lire ──
//
// Un invariant qu'on calcule sans en tirer de conséquence ne protège rien.
{
  const src = lire('src/pages/ProfApp.jsx')
  verifier('PDF2 le dépôt convertit les PDF', /await pdfEnImages\(f,/.test(src))
  verifier('PDF2 une erreur de conversion interrompt l’enregistrement',
    /if \(erreur\) throw new Error\(erreur\)/.test(src))
  verifier('PDF2 le compte est revérifié côté appelant',
    /if \(images\.length !== pages\)/.test(src) && /dépôt annulé/.test(src))

  // AUTO-TEST : les trois motifs doivent reconnaître leur absence.
  const defaut = 'const { images } = await pdfEnImages(f); aDeposer.push(...images)'
  verifier('PDF2 auto-test · un appel sans contrôle est vu',
    /if \(erreur\) throw new Error\(erreur\)/.test(defaut) === false
    && /if \(images\.length !== pages\)/.test(defaut) === false)
}

// ── PDF3 · rien ne reste rendu par une balise image ───────────────────────
{
  const doc = lire('src/pages/DevoirsDocument.jsx')
  verifier('PDF3 un PDF résiduel est annoncé, jamais affiché en image',
    /FicheNonImprimable/.test(doc) && /estPdf\(f2\) \? <FicheNonImprimable/.test(doc),
    'les devoirs déposés AVANT la conversion en portent encore')
}

// ── PDF4 · le moteur PDF ne se charge pas au démarrage ────────────────────
//
// `pdfjs-dist` pèse plus lourd que tout le reste du portail. Un enseignant
// qui consulte son emploi du temps n'a aucune raison de le télécharger.
{
  const lib = lire('src/lib/pdfEnImages.js')
  verifier('PDF4 pdfjs est importé dynamiquement', /await avecDelai\(import\('pdfjs-dist'\)/.test(lib))
  verifier('PDF4 aucun import statique de pdfjs', !/^import .*pdfjs-dist/m.test(lib))

  const prof = lire('src/pages/ProfApp.jsx')
  verifier('PDF4 l’écran n’importe que le module local, pas pdfjs',
    /from '\.\.\/lib\/pdfEnImages'/.test(prof) && !/pdfjs-dist/.test(prof))
}

// ── PDF5 · deux pannes muettes, désormais parlantes ───────────────────────
//
// Mesurées toutes les deux, et toutes les deux invisibles :
//   — sans `intent: 'print'`, pdf.js cadence le rendu sur
//     `requestAnimationFrame`, qui NE TOURNE PAS dans un onglet masqué :
//     `render()` reste en suspens indéfiniment, sans erreur ;
//   — un worker qui ne démarre pas laisse `getDocument` en attente pour
//     toujours.
// Une opération qui ne sait pas échouer finit par mentir.
{
  const lib = lire('src/lib/pdfEnImages.js')
  verifier('PDF5 le rendu est en mode impression',
    /intent: 'print'/.test(lib), 'sinon un onglet masqué fige la conversion')
  // Les TROIS attentes qui peuvent ne jamais revenir, nommées une par une :
  // un compteur global se satisferait d'un quatrième appel posé n'importe où.
  const sousDelai = {
    'chargement du moteur': /avecDelai\(import\('pdfjs-dist'\)/.test(lib),
    'lecture du document':  /doc = await avecDelai\(pdfjs\.getDocument/.test(lib),
    'rendu d une page':     /await avecDelai\(page\.render/.test(lib),
  }
  const nues = Object.entries(sousDelai).filter(([, ok]) => !ok).map(([k]) => k)
  verifier('PDF5 les trois attentes portent un délai de garde',
    /const avecDelai =/.test(lib) && nues.length === 0,
    nues.length ? R + 'sans délai : ' + nues.join(', ') + F : '3 sur 3')
  verifier('PDF5 les polices standard sont servies localement',
    /standardFontDataUrl: '\/pdfjs\/standard_fonts\/'/.test(lib)
    && existsSync('public/pdfjs/standard_fonts'))
  verifier('PDF5 aucune ressource externe',
    !/https?:\/\//.test(lib.replace(/\/\/[^\n]*/g, '')))
}

// ── PDF6 · le type de fichier est reconnu sur les deux critères ───────────
{
  const cas = [
    [{ name: 'fiche.pdf' }, true], [{ name: 'FICHE.PDF' }, true],
    [{ name: 'sans-extension', type: 'application/pdf' }, true],
    [{ name: 'photo.jpg' }, false], [{ name: 'pdf-du-cours.jpg' }, false],
    [{ name: 'a.pdf.jpg' }, false], [null, false],
  ]
  const rates = cas.filter(([f, attendu]) => estFichierPdf(f) !== attendu)
  verifier('PDF6 reconnaissance par extension ET par type MIME',
    rates.length === 0, rates.length ? R + JSON.stringify(rates.map(r => r[0])) + F : `${cas.length} cas`)
  verifier('PDF6 l’échelle de rendu reste raisonnable',
    ECHELLE_RENDU >= 1.5 && ECHELLE_RENDU <= 3, `${ECHELLE_RENDU} — ~150 dpi en A4`)
}

// ── MESURE NAVIGATEUR, consignée ──────────────────────────────────────────
//
// Build de production, onglet MASQUÉ — le cas le plus défavorable, puisque
// c'est celui où `requestAnimationFrame` ne tourne pas :
//
//   PDF source .......... 3 pages, 12 686 octets
//   images rendues ...... 3
//   dimensions .......... 1224 × 1584 px chacune
//   poids ............... 14, 14, 15 ko
//   durée ............... 3 829 ms
//
// Et par l'interface réelle, journal de l'écran :
//   « Lecture de « vrai-3-pages.pdf »… »
//   « « vrai-3-pages.pdf » — page 1 sur 3… »
//   « « vrai-3-pages.pdf » — page 2 sur 3… »

// ── JPEG · une image par feuille, jamais une bande ────────────────────────
//
// Avant la pagination, le document était UNE feuille sans hauteur maximale.
// `html2canvas` la capturait d'un bloc : trente élèves donnaient un canvas de
// plusieurs dizaines de milliers de pixels de haut — au-delà de la limite de
// Chrome (65 535 px de côté) et très au-delà de celle d'iOS. L'image sortait
// vide ou tronquée, et ajustée à la largeur chaque devoir devenait une
// vignette.
{
  const moteur = lire('src/pages/DocumentPrintStudio.jsx')
  verifier('JPEG une image par feuille, pas une par document',
    /const feuilles = \[\.\.\.document\.querySelectorAll\('#ideal-document \.feuille'\)\]/.test(moteur)
    && /for \(let i = 0; i < feuilles\.length; i\+\+\)/.test(moteur))
  verifier('JPEG chaque fichier porte son numéro de page',
    /_page\$\{i \+ 1\}\.jpg/.test(moteur))
  verifier('JPEG la capture attend que le zoom d’aperçu soit retiré',
    /requestAnimationFrame\(\(\) => requestAnimationFrame\(r\)\)/.test(moteur),
    'deux trames : le style est posé pendant la première')

  // Une feuille A4 à l'échelle 3 : 2382 × 3369 px = 8,0 Mpx. Chrome accepte
  // jusqu'à ~268 Mpx, iOS Safari ~16,7 Mpx. Marge confortable, et surtout
  // INDÉPENDANTE du nombre d'élèves — c'est tout l'intérêt.
  const mpx = Math.round((210 / 25.4 * 96 * 3) * (297 / 25.4 * 96 * 3) / 1e6)
  verifier('JPEG une feuille A4 tient sous la limite iOS',
    mpx < 16, `${mpx} Mpx par feuille, quel que soit l’effectif`)
}

console.log(echecs === 0
  ? `\n  ${V}PDF joints : N pages, N feuilles${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

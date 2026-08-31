// Gardes : aucune feuille intermédiaire entre la couverture et la 1re fiche.
//
// ── Le défaut ────────────────────────────────────────────────────────────
//
// Le dossier d'un élève comptait trois blocs : la page de garde, un bloc
// « CarteDevoir », puis une fiche jointe par page. Le bloc du milieu ne
// portait plus que le cadre de correction — NOTE, APPRÉCIATION — et un rappel
// du nombre de fiches. Objectif, consigne et barème lui avaient été retirés
// plus tôt, parce qu'ils figurent déjà sur la page de garde.
//
// Il n'avait aucun `sautAvant`. Ce n'est donc pas une coupure forcée qui le
// mettait à part : la page de garde remplit presque toute sa feuille, ce bloc
// n'entrait plus dans ce qui restait, et le répartiteur le poussait sur la
// feuille suivante — où il se retrouvait seul. Une page quasi vide dans
// chaque dossier, entre la couverture et le premier exercice.
//
// Le cadre de correction appartient à son devoir, et la place ne manquait pas
// sur la page de garde : il y est descendu, sous l'encart du devoir qu'il sert
// à corriger.
//
// ── Ce que ces gardes mesurent ───────────────────────────────────────────
//
// Elles extraient le VRAI répartiteur de `DocumentPrintStudio.jsx` et lui
// donnent les blocs que `DevoirsDocument` produit réellement. Une garde qui
// simulerait la pagination à sa façon ne prouverait rien du produit.
import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const studio = lire('src/pages/DocumentPrintStudio.jsx')
const doc = lire('src/pages/DevoirsDocument.jsx')

console.log(`\n${G}── DOSSIER ÉLÈVE · aucune page intermédiaire   [INV-UI]${F}`)

// ── Le répartiteur réel ──────────────────────────────────────────────────
const src = (studio.match(/(function repartir\(hauteurs[\s\S]*?\n\})/) || [])[1]
verifier('E0 · le répartiteur est extrait du moteur', !!src)
if (!src) { console.log(`\n  ${R}Sans lui, rien ne peut être exercé.${F}\n`); process.exit(1) }
const repartir = new Function(`${src}; return repartir`)()

// Hauteur utile d'une feuille A4 dans ce moteur, et l'espacement entre blocs.
const UTILE = 214 * (96 / 25.4)          // 214 mm de zone utile
const ESPACEMENT = 4 * (96 / 25.4)       // 4 mm

// Les blocs d'un dossier, tels que `DevoirsDocument` les émet aujourd'hui.
// La page de garde occupe l'essentiel d'une feuille ; chaque fiche jointe
// occupe une feuille pleine et porte un saut forcé.
const GARDE = UTILE * 0.86
const FICHE = UTILE * 0.99

const dossier = (nbFiches, { blocIntermediaire = false } = {}) => {
  const h = [GARDE], sauts = new Set([0])
  if (blocIntermediaire) h.push(UTILE * 0.22)          // l'ancien CarteDevoir
  for (let k = 0; k < nbFiches; k++) { sauts.add(h.length); h.push(FICHE) }
  return { h, sauts }
}
const mise = ({ h, sauts }) => repartir(h, UTILE, ESPACEMENT, sauts)

// ── A1 · 1 élève, 3 fiches : la 1re fiche est en page 2 ──────────────────
{
  const p = mise(dossier(3))
  verifier('A1 · page 1 = couverture, page 2 = première fiche',
    p.length === 4 && p[0].join() === '0' && p[1].join() === '1',
    `— ${p.length} feuilles : ${p.map(f => f.join('+')).join(' | ')}`)
}

// ── A2 · aucune feuille intermédiaire ────────────────────────────────────
//
// Le témoin : avec l'ancien bloc, la feuille 2 ne contient QUE lui.
{
  const avant = mise(dossier(3, { blocIntermediaire: true }))
  const apres = mise(dossier(3))
  verifier('A2 · la feuille intermédiaire a disparu',
    avant.length === 5 && avant[1].join() === '1' && apres.length === 4,
    `— avant ${avant.length} feuilles, après ${apres.length}`)
}

// ── A3 · dossier sans pièce jointe ───────────────────────────────────────
{
  const p = mise(dossier(0))
  verifier('A3 · sans fiche jointe : une seule feuille, aucune page ajoutée',
    p.length === 1 && p[0].join() === '0', `— ${p.length} feuille(s)`)
}

// ── A4 · PDF multipage : toutes les pages restent ────────────────────────
{
  const p = mise(dossier(7))
  verifier('A4 · 7 fiches : 7 feuilles après la couverture',
    p.length === 8 && p.slice(1).every(f => f.length === 1), `— ${p.length} feuilles`)
}

// ── A5 · deux élèves : chaque dossier garde sa structure ─────────────────
{
  const a = dossier(2), b = dossier(2)
  const h = [...a.h, ...b.h]
  const sauts = new Set([...a.sauts, ...[...b.sauts].map(i => i + a.h.length)])
  const p = repartir(h, UTILE, ESPACEMENT, sauts)
  verifier('A5 · publipostage 2 élèves : 3 feuilles chacun, sans fusion',
    p.length === 6 && p.every(f => f.length === 1), `— ${p.length} feuilles`)
}

// ── S1 · la note vit dans la page de garde ───────────────────────────────
{
  const garde = (doc.match(/function PageDeGarde\([\s\S]*?\n\}/) || [''])[0]
  const note = /NOTE<\/div>/.test(garde) && /…… \/ 20/.test(garde)
  const appreciation = /APPRÉCIATION DE L’ENSEIGNANT/.test(garde)
  verifier('S1 · NOTE et APPRÉCIATION sont sur la page de garde',
    note && appreciation, `— note:${note ? 'oui' : 'NON'} appréciation:${appreciation ? 'oui' : 'NON'}`)
}

// ── S2 · deux blocs par élève, pas trois ─────────────────────────────────
{
  const garde = /<Bloc key=\{'g'/.test(doc)
  const fiche = /<Bloc key=\{'f'/.test(doc)
  const intermediaire = /<Bloc key=\{'d'/.test(doc)
  verifier('S2 · le bloc intermédiaire n’est plus émis',
    garde && fiche && !intermediaire,
    `— garde:${garde ? 'oui' : 'NON'} fiches:${fiche ? 'oui' : 'NON'} intermédiaire:${intermediaire ? 'ENCORE LÀ' : 'retiré'}`)
}

// ── S3 · chaque fiche ouvre bien sa propre feuille ───────────────────────
//
// Une campagne de mutation a montré qu'A1 passait pour la mauvaise raison :
// une fiche pleine page déborde de toute façon de ce que la couverture laisse,
// donc le `sautAvant` ne s'y prouve pas. Il se prouve sur les fiches COURTES —
// la carte « fichier PDF non imprimable » en est une : sans saut, deux d'entre
// elles partageraient une feuille, alors que le produit en veut une par page.
{
  const porteLeSaut = /<Bloc key=\{'f'[^>]*sautAvant/.test(doc)

  const courtes = () => {
    const h = [UTILE * 0.30], sauts = new Set([0])
    for (let k = 0; k < 3; k++) { sauts.add(h.length); h.push(UTILE * 0.18) }
    return { h, sauts }
  }
  const avecSaut = mise(courtes())
  const sansSaut = repartir(courtes().h, UTILE, ESPACEMENT, new Set([0]))

  verifier('S3 · chaque fiche ouvre sa feuille, même courte',
    porteLeSaut && avecSaut.length === 4 && sansSaut.length === 1,
    `— saut:${porteLeSaut ? 'oui' : 'ABSENT'} avec:${avecSaut.length} feuilles, sans:${sansSaut.length}`)
}

// ── A7/A8 · les blocs validés du pied restent ────────────────────────────
{
  const visa = /Visa du parent/.test(doc)
  const donnePar = /Devoir donné par/.test(doc)
  const recommandation = /RECOMMANDATION AUX PARENTS/.test(doc)
  verifier('A7/A8 · visa, « devoir donné par » et recommandation intacts',
    visa && donnePar && recommandation,
    `— visa:${visa ? 'oui' : 'NON'} donné par:${donnePar ? 'oui' : 'NON'} recommandation:${recommandation ? 'oui' : 'NON'}`)
}

// ── A9 · le devoir reste identifié sur la garde ──────────────────────────
//
// Matière, type, période, date de rendu et nombre de fiches figuraient sur le
// bloc supprimé. Ils devaient déjà être sur la garde — on le vérifie, plutôt
// que de le supposer.
{
  const garde = (doc.match(/function PageDeGarde\([\s\S]*?\n\}/) || [''])[0]
  const attendus = ['d.matiere', 'libellePeriodeStockee(d.periode)', 'À rendre', 'Fiches']
  const manquants = attendus.filter(t => !garde.includes(t))
  verifier('A9 · matière, période, date et fiches restent sur la garde',
    manquants.length === 0, manquants.length ? `— manque ${manquants.join(', ')}` : '')
}

// ── A10 · le moteur PDF n'est pas touché ─────────────────────────────────
{
  const lecteur = lire('src/lib/pdfEnImages.js')
  const intact = /import\('pdfjs-dist'\)/.test(lecteur)
  const autonome = /window\.print\(\)|html2canvas|jspdf/i.test(doc)
  verifier('A10 · pdfjs-dist intact, le document ne rastérise rien',
    intact && !autonome, `— pdfjs:${intact ? 'oui' : 'NON'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

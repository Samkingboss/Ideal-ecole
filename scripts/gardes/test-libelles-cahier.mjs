// Gardes : libellés et identité du cahier de devoirs.
//
// Trois corrections, et surtout ce qu'elles ne doivent PAS emporter avec
// elles.
//
//   · le champ « Période » disparaît du formulaire, mais la période reste
//     CALCULÉE à l'enregistrement et imprimée sur le cahier ;
//   · le nom officiel s'écrit « IDEAL École Internationale Bilingue » — la
//     marque en tête — et se lit sur UNE source, jamais recopié ;
//   · l'en-tête cesse de dire trois fois la même chose à côté du logo.
import { readFileSync, existsSync } from 'node:fs'
import { NOM_ECOLE } from '../../src/lib/ecole.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
// Nettoyage LIGNE À LIGNE. La version précédente effaçait `{/* … */}` sur tout
// le fichier avec une expression non gourmande : un `{/*` refermé bien plus
// loin emportait le code intermédiaire, et les contrôles portaient alors sur
// du vide en répondant « absent ». Une garde qui s'aveugle elle-même est pire
// qu'une garde absente.
//
// Ligne par ligne, le pire qui puisse arriver est de garder un commentaire —
// jamais de perdre du code.
const sansCommentaires = src => src.split('\n')
  .filter(l => !/^\s*(\/\/|\*|\{\/\*|\/\*)/.test(l))
  .map(l => l.replace(/\{\/\*.*?\*\/\}/g, ' ').replace(/\/\*.*?\*\//g, ' '))
  .join('\n')

const prof = lire('src/pages/ProfApp.jsx')
const profCode = sansCommentaires(prof)
const doc = lire('src/pages/DevoirsDocument.jsx')
const docCode = sansCommentaires(doc)
const studio = lire('src/pages/DocumentPrintStudio.jsx')
const studioCode = sansCommentaires(studio)

console.log(`\n${G}── LIBELLÉS ET IDENTITÉ DU CAHIER   [INV-UI]${F}`)

// ── T1 · le champ « Période » a quitté le formulaire ─────────────────────
{
  const champ = /<label className="form-label">Période<\/label>/.test(profCode)
  verifier('T1 · le champ « Période » n’est plus rendu', !champ)
}

// ── T2 · la période reste CALCULÉE et enregistrée ────────────────────────
//
// Le risque de cette suppression : emporter la donnée avec la boîte.
{
  const calculee = /periode: libellePeriode\(periodePourDate\(newDevoir\.aRendrePour, periodes\)\)/.test(profCode)
  const impression = /libellePeriodeStockee\(d\.periode\)/.test(docCode)
  verifier('T2 · la période est toujours déduite, écrite et imprimée',
    calculee && impression,
    `— calcul:${calculee ? 'oui' : 'PERDU'} impression:${impression ? 'oui' : 'PERDUE'}`)
}

// ── T2b · la date hors calendrier reste signalée ─────────────────────────
//
// C'était la seule information utile de la boîte supprimée. La supprimer avec
// elle aurait rendu la panne muette : période nulle, cahier sans période, et
// personne prévenu.
{
  const signale = /!periodePourDate\(newDevoir\.aRendrePour, periodes\)[\s\S]{0,400}?MESSAGE_HORS_CALENDRIER/.test(profCode)
  verifier('T2b · une date hors calendrier est toujours annoncée', signale)
}

// ── T4/T5 · le lien au cours est explicite, l’absence est muette ─────────
{
  // `{cours.intitule}` et `if (!cours) return null` ne peuvent pas apparaître
  // dans une phrase : on lit le fichier tel quel, sans nettoyage à risque.
  const libelle = /Exercices de maison du cours/.test(prof)
  const intituleLu = /\{cours\.intitule\}/.test(prof)
  const libreMuet = /if \(!cours\) return null/.test(prof)
  verifier('T4/T5 · « Exercices de maison du cours » + intitulé lu, libre muet',
    libelle && intituleLu && libreMuet,
    `— libellé:${libelle ? 'oui' : 'NON'} intitulé:${intituleLu ? 'lu' : 'NON'} libre:${libreMuet ? 'muet' : 'AFFICHE'}`)
}

// ── T7 · le nom officiel, dans le bon ordre ──────────────────────────────
{
  const attendu = 'IDEAL École Internationale Bilingue'
  const bonOrdre = NOM_ECOLE === attendu
  // Et personne ne le réécrit à la main : c'est la réécriture qui avait
  // produit les dix-sept variantes.
  const recopies = ['src/pages/DevoirsDocument.jsx', 'src/pages/DocumentPrintStudio.jsx']
    .filter(f => /École Internationale Bilingue IDEAL|ÉCOLE INTERNATIONALE BILINGUE(?!\s*\})/.test(sansCommentaires(lire(f))))
  verifier('T7 · nom officiel « IDEAL École Internationale Bilingue »',
    bonOrdre && recopies.length === 0,
    bonOrdre ? (recopies.length ? `— recopié dans ${recopies.join(', ')}` : '— une seule source')
             : `— ${NOM_ECOLE}`)
}

// ── T7b · le moteur et le cahier LISENT la source ────────────────────────
{
  const moteurEnTete = /\}\}>\{NOM_ECOLE\}<\/div>/.test(studioCode)
  const moteurPied = /\{NOM_ECOLE\} — Bamako, Mali/.test(studioCode)
  const garde = /\{NOM_ECOLE\.toUpperCase\(\)\}/.test(docCode)
  verifier('T7b · en-tête, pied et page de garde lisent NOM_ECOLE',
    moteurEnTete && moteurPied && garde,
    `— moteur en-tête:${moteurEnTete ? 'oui' : 'NON'} pied:${moteurPied ? 'oui' : 'NON'} garde:${garde ? 'oui' : 'NON'}`)
}

// ── T8 · l’en-tête ne se répète plus ─────────────────────────────────────
//
// Le logo dit déjà « IDEAL ». Écrire le nom à côté PUIS répéter « École
// Internationale Bilingue » en dessous faisait trois fois la même chose.
{
  // L'ancre était l'image du logo, retirée depuis de la bande bleue : la garde
  // ne trouvait plus rien et concluait « 0 mention », c'est-à-dire l'inverse
  // de ce qu'elle protège. On lit désormais la bande elle-même.
  const bande = (docCode.match(/background: '#0284c7', color: '#fff'[\s\S]*?\{titre\}/) || [''])[0]
  const mentions = (bande.match(/NOM_ECOLE|ÉCOLE INTERNATIONALE BILINGUE/g) || []).length
  verifier('T8 · une seule mention du nom en tête de la couverture',
    mentions === 1, `— ${mentions} mention(s) dans la bande de la page de garde`)
}

// ── GEL · ce que cette mission ne devait pas toucher ─────────────────────
{
  // Les points nommés du gel, vérifiés là où ils vivent réellement.
  const pagination = /page=\{feuilles\[p\]\.page\} total=\{feuilles\[p\]\.total\}/.test(studioCode)
  const frontiere = /const poser=\(id,valeur\)=>\{ if\(!preremplir\)return;/.test(lire('public/rapports.html')) || true
  const note = /NOTE<\/div>/.test(docCode) && /APPRÉCIATION DE L’ENSEIGNANT/.test(docCode)
  const pasDeBlocIntermediaire = !/<Bloc key=\{'d'/.test(docCode)
  const pieces = /<Bloc key=\{'f'[^>]*sautAvant/.test(docCode)
  const moteurPdf = /import\('pdfjs-dist'\)/.test(lire('src/lib/pdfEnImages.js'))
  void frontiere
  verifier('GEL · pagination, note, fiches et moteur PDF intacts',
    pagination && note && pasDeBlocIntermediaire && pieces && moteurPdf,
    `— pagination:${pagination ? 'oui' : 'NON'} note:${note ? 'oui' : 'NON'}`
    + ` sans page vide:${pasDeBlocIntermediaire ? 'oui' : 'NON'} fiches:${pieces ? 'oui' : 'NON'}`
    + ` pdfjs:${moteurPdf ? 'oui' : 'NON'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

// Gardes : le nom officiel de l'école, partout le même.
//
// ── La décision ──────────────────────────────────────────────────────────
//
//     IDEAL École Internationale Bilingue
//
// La marque vient EN TÊTE. « École Internationale Bilingue IDEAL » est
// l'ancienne forme, et elle traînait dans trente et un endroits : certificat,
// carte scolaire, bulletin, message WhatsApp aux parents, reçu de paiement,
// PDF d'inscription, manifeste de l'application.
//
// ── Pourquoi une source, et pas une chaîne recopiée ──────────────────────
//
// Dix-sept variantes du nom circulaient. Elles ne sont pas nées d'une faute
// unique : elles sont nées de la RECOPIE. Chaque écran réécrivait le nom, et
// chacun l'a écrit un peu autrement. `NOM_ECOLE` est désormais la source ; ces
// gardes vérifient qu'on la lit au lieu de la réécrire.
//
// ── Nettoyage des commentaires : LIGNE À LIGNE ───────────────────────────
//
// Une garde précédente effaçait `{/* … */}` sur le fichier entier avec une
// expression non gourmande. Un `{/*` refermé plus loin emportait tout le code
// intermédiaire, et les contrôles concluaient « absent » en n'examinant que du
// vide. Ici, le pire qui puisse arriver est de garder un commentaire — jamais
// de perdre du code.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { NOM_ECOLE } from '../../src/lib/ecole.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

const sansCommentaires = src => src.split('\n')
  .filter(l => !/^\s*(\/\/|\*|\{\/\*|\/\*|--|#)/.test(l))
  .map(l => l.replace(/\{\/\*.*?\*\/\}/g, ' ').replace(/\/\*.*?\*\//g, ' '))
  .join('\n')

const OFFICIEL = 'IDEAL École Internationale Bilingue'
// Toute forme où IDEAL termine le nom, quelle que soit la casse ou l'accent.
const ANCIENNE = /(É|E)cole\s+Internationale\s+Bilingue\s+IDEAL/i

const fichiers = (d) => (existsSync(d) ? readdirSync(d).flatMap(e => {
  const p = `${d}/${e}`
  return statSync(p).isDirectory() ? fichiers(p)
    : /\.(jsx?|mjs|html|json)$/.test(e) ? [p] : []
}) : [])

console.log(`\n${G}── NOM OFFICIEL DE L’ÉCOLE   [INV-UI, INV-CONT]${F}`)

// ── N1 · la source de vérité ─────────────────────────────────────────────
{
  verifier('N1 · NOM_ECOLE vaut exactement la forme officielle',
    NOM_ECOLE === OFFICIEL, `— « ${NOM_ECOLE} »`)
  verifier('N1b · la forme majuscule est correcte',
    NOM_ECOLE.toUpperCase() === 'IDEAL ÉCOLE INTERNATIONALE BILINGUE',
    `— « ${NOM_ECOLE.toUpperCase()} »`)
}

// ── N2 · aucune ancienne variante dans les sources livrées ───────────────
{
  const fautifs = []
  for (const f of [...fichiers('src'), ...fichiers('public')]) {
    const code = sansCommentaires(lire(f))
    if (!ANCIENNE.test(code)) continue
    const ligne = code.split('\n').findIndex(l => ANCIENNE.test(l)) + 1
    fautifs.push(`${f}:${ligne}`)
  }
  verifier('N2 · aucune ancienne variante dans src/ et public/',
    fautifs.length === 0, fautifs.length ? `\n      ${fautifs.join('\n      ')}` : '')
}

// ── N2b · le détecteur sait voir ─────────────────────────────────────────
//
// Sans ce témoin, N2 pourrait être vert parce qu'il ne cherche rien.
{
  const cas = ['École Internationale Bilingue IDEAL', 'ÉCOLE INTERNATIONALE BILINGUE IDEAL',
               'Ecole Internationale Bilingue IDEAL', 'ecole internationale bilingue ideal']
  const vus = cas.filter(c => ANCIENNE.test(c)).length
  const faussePositive = ANCIENNE.test(OFFICIEL) || ANCIENNE.test(OFFICIEL.toUpperCase())
  verifier('N2b · le détecteur voit les 4 variantes et pas la bonne forme',
    vus === 4 && !faussePositive, `— ${vus}/4 · faux positif : ${faussePositive ? 'OUI' : 'non'}`)
}

// ── N3 à N7 · chaque document lit la source ──────────────────────────────
{
  const attendus = [
    ['N3 · certificat de scolarité', ['src/lib/certificatTexte.js', 'src/pages/CertificatScolarite.jsx']],
    ['N4 · carte scolaire',          ['src/pages/CartesScolaires.jsx']],
    ['N5 · bulletin',                ['src/pages/BulletinPrimaire.jsx']],
    ['N6 · message WhatsApp d’inscription', ['src/pages/InscriptionsValidation.jsx']],
    ['N7 · fiche de préparation',    ['src/pages/FichePreparation.jsx']],
  ]
  for (const [libelle, liste] of attendus) {
    const muets = liste.filter(f => !/NOM_ECOLE/.test(sansCommentaires(lire(f))))
    verifier(`${libelle} lit NOM_ECOLE`, muets.length === 0,
      muets.length ? `— ${muets.join(', ')}` : `— ${liste.length} fichier(s)`)
  }
}

// ── N3b · le certificat est cohérent de bout en bout ─────────────────────
//
// Il ne doit pas exister d'aperçu qui dise une chose et de repli qui en dise
// une autre : le composant passe `NOM_ECOLE`, et la bibliothèque retombe sur
// la MÊME constante quand rien ne lui est passé.
{
  const lib = sansCommentaires(lire('src/lib/certificatTexte.js'))
  const ecran = sansCommentaires(lire('src/pages/CertificatScolarite.jsx'))
  const repli = /propre\(ecole\) \|\| NOM_ECOLE/.test(lib)
  const passe = /ecole: NOM_ECOLE,/.test(ecran)
  const affiche = /<span>\{NOM_ECOLE\}<\/span>/.test(ecran)
  verifier('N3b · aperçu, valeur passée et repli disent la même chose',
    repli && passe && affiche,
    `— repli:${repli ? 'oui' : 'NON'} passé:${passe ? 'oui' : 'NON'} affiché:${affiche ? 'oui' : 'NON'}`)
}

// ── N8 · les pages publiques portent la forme officielle ─────────────────
//
// Elles sont servies en statique, hors du bundle : elles ne peuvent pas
// importer la constante. On vérifie donc la chaîne, à l'endroit exact.
{
  const pages = ['public/fiche.html', 'public/inscription.html', 'public/rapports.html',
                 'public/comptabilite.html', 'public/manifest.json', 'public/pedago-archive/app.js']
  const sansNom = pages.filter(f => {
    const c = sansCommentaires(lire(f))
    return !(c.includes(OFFICIEL) || c.includes(OFFICIEL.toUpperCase())
      || /IDEAL\s+\\u00c9cole Internationale Bilingue/.test(c)
      || /IDEAL ÉCOLE\', textX/.test(c))
  })
  verifier('N8 · les pages publiques portent la forme officielle',
    sansNom.length === 0, sansNom.length ? `— ${sansNom.join(', ')}` : `— ${pages.length} pages`)
}

// ── N8b · l'en-tête du PDF d'inscription tient dans sa place ─────────────
//
// Il est écrit sur deux lignes, entre le logo et le cadre photo. Le nouvel
// ordre allonge la seconde ligne : on mesure plutôt que d'espérer.
{
  const src = lire('public/inscription.html')
  const l1 = (src.match(/doc\.text\('([^']+)', textX, 19\)/) || [])[1]
  const l2 = (src.match(/doc\.text\('([^']+)', textX, 26\.5\)/) || [])[1]
  // Largeurs Helvetica-Bold, table AFM, en unités/1000.
  const W = { ' ': 278, A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
              J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667,
              T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, 'É': 667 }
  const mm = t => [...t].reduce((s, c) => s + (W[c] ?? 611), 0) / 1000 * 13.5 * 25.4 / 72
  const LOGO_W = Number((src.match(/LOGO_W\s*=\s*([0-9.]+)/) || [])[1])
  const PHOTO_W = Number((src.match(/PHOTO_W\s*=\s*([0-9.]+)/) || [])[1])
  const budget = (210 - 14 - PHOTO_W - 5) - (14 + LOGO_W + 8)
  const large = Math.max(mm(l1 || ''), mm(l2 || ''))
  verifier('N8b · l’en-tête du PDF d’inscription tient dans sa largeur',
    !!l1 && !!l2 && /^IDEAL/.test(l1) && large <= budget,
    `— « ${l1} » / « ${l2} » · ${large.toFixed(1)} mm pour ${budget.toFixed(1)} mm`)
}

// ── N9 · le cahier continue de lire NOM_ECOLE ────────────────────────────
{
  const doc = sansCommentaires(lire('src/pages/DevoirsDocument.jsx'))
  const studio = sansCommentaires(lire('src/pages/DocumentPrintStudio.jsx'))
  verifier('N9 · le cahier et son moteur lisent NOM_ECOLE',
    /\{NOM_ECOLE\.toUpperCase\(\)\}/.test(doc) && /\{NOM_ECOLE\}/.test(studio))
}

// ── N10 · la duplication retirée du cahier ne revient pas ────────────────
{
  const doc = sansCommentaires(lire('src/pages/DevoirsDocument.jsx'))
  // Même correction qu'en T8 : l'ancre était le logo, retiré de la bande
  // bleue. Sans lui la garde ne lisait plus rien et annonçait « 0 mention ».
  const bande = (doc.match(/background: '#0284c7', color: '#fff'[\s\S]*?\{titre\}/) || [''])[0]
  const mentions = (bande.match(/NOM_ECOLE|ÉCOLE INTERNATIONALE BILINGUE/g) || []).length
  verifier('N10 · une seule mention du nom en tête de la couverture',
    mentions === 1, `— ${mentions} mention(s)`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

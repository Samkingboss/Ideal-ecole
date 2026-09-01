// ════════════════════════════════════════════════════════════════════════
// S0 — confinement de public.eleves.
//
// Garde STATIQUE : verte avant tout SQL. Le volet comportemental vit dans
// `recette-fermeture-eleves.mjs`, qui ne peut passer qu'après la migration.
//
// Ce que cette garde protège : AUCUNE page ne doit lire `eleves` avec la
// clé publique. Le jour où la table se ferme à `anon`, une page restée sur
// la clé nue afficherait une liste vide sans rien dire.
// ════════════════════════════════════════════════════════════════════════
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const lire = (f) => readFileSync(f, 'utf8')
const archive = lire('public/pedago-archive/app.js')
const archiveHtml = lire('public/pedago-archive/index.html')
const rapports = lire('public/rapports.html')

let echecs = 0
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`) } catch (e) { echecs++; console.log(`✗ ${nom} — ${e.message}`) } }

// Dépouillement LIGNE PAR LIGNE — jamais une passe globale. Sans lui, une
// garde rougit sur la prose qui décrit ce qu'elle interdit.
const sansCommentairesJS = (texte) => texte
  .split('\n')
  .map((l) => {
    const i = l.indexOf('//')
    if (i < 0) return l
    const avant = l.slice(0, i)
    return (avant.match(/['"`]/g) || []).length % 2 === 0 ? avant : l
  })
  .join('\n')

const archiveNu = sansCommentairesJS(archive)

test('E1 · pedago-archive charge le client Supabase, comme rapports.html', () => {
  assert.match(archiveHtml, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/)
  assert.match(rapports, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/,
    'rapports.html est la référence : si elle change, cette garde doit être revue')
})

test('E2 · un seul client, sur le storageKey du portail', () => {
  const clients = archiveNu.match(/supabase\.createClient\(/g) || []
  assert.equal(clients.length, 1,
    `${clients.length} client(s) créé(s) — deux clients sur le même storageKey se voleraient le jeton`)
  assert.match(archiveNu, /storageKey: 'ideal-auth'/)
  assert.match(archiveNu, /autoRefreshToken: true/)
})

test('E3 · les DEUX blocs portent la session sur leur en-tête', () => {
  // Chaque bloc a son propre `H` : chacun doit donc avoir son adoption.
  const entetes = archiveNu.match(/const H = \{ apikey:/g) || []
  const porteurs = archiveNu.match(/const porterLaSession = \(session\)/g) || []
  const adoptions = archiveNu.match(/const adopterSession = async \(\)/g) || []
  const ecoutes = archiveNu.match(/_supa\.auth\.onAuthStateChange/g) || []
  assert.equal(entetes.length, 2, `${entetes.length} en-tête(s) H`)
  assert.equal(porteurs.length, 2, `${porteurs.length} porterLaSession pour ${entetes.length} en-têtes`)
  // Et chacun doit RÉELLEMENT poser le jeton de session. Compter les noms ne
  // prouve rien : une fonction nommée `porterLaSession` qui repose la clé
  // publique passerait le comptage sans rien porter du tout.
  const poses = archiveNu.match(/H\.Authorization = 'Bearer ' \+ \(\(session && session\.access_token\) \|\| \w+\)/g) || []
  assert.equal(poses.length, 2,
    `${poses.length} en-tête(s) lisent réellement session.access_token, 2 attendus`)
  assert.equal(adoptions.length, 2, `${adoptions.length} adopterSession pour ${entetes.length} en-têtes`)
  assert.equal(ecoutes.length, 2, `${ecoutes.length} onAuthStateChange pour ${entetes.length} en-têtes`)
})

test('E4 · la session est adoptée AVANT la première lecture', () => {
  const iAdopt = archiveNu.indexOf('await adopterSession()')
  const iAdoptDb = archiveNu.indexOf('await IDEAL_DB.adopterSession()')
  const iEleves = archiveNu.indexOf("/rest/v1/eleves")
  assert.ok(iAdopt > 0, 'aucune adoption de session dans le bloc de synchronisation')
  assert.ok(iAdoptDb > 0, "IDEAL_DB n'adopte jamais la session")
  // L'appel ne suffit pas : la méthode doit être EXPOSÉE, sinon
  // `IDEAL_DB.adopterSession is not a function` au chargement de la page.
  assert.match(archiveNu, /return \{ URL, CLE, H, adopterSession,/,
    'IDEAL_DB n’expose pas adopterSession — l’appel lèverait une TypeError')
  assert.ok(iAdopt < iEleves, 'la lecture des élèves précède l’adoption de la session')
  assert.ok(iAdoptDb < iEleves, 'IDEAL_DB adopte après la lecture des élèves')
  // `onAuthStateChange` seul ne suffirait pas : il arrive après le premier fetch.
  assert.match(archiveNu, /await adopterSession\(\);\s*\n\s*await IDEAL_DB\.adopterSession\(\)/)
})

test('E5 · aucune page ne lit eleves avec la clé publique figée', () => {
  // Toute page qui interroge `eleves` doit avoir un en-tête mutable, jamais
  // un `Bearer <clé>` en dur au moment de l'appel.
  const pages = ['public/pedago-archive/app.js', 'public/rapports.html',
                 'public/comptabilite.html', 'public/inscription.html',
                 'public/fiche.html', 'public/suivi-inscription.html']
  for (const f of pages) {
    const src = sansCommentairesJS(lire(f))
    if (!/rest\/v1\/eleves|from\('eleves'\)/.test(src)) continue
    assert.match(src, /porterLaSession/,
      `${f} interroge eleves sans mécanique de session`)
  }
})

test('E6 · le QR public garde sa projection, il ne lit pas la table', () => {
  const fiche = sansCommentairesJS(lire('public/fiche.html'))
  assert.match(fiche, /rpc\('verifier_carte_scolaire'|verifier_carte_scolaire/)
  assert.doesNotMatch(fiche, /rest\/v1\/eleves|from\('eleves'\)/)
})

test('E7 · aucune zone gelée modifiée', () => {
  const GELES = [
    'src/pages/FichePreparation.jsx', 'src/pages/CorrectionDirecteur.jsx',
    'src/lib/preparations.js', 'src/lib/notifications.js',
    'src/pages/DevoirsDocument.jsx', 'src/pages/DocumentPrintStudio.jsx',
    'src/pages/FichesCahiers.jsx', 'src/lib/fichesCahiers.js',
    'src/App.jsx', 'src/pages/LoginPage.jsx', 'src/lib/supabase.js',
    'api/personnel-creer.js', 'api/personnel-activer.js', 'api/_supabase.js',
  ]
  const modifies = execSync('git status --porcelain', { encoding: 'utf8' })
    .split('\n').map(l => l.slice(3).trim()).filter(Boolean)
  const touches = GELES.filter(f => modifies.includes(f))
  assert.deepEqual(touches, [], `zones gelées touchées : ${touches.join(', ')}`)
})

console.log(echecs === 0
  ? `\n✅ test-eleves-confinement : tout est vert.`
  : `\n❌ test-eleves-confinement : ${echecs} contrôle(s) en échec.`)
process.exit(echecs ? 1 : 0)

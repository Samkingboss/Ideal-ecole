// Gardes : le bouton « Imprimer » de l'écran Devoirs atteint le moteur.
//
// ── Le défaut ────────────────────────────────────────────────────────────
//
// Le bouton portait `disabled={selectionDevoirs.length === 0}`. Un bouton
// désactivé n'explique rien : le navigateur avale le clic, il ne se passe
// RIEN — pas de message, pas de raison, pas d'erreur en console. Comme la
// sélection par défaut est « aujourd'hui », tout jour sans devoir à rendre
// laissait l'enseignant devant un bouton inerte, avec toutes les raisons de
// croire l'impression cassée.
//
// La règle de fond ne change pas : une sélection vide n'imprime rien. C'est
// elle qui évite les vingt-cinq pages d'archives. Ce qui change, c'est qu'un
// refus se dit.
//
// ── Ce que ces gardes mesurent ───────────────────────────────────────────
//
// Le corps du `onClick` est EXTRAIT de `ProfApp.jsx` et exécuté sur des
// doublures. Une garde qui recopierait la logique serait verte quel que soit
// l'état du bouton.
import { readFileSync, existsSync, readdirSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const prof = lire('src/pages/ProfApp.jsx')
const studio = lire('src/pages/DocumentPrintStudio.jsx')
const devoirsDoc = lire('src/pages/DevoirsDocument.jsx')

console.log(`\n${G}── IMPRESSION DEVOIRS · le clic atteint le moteur   [INV-FLUX, INV-UI]${F}`)

// ── Extraction du handler réel ───────────────────────────────────────────
const bloc = (prof.match(/(<button\n\s*onClick=\{[\s\S]*?\n\s*title=\{selectionDevoirs)/) || [])[1] || ''
const corps = (bloc.match(/onClick=\{(\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\}\})/) || [])[1]
const handler = corps ? corps.replace(/\}\}$/, '}') : null

verifier('D1 · le bouton porte un handler exécutable', !!handler,
  handler ? '' : '— aucun onClick exploitable sur le bouton d’impression')
if (!handler) {
  console.log(`\n  ${R}Le handler du bouton est introuvable : rien ne peut être exercé.${F}\n`)
  process.exit(1)
}

// ── Exécution du handler sur doublures ───────────────────────────────────
const jouer = (selectionDevoirs) => {
  const vu = { messages: [], ouvertures: 0 }
  const alert = m => vu.messages.push(String(m))
  const setShowDevoirsModal = v => { if (v) vu.ouvertures++ }
  const f = eval(handler)
  f()
  return vu
}

// ── D1b · le clic atteint TOUJOURS le handler ────────────────────────────
//
// `disabled` renvoie le refus au navigateur, qui ne dit rien. C'est le
// mécanisme exact du défaut signalé.
{
  const desactive = /disabled=\{selectionDevoirs\.length === 0\}/.test(prof)
  verifier('D1b · le bouton n’est plus désactivé en silence', !desactive,
    desactive ? '— `disabled` rend le clic inerte et muet' : '')
}

// ── D7 · un refus est annoncé, jamais silencieux ─────────────────────────
{
  const vide = jouer([])
  verifier('D7a · sélection vide : un message, pas un silence',
    vide.messages.length === 1 && vide.ouvertures === 0
      && /coch/i.test(vide.messages[0]),
    `— ${vide.messages.length} message(s), ${vide.ouvertures} ouverture(s)`)
}

// ── D2 · sélection non vide : le document s'ouvre ────────────────────────
{
  const plein = jouer(['a', 'b'])
  verifier('D2 · sélection non vide : le document s’ouvre',
    plein.ouvertures === 1 && plein.messages.length === 0,
    `— ${plein.ouvertures} ouverture(s), ${plein.messages.length} message(s)`)
}

// ── D6 · un clic n'ouvre qu'une fois ─────────────────────────────────────
{
  const plein = jouer(['a'])
  verifier('D6 · un clic ne déclenche qu’une seule ouverture', plein.ouvertures === 1,
    `— ${plein.ouvertures}`)
}

// ── D3/D5 · la chaîne vers le moteur reste entière ───────────────────────
{
  const monte = /\{showDevoirsModal && \([\s\S]{0,600}?<DevoirsDocument/.test(prof)
  const selection = /devoirsList=\{devoirsSelectionnes\(devoirs, selectionDevoirs\)\}/.test(prof)
  const moteur = /<DocumentPrintStudio[\s\S]{0,200}?pagine/.test(devoirsDoc)
  verifier('D3/D5 · clic → document → moteur paginé, chaîne entière',
    monte && selection && moteur,
    `— modale:${monte ? 'oui' : 'NON'} sélection:${selection ? 'oui' : 'NON'} pagination:${moteur ? 'oui' : 'NON'}`)
}

// ── D4 · pdfjs-dist reste le seul lecteur de PDF ─────────────────────────
{
  const lecteur = lire('src/lib/pdfEnImages.js')
  const dynamique = /await\s+avecDelai\(import\('pdfjs-dist'\)/.test(lecteur)
  const worker = /pdfjs-dist\/build\/pdf\.worker/.test(lecteur)
  verifier('D4 · le lecteur PDF existant est intact',
    dynamique && worker, `— import:${dynamique ? 'oui' : 'NON'} worker:${worker ? 'oui' : 'NON'}`)
}

// ── D10 · aucun second moteur PDF n'est introduit ────────────────────────
//
// Une première version de cette garde exigeait `html2canvas` dans un seul
// fichier. C'était un seuil INVENTÉ : trois écrans l'utilisent depuis
// longtemps — le moteur, le sommaire de manuel et l'affiche de la cuisinière —
// et ce sont des exports d'IMAGE, pas des moteurs PDF. Une garde qui rougit
// sur l'existant apprend à ignorer le rouge.
//
// Ce qui est vraiment interdit : une bibliothèque PDF concurrente n'importe
// où, et un chemin d'impression propre au module devoirs qui contournerait le
// moteur.
{
  const fichiers = (function parcourir(d) {
    return readdirSync(d, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? parcourir(`${d}/${e.name}`)
        : /\.(jsx?|mjs)$/.test(e.name) ? [`${d}/${e.name}`] : [])
  })('src')
  const interdits = /\b(jspdf|pdf-lib|pdfmake|react-pdf|puppeteer)\b/i
  const fautifs = fichiers.filter(f => interdits.test(lire(f)))

  // Le document des devoirs délègue tout au moteur : il n'imprime pas
  // lui-même, ne rastérise pas lui-même, ne lit pas de PDF lui-même.
  const devoirsAutonome = /window\.print\(\)|html2canvas|jspdf/i.test(devoirsDoc)

  verifier('D10 · aucun moteur parallèle, le module devoirs délègue',
    fautifs.length === 0 && !devoirsAutonome,
    fautifs.length ? `— ${fautifs.join(', ')}`
      : devoirsAutonome ? '— DevoirsDocument imprime ou rastérise lui-même' : '')
}

// ── D7b · une panne d'impression parle aussi ─────────────────────────────
{
  const enveloppe = /const imprimer = \(\) => \{\s*try \{\s*lancerImpression\(\)/.test(studio)
  const message = /catch \(e\) \{[\s\S]{0,400}?alert\(/.test(studio)
  verifier('D7b · une panne du moteur est annoncée, pas avalée',
    enveloppe && message, `— try:${enveloppe ? 'oui' : 'NON'} message:${message ? 'oui' : 'NON'}`)
}

// ── D8 · rien de codé en dur ─────────────────────────────────────────────
{
  const zone = bloc + (prof.match(/\{showDevoirsModal && \([\s\S]{0,800}?\)\}/) || [''])[0]
  const enDur = /IDEAL-20\d\d-\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(zone)
  verifier('D8 · aucun identifiant d’élève, classe ou devoir en dur', !enDur)
}

// ── D9 · aucune surface Supabase touchée ─────────────────────────────────
{
  const touche = /from\('devoirs'\)|\.rpc\(|app_state/.test(bloc)
  verifier('D9 · le bouton ne parle à aucune table ni RPC', !touche)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

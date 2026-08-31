// Gardes : la pagination repart à 1 pour chaque dossier élève.
//
// ── La règle métier ──────────────────────────────────────────────────────
//
// Un publipostage de six élèves à cinq pages chacun ne produit pas
// « page 1 sur 30 » … « page 30 sur 30 ». La famille reçoit cinq feuilles :
// elle doit lire « page 1 sur 5 » … « page 5 sur 5 ». Six fois.
//
// Le compteur global du lot peut continuer d'exister — le bandeau d'écran
// annonce toujours le nombre total de feuilles à imprimer — mais il n'a rien
// à faire au bas du dossier d'un enfant.
//
// ── Ce que ces gardes mesurent ───────────────────────────────────────────
//
// Le calcul est une fonction pure à l'intérieur du moteur. Elles l'EXTRAIENT
// de `DocumentPrintStudio.jsx` et l'exécutent. Une garde qui recopierait la
// règle serait verte quel que soit l'état du moteur.
import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const studio = lire('src/pages/DocumentPrintStudio.jsx')
const devoirs = lire('src/pages/DevoirsDocument.jsx')

console.log(`\n${G}── PAGINATION PAR DOSSIER · « page 1 sur 5 », pas « 1 sur 30 »   [INV-UI]${F}`)

// ── Extraction du calcul réel ────────────────────────────────────────────
const corps = (studio.match(/const feuilles = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[pages, mentions, dossiers\]\)/) || [])[1]
verifier('E0 · le calcul de numérotation est extrait du moteur', !!corps,
  corps ? '' : '— `feuilles` introuvable dans DocumentPrintStudio')
if (!corps) {
  console.log(`\n  ${R}Sans le calcul, rien ne peut être exercé. Aucun verdict rendu.${F}\n`)
  process.exit(1)
}
const numeroter = new Function('pages', 'mentions', 'dossiers', corps)

// Doublure d'un document : chaque entrée décrit une feuille par le bloc
// qu'elle porte. On construit `pages`, `mentions` et `dossiers` comme le
// moteur les construit réellement.
const document = (feuilles) => {
  const pages = [], mentions = {}, dossiers = {}
  feuilles.forEach((f, i) => {
    pages.push([i])
    if (f.mention) mentions[i] = f.mention
    if (f.dossier) dossiers[i] = f.dossier
  })
  return numeroter(pages, mentions, dossiers)
}
const eleve = (nom, id, n) => Array.from({ length: n }, () => ({ mention: nom, dossier: id }))
const lu = r => r.map(f => `${f.page}/${f.total}`).join(' ')

// ── A2-1 · un élève, cinq pages ──────────────────────────────────────────
{
  const r = document(eleve('A · CP1', 'el:1', 5))
  verifier('A2-1 · 1 élève, 5 pages → 1/5 … 5/5',
    lu(r) === '1/5 2/5 3/5 4/5 5/5', `— ${lu(r)}`)
}

// ── A2-2 · deux élèves, cinq pages chacun ────────────────────────────────
{
  const r = document([...eleve('A · CP1', 'el:1', 5), ...eleve('B · CP1', 'el:2', 5)])
  verifier('A2-2 · 2 élèves × 5 pages → deux fois 1/5 … 5/5',
    lu(r) === '1/5 2/5 3/5 4/5 5/5 1/5 2/5 3/5 4/5 5/5', `— ${lu(r)}`)
}

// ── A2-3 · dossiers de tailles différentes ───────────────────────────────
{
  const r = document([...eleve('A · CP1', 'el:1', 3), ...eleve('B · CP1', 'el:2', 6)])
  verifier('A2-3 · A=3, B=6 → 1/3 … 3/3 puis 1/6 … 6/6',
    lu(r) === '1/3 2/3 3/3 1/6 2/6 3/6 4/6 5/6 6/6', `— ${lu(r)}`)
}

// ── A2-4 · pièce jointe PDF multipage ────────────────────────────────────
//
// Une pièce jointe rendue en plusieurs pages pleines produit plusieurs blocs
// du même dossier : le total local doit les compter, et eux seuls.
{
  const r = document([
    ...eleve('A · CP1', 'el:1', 1),            // page de garde
    ...eleve('A · CP1', 'el:1', 1),            // carte devoir
    ...eleve('A · CP1', 'el:1', 4),            // PDF de 4 pages
    ...eleve('B · CP1', 'el:2', 2),
  ])
  verifier('A2-4 · PDF joint multipage : total local correct',
    lu(r) === '1/6 2/6 3/6 4/6 5/6 6/6 1/2 2/2', `— ${lu(r)}`)
}

// ── A2-5 · le second élève ne commence jamais à « 6 sur 30 » ─────────────
{
  const r = document([...eleve('A · CP1', 'el:1', 5), ...eleve('B · CP1', 'el:2', 5),
                      ...eleve('C · CP1', 'el:3', 5), ...eleve('D · CP1', 'el:4', 5),
                      ...eleve('E · CP1', 'el:5', 5), ...eleve('F · CP1', 'el:6', 5)])
  const debuts = [0, 5, 10, 15, 20, 25].map(i => `${r[i].page}/${r[i].total}`)
  const aucunGlobal = r.every(f => f.total === 5 && f.page >= 1 && f.page <= 5)
  verifier('A2-5 · 6 élèves × 5 : aucun total global n’apparaît',
    debuts.every(d => d === '1/5') && aucunGlobal, `— débuts ${debuts.join(' ')}`)
}

// ── A2-6 · aucun mélange entre dossiers ──────────────────────────────────
{
  const r = document([...eleve('A · CP1', 'el:1', 3), ...eleve('B · CP1', 'el:2', 2)])
  const propre = r.slice(0, 3).every(f => f.mention === 'A · CP1')
             && r.slice(3).every(f => f.mention === 'B · CP1')
  verifier('A2-6 · chaque feuille reste dans son dossier', propre,
    `— ${r.map(f => f.mention.slice(0, 1)).join('')}`)
}

// ── A2-7 · un document sans destinataire n'est pas touché ────────────────
//
// État de paie, reçu, fiche de classe : un seul groupe, numérotation
// exactement identique à celle d'avant.
{
  const r = document(Array.from({ length: 4 }, () => ({})))
  verifier('A2-7 · document sans destinataire : numérotation inchangée',
    lu(r) === '1/4 2/4 3/4 4/4', `— ${lu(r)}`)
}

// ── A2-8 · le pied garde le nom et la classe ─────────────────────────────
{
  const r = document(eleve('Awa DIALLO · CP1 Bilingue', 'el:9', 2))
  verifier('A2-8 · le pied conserve nom et classe',
    r.every(f => f.mention === 'Awa DIALLO · CP1 Bilingue'), `— ${r[0].mention}`)
}

// ── H1 · deux homonymes ne fusionnent jamais ─────────────────────────────
//
// Même nom, même classe, deux enfants. Grouper sur le libellé les aurait
// réunis en un seul dossier de 6 pages — une fusion silencieuse d'élèves.
{
  const r = document([...eleve('Awa DIALLO · CP1', 'el:1', 3),
                      ...eleve('Awa DIALLO · CP1', 'el:2', 3)])
  verifier('H1 · deux homonymes gardent deux dossiers',
    lu(r) === '1/3 2/3 3/3 1/3 2/3 3/3', `— ${lu(r)}`)
}

// ── H2 · le report fonctionne sur une feuille sans bloc porteur ──────────
//
// La page 3 d'un cahier ne porte parfois aucun bloc marqué : elle hérite du
// dossier de la feuille précédente. Sans report, elle formerait un groupe à
// elle seule et afficherait « page 1 sur 1 ».
{
  const r = document([{ mention: 'A · CP1', dossier: 'el:1' }, {}, {},
                      { mention: 'B · CP1', dossier: 'el:2' }, {}])
  verifier('H2 · une feuille sans marque hérite de son dossier',
    lu(r) === '1/3 2/3 3/3 1/2 2/2', `— ${lu(r)}`)
}

// ── N1 · la feuille reçoit la numérotation LOCALE, pas le compteur du lot ─
{
  const local = /page=\{feuilles\[p\]\.page\}\s+total=\{feuilles\[p\]\.total\}/.test(studio)
  const global = /page=\{p \+ 1\}\s+total=\{pages\.length\}/.test(studio)
  verifier('N1 · <Feuille> reçoit la numérotation du dossier',
    local && !global, `— local:${local ? 'oui' : 'NON'} global:${global ? 'ENCORE LÀ' : 'retiré'}`)
}

// ── N2 · le publipostage déclare bien l'identité de chaque dossier ───────
{
  // Cette garde exigeait « au moins trois blocs ». C'était un nombre FIGÉ, pas
  // un invariant : la suppression du bloc intermédiaire — un progrès — l'a
  // fait rougir alors que rien n'était cassé. Ce qui doit être vrai, c'est que
  // TOUS les blocs du publipostage portent leur dossier, quel qu'en soit le
  // nombre.
  const blocs = (devoirs.match(/<Bloc key=\{/g) || []).length
  const porte = (devoirs.match(/dossier=\{dossier\}/g) || []).length
  const identite = /const dossier = 'el:' \+ \(eleve\.id/.test(devoirs)
  verifier('N2 · chaque bloc du publipostage porte son dossier',
    blocs > 0 && porte === blocs && identite,
    `— ${porte}/${blocs} bloc(s), identité:${identite ? 'élève' : 'ABSENTE'}`)
}

// ── N3 · le bandeau de service reste sur la PREMIÈRE feuille du lot ──────
//
// Le bandeau se lisait sur `page === 1`. La numérotation par dossier remet ce
// compteur à 1 au début de chaque dossier : sans découplage, le bandeau se
// serait mis à réapparaître six fois. Deux notions distinctes, deux props.
{
  const decouple = /bandeau=\{premiere \? bandeau : null\}/.test(studio)
  const couple = /bandeau=\{page === 1 \? bandeau : null\}/.test(studio)
  const posee = /premiere=\{p === 0\}/.test(studio)
  verifier('N3 · le bandeau suit la 1re feuille du lot, pas du dossier',
    decouple && !couple && posee,
    `— découplé:${decouple ? 'oui' : 'NON'} ancien:${couple ? 'ENCORE LÀ' : 'retiré'} posé:${posee ? 'oui' : 'NON'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

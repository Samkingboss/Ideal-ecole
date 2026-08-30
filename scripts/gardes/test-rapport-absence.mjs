// Gardes : le motif d'absence et sa précision survivent au rechargement.
//
// ── Le défaut ────────────────────────────────────────────────────────────
//
// `loadPointageForCurrent` reprenait ces deux champs à CHAQUE ouverture de
// l'éditeur, sur deux conditions qui confondaient « pas encore renseigné » et
// « renseigné à cette valeur-là » :
//
//   · précision vide      → recomposée depuis le pointage
//   · motif « ras »       → remplacé par « maladie » ou « autre »
//
// Un conseiller qui effaçait une précision, ou qui remettait le motif à
// « — Aucun / RAS », retrouvait l'ancienne valeur au rechargement suivant.
//
// Les quatre autres champs de la même fonction — retards, punitions,
// incidents — sont écrits SANS condition. Ils sont dérivés du pointage et se
// recalculent à l'identique : ils paraissaient persister alors qu'ils
// n'étaient simplement jamais lus depuis le rapport. Cette asymétrie explique
// pourquoi « les autres champs s'enregistrent » tout en laissant ces deux-là
// se perdre.
//
// ── Comment ces gardes mesurent ──────────────────────────────────────────
//
// Elles n'imitent pas le code : elles l'EXTRAIENT du fichier et le font
// tourner sur un DOM factice. Une garde qui recopierait la logique serait
// verte quel que soit l'état de la page.
import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const src = existsSync('public/rapports.html') ? readFileSync('public/rapports.html', 'utf8') : ''

console.log(`\n${G}── RAPPORT HEBDO · motif d'absence et précision   [INV-UI, INV-CONT]${F}`)

// ── Extraction des fragments réels ───────────────────────────────────────
const gate   = (src.match(/loadPointageForCurrent\(\{\s*preremplirMotif:\s*([\s\S]*?)\s*\}\)/) || [])[1]
const bloc   = (src.match(/if\(abs>0 && preremplirMotif\)\{([\s\S]*?)\n  \}/) || [])[1]
const hydType = (src.match(/g\('ed-motif-type',\s*([^;]+)\);/) || [])[1]
const hydMotif = (src.match(/g\('ed-motif',\s*([^;]+)\);/) || [])[1]
const collecte = /motifType:v\('ed-motif-type'\),\s*motif:v\('ed-motif'\),/.test(src)

const extraitComplet = !!gate && !!bloc && !!hydType && !!hydMotif && collecte
verifier('E0 · les quatre fragments sont extraits du fichier',
  extraitComplet,
  `— gate:${gate ? 'oui' : 'NON'} bloc:${bloc ? 'oui' : 'NON'} hydratation:${hydType && hydMotif ? 'oui' : 'NON'} collecte:${collecte ? 'oui' : 'NON'}`)

// Sans les fragments, les cycles tourneraient sur un code absent et R1 à R4
// répondraient vert en n'exerçant rien. C'est arrivé lors de la campagne de
// mutation : la suppression pure du correctif faisait échouer E0 seule pendant
// que les quatre recettes annonçaient un succès. On s'arrête ici : une garde
// qui ne peut pas conclure ne doit pas conclure.
if (!extraitComplet) {
  console.log(`\n  ${R}Le code attendu est introuvable dans public/rapports.html :${F}`)
  console.log(`  ${R}les recettes R1 à R4 n'exerceraient rien. Aucun verdict rendu.${F}\n`)
  process.exit(1)
}

// ── DOM factice, réduit à ce que les fragments touchent ──────────────────
const faireDom = () => {
  const champs = new Map([['ed-motif', { value: '' }], ['ed-motif-type', { value: '' }]])
  return { getElementById: id => champs.get(id) || null, _champs: champs }
}

// Un cycle complet : ouverture de l'éditeur → synchronisation du pointage →
// relecture des champs, avec le code de la page.
const cycle = (rapport, pointage) => {
  const document = faireDom()
  const g = (id, v) => { const el = document.getElementById(id); if (el) el.value = v }
  const r = rapport

  // 1 · hydratation depuis le rapport enregistré
  g('ed-motif-type', eval(hydType))
  g('ed-motif', eval(hydMotif))

  // 2 · décision de pré-remplissage, telle qu'écrite dans openEditor
  const preremplirMotif = eval(gate)

  // 3 · synchronisation du pointage
  const abs = pointage.abs, motifs = pointage.motifs || []
  if (abs > 0 && preremplirMotif) eval(bloc)

  // 4 · ce que la sauvegarde relira
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : '' }
  return { motifType: v('ed-motif-type'), motif: v('ed-motif'), preremplirMotif }
}

const POINTAGE = { abs: 1, motifs: ['maladie déclarée'] }

// ── R1 · « Maladie » choisi puis enregistré ──────────────────────────────
{
  const o = cycle({ motifType: 'maladie', motif: 'fièvre' }, POINTAGE)
  verifier('R1 · « Maladie » enregistré reste sélectionné',
    o.motifType === 'maladie', `— ${o.motifType}`)
}

// ── R2 · précision saisie ────────────────────────────────────────────────
{
  const o = cycle({ motifType: 'maladie', motif: 'Certificat médical remis' }, POINTAGE)
  verifier('R2 · la précision saisie revient à l’identique',
    o.motif === 'Certificat médical remis', `— « ${o.motif} »`)
}

// ── R3 · changement de motif, y compris le retour à RAS ──────────────────
{
  const a = cycle({ motifType: 'autre', motif: 'Certificat médical remis' }, POINTAGE)
  // Le cas dur : « — Aucun / RAS » était systématiquement remplacé, car la
  // synchronisation lisait cette valeur comme « pas encore choisi ».
  const b = cycle({ motifType: 'ras', motif: 'Certificat médical remis' }, POINTAGE)
  verifier('R3 · un motif changé persiste, RAS compris',
    a.motifType === 'autre' && b.motifType === 'ras', `— autre:${a.motifType} ras:${b.motifType}`)
}

// ── R4 · effacement volontaire de la précision ───────────────────────────
{
  const o = cycle({ motifType: 'maladie', motif: '' }, POINTAGE)
  verifier('R4 · une précision effacée reste effacée',
    o.motif === '', `— « ${o.motif} »`)
}

// ── P1 · le pré-remplissage d'origine est CONSERVÉ au premier passage ────
//
// Sans cette garde, on aurait pu « corriger » en supprimant purement la
// proposition automatique, ce qui aurait fait perdre un service réel.
{
  const o = cycle({}, POINTAGE)
  verifier('P1 · sans rapport enregistré, le pointage propose toujours',
    o.preremplirMotif === true && o.motifType === 'maladie' && o.motif === 'maladie déclarée',
    `— ${o.motifType} / « ${o.motif} »`)
}

// ── P2 · un rapport ancien, sans champ `week`, est protégé aussi ─────────
{
  const o = cycle({ motifType: 'ras', motif: '' }, POINTAGE)
  verifier('P2 · rapport ancien (sans `week`) : rien n’est écrasé',
    o.motifType === 'ras' && o.motif === '', `— ${o.motifType} / « ${o.motif} »`)
}

// ── P3 · aucune absence : la synchronisation ne touche à rien ────────────
{
  const o = cycle({ motifType: 'ras', motif: '' }, { abs: 0, motifs: [] })
  verifier('P3 · sans absence, aucun des deux champs n’est touché',
    o.motifType === 'ras' && o.motif === '')
}

// ── N1 · les champs DÉRIVÉS restent écrits sans condition ────────────────
//
// Retards, punitions et incidents se recalculent depuis la base à chaque
// synchronisation. Les enfermer dans la même condition serait une régression.
{
  const derives = ['ed-retard-matin', 'ed-retard-soir', 'ed-punitions', 'ed-incidents']
  const conditionnes = derives.filter(id => {
    const m = src.match(new RegExp(`^.*getElementById\\('${id}'\\)\\.value=.*$`, 'm'))
    return m && /preremplirMotif/.test(m[0])
  })
  verifier('N1 · les champs dérivés restent inconditionnels',
    conditionnes.length === 0, conditionnes.length ? `— ${conditionnes.join(', ')}` : `— ${derives.length} champs`)
}

// ── N2 · les deux entrées explicites de synchronisation pré-remplissent ──
//
// Le bouton « Synchroniser toute la semaine » et le changement de semaine
// appellent `reloadPointage()` sans argument : c'est le défaut `= true` qui
// doit leur répondre.
{
  const defautVrai = /preremplirMotif = true \} = \{\} *\)/.test(src)
  const alias = /window\.reloadPointage=loadPointageForCurrent;/.test(src)
  const appels = (src.match(/reloadPointage\(\)/g) || []).length
  verifier('N2 · le bouton et le changement de semaine pré-remplissent encore',
    defautVrai && alias && appels >= 2, `— défaut:${defautVrai ? 'true' : 'ABSENT'} appels:${appels}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

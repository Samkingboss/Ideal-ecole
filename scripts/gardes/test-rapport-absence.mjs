// Gardes : un rapport hebdomadaire enregistré fait autorité.
//
// ── Le défaut, tel qu'il se voyait ───────────────────────────────────────
//
// À l'ouverture d'un rapport enregistré, les valeurs correctes s'affichaient
// pendant une à deux secondes, puis disparaissaient. `openEditor` hydrate les
// champs depuis le rapport, puis lance `loadPointageForCurrent()` SANS
// l'attendre : la réponse du pointage arrive après, et réécrivait les champs
// par-dessus. Quand le pointage ne renvoyait rien pour la semaine, un rapport
// portant 12 et 7 minutes de retard revenait à 0 / 0.
//
// ── Pourquoi la première correction ne suffisait pas ─────────────────────
//
// Elle protégeait le motif et sa précision seulement, sur l'idée que les
// autres champs étaient « dérivés du pointage et recalculés à l'identique ».
// C'était une supposition, et elle était fausse : une lecture vide n'est pas
// un recalcul identique, c'est un zéro. Pire, la garde d'alors EXIGEAIT que
// les retards restent écrits sans condition — elle verrouillait le défaut.
//
// La frontière ne se trace pas champ par champ. Elle se trace entre « ce
// rapport n'existe pas encore » et « ce rapport existe ».
//
// ── Comment ces gardes mesurent ──────────────────────────────────────────
//
// Elles n'imitent pas le code : elles l'EXTRAIENT de `public/rapports.html` et
// le font tourner sur un DOM factice, dans l'ordre réel — hydratation, puis
// application tardive du pointage.
import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const src = existsSync('public/rapports.html') ? readFileSync('public/rapports.html', 'utf8') : ''

console.log(`\n${G}── RAPPORT HEBDO · le rapport enregistré fait autorité   [INV-UI, INV-CONT]${F}`)

// ── Extraction des fragments réels ───────────────────────────────────────
const pris = re => (src.match(re) || [])[1]
const hydRetards = [pris(/(g\('ed-retard-matin',[^;]+;)/), pris(/(g\('ed-retard-soir',[^;]+;)/)]
const hydMotifs  = [pris(/(g\('ed-motif-type',[^;]+;)/),   pris(/(g\('ed-motif',[^;]+;)/)]
// La frontière et l'écriture encadrée peuvent MANQUER — c'est précisément
// l'état fautif. Les remplacer par ce que le code fait alors réellement permet
// aux recettes de REPRODUIRE l'écrasement au lieu de s'arrêter avant.
//
//   · pas de `preremplir:` dans openEditor  → `loadPointageForCurrent()` sans
//     argument, donc le défaut `= true` : la synchronisation écrit ;
//   · pas de `poser`                        → écriture directe dans le champ.
const gatePresent = pris(/loadPointageForCurrent\(\{\s*preremplir:\s*([\s\S]*?)\s*\}\)/)
const gate       = gatePresent || 'true'
const poserSrc   = pris(/const poser=(\(id,valeur\)=>\{[^\n]*\});/)
  || '(id,valeur)=>{ const el=document.getElementById(id); if(el)el.value=valeur; }'
const appliRetards = pris(/(  poser\('ed-retard-matin', rm\);\n  poser\('ed-retard-soir', rs\);)/)
  || pris(/(  document\.getElementById\('ed-retard-matin'\)\.value=rm;\n  document\.getElementById\('ed-retard-soir'\)\.value=rs;)/)
const blocMotif  = pris(/(if\(abs>0[^)]*\)\{[\s\S]*?\n  \})/)

// Seuls les fragments SANS lesquels on ne peut rien simuler sont bloquants.
const complet = [...hydRetards, ...hydMotifs, appliRetards, blocMotif].every(Boolean)
verifier('E0 · les fragments réels sont extraits de la page', complet,
  `— frontière:${gatePresent ? 'présente' : 'ABSENTE'} retards:${appliRetards ? 'oui' : 'NON'} motif:${blocMotif ? 'oui' : 'NON'}`)

// Sans les fragments, les recettes tourneraient sur du vide et répondraient
// vert en n'exerçant rien. Une garde qui ne peut pas conclure ne conclut pas.
if (!complet) {
  console.log(`\n  ${R}Le code attendu est introuvable dans public/rapports.html.${F}`)
  console.log(`  ${R}Aucun verdict rendu — les recettes n'exerceraient rien.${F}\n`)
  process.exit(1)
}

// ── Un cycle d'ouverture complet, avec le code de la page ────────────────
const cycle = (rapport, pointage) => {
  const champs = new Map([['ed-retard-matin', { value: '' }], ['ed-retard-soir', { value: '' }],
                          ['ed-motif-type', { value: '' }], ['ed-motif', { value: '' }]])
  const document = { getElementById: id => champs.get(id) || null }
  const g = (id, v) => { const el = document.getElementById(id); if (el) el.value = v }

  const key = 'el:X'
  const REPORTS = rapport ? { [key]: rapport } : {}
  const r = REPORTS[key] || {}

  // T2 · hydratation depuis le rapport enregistré
  eval(hydRetards[0]); eval(hydRetards[1]); eval(hydMotifs[0]); eval(hydMotifs[1])
  const apresHydratation = lire(document)

  // T3 · décision, telle qu'écrite dans openEditor
  const preremplir = eval(gate)
  const poser = eval(poserSrc)

  // T5 · application tardive du pointage
  const rm = pointage.rm, rs = pointage.rs, abs = pointage.abs, motifs = pointage.motifs || []
  eval(appliRetards)
  if (abs > 0) eval(blocMotif)

  return { avant: apresHydratation, apres: lire(document), preremplir }
}
function lire(document) {
  const v = id => { const el = document.getElementById(id); return el ? String(el.value).trim() : '' }
  return { retardMatin: v('ed-retard-matin'), retardSoir: v('ed-retard-soir'),
           motifType: v('ed-motif-type'), motif: v('ed-motif') }
}
const identique = o => JSON.stringify(o.avant) === JSON.stringify(o.apres)
const RAPPORT = { retardMatin: 12, retardSoir: 7, motifType: 'maladie', motif: 'Certificat médical remis' }
const POINTAGE_VIDE = { rm: 0, rs: 0, abs: 0, motifs: [] }
const POINTAGE_AUTRE = { rm: 3, rs: 45, abs: 2, motifs: ['grippe'] }

// ── T1 · rapport existant, ouvert et laissé en place ─────────────────────
{
  const o = cycle(RAPPORT, POINTAGE_VIDE)
  verifier('T1 · rapport existant : rien ne bouge après le pointage',
    identique(o), `— ${o.apres.retardMatin}/${o.apres.retardSoir} · ${o.apres.motifType}`)
}

// ── T2/T3 · réouverture et rechargement complet ──────────────────────────
//
// Les deux passent par le même chemin : `REPORTS` est rempli depuis le
// serveur, puis `openEditor`. Ce qui les distingue à l'écran ne les distingue
// pas dans le code — c'est bien pour cela que le défaut se voyait dans les
// deux cas.
{
  const o = cycle(RAPPORT, POINTAGE_AUTRE)
  verifier('T2/T3 · même un pointage DIFFÉRENT ne réécrit rien',
    identique(o), `— ${o.apres.retardMatin}/${o.apres.retardSoir}`)
}

// ── T4 · rapport jamais enregistré : le pointage propose toujours ────────
{
  // Deux branches à exercer : la justification du pointage devient « maladie »
  // quand elle contient ce mot, « autre » sinon. Une première version de cette
  // garde attendait « maladie » pour une justification « grippe » — l'attente
  // était fausse, pas le code.
  const o = cycle(null, POINTAGE_AUTRE)
  const m = cycle(null, { rm: 3, rs: 45, abs: 2, motifs: ['maladie déclarée'] })
  verifier('T4 · rapport neuf : le pointage pré-remplit encore',
    o.preremplir === true && o.apres.retardMatin === '3' && o.apres.retardSoir === '45'
      && o.apres.motifType === 'autre' && o.apres.motif === 'grippe'
      && m.apres.motifType === 'maladie',
    `— ${o.apres.retardMatin}/${o.apres.retardSoir} · ${o.apres.motifType}/« ${o.apres.motif} » · branche maladie:${m.apres.motifType}`)
}

// ── T5 · le bouton « Synchroniser toute la semaine » recalcule ───────────
//
// Il appelle `reloadPointage()` sans argument : c'est le défaut `= true` qui
// lui répond. Une demande explicite doit toujours aboutir.
{
  const defautVrai = /preremplir = true \} = \{\} *\)/.test(src)
  const alias = /window\.reloadPointage=loadPointageForCurrent;/.test(src)
  // Compter `reloadPointage()` dans tout le fichier comptait aussi les
  // mentions en commentaire — la garde serait restée verte avec deux phrases
  // et zéro gestionnaire. On ne compte que les attributs HTML réels.
  const appels = (src.match(/on(?:change|click)="reloadPointage\(\)"/g) || []).length
  verifier('T5 · la synchronisation explicite recalcule encore',
    defautVrai && alias && appels >= 2, `— défaut:${defautVrai ? 'true' : 'ABSENT'} gestionnaires:${appels}`)
}

// ── T6 · un pointage VIDE ne remet jamais un rapport à zéro ──────────────
//
// C'est le cas qui a été observé en production : lecture sans ligne pour la
// semaine, donc rm = rs = 0.
{
  const o = cycle(RAPPORT, POINTAGE_VIDE)
  verifier('T6 · pointage vide : aucune remise à zéro',
    o.apres.retardMatin === '12' && o.apres.retardSoir === '7',
    `— ${o.apres.retardMatin}/${o.apres.retardSoir}`)
}

// ── T7 · « — Aucun / RAS » choisi volontairement ─────────────────────────
{
  const o = cycle({ ...RAPPORT, motifType: 'ras' }, POINTAGE_AUTRE)
  verifier('T7 · un motif remis à RAS reste RAS', o.apres.motifType === 'ras', `— ${o.apres.motifType}`)
}

// ── T8 · précision effacée volontairement ────────────────────────────────
{
  const o = cycle({ ...RAPPORT, motif: '' }, POINTAGE_AUTRE)
  verifier('T8 · une précision effacée reste effacée', o.apres.motif === '', `— « ${o.apres.motif} »`)
}

// ── N1 · aucune écriture de champ ne contourne la frontière ──────────────
//
// La garde précédente demandait l'INVERSE — que les retards restent écrits
// sans condition. Elle verrouillait le défaut. Elle demande maintenant que
// toute écriture passe par `poser`, ou vive dans un bloc `if(preremplir)`.
{
  const corps = (src.match(/async function loadPointageForCurrent[\s\S]*?\nwindow\.reloadPointage/) || [''])[0]
  const lignes = corps.split('\n')
  const fautives = []
  let dansBlocPreremplir = 0
  for (const l of lignes) {
    if (/if\(preremplir\)\{/.test(l)) dansBlocPreremplir = 1
    else if (dansBlocPreremplir && /^  \}/.test(l)) dansBlocPreremplir = 0
    if (!/\.value=/.test(l)) continue
    if (/const poser=/.test(l)) continue          // la frontière elle-même
    if (/poser\(/.test(l)) continue                // écriture encadrée
    if (dansBlocPreremplir) continue               // bloc explicitement gardé
    fautives.push(l.trim().slice(0, 60))
  }
  verifier('N1 · aucune écriture de champ hors de la frontière',
    fautives.length === 0, fautives.length ? `\n      ${fautives.join('\n      ')}` : '')
}

// ── N2 · la frontière est bien branchée sur l'existence du rapport ───────
{
  const surLExistence = !!gatePresent && /!REPORTS\[key\]/.test(gatePresent)
  verifier('N2 · la frontière lit l’existence du rapport enregistré',
    surLExistence, `— ${gatePresent || 'AUCUNE FRONTIÈRE : appel automatique sans condition'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

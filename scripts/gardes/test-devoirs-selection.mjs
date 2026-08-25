// Gardes sur ce qui ENTRE dans un document de devoirs.
//
// Le défaut d'origine : `ProfApp.jsx` passait `devoirsList={devoirs}` au
// cahier imprimable — toute la table de la classe. Deux devoirs à distribuer
// sortaient en vingt-cinq pages, et le parent recevait sur WhatsApp la liste
// de tout le trimestre.
//
// Ces gardes ne relisent pas l'intention du code : elles font tourner les
// fonctions de décision sur des jeux construits, et elles vérifient que le
// composant les APPELLE réellement.

import { readFileSync, existsSync } from 'node:fs'
import {
  rubriqueDevoir, estArchive, devoirsActifs, classerDevoirs,
  devoirsSelectionnes, selectionRaccourci, ecartDeSelection,
  JOURS_AVANT_ARCHIVAGE, aujourdHuiISO,
} from '../../src/lib/devoirsSelection.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// Un jeu figé : aucune garde ne doit dépendre du jour où on la lance.
const H = '2026-08-25'
const d = (id, rendu, extra = {}) => ({ id, date_rendu: rendu, ...extra })
const JEU = [
  d('today',    '2026-08-25'),
  d('demain',   '2026-08-26'),
  d('semaine',  '2026-08-30'),
  d('mois',     '2026-10-01'),
  d('retard',   '2026-08-20'),
  d('archive1', '2026-06-01'),
  d('archive2', '2026-05-04'),
  d('archive3', '2026-04-02'),
  d('archive4', '2026-03-11'),
  d('archive5', '2026-02-09'),
  d('sansdate', null),
]

console.log(`\n${G}── DEVOIRS · ce qui entre dans un document        [INV-METIER]${F}`)

// ── G1 · le document ne contient QUE la sélection ─────────────────────────
{
  const doc = devoirsSelectionnes(JEU, ['today', 'demain'])
  verifier('G1 sélection de 2 → 2 devoirs', doc.length === 2 && doc.every(x => ['today','demain'].includes(x.id)))

  // Le point qui empêche les vingt-cinq pages : une sélection VIDE ne veut
  // pas dire « tout ». Un appelant qui oublie la sélection obtient un
  // document vide — qui se voit — au lieu de l'historique, qui ne se voit
  // qu'au moment de distribuer les feuilles.
  verifier('G1 sélection vide → document vide, jamais tout',
    devoirsSelectionnes(JEU, []).length === 0, `(table de ${JEU.length})`)
  verifier('G1 sélection nulle → document vide',
    devoirsSelectionnes(JEU, null).length === 0)
  verifier('G1 identifiant inconnu ignoré',
    devoirsSelectionnes(JEU, ['today', 'fantome']).length === 1)

  // AUTO-TEST : le juge d'écart doit voir un document élargi en chemin.
  verifier('G1 auto-test · écart détecté', ecartDeSelection(JEU, ['today']) !== null)
  verifier('G1 auto-test · aucun écart quand conforme',
    ecartDeSelection(devoirsSelectionnes(JEU, ['today','demain']), ['today','demain']) === null)
}

// ── G2 · les archives sortent par défaut ──────────────────────────────────
{
  const actifs = devoirsActifs(JEU, H)
  const archives = JEU.filter(x => estArchive(x, H))
  verifier('G2 5 archives écartées des actifs',
    archives.length === 5 && actifs.length === JEU.length - 5, `${actifs.length} actifs`)
  verifier('G2 aucun archivé parmi les actifs',
    actifs.every(x => !estArchive(x, H)))
  verifier('G2 « Tout sélectionner » ne prend pas les archives',
    selectionRaccourci(JEU, 'actifs', H).every(id => !id.startsWith('archive')))

  // Un devoir sans date n'est PAS une archive : on ignore s'il est passé.
  verifier('G2 devoir sans date ≠ archive', estArchive(d('x', null), H) === false)

  // La frontière est une durée nommée, pas un nombre semé dans le code.
  const limite = new Date(Date.UTC(2026, 7, 25) - JOURS_AVANT_ARCHIVAGE * 86400000)
  const iso = limite.toISOString().slice(0, 10)
  verifier(`G2 frontière à ${JOURS_AVANT_ARCHIVAGE} jours, pile`,
    rubriqueDevoir(d('l', iso), H) === 'enRetard', iso)
  const veille = new Date(Date.UTC(2026, 7, 25) - (JOURS_AVANT_ARCHIVAGE + 1) * 86400000).toISOString().slice(0, 10)
  verifier('G2 un jour plus tôt : archivé',
    rubriqueDevoir(d('l', veille), H) === 'archives', veille)

  // AUTO-TEST : la garde doit savoir dire « ça fuit ».
  const fauxActifs = JEU   // le défaut : on passe tout
  verifier('G2 auto-test · voit une liste non filtrée',
    fauxActifs.some(x => estArchive(x, H)) === true)
}

// ── G10 · le volume reste celui qu'on a demandé ───────────────────────────
//
// « 25 pages par accident » vient d'un seul endroit : le nombre de devoirs
// mis dans le document. Tant qu'il est borné par la sélection, la pagination
// l'est aussi.
{
  const doc = devoirsSelectionnes(JEU, selectionRaccourci(JEU, 'aujourdhui', H))
  verifier('G10 raccourci « aujourd’hui » → 1 devoir', doc.length === 1, doc.map(x=>x.id).join(','))
  const sem = devoirsSelectionnes(JEU, selectionRaccourci(JEU, 'semaine', H))
  verifier('G10 raccourci « cette semaine » → 3 devoirs, pas le mois prochain',
    sem.length === 3 && !sem.some(x => x.id === 'mois'), sem.map(x=>x.id).join(','))
  verifier('G10 « effacer » → 0', selectionRaccourci(JEU, 'rien', H).length === 0)
}

// ── G1b · le composant appelle bien la sélection ──────────────────────────
//
// Les fonctions ci-dessus peuvent être parfaites et n'être appelées par
// personne. On vérifie donc le CÂBLAGE, à l'endroit exact du défaut.
{
  const src = lire('src/pages/ProfApp.jsx')
  verifier('G1b le document reçoit la sélection, pas la table',
    /devoirsList=\{devoirsSelectionnes\(devoirs, selectionDevoirs\)\}/.test(src))
  verifier('G1b le défaut d’origine a disparu',
    !/devoirsList=\{devoirs\}/.test(src))
  verifier('G1b le bouton se désactive sans sélection',
    /disabled=\{selectionDevoirs\.length === 0\}/.test(src))

  // AUTO-TEST : les trois motifs doivent savoir dire non.
  const defaut = 'devoirsList={devoirs}\n disabled={devoirs.length === 0}'
  verifier('G1b auto-test · reconnaît le défaut réintroduit',
    /devoirsList=\{devoirs\}/.test(defaut) === true
    && /devoirsList=\{devoirsSelectionnes\(devoirs, selectionDevoirs\)\}/.test(defaut) === false)
}

// ── Fuseau ────────────────────────────────────────────────────────────────
//
// `new Date('2026-08-26')` est le 25 août à l'ouest de Greenwich. Une date de
// calendrier scolaire n'a pas de fuseau : elle se compare en texte.
{
  const src = lire('src/lib/devoirsSelection.js')
  verifier('DATE aucune conversion par objet Date sur date_rendu',
    !/new Date\([^)]*date_rendu/.test(src))
  verifier('DATE aujourdHuiISO rend bien 10 caractères',
    /^\d{4}-\d{2}-\d{2}$/.test(aujourdHuiISO(new Date(2026, 0, 5))))
  verifier('DATE aujourdHuiISO ne décale pas d’un jour',
    aujourdHuiISO(new Date(2026, 0, 5)) === '2026-01-05', aujourdHuiISO(new Date(2026, 0, 5)))
}

console.log(echecs === 0
  ? `\n  ${V}Sélection des devoirs : conforme${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

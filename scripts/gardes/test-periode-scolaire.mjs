// Gardes sur la période scolaire d'un devoir.
//
// Le défaut : la période était un `<select>` en dur `['1'..'5']` que
// l'enseignant remplissait à la main, sans qu'aucun calendrier ne le
// contredise. Un devoir de novembre pouvait porter « Période 5 ».
//
// Et la liste déroulante de l'en-tête affichait chaque période trois fois :
// la table `periodes` porte 15 lignes = 5 × 3 exemplaires identiques, toutes
// en `annee_scolaire = '2024-2025'`. Un seed passé trois fois.

import { readFileSync, existsSync, statSync } from 'node:fs'
import {
  periodePourDate, periodesUtilisables, libellePeriode, calendrierEnBase,
  PERIODES_PAR_DEFAUT, ANNEE_SCOLAIRE, MESSAGE_HORS_CALENDRIER,
} from '../../src/lib/periodeScolaire.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// La forme EXACTE relevée en base le 25/08/2026 : trois exemplaires par
// période, année périmée.
const EN_BASE = []
for (let n = 0; n < 3; n++) {
  EN_BASE.push(
    { id: `a${n}`, nom: '1er Trimestre',   ordre: 1, annee_scolaire: '2024-2025', date_debut: '2024-10-01', date_fin: '2024-12-20' },
    { id: `b${n}`, nom: '2ème Trimestre',  ordre: 2, annee_scolaire: '2024-2025', date_debut: '2025-01-06', date_fin: '2025-03-28' },
    { id: `c${n}`, nom: '3ème Trimestre',  ordre: 3, annee_scolaire: '2024-2025', date_debut: '2025-04-07', date_fin: '2025-07-11' },
    { id: `d${n}`, nom: 'Période Extra 1', ordre: 4, annee_scolaire: '2024-2025', date_debut: '2025-07-12', date_fin: '2025-07-12' },
    { id: `e${n}`, nom: 'Période Extra 2', ordre: 5, annee_scolaire: '2024-2025', date_debut: '2025-07-13', date_fin: '2025-07-13' },
  )
}

console.log(`\n${G}── DEVOIRS · la période se calcule, elle ne se tape pas [INV-METIER]${F}`)

// ── G5 · la période est dérivée du calendrier ─────────────────────────────
{
  const src = lire('src/pages/ProfApp.jsx')
  verifier('G5 la période enregistrée est calculée',
    /periode: libellePeriode\(periodePourDate\(newDevoir\.aRendrePour, periodes\)\)/.test(src))
  verifier('G5 le sélecteur manuel a disparu',
    !/\['1', '2', '3', '4', '5'\]\.map/.test(src))
  verifier('G5 aucun champ de saisie de période ne subsiste',
    !/newDevoir, periode: e\.target\.value/.test(src))

  // AUTO-TEST : les trois motifs doivent reconnaître le défaut d'origine.
  const defaut = `<select value={newDevoir.periode} onChange={e => setNewDevoir({ ...newDevoir, periode: e.target.value })}>
    {['1', '2', '3', '4', '5'].map(p => <option key={p}>Période {p}</option>)}`
  verifier('G5 auto-test · reconnaît la saisie manuelle',
    /\['1', '2', '3', '4', '5'\]\.map/.test(defaut) === true
    && /newDevoir, periode: e\.target\.value/.test(defaut) === true)
}

// ── G6 · aucune période inventée ──────────────────────────────────────────
//
// Le point qui compte le plus. Une date hors calendrier ne doit PAS retomber
// sur la période la plus proche, ni sur la première, ni sur un repli.
{
  const cas = [
    ['2026-11-05', 'Période 1 (T1)', 'en pleine période 1'],
    ['2026-11-13', 'Période 1 (T1)', 'dernier jour de la période 1'],
    ['2026-11-14', null,             'lendemain — congé'],
    ['2026-11-22', null,             'veille de la période 2'],
    ['2026-11-23', 'Période 2 (T1)', 'premier jour de la période 2'],
    ['2027-02-10', 'Période 3 (T2)', 'février'],
    ['2027-05-20', 'Période 5 (T3)', 'mai'],
    ['2027-06-25', 'Période 5 (T3)', 'dernier jour de l’année'],
    ['2027-06-26', null,             'grandes vacances'],
    ['2027-08-15', null,             'hors année scolaire'],
    ['2024-11-05', null,             'année précédente'],
    ['',           null,             'date vide'],
    ['pas-une-date', null,           'date illisible'],
  ]
  const rates = cas.filter(([d, attendu]) => libellePeriode(periodePourDate(d, EN_BASE)) !== attendu)
  verifier('G6 aucune date ne reçoit une période inventée',
    rates.length === 0,
    rates.length ? R + rates.map(([d, a]) => `${d}→attendu ${a}`).join(' · ') + F
                 : `${cas.length} dates, dont ${cas.filter(c => c[1] === null).length} sans période`)

  // AUTO-TEST : un repli sur la première période — le défaut classique — doit
  // être visible pour ce juge.
  const avecRepli = (d, ps) => periodePourDate(d, ps) || PERIODES_PAR_DEFAUT[0]
  verifier('G6 auto-test · un repli se verrait',
    libellePeriode(avecRepli('2027-08-15', EN_BASE)) === 'Période 1 (T1)',
    'le juge distingue null d’un repli')

  verifier('G6 le message hors calendrier ne devine rien',
    /aucune période du calendrier scolaire configuré/.test(MESSAGE_HORS_CALENDRIER)
    && !/proche|approximat|environ/i.test(MESSAGE_HORS_CALENDRIER))
}

// ── G7 · aucun doublon dans l'interface ───────────────────────────────────
{
  const utilisables = periodesUtilisables(EN_BASE)
  verifier('G7 15 lignes en base → 5 entrées à l’écran',
    EN_BASE.length === 15 && utilisables.length === 5,
    `${EN_BASE.length} → ${utilisables.length}`)
  verifier('G7 les ordres sont uniques et triés',
    utilisables.map(p => p.ordre).join(',') === '1,2,3,4,5')

  // Le dédoublonnage porte sur (année, ordre), PAS sur le libellé : deux
  // années peuvent légitimement porter les mêmes noms.
  const deuxAnnees = [
    { nom: '1er Trimestre', ordre: 1, annee_scolaire: '2026-2027', date_debut: '2026-10-01', date_fin: '2026-12-20' },
    { nom: '1er Trimestre', ordre: 1, annee_scolaire: '2025-2026', date_debut: '2025-10-01', date_fin: '2025-12-20' },
  ]
  verifier('G7 le tri n’écrase pas une autre année par son nom',
    periodesUtilisables(deuxAnnees, '2026-2027').length === 1
    && periodesUtilisables(deuxAnnees, '2025-2026').length === 1)

  // AUTO-TEST : sans dédoublonnage, l'écran montrerait bien 15 entrées.
  verifier('G7 auto-test · le défaut se verrait',
    EN_BASE.filter(p => p.annee_scolaire === '2024-2025').length === 15)

  const src = lire('src/pages/ProfApp.jsx')
  verifier('G7 l’écran passe par periodesUtilisables',
    /periodesUtilisables\(periodes\)\.map/.test(src))
  verifier('G7 la liste brute n’est plus rendue',
    !/\{periodes\.map\(p => <option/.test(src))
}

// ── ANNÉE · la base est périmée, et l'écran ne doit pas mentir ────────────
{
  verifier('ANNÉE la table ne porte pas encore l’année en cours',
    calendrierEnBase(EN_BASE) === false, `attendu ${ANNEE_SCOLAIRE}`)
  verifier('ANNÉE le repli sert alors de calendrier',
    periodesUtilisables(EN_BASE).length === PERIODES_PAR_DEFAUT.length)
  verifier('ANNÉE dès que la base porte l’année, elle gagne',
    calendrierEnBase([{ ordre: 1, annee_scolaire: ANNEE_SCOLAIRE, date_debut: '2026-10-01', date_fin: '2026-10-02' }]) === true)
}

console.log(echecs === 0
  ? `\n  ${V}Période scolaire : calculée, jamais inventée${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

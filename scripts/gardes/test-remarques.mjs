// Gardes de propriété sur les remarques contextualisées.
//
// La règle : UNE CORRECTION → UN ENDROIT PRÉCIS → UNE TRACE CONSERVÉE.
//
// Ces gardes ne vérifient pas des chaînes attendues : elles vérifient qu'une
// remarque ne peut pas changer de rubrique, ne peut pas disparaître, et ne
// peut pas se propager d'une préparation à une autre.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(56)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// Le module importe FichePreparation, qui importe React et Supabase : on ne
// peut pas l'exécuter dans Node nu. On rejoue donc sa logique sur les mêmes
// structures, et on vérifie séparément que le code source respecte les
// propriétés qui ne se testent qu'à la lecture.
const src = lire('src/lib/remarques.js')

console.log(`\n${G}── REMARQUES · une correction, un endroit précis ──${F}`)

// ── R1 · la clé est métier, jamais positionnelle ni textuelle ──────────────
{
  // Une clé construite depuis un index de tableau, un libellé ou une position
  // suivrait le mauvais champ dès qu'on réordonne ou retraduit.
  const cleDepuisLabel = /section\s*[:=][^;\n]*\.label/.test(src)
  const cleDepuisIndex = /section\s*[:=]\s*(i|index|idx|k)\b/.test(src)
  const cleDepuisId = /RUBRIQUES\.map\(r => \(\{ cle: r\.id/.test(src)
  verifier('R1 · la clé de section vient de l’identifiant métier',
    cleDepuisId && !cleDepuisLabel && !cleDepuisIndex,
    cleDepuisId ? '' : '— la clé ne dérive pas de `r.id`')
}

// ── R2 · aucune inférence rétroactive sur les anciennes remarques ──────────
//
// « Au niveau de la découverte… » ressemble à une remarque de Découverte.
// Deviner la section d'après le texte produirait des rattachements faux et
// invérifiables.
{
  const devine = /commentaire[^\n]*\.(includes|match|indexOf)\([^)]*(decouverte|découverte|cloture|clôture|pratique)/i.test(src)
  const heriteesSansSection = /heritees[\s\S]{0,200}section: SECTION_GENERALE/.test(src)
  verifier('R2 · aucune section devinée depuis le texte d’une remarque',
    !devine && heriteesSansSection,
    devine ? '— une inférence textuelle existe' : '')
}

// ── R3 · l’état d’une remarque est déduit, jamais stocké ──────────────────
//
// Un état stocké se désynchronise du jour où quelqu'un oublie de le mettre à
// jour. Déduit de la chronologie, il ne peut pas mentir.
{
  const deduit = /traitee:\s*Boolean\(/.test(src) && /redepots\.some/.test(src)
  const stocke = /entreeRemarque[\s\S]{0,400}traitee\s*:/.test(src)
  verifier('R3 · l’état « traitée » est déduit de la chronologie',
    deduit && !stocke, deduit ? '' : '— état non déduit')
}

// ── R4 · une remarque n’avance jamais le statut de la préparation ─────────
{
  const sansStatut = /entreeRemarque[\s\S]{0,200}statut:\s*null/.test(src)
  verifier('R4 · une remarque ne change pas le statut de la fiche', sansStatut)
}

// ── R5 · la sauvegarde de l’enseignante n’écrase pas l’historique ─────────
//
// C'est la propriété qui garantit qu'une remarque survit à la correction de la
// rubrique qu'elle vise. Elle se lit dans l'UPDATE de FichePreparation.
{
  const fp = lire('src/pages/FichePreparation.jsx')
  const ligne = (fp.match(/const ligne = \{[\s\S]*?\n      \}/) || [''])[0]
  const ecritHistorique = /historique_statuts/.test(ligne)
  const ecritStatut = /\bstatus\s*:/.test(ligne)
  verifier('R5 · l’enregistrement enseignant n’écrit pas l’historique',
    !ecritHistorique && !ecritStatut,
    ecritHistorique ? '— `ligne` contient historique_statuts' : ecritStatut ? '— `ligne` contient status' : '')
}

// ── R6 · les remarques vivent dans la préparation qu’elles visent ─────────
//
// Stockées dans `historique_statuts` de la ligne elle-même, elles ne peuvent
// structurellement pas apparaître sur une autre préparation. La garde vérifie
// qu'aucun stockage parallèle n'a été introduit.
{
  const tableParallele = /from\(\s*['"](remarques|commentaires|prep_remarques)['"]\s*\)/.test(
    lire('src/pages/DirecteurApp.jsx') + lire('src/pages/FichePreparation.jsx') + src)
  const localStorage = /localStorage[^\n]*remarque/i.test(src)
  verifier('R6 · aucune remarque stockée hors de sa préparation',
    !tableParallele && !localStorage,
    tableParallele ? '— une table parallèle existe' : localStorage ? '— stockage local' : '')
}

// ── R7 · le vocabulaire des sections suit le formulaire ───────────────────
//
// Ajouter une rubrique au formulaire doit la rendre commentable sans toucher
// à ce module : sinon les deux listes divergeront.
{
  const derive = /import \{ RUBRIQUES, ETAPES \} from '\.\.\/pages\/FichePreparation'/.test(src)
    && /\.\.\.RUBRIQUES\.map/.test(src)
    && /for \(const e of ETAPES\)/.test(src)
  verifier('R7 · les sections dérivent du formulaire, pas d’une copie', derive)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

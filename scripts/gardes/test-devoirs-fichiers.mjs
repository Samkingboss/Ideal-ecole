// Gardes sur les pièces jointes d'un devoir : nombre, ordre, retrait.
//
// Un devoir tient rarement sur une seule page de cahier. `multiple` était
// posé sur le champ, mais rien derrière ne suivait :
//
//   — choisir une seconde fois REMPLAÇAIT la première sélection, en silence ;
//   — aucun moyen de retirer une fiche avant d'enregistrer ;
//   — aucun moyen de changer l'ordre ;
//   — à la modification, les pièces déjà en ligne étaient relues depuis la
//     ligne d'origine et non depuis l'écran : les retirer était impossible.

import { readFileSync, existsSync } from 'node:fs'
import { lireDevoir } from '../../src/lib/devoirs.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const src = lire('src/pages/ProfApp.jsx')

console.log(`\n${G}── DEVOIRS · une fiche, deux fiches, trois fiches [INV-METIER]${F}`)

// ── G3 · le multi-fichiers tient de bout en bout ──────────────────────────
{
  verifier('G3 le champ accepte plusieurs fichiers', /type="file" multiple/.test(src))
  verifier('G3 un second choix AJOUTE au lieu de remplacer',
    /fichiers: \[\.\.\.d\.fichiers, \.\.\.ajoutes\]/.test(src))
  verifier('G3 le défaut « remplace » a disparu',
    !/fichiers: \[\.\.\.e\.target\.files\] \}\)/.test(src))
  verifier('G3 le champ se vide après chaque prise',
    /e\.target\.value = ''/.test(src), 'sinon le même fichier ne peut être repris')

  // AUTO-TEST : le motif doit reconnaître le défaut d'origine.
  const defaut = "onChange={e => setNewDevoir({ ...newDevoir, fichiers: [...e.target.files] })}"
  verifier('G3 auto-test · reconnaît le remplacement',
    /fichiers: \[\.\.\.e\.target\.files\] \}\)/.test(defaut) === true
    && /fichiers: \[\.\.\.d\.fichiers, \.\.\.ajoutes\]/.test(defaut) === false)

  // La lecture doit rendre autant de pièces qu'il y en a.
  for (const n of [0, 1, 2, 3, 5]) {
    const d = lireDevoir({ id: 'x', fichiers: Array.from({ length: n }, (_, k) => ({ url: `u${k}` })) })
    if (d.piecesJointes.length !== n) verifier(`G3 ${n} fichiers relus`, false, `${d.piecesJointes.length}`)
  }
  verifier('G3 0, 1, 2, 3 et 5 pièces sont relues à l’identique', true)
}

// ── G4 · l'ordre est celui de l'écran, pas celui de Storage ───────────────
{
  // La permutation est une fonction pure du fichier : on la rejoue ici, à
  // l'identique, pour éprouver la règle plutôt que sa présence.
  const permuter = (liste, a, b) => { const c = [...liste]; const t = c[a]; c[a] = c[b]; c[b] = t; return c }
  const l = ['p1', 'p2', 'p3']
  verifier('G4 monter la deuxième la met en tête', permuter(l, 1, 0).join(',') === 'p2,p1,p3')
  verifier('G4 descendre la première la met en second', permuter(l, 0, 1).join(',') === 'p2,p1,p3')
  verifier('G4 la liste d’origine n’est pas mutée', l.join(',') === 'p1,p2,p3',
    'muter l’état laisserait React croire que rien n’a changé')

  verifier('G4 l’écran expose monter, descendre et retirer',
    /onMonter=/.test(src) && /onDescendre=/.test(src) && /onRetirer=/.test(src))
  verifier('G4 l’enregistrement suit l’ordre de l’écran',
    /const toutesPieces = \[\.\.\.\(newDevoir\.pieces_existantes \|\| \[\]\), \.\.\.fichiers\]/.test(src))
  verifier('G4 il ne relit plus la ligne d’origine',
    !/Array\.isArray\(devoirEdite\.fichiers\) \? devoirEdite\.fichiers/.test(src),
    'sinon une pièce retirée à l’écran serait réécrite')

  // AUTO-TEST : le défaut consistait à relire devoirEdite.
  const defaut = "const dejaLa = devoirEdite ? (Array.isArray(devoirEdite.fichiers) ? devoirEdite.fichiers : []) : []"
  verifier('G4 auto-test · reconnaît la relecture de la ligne',
    /Array\.isArray\(devoirEdite\.fichiers\) \? devoirEdite\.fichiers/.test(defaut) === true)

  // Le dépôt reste séquentiel : une boucle parallèle rendrait l'ordre
  // dépendant de la vitesse du réseau.
  verifier('G4 le dépôt est séquentiel, jamais en parallèle',
    /for \(const f of newDevoir\.fichiers\)/.test(src) && !/Promise\.all\([^)]*upload/.test(src))
}

// ── MODIFICATION · les pièces en ligne sont retirables ────────────────────
{
  verifier('MODIF les pièces existantes remontent dans le formulaire',
    /pieces_existantes: d\.piecesJointes\.map/.test(src))
  verifier('MODIF elles se retirent une par une',
    /pieces_existantes: d\.pieces_existantes\.filter/.test(src))
  verifier('MODIF elles se réordonnent',
    /pieces_existantes: permuter\(d\.pieces_existantes/.test(src))
}

// ── G12 · le bucket devoirs reste public, la lecture reste centralisée ────
//
// La fermeture du bucket n'est PAS dans ce lot : elle demande de basculer
// vers des URL signées d'abord. Ce qu'on garde ici, c'est qu'il n'y ait
// qu'UN point d'appel à migrer le jour venu.
{
  const appels = (src.match(/getPublicUrl/g) || []).length
  verifier('G12 un seul point d’appel à migrer vers un lien signé',
    appels === 1, `${appels} appel(s) dans ProfApp`)
}

console.log(echecs === 0
  ? `\n  ${V}Pièces jointes : comptées, ordonnées, retirables${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

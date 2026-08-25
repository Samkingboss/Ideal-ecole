// Gardes sur le suivi des pièces d'un dossier d'inscription.
//
// La règle métier est simple et ne doit pas dériver :
//
//   UNE PIÈCE MANQUANTE NE BLOQUE PAS L'INSCRIPTION.
//
// Un dossier incomplet se dit, se compte et se rattrape. Il n'interdit ni
// l'inscription, ni l'encaissement.

import { readFileSync, existsSync } from 'node:fs'
import { PIECES, etatDossier, libelleEtat } from '../../src/lib/dossierPieces.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── DOSSIER · une pièce manquante ne bloque rien   [INV-METIER]${F}`)

// ── P1 · la liste des types n'existe qu'à un seul endroit ─────────────────
//
// Elle vivait au milieu de la fonction d'envoi de `inscription.html`, et
// nulle part ailleurs. Deux listes finiraient par diverger, et un dossier
// serait alors complet sur un écran et incomplet sur l'autre.
{
  const ids = PIECES.map(p => p.id)
  const ailleurs = ['src/pages/InscriptionsValidation.jsx', 'src/pages/DirecteurApp.jsx']
    .filter(f => {
      const src = lire(f)
      // Une redéclaration serait une liste littérale contenant plusieurs ids.
      return ids.filter(id => new RegExp(`['"\`]${id}['"\`]`).test(src)).length >= 2
    })
  verifier('P1 · une seule source pour la liste des pièces',
    ids.length === 4 && ailleurs.length === 0,
    ailleurs.length ? `— redéclarée dans ${ailleurs.join(', ')}` : `— ${ids.length} types`)
}

// ── P2 · le compte des manquantes est exact ──────────────────────────────
{
  const cas = [
    [[], 4], [[{ type: 'acte_naissance' }], 3],
    [[{ type: 'acte_naissance' }, { type: 'vaccination' }], 2],
    [PIECES.map(p => ({ type: p.id })), 0],
  ]
  const faux = cas.filter(([docs, attendu]) => etatDossier(docs).nbManquantes !== attendu)
  verifier('P2 · le nombre de pièces manquantes est exact', faux.length === 0,
    faux.length ? `— ${faux.length} cas faux` : '— 0, 1, 2 et 4 pièces')
}

// ── P3 · complet seulement quand toutes les requises sont là ─────────────
{
  const requises = PIECES.filter(p => p.requise)
  const toutes = etatDossier(requises.map(p => ({ type: p.id })))
  const uneEnMoins = etatDossier(requises.slice(1).map(p => ({ type: p.id })))
  verifier('P3 · complet uniquement quand les requises sont là',
    toutes.complet === true && uneEnMoins.complet === false,
    `— toutes:${toutes.complet} · une en moins:${uneEnMoins.complet}`)
}

// ── P4 · un type inconnu ne fausse pas le compte ─────────────────────────
//
// Une pièce ajoutée en base sous un type non prévu ne doit ni compter comme
// une requise fournie, ni disparaître silencieusement.
{
  const e = etatDossier([{ type: 'acte_naissance' }, { type: 'photo_identite' }])
  verifier('P4 · un type inconnu est signalé, pas avalé',
    e.nbManquantes === 3 && e.inconnues.includes('photo_identite'),
    `— manquantes:${e.nbManquantes} inconnues:${e.inconnues.join(',') || 'aucune'}`)
}

// ── P5 · l'écran dit que rien n'est bloqué ───────────────────────────────
{
  const src = lire('src/pages/InscriptionsValidation.jsx')
  const litLesPieces = /from\('documents_inscription'\)/.test(src)
  const affiche = /libelleEtat\(/.test(src) && /ep\.detail\.map/.test(src)
  const rassure = /n’empêche ni l’inscription ni l’encaissement/.test(src)
  verifier('P5 · l’écran montre les pièces et ne bloque pas',
    litLesPieces && affiche && rassure,
    `— lit:${litLesPieces ? 'oui' : 'NON'} affiche:${affiche ? 'oui' : 'NON'} rassure:${rassure ? 'oui' : 'NON'}`)
}

// ── P6 · une lecture en échec n'est pas un dossier vide ──────────────────
//
// Afficher « incomplet » parce que la requête a échoué enverrait le
// secrétariat réclamer des pièces déjà remises.
{
  const src = lire('src/pages/InscriptionsValidation.jsx')
  const distingue = /if \(error\) \{ setPiecesEtat\('erreur'\)/.test(src)
                 && /n’est pas nécessairement incomplet/.test(src)
  verifier('P6 · une lecture en échec ne se lit pas « incomplet »',
    distingue, distingue ? '' : '— une panne passerait pour un manque')
}

console.log(echecs === 0
  ? `\n  ${V}6 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

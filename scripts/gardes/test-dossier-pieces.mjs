// Gardes sur le suivi des pièces d'un dossier d'inscription.
//
// La règle métier est simple et ne doit pas dériver :
//
//   UNE PIÈCE MANQUANTE NE BLOQUE PAS L'INSCRIPTION.
//
// Un dossier incomplet se dit, se compte et se rattrape. Il n'interdit ni
// l'inscription, ni l'encaissement.

import { readFileSync, existsSync } from 'node:fs'
import { PIECES, etatDossier, contexteDossier } from '../../src/lib/dossierPieces.js'

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

// ── P2 · les six scénarios métier ────────────────────────────────────────
{
  const d = t => ({ type: t })
  const AILLEURS = { type_inscription: 'nouvelle', ancienne_ecole: 'École Les Colibris' }
  const PREMIERE = { type_inscription: 'nouvelle', ancienne_ecole: null }
  const REINSC   = { type_inscription: 'reinscription', ancienne_ecole: 'École IDEAL' }
  const cas = [
    ['A · maternelle, acte+vaccin',        [d('acte_naissance'), d('vaccination')], PREMIERE, true],
    ['B · acte manquant',                  [d('vaccination')], PREMIERE, false],
    ['C · d’ailleurs, bulletin manquant',  [d('acte_naissance'), d('vaccination'), d('transfert')], AILLEURS, false],
    ['D · d’ailleurs, transfert manquant', [d('acte_naissance'), d('vaccination'), d('bulletin')], AILLEURS, false],
    ['E · d’ailleurs, tout fourni',        [d('acte_naissance'), d('vaccination'), d('bulletin'), d('transfert')], AILLEURS, true],
    ['F · réinscription, acte+vaccin',     [d('acte_naissance'), d('vaccination')], REINSC, true],
  ]
  const faux = cas.filter(([, docs, ins, attendu]) => etatDossier(docs, ins).complet !== attendu)
  verifier('P2 · les six scénarios de complétude',
    faux.length === 0,
    faux.length ? `— faux: ${faux.map(c => c[0]).join(', ')}` : '— A à F conformes')
}

// ── P3 · un enfant jamais scolarisé n'est jamais incomplet à tort ────────
//
// C'est la règle qui a motivé le contexte : exiger un bulletin de l'année
// précédente d'un enfant de petite section marquerait INCOMPLET tout premier
// dossier de l'école.
{
  const e = etatDossier([{ type: 'acte_naissance' }, { type: 'vaccination' }],
    { type_inscription: 'nouvelle', ancienne_ecole: null })
  const conditionnellesNonComptees = e.manquantes.every(m => m.portee === 'toujours')
  verifier('P3 · une première scolarisation n’est pas incomplète à tort',
    e.complet === true && conditionnellesNonComptees,
    `— complet:${e.complet} · manquantes:${e.nbManquantes}`)
}

// ── P4 · l'incertitude est montrée, pas devinée ──────────────────────────
//
// `ancienne_ecole` est un champ LIBRE et FACULTATIF — « si applicable ». Un
// vide peut vouloir dire « première scolarisation » comme « personne ne l'a
// rempli ». On ne tranche pas : on affiche « à confirmer ».
{
  const e = etatDossier([{ type: 'acte_naissance' }, { type: 'vaccination' }],
    { type_inscription: 'nouvelle', ancienne_ecole: null })
  const ctxIndetermine = contexteDossier({ type_inscription: 'nouvelle', ancienne_ecole: null }) === 'indetermine'
  const ctxAilleurs = contexteDossier({ type_inscription: 'nouvelle', ancienne_ecole: 'X' }) === 'venant_d_ailleurs'
  const ctxReinsc = contexteDossier({ type_inscription: 'reinscription' }) === 'reinscription'
  verifier('P4 · l’incertitude est signalée, pas tranchée',
    ctxIndetermine && ctxAilleurs && ctxReinsc && e.aConfirmer.length === 2,
    `— contexte:${e.contexte} · à confirmer:${e.aConfirmer.length}`)
}

// ── P4b · un type inconnu ne fausse pas le compte ────────────────────────
{
  const e = etatDossier([{ type: 'acte_naissance' }, { type: 'photo_identite' }],
    { type_inscription: 'reinscription' })
  verifier('P4b · un type inconnu est signalé, pas avalé',
    e.nbManquantes === 1 && e.inconnues.includes('photo_identite'),
    `— manquantes:${e.nbManquantes} inconnues:${e.inconnues.join(',') || 'aucune'}`)
}

// ── P5 · l'écran dit que rien n'est bloqué ───────────────────────────────
{
  const src = lire('src/pages/InscriptionsValidation.jsx')
  const litLesPieces = /from\('documents_inscription'\)/.test(src)
  const affiche = /libelleEtat\(/.test(src) && /ep\.detail\.map/.test(src)
                && /etatPiece\(d\)/.test(src) && /LIBELLE_CONTEXTE\[ep\.contexte\]/.test(src)
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
  ? `\n  ${V}7 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

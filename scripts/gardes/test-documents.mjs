// Gardes de propriété sur les documents officiels.
//
//   DOCUMENT ADMINISTRATIF → informations administratives
//   DOCUMENT PÉDAGOGIQUE   → informations pédagogiques
//
// Le pied de la fiche d'inscription a porté pendant des mois trois bandeaux
// venus du cahier de devoirs : « PROGRAMME PÉDAGOGIQUE · TRAVAUX AUTONOMES DU
// SOIR », « SUIVI PÉDAGOGIQUE & SUCCÈS SCOLAIRE », « SERVICE PÉDAGOGIQUE &
// ENSEIGNEMENT ». Sur un dossier d'inscription. Personne ne les avait mis là
// volontairement : ils venaient d'un gabarit recopié.
//
// C'est ce genre de mélange que ces gardes empêchent de revenir.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(54)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// Retire les commentaires : un commentaire qui EXPLIQUE le retrait d'un
// bandeau pédagogique ne doit pas être pris pour le bandeau lui-même.
const sansCommentaires = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*(\/\/|--|\*)/.test(l)).join('\n')

// Les documents qui attestent, facturent, identifient ou enregistrent.
const ADMINISTRATIFS = [
  ['fiche d’inscription',   'public/inscription.html'],
  ['certificat de scolarité','src/pages/CertificatScolarite.jsx'],
  ['carte scolaire',        'src/pages/CartesScolaires.jsx'],
  ['dossier RH',            'src/pages/DossierPersonnel.jsx'],
  ['fiches et effectifs',   'src/pages/FichesEffectifs.jsx'],
  ['avis de recouvrement',  'src/pages/RecouvrementDocument.jsx'],
  ['vérification de fiche', 'public/fiche.html'],
]

console.log(`\n${G}── DOCUMENTS · un document administratif reste administratif ──${F}`)

// ── G1 · aucun bandeau pédagogique sur un document administratif ───────────
{
  // Les libellés promotionnels ou pédagogiques qui n'ont rien à faire sur une
  // pièce administrative. Volontairement littéraux : « pédagogique » seul
  // apparaît légitimement dans une mention de règlement intérieur.
  const BANDEAUX = [
    'PROGRAMME PÉDAGOGIQUE', 'TRAVAUX AUTONOMES', 'SUIVI PÉDAGOGIQUE',
    'SUCCÈS SCOLAIRE', 'SERVICE PÉDAGOGIQUE', 'EXCELLENCE & RIGUEUR',
  ]
  const fautifs = []
  for (const [nom, f] of ADMINISTRATIFS) {
    const src = sansCommentaires(lire(f))
    const trouves = BANDEAUX.filter(b => src.includes(b))
    if (trouves.length) fautifs.push(`${nom} (${trouves.join(', ')})`)
  }
  verifier('G1 · aucun bandeau pédagogique sur une pièce administrative',
    fautifs.length === 0,
    fautifs.length ? `\n      ${fautifs.join('\n      ')}` : `— ${ADMINISTRATIFS.length} documents`)
}

// ── G2 · le numéro de l'école n'est jamais recopié dans un document ────────
//
// Il vit dans `src/lib/ecole.js`. Un document qui l'écrit en dur crée une
// copie qui dérivera le jour où le numéro changera.
{
  const fautifs = []
  for (const [nom, f] of ADMINISTRATIFS) {
    if (!f.startsWith('src/')) continue          // les pages statiques ne peuvent pas importer
    const src = sansCommentaires(lire(f))
    if (/22390190007|90\s?19\s?00\s?07/.test(src)) fautifs.push(nom)
  }
  verifier('G2 · aucun numéro d’école recopié dans un document',
    fautifs.length === 0, fautifs.length ? `— ${fautifs.join(', ')}` : '')
}

// ── G3 · la carte porte un contact lisible en cas de perte ────────────────
//
// Le QR ne peut pas porter cette fonction : il faut savoir qu'un carré noir se
// scanne. Une personne qui ramasse une carte doit pouvoir lire un numéro.
{
  const src = lire('src/pages/CartesScolaires.jsx')
  const mention = /EN CAS DE PERTE/i.test(src)
  // Importer la constante ne suffit pas : elle doit être RENDUE. Un import
  // conservé au-dessus d'un numéro recopié en dur passerait sinon au vert.
  const importee = /import\s*\{[^}]*WHATSAPP_ECOLE_LISIBLE[^}]*\}\s*from\s*'\.\.\/lib\/ecole'/.test(src)
  const rendue = /\{\s*WHATSAPP_ECOLE_LISIBLE\s*\}/.test(src)
  const sansCopie = !/22390190007|90\s?19\s?00\s?07/.test(src)
  const depuisSource = importee && rendue && sansCopie
  verifier('G3 · la carte affiche un contact de perte, depuis la source unique',
    mention && depuisSource,
    `— mention:${mention ? 'oui' : 'NON'} source:${depuisSource ? 'unique' : 'RECOPIÉE'}`)
}

// ── G4 · le badge de la fiche d’inscription porte un statut, pas un doublon ─
{
  const src = sansCommentaires(lire('public/inscription.html'))
  const litLeStatut = /typeLabel\s*=\s*[\s\S]{0,120}data\.statut/.test(src)
  const doublonDuTitre = /typeLabel\s*=\s*'DOSSIER D/.test(src)
  verifier('G4 · le badge du dossier porte son statut réel',
    litLeStatut && !doublonDuTitre,
    litLeStatut ? '' : '— badge figé, ne lit pas `data.statut`')
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

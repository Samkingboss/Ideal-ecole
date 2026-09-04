// Gardes de propriété sur l'identité professionnelle.
//
// La règle IDEAL : un document n'est jamais signé d'un nom seul. La fonction
// affichée doit dépendre du CONTEXTE — un directeur qui enseigne signe
// « Directeur » un courrier de direction et « Enseignant de Mathématiques »
// un devoir de mathématiques.
//
// Ces gardes vérifient des propriétés, pas des chaînes attendues une à une :
// on peut renommer une fonction sans les faire échouer, on ne peut pas
// supprimer la contextualisation sans qu'elles le voient.

import {
  signature, signatureLigne, fonctionProfessionnelle, nomProfessionnel, genreDe,
} from '../../src/lib/identiteProfessionnelle.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(56)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}

const directeurQuiEnseigne = { prenom: 'Samuel', nom: 'Mogadzi', role: 'directeur', fonction: null }
const enseignante         = { prenom: 'Bintou', nom: 'Nabo', role: 'professeur', fonction: 'maitresse-fr-mat' }
const enseignant          = { prenom: 'Ornella', nom: 'Mogadzi', role: 'professeur', fonction: null }
const conseiller          = { prenom: 'Nadia', nom: 'Deyi', role: 'conseiller_vie_scolaire', fonction: null }

console.log('\n\x1b[0;90m── IDENTITÉ · un nom ne signe jamais seul   [V2.1 §3] ──\x1b[0m')

// P1 · toute personne obtient une fonction, même inconnue au tableau
{
  const cas = [directeurQuiEnseigne, enseignante, enseignant, conseiller,
               { prenom: 'X', nom: 'Y', role: 'role_inconnu' }]
  const muettes = cas.filter(p => !fonctionProfessionnelle(p))
  verifier('P1 · toute personne reçoit une fonction', muettes.length === 0,
    muettes.length ? `— ${muettes.length} sans fonction` : `— ${cas.length} cas`)
}

// P2 · la fonction dépend du contexte — le cœur de la règle
{
  const surCourrier = fonctionProfessionnelle(directeurQuiEnseigne, {})
  const surDevoir   = fonctionProfessionnelle(directeurQuiEnseigne, { role: 'professeur', matiere: 'Mathématiques' })
  verifier('P2 · un même agent signe différemment selon le document',
    surCourrier !== surDevoir && /math/i.test(surDevoir) && !/math/i.test(surCourrier),
    `— « ${surCourrier} » / « ${surDevoir} »`)
}

// P3 · la matière apparaît quand le document en porte une
{
  const avec = fonctionProfessionnelle(enseignant, { matiere: 'Français' })
  const sans = fonctionProfessionnelle(enseignant, {})
  verifier('P3 · la matière du document entre dans la fonction',
    avec.includes('Français') && !sans.includes('Français'), `— « ${avec} »`)
}

// P4 · le genre se lit dans les données, jamais dans le prénom
{
  const f = genreDe(enseignante)                                   // fonction féminine
  const inconnu = genreDe(enseignant)                              // rien pour trancher
  const explicite = genreDe({ ...enseignant, sexe: 'F' })          // colonne future
  verifier('P4 · le genre vient des données, pas du prénom',
    f === 'f' && inconnu === null && explicite === 'f',
    `— maternelle:${f} · inconnu:${inconnu} · déclaré:${explicite}`)
}

// P5 · sans information de genre, la forme épicène — jamais une supposition
{
  const a = fonctionProfessionnelle(enseignant, { matiere: 'Français' })
  const b = fonctionProfessionnelle({ ...enseignant, sexe: 'F' }, { matiere: 'Français' })
  verifier('P5 · forme épicène tant que le genre est inconnu',
    a.startsWith('Enseignant ') && b.startsWith('Enseignante '),
    `— « ${a} » / « ${b} »`)
}

// P6 · les fonctions qui s'accordent couvrent les rôles administratifs et
// pédagogiques ; le changement reste centralisé dans une seule bibliothèque.
{
  const cas = [
    ['directeur', 'Directrice'],
    ['responsable_administratif', 'Responsable administrative'],
    ['conseiller_vie_scolaire', 'Conseillère de vie scolaire'],
    ['surveillant', 'Surveillante'],
    ['professeur', 'Enseignante'],
  ]
  const incorrects = cas.filter(([role, attendu]) =>
    fonctionProfessionnelle({ role, sexe: 'F' }) !== attendu)
  verifier('P6 · les fonctions féminines viennent du sexe déclaré',
    incorrects.length === 0,
    incorrects.length ? `— ${incorrects.map(([role]) => role).join(', ')}` : `— ${cas.length} rôles`)
}

// P7 · le nom respecte la convention des documents officiels
{
  const n = nomProfessionnel(enseignant)
  verifier('P7 · prénom en casse normale, nom en capitales',
    n === 'Ornella MOGADZI', `— « ${n} »`)
}

// P8 · les deux formes de signature portent toujours les deux informations
{
  const s = signature(enseignant, { matiere: 'Français' })
  const l = signatureLigne(enseignant, { matiere: 'Français' })
  verifier('P8 · signature = nom + fonction, dans les deux formes',
    !!s.nom && !!s.fonction && l.includes(s.nom) && l.includes(s.fonction), `— « ${l} »`)
}

// P9 · aucun DOCUMENT ne réécrit une fonction à la main
//
// C'est la propriété qui empêche le retour du problème : une fonction saisie
// en dur dans un document dérive dès que la personne change de poste.
//
// Le périmètre est celui des documents — fichiers qui impriment, exportent ou
// composent une pièce signée. Les libellés de configuration en sont exclus :
// « Maîtresse de français » dans un menu de création de poste nomme un POSTE
// à pourvoir, pas le signataire d'une pièce. Une garde qui confond les deux
// oblige à la contourner, et une garde qu'on contourne ne sert plus.
{
  const { readdirSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')

  const estDocument = src =>
    /DocumentPrintStudio|window\.print\(|html2canvas|@media print/.test(src)

  const estConfiguration = ligne =>
    /\blabel\s*:|<option|placeholder=|\bcommentaire\s*:|^\s*\/\//.test(ligne)

  // Un intitulé de fonction suivi d'un complément : « Enseignant de Français »,
  // « Conseillère de vie scolaire », « Directeur — Direction ».
  const INTITULE = /(Enseignante?|Professeure?|Directrice|Directeur|Maîtresse|Ma[îi]tre|Surveillante?|Conseill[eè]re?)\s+(de|d'|—|-)\s/

  const coupables = []
  for (const f of readdirSync('src/pages').filter(f => f.endsWith('.jsx'))) {
    const src = readFileSync(join('src/pages', f), 'utf8')
    if (!estDocument(src)) continue
    if (/identiteProfessionnelle/.test(src)) continue
    const lignes = src.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => INTITULE.test(l) && !estConfiguration(l))
    if (lignes.length) coupables.push(`${f}:${lignes.map(([n]) => n).join(',')}`)
  }
  verifier('P9 · aucun document ne code une fonction en dur', coupables.length === 0,
    coupables.length ? `— ${coupables.join(' · ')}` : '')
}

console.log(echecs === 0
  ? `\n  ${V}9 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

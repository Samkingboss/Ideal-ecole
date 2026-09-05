import { readFileSync } from 'node:fs'

const source = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
// Partir du commentaire de l'interface dédiée : le fichier contient aussi
// des fonctions Direction avant ce rendu. Les inclure ferait croire que le
// Responsable administratif voit leurs boutons, alors qu'elles ne sont
// jamais rendues dans sa branche.
const blocRa = source.match(/INTERFACE DÉDIÉE : RESPONSABLE ADMINISTRATIF[\s\S]*?INTERFACE DIRECTEUR/)?.[0] || ''
const blocDirection = source.match(/INTERFACE DIRECTEUR[\s\S]*$/)?.[0] || ''
let echecs = 0

const verifier = (nom, condition) => {
  console.log(`${condition ? '✓' : '✗'} ${nom}`)
  if (!condition) echecs++
}

verifier('RH1 · les comptes et codes d’accès ont disparu du responsable administratif',
  !/Nouveau Dossier Personnel|Code d'accès|setShowModal\('prof'\)/.test(blocRa))
verifier('RH2 · le responsable administratif ne peut plus ouvrir l’éditeur salarial',
  !/setShowModal\('postes'\)/.test(blocRa))
verifier('RH3 · le Directeur conserve l’édition des postes et salaires',
  /activeDirectorTab === 'rh'[\s\S]*?setShowModal\('postes'\)/.test(blocDirection))
verifier('RH4 · les demandes RH restent accessibles au responsable administratif',
  /Demandes RH du personnel/.test(blocRa) && /repondreDemande/.test(blocRa))
verifier('RH5 · le référentiel salarial du responsable administratif reste en lecture seule',
  /Référentiel des Postes &amp; Salaires/.test(blocRa) && /Salaire Mensuel/.test(blocRa))
verifier('RH6 · le personnel est présenté en blocs sélectionnables',
  /Tout le personnel actif/.test(blocRa) && /setPersonnelRHSelectionne\(p\.id\)/.test(blocRa))
verifier('RH7 · toutes les demandes sont rattachées à leur enseignant par identifiant',
  /String\(d\.user_id\) === String\(personne\.id\)/.test(blocRa)
  && /Demandes RH \(\{demandes\.length\}\)/.test(blocRa))
verifier('RH8 · la décision sur une demande reste disponible dans la fiche',
  /repondreDemande\(d, 'Approuvée'/.test(blocRa) && /repondreDemande\(d, 'Refusée'/.test(blocRa))
verifier('RH9 · les indicateurs financiers sont séparés du personnel',
  /Vue financière globale/.test(blocRa) && /Tout le personnel actif/.test(blocRa))

console.log(echecs ? `\n${echecs} garde(s) RH en échec.` : '\n9 gardes RH au vert.')
process.exit(echecs ? 1 : 0)

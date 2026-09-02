import fs from 'node:fs'

const src = fs.readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
let echecs = 0

const verifier = (nom, condition) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${nom}`)
  if (!condition) echecs += 1
}

verifier('Pédagogie propose une sélection par enseignant',
  src.includes('enseignantPedagogieSelectionne') && src.includes('Tous les enseignants'))
verifier('Les préparations sont filtrées avec leur propriétaire réel',
  /String\(p\.user_id\) === String\(enseignantPedagogieSelectionne\)/.test(src))
verifier('RH propose un dossier par membre du personnel',
  src.includes('Dossiers du personnel') && src.includes('personnelRHSelectionne'))
verifier('Les demandes RH sont isolées par user_id',
  /String\(d\.user_id\) === String\(personnelRHSelectionne\)/.test(src))
verifier('Synthèse contient les deux blocs demandés',
  src.includes('Synthèse Personnel') && src.includes('Synthèse Élèves'))
verifier('La fiche personnel agrège préparations, RH, présences et points',
  ['Préparations :', 'Demandes RH :', 'Présences enregistrées :', 'Points :'].every(texte => src.includes(texte)))
verifier('La fiche élève agrège identité, inscription, progression et discipline',
  ['Matricule :', 'Inscription :', 'Check-points validés :', 'Incidents disciplinaires :'].every(texte => src.includes(texte)))
verifier('Aucune nouvelle mutation Supabase dans ce lot de présentation',
  !src.slice(src.indexOf('Synthèse de chaque membre du personnel'), src.indexOf('Avancement des Check-points')).includes("supabase."))

process.exit(echecs ? 1 : 0)

import fs from 'node:fs'

const src = fs.readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
let echecs = 0

const verifier = (nom, condition) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${nom}`)
  if (!condition) echecs += 1
}

verifier('Pédagogie propose une sélection par enseignant',
  src.includes('enseignantPedagogieSelectionne') && src.includes('Cliquez sur un enseignant'))
verifier('Les préparations sont filtrées avec leur propriétaire réel',
  /String\(p\.user_id\) === String\(enseignantPedagogieSelectionne\)/.test(src))
verifier('La fiche pédagogique remplace la liste et possède un retour',
  src.includes('!enseignantPedagogieSelectionne &&') && src.includes('← Retour aux enseignants'))
verifier('RH propose un dossier par membre du personnel',
  src.includes('Dossiers du personnel') && src.includes('personnelRHSelectionne'))
verifier('Les demandes RH sont isolées par user_id',
  /String\(d\.user_id\) === String\(personnelRHSelectionne\)/.test(src))
verifier('Synthèse contient les deux blocs demandés',
  src.includes('Synthèse Personnel') && src.includes('Synthèse Élèves'))
verifier('Accueil Synthèse limité aux deux accès et aux deux effectifs demandés',
  src.includes("syntheseVue === 'accueil'") && src.includes('Classes</div>')
  && !src.includes('<div className="kpi-label">Préparations</div>'))
verifier('Les fiches de synthèse remplacent les listes sur une vue dédiée',
  src.includes('!synthesePersonnelSelectionne &&') && src.includes('retourAccueilSynthese')
  && src.includes('!syntheseEleveSelectionne &&'))
verifier('Personnel et élèves sont triés et recherchables',
  src.includes('ordreAlphabetique') && src.includes('rechercheSynthesePersonnel')
  && src.includes('rechercheSyntheseEleves'))
verifier('La cuisinière est suivie par ses menus et non par des préparations',
  src.includes("p.role === 'cuisiniere'") && src.includes('Menu de la semaine :')
  && src.includes('Justificatifs transmis :'))
verifier('La fiche personnel agrège préparations, RH, présences et points',
  ['Préparations :', 'Demandes RH :', 'Présences enregistrées :', 'Points :'].every(texte => src.includes(texte)))
verifier('La fiche élève agrège identité, inscription, progression et discipline',
  ['Matricule :', 'Inscription :', 'Check-points validés :', 'Incidents disciplinaires :'].every(texte => src.includes(texte)))
verifier('Les fiches individuelles affichent leur progression',
  src.includes('Préparations validées') && src.includes('Progression pédagogique'))
verifier('Aucune nouvelle mutation Supabase dans ce lot de présentation',
  !src.slice(src.indexOf('Synthèse de chaque membre du personnel'), src.indexOf('      </div>\n\n      <div className="bottom-nav"')).includes("supabase."))

process.exit(echecs ? 1 : 0)

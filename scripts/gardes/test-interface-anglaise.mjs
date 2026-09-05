import fs from 'node:fs'
import { posteEnAnglais, traduireInterface } from '../../src/lib/interfaceLanguage.js'

let echecs = 0
const verifie = (nom, condition) => {
  if (condition) console.log(`  ✓ ${nom}`)
  else { console.error(`  ✗ ${nom}`); echecs += 1 }
}

const cas = [
  ['navigation', '📚 Pédagogie & Cours', '📚 Teaching & Lessons'],
  ['préparation', 'Soumettre une préparation', 'Submit a lesson plan'],
  ['assistante', 'Quel sera votre rôle pendant l’activité ?', 'What will your role be during the activity?'],
  ['matériel', 'Demander au surveillant', 'Request from the supervisor'],
  ['classe', 'ÉLÈVES DE LA CLASSE DE', 'PUPILS IN THE CLASS OF'],
  ['devoirs', 'Énoncé du devoir', 'Homework instructions'],
  ['bulletin', 'MON PORTRAIT D’APPRENTISSAGE', 'MY LEARNING PORTRAIT'],
  ['discipline', 'a perturbé le déroulement du cours', 'disrupted the lesson'],
  ['RH', 'Situation Familiale & Enfants du Personnel', 'Family Situation & Staff Children'],
  ['date complète', 'vendredi 5 septembre 2026', 'Friday 5 September 2026'],
  ['date abrégée', 'ven. 5 sept. 2026', 'Fri 5 Sep 2026'],
  ['erreur dynamique', 'Erreur : accès refusé', 'Error: accès refusé'],
]

cas.forEach(([nom, francais, anglais]) =>
  verifie(`${nom} traduit`, traduireInterface(francais) === anglais))

verifie('enseignante anglaise détectée', posteEnAnglais({ fonction:'enseignante-anglais-primaire' }))
verifie('assistante anglaise détectée sans champ langue', posteEnAnglais({ fonction:'assistante-en-maternelle' }))
verifie('ancien compte anglais détecté par langue', posteEnAnglais({ fonction:'Enseignant', langue:'en' }))
verifie('compte français non traduit', !posteEnAnglais({ fonction:'maitresse-fr-maternelle', langue:'fr' }))

const app = fs.readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8')
const prof = fs.readFileSync(new URL('../../src/pages/ProfApp.jsx', import.meta.url), 'utf8')
const notifications = fs.readFileSync(new URL('../../src/pages/NotificationCenter.jsx', import.meta.url), 'utf8')
verifie('traduction activée au niveau racine', /useEnglishInterface\(interfaceAnglaise\)/.test(app))
verifie('badge de langue fondé sur le poste complet', /interfaceAnglaise \? 'English' : 'Français'/.test(prof))
verifie('notifications enregistrées traduites', /traduireInterface/.test(notifications) && /ui\(n\.message\)/.test(notifications))

if (echecs) {
  console.error(`\n${echecs} garde(s) interface anglaise en échec.`)
  process.exit(1)
}
console.log(`\n${cas.length + 7} gardes interface anglaise au vert.`)

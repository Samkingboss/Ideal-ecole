import { readFileSync } from 'node:fs'

const directeur = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
const ra = directeur.match(/if \(user\.role === 'responsable_administratif'\)[\s\S]*?INTERFACE DIRECTEUR/)?.[0] || ''
let echecs = 0
const verifier = (nom, condition) => {
  console.log(`${condition ? '✓' : '✗'} ${nom}`)
  if (!condition) echecs++
}

const routes = [
  '/administration/cartes-scolaires',
  '/administration/certificats-scolarite',
  '/administration/effectifs',
  '/administration/cantine',
  '/administration/budget-cuisine',
]

verifier('N1 · les cinq routes dédiées sont déclarées et reliées aux cartes',
  routes.every(route => directeur.includes(`'${route}'`) && ra.includes(`href="${route}"`)))
verifier('N2 · le modèle Inscriptions reste une page autonome',
  ra.includes('href="/inscription.html"'))
verifier('N3 · les composants métier existants sont réutilisés',
  ['<CartesScolaires', '<CertificatScolarite', '<FichesEffectifs'].every(terme => ra.includes(terme)))
verifier('N4 · Cantine et Budget cuisine ont des rendus exclusifs',
  /moduleAdministration === 'cantine'/.test(ra) && /moduleAdministration === 'budget-cuisine'/.test(ra))
verifier('N5 · aucun contenu métier n’est rendu lorsque la grille d’accueil est visible',
  /!moduleAdministration && <>/.test(ra)
  && !/subTabEleve === '(cartes|certificat|liste|cantine|dossiers)'/.test(ra))
verifier('N6 · le retour Administration et le bouton précédent sont gérés',
  /href="\/administration"/.test(ra) && /popstate/.test(directeur))
verifier('N7 · le rafraîchissement direct est réécrit vers le SPA',
  vercel.rewrites?.some(regle => regle.source === '/administration/:module*' && regle.destination === '/index.html'))
verifier('N8 · aucune nouvelle surface Supabase ou permission n’est introduite',
  !/create policy|alter table|service[_-]?role/i.test(ra))

console.log(echecs ? `\n${echecs} garde(s) navigation en échec.` : '\n8 gardes navigation au vert.')
process.exit(echecs ? 1 : 0)

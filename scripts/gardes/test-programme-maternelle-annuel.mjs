import assert from 'node:assert/strict'
import fs from 'node:fs'

const programme = fs.readFileSync('src/pages/ProgrammeMaternelleAnnuel.jsx', 'utf8')
const passerelle = fs.readFileSync('src/pages/ProgrammePedagogique.jsx', 'utf8')
const prof = fs.readFileSync('src/pages/ProfApp.jsx', 'utf8')
const referentiel = fs.readFileSync('src/lib/programmes/maternelle.js', 'utf8')
const styles = fs.readFileSync('src/pages/ProgrammeMaternelleAnnuel.css', 'utf8')
const test = (nom, condition) => { assert.ok(condition, nom); console.log(`PASS — ${nom}`) }

test('Pédagogie et cours ouvre la vue annuelle pour les comptes maternelle', /maternelle\) return <ProgrammeMaternelleAnnuel/.test(passerelle) && /maternelle=\{compteMaternelle\}/.test(prof))
test('la source reste exactement le référentiel du bulletin', /programmeAnnuelMaternelle/.test(programme) && /MATERNELLE_DOMAINS/.test(referentiel))
test('les trois trimestres de l’année sont toujours parcourus', /\['t1', 't2', 't3'\]\.forEach/.test(referentiel))
test('les objectifs restent classés par matière', /matieres\.set\(domaine\.id/.test(referentiel) && /pma-subjects/.test(programme))
test('Petite Section et Grande Section restent séparées', /\['PS', 'GS'\]/.test(programme) && /Petite Section/.test(programme) && /Grande Section/.test(programme))
test('chaque enseignante ne voit que la langue de son compte', /langueMaternelle/.test(programme) && /estObjectifAnglaisMaternelle/.test(referentiel))
test('la recherche couvre matières et objectifs', /Rechercher une matière ou un objectif/.test(programme) && /objectifsDe\(item\)\.some/.test(programme))
test('un clic sur une matière ouvre son programme annuel détaillé', /setMatiereDemandee\(item\.id\)/.test(programme) && /Retour aux matières/.test(programme))
test('les objectifs préparés se déduisent des préparations existantes', /objectifsPrepares/.test(programme) && /contenu\?\.objectif/.test(programme) && /✓ Préparé/.test(programme))
test('le programme est en lecture seule et ne double aucune donnée', !/supabase|\.insert\(|\.upsert\(|\.update\(/.test(programme))
test('la vue possède une adaptation téléphone', /@media\(max-width:700px\)/.test(styles) && /grid-template-columns:1fr/.test(styles))

console.log('PASS — 11 gardes programme maternelle annuel')

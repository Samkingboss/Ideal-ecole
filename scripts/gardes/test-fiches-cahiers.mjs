import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estPreparationExploitable, estClasseMaternelle, genererFichesCahiers, paginerFiches } from '../../src/lib/fichesCahiers.js'

const prep = { status:'validee', matiere:'Mathématiques', date_cours:'2026-08-27', contenu:{ objectif:'Comparer les nombres jusqu’à 100', trace:'Relire la leçon', programme:{ unite:'Numération', titre:'Les nombres jusqu’à 100' }, sequences:[{ etapes:{ decouverte:{ texte:'Manipulation de cartes-nombres' }, pratique:{ texte:'Comparaison en binômes' } } }] } }
const eleves = [{id:'m',prenom:'Moussa',nom:'Diallo',actif:true},{id:'a',prenom:'Aminata',nom:'Traoré',actif:true},{id:'k',prenom:'Kadi',nom:'Koné',actif:true},{id:'x',prenom:'Ancien',nom:'Élève',actif:false}]
const fiches = genererFichesCahiers({ preparation:prep, eleves, classeNom:'CP1', enseignant:'Mme Test', observations:{m:'Très bonne participation'}, presences:{a:{statut:'absent'}} })
const interfaceSource = readFileSync('src/pages/FichesCahiers.jsx','utf8')
const preparationSource = readFileSync('src/pages/FichePreparation.jsx','utf8')
const tests = []
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`); tests.push(true) } catch (e) { console.log(`✗ ${nom} — ${e.message}`); tests.push(false) } }

test('F1 · non validée interdite',()=>assert.equal(estPreparationExploitable('a_corriger'),false))
test('F2 · N élèves actifs donnent N fiches',()=>assert.equal(fiches.length,3))
test('F3 · chaque fiche porte le bon enfant',()=>assert.deepEqual(fiches.map(f=>f.prenom),['Moussa','Aminata','Kadi']))
test('F4 · aucune observation ne fuit',()=>{assert.equal(fiches[0].observation,'Très bonne participation'); assert.equal(fiches[1].observation,'')})
test('F5 · contenu tiré de la préparation',()=>assert.equal(fiches[0].objectif,prep.contenu.objectif))
test('F6 · aucun champ sensible',()=>assert.ok(fiches.every(f=>!('parent_phone' in f)&&!('allergies_connues' in f))))
test('F7 · template maternelle automatique',()=>assert.equal(genererFichesCahiers({preparation:prep,eleves:[eleves[0]],classeNom:'Petite Section'})[0].template,'maternelle'))
test('F8 · template primaire automatique',()=>assert.equal(estClasseMaternelle('CP1'),false))
test('F9 · une fiche reste entière dans une case',()=>assert.ok(paginerFiches(fiches).every(p=>p.length<=2)))
test('F10 · pagination déterministe',()=>assert.deepEqual(paginerFiches(fiches).map(p=>p.map(f=>f.id)),[['m','a'],['k']]))
test('F11 · aucun null ou undefined',()=>assert.ok(fiches.every(f=>Object.values(f).every(v=>v!==null&&v!==undefined))))
test('F12 · aucune progression inventée',()=>assert.equal(genererFichesCahiers({preparation:{...prep,contenu:{...prep.contenu,programme:null}},eleves:[eleves[0]],classeNom:'CP1'})[0].progression,''))
test('F13 · anciens élèves exclus',()=>assert.ok(!fiches.some(f=>f.id==='x')))
test('F14 · aperçu et impression partagent les mêmes objets',()=>assert.equal(paginerFiches(fiches).flat()[1],fiches[1]))
test('F15 · aucune notification dans le générateur',()=>assert.ok(!genererFichesCahiers.toString().match(/pushNotification|notifier/)))
test('F16 · absence connue évite d’affirmer que l’enfant a appris',()=>assert.ok(!fiches[1].introduction.includes('Aminata a appris')))
test('F17 · action enfermée dans le statut validé',()=>assert.match(preparationSource,/statut === 'validee'[\s\S]*?Générer les fiches des élèves/))
test('F18 · impression protège les fiches et fixe deux cases A5',()=>{assert.match(interfaceSource,/page-break-inside:avoid/);assert.match(interfaceSource,/grid-template-rows:1fr 1fr/)})
test('F19 · requête élève minimale et active',()=>{assert.match(interfaceSource,/select\('id,prenom,nom,classe_id,actif'\)/);assert.match(interfaceSource,/eq\('actif', true\)/)})
test('F20 · aucune donnée sensible demandée',()=>assert.ok(!/parent_phone|allergies_connues|tel1|whatsapp/.test(interfaceSource)))
test('F21 · PS et GS ont une résolution explicite',()=>assert.ok(/g === 'ps'/.test(interfaceSource)&&/g === 'gs'/.test(interfaceSource)))
test('F22 · présence et observation limitées aux élèves actifs chargés',()=>assert.ok((interfaceSource.match(/\.in\('eleve_id', ids\)/g)||[]).length===2))
test('F23 · protection mobile sans débordement horizontal',()=>assert.match(interfaceSource,/@media\(max-width:600px\)[\s\S]*?overflow-x:hidden/))

const debut = performance.now()
const trente = genererFichesCahiers({preparation:prep,eleves:Array.from({length:30},(_,i)=>({id:String(i),prenom:`Élève ${i}`,actif:true})),classeNom:'CP1'})
const duree = performance.now()-debut
test('PERF · 30 fiches en moins de 100 ms',()=>{assert.equal(trente.length,30); assert.ok(duree<100)})
console.log(`\n${tests.filter(Boolean).length}/${tests.length} gardes fiches cahiers au vert · ${duree.toFixed(2)} ms pour 30 élèves.`)
process.exit(tests.every(Boolean)?0:1)

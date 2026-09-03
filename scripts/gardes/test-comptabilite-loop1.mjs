import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  protegerMutationSalariale, salairesDepuisPostes, synchroniserEleves, trouverClasseCanonique,
} from '../../src/lib/comptabiliteRA.js'

const composant = readFileSync('src/pages/ComptabiliteRA.jsx', 'utf8')
const directeur = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
const lib = readFileSync('src/lib/comptabiliteRA.js', 'utf8')
const classes = [
  { id:'classe-ps', nom:'Petite Section' }, { id:'classe-gs', nom:'Grande Section' },
  { id:'classe-cp1', nom:'CP1' }, { id:'classe-ce1', nom:'CE1' },
]
const inscriptions = [
  { id:'ps', statut:'validee', matricule:'PS-1', nom:'A', prenom:'A', classe_demandee:'Petite Section' },
  { id:'gs', statut:'validee', matricule:'GS-1', nom:'B', prenom:'B', classe_demandee:'Grande Section bilingue' },
  { id:'cp1', statut:'validee', matricule:'CP-1', nom:'C', prenom:'C', classe_demandee:'CP1' },
  { id:'ce1', statut:'validee', matricule:'CE-1', nom:'D', prenom:'D', classe_demandee:'CE1' },
  { id:'attente', statut:'en_attente', matricule:'X-1', nom:'X', prenom:'X', classe_demandee:'Petite Section' },
]

let echecs = 0
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`) } catch (e) { echecs++; console.log(`✗ ${nom} — ${e.message}`) } }

test('SYNC1 · la table classes est la source canonique', () => {
  assert.equal(trouverClasseCanonique('Petite Section', classes)?.id, 'classe-ps')
  assert.equal(trouverClasseCanonique('Grande Section bilingue', classes)?.id, 'classe-gs')
})
test('SYNC2 · Petite Section et les autres niveaux sont importés', () => {
  const { suivant, nombre } = synchroniserEleves({}, inscriptions, classes)
  assert.equal(nombre, 4)
  assert.deepEqual(suivant.students.map(e => e.classe), ['Petite Section','Grande Section','CP1','CE1'])
  assert.deepEqual(suivant.students.map(e => e.classe_id), ['classe-ps','classe-gs','classe-cp1','classe-ce1'])
})
test('SYNC3 · une inscription non validée reste exclue', () => {
  assert.ok(!synchroniserEleves({}, inscriptions, classes).suivant.students.some(e => e.sourceInscription === 'attente'))
})
test('SYNC4 mutation · une correspondance partielle ne passe plus', () => {
  assert.equal(trouverClasseCanonique('CP', classes), null)
})
test('SYNC5 · une correction administrative actualise l’identité comptable', () => {
  const historique = [{ amount:25000, receiptId:'REC-1' }]
  const reductions = [{ id:'r1', montant:5000 }]
  const etat = { students:[{
    id:'inscription-cp1', sourceInscription:'cp1', matricule:'CP-1', nom:'C', prenom:'Sarah',
    classe:'CP1', classe_id:'classe-cp1', cantine:false, annee_scolaire:'2026-2027',
    famille:'FAMILLE CONSERVÉE', plan:'mensuel', history:historique, reductions,
  }] }
  const corrigees = inscriptions.map(i => i.id === 'cp1' ? { ...i, prenom:'Saran', cantine:true } : i)
  const { suivant, nombre, modifies } = synchroniserEleves(etat, corrigees, classes)
  assert.equal(nombre, 3)
  assert.equal(modifies, 1)
  const fiche = suivant.students.find(s => s.sourceInscription === 'cp1')
  assert.equal(fiche.prenom, 'Saran')
  assert.equal(fiche.cantine, true)
  assert.equal(fiche.famille, 'FAMILLE CONSERVÉE')
  assert.equal(fiche.plan, 'mensuel')
  assert.deepEqual(fiche.history, historique)
  assert.deepEqual(fiche.reductions, reductions)
})

const courant = { salaires:[{id:'s',mensuel:100}], paies:{'2026-08':[{statut:'En attente'}]}, charges:[{id:'salaires',montant:1200},{id:'loyer',montant:500}] }
const attaque = { salaires:[{id:'s',mensuel:1}], paies:{'2026-08':[{statut:'Payé'}]}, charges:[{id:'salaires',montant:12},{id:'loyer',montant:600}] }
test('SAL1 · la protection métier restaure salaires, paie et charge salariale du RA', () => {
  const protege = protegerMutationSalariale(courant, attaque, 'responsable_administratif')
  assert.deepEqual(protege.salaires, courant.salaires)
  assert.deepEqual(protege.paies, courant.paies)
  assert.equal(protege.charges[0].montant, 1200)
  assert.equal(protege.charges[1].montant, 600)
})
test('SAL2 contre-test · le Directeur n’est pas bloqué par la protection RA', () => {
  assert.equal(protegerMutationSalariale(courant, attaque, 'directeur'), attaque)
})
test('SAL3 · aucun éditeur salarial ne subsiste dans la vue RA', () => {
  assert.ok(!/modifierSalaire|modifierPaie|enregistrerSalaires/.test(composant))
  assert.ok(!/data-label="(Poste|Primes|Retenues|Statut)"[^<]*><(input|select)/.test(composant))
})
test('SAL4 · le Directeur conserve une garde de rôle explicite', () => {
  assert.match(directeur, /savePostes[\s\S]{0,120}user\.role !== 'directeur'/)
})

test('SRC1 · app_state rh/postes alimente directement la Comptabilité', () => {
  assert.match(directeur, /<ComptabiliteRA[^>]*postes=\{postes\}/)
  assert.match(composant, /salairesDepuisPostes\(postes\)/)
  assert.ok(!/SALAIRES_PREVISIONNELS/.test(lib + composant))
})
test('SRC2 mutation · la copie historique state_json.salaires ne gagne pas', () => {
  assert.deepEqual(salairesDepuisPostes([{id:'canon',label:'Canon',mensuel:250}]), [{id:'canon',poste:'Canon',mensuel:250}])
})

test('IMP1 · le RA ne reçoit aucun contrôle d’import complet', () => {
  assert.match(composant, /user\?\.role === 'directeur'[\s\S]{0,180}📂 Importer/)
})
test('IMP2 mutation · le gestionnaire refuse explicitement le RA', () => {
  assert.match(composant, /const importer = event => \{\s*if \(user\?\.role !== 'directeur'\)/)
})

console.log(echecs ? `\n${echecs} garde(s) loop 1 en échec.` : '\n12 gardes loop 1 au vert.')
process.exit(echecs ? 1 : 0)

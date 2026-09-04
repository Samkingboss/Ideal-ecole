import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cleClassePrevisionnelle, comparerEffectifs } from '../../src/lib/comptabiliteRA.js'

const directeur = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
const comptabilite = readFileSync('src/pages/ComptabiliteRA.jsx', 'utf8')
const migration = readFileSync('sql/salaires_direction_seule.sql', 'utf8')
const blocRa = directeur.match(/if \(user\.role === 'responsable_administratif'\) \{[\s\S]*?INTERFACE DIRECTEUR/)?.[0] || ''

let echecs = 0
const test = (nom, fn) => {
  try { fn(); console.log(`✓ ${nom}`) }
  catch (error) { echecs++; console.log(`✗ ${nom} — ${error.message}`) }
}

test('PR1 · les libellés de classes alimentent la même comparaison', () => {
  assert.equal(cleClassePrevisionnelle('Petite Section bilingue'), 'ps')
  assert.equal(cleClassePrevisionnelle('Grande Section'), 'gs')
  assert.equal(cleClassePrevisionnelle('CP1'), 'cp1')
})

test('PR2 · le réel exclut les départs et reste ventilé par classe', () => {
  const resultat = comparerEffectifs({ students: [
    { classe: 'Petite Section' }, { classe: 'PS' }, { classe: 'CP1' },
    { classe: 'CP1', dateDepart: '2026-09-01' },
  ] }, { ps: 3, cp1: 2 })
  assert.equal(resultat.prevu, 5)
  assert.equal(resultat.reel, 3)
  assert.deepEqual(resultat.lignes, [
    { classe: 'ps', prevu: 3, reel: 2, ecart: -1 },
    { classe: 'cp1', prevu: 2, reel: 1, ecart: -1 },
  ])
})

test('PR3 · le Responsable administratif voit prévision, réel et écart', () => {
  assert.match(comptabilite, /Prévisionnel comparé au réel/)
  assert.match(comptabilite, /Effectif prévu/)
  assert.match(comptabilite, /Effectif réel/)
  assert.match(comptabilite, /Encaissements réels \/ recettes annuelles prévues/)
})

test('SAL-D1 · la vue RA reste en lecture seule', () => {
  assert.match(blocRa, /Lecture seule/)
  assert.ok(!/setShowModal\('postes'\)/.test(blocRa))
})

test('SAL-D2 · le chargement RA ne réécrit plus rh\/postes', () => {
  assert.match(directeur, /if \(user\.role === 'directeur'\) \{[\s\S]{0,900}modifierListePartagee\([\s\S]{0,900}else \{[\s\S]{0,500}\.select\('value'\)\.eq\('app', 'rh'\)\.eq\('key', 'postes'\)/)
})

test('SAL-D3 · la base protège les deux sources salariales', () => {
  assert.match(migration, /v_key in \('postes', 'personnel'\)/)
  assert.match(migration, /not public\.ideal_est\(array\['directeur'\]\)/)
  assert.match(migration, /financement_salaires_direction_seule/)
  assert.match(migration, /public\.ideal_est\(array\['responsable_administratif'\]\)/)
})

console.log(echecs ? `\n${echecs} garde(s) salaires/comparatif en échec.` : '\n6 gardes salaires/comparatif au vert.')
process.exit(echecs ? 1 : 0)

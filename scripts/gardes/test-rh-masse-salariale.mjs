import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
const declaration = "const masseSalariale = (postes || []).reduce((s, p) => s + (p.mensuel || 0), 0)"
const debutRa = source.indexOf("if (user.role === 'responsable_administratif')")
const debutDirection = source.indexOf('INTERFACE DIRECTEUR')

let echecs = 0
const test = (nom, fn) => {
  try { fn(); console.log(`✓ ${nom}`) }
  catch (error) { echecs++; console.log(`✗ ${nom} — ${error.message}`) }
}

const verifierPortee = code => {
  const positionDeclaration = code.indexOf(declaration)
  // RECALIBREE le 03/09/2026 : l'ancre avait glisse.
  //
  // La garde cherchait la premiere occurrence de
  // `if (user.role === 'responsable_administratif')`. Le 02/09, une ligne
  // de NAVIGATION portant exactement ce texte est apparue bien plus haut
  // dans le fichier :
  //
  //   if (user.role === 'responsable_administratif') setModuleAdministration('inscriptions')
  //
  // L'ancre a saute de la ligne 954 — la vraie branche de rendu — a la
  // ligne 389, et la garde a conclu que la declaration venait apres. Elle
  // mesurait la position d'une instruction de navigation.
  //
  // On ancre desormais sur la BRANCHE, reconnaissable a son accolade
  // ouvrante : une garde qui suit un `if` d'une ligne ne prouve rien.
  const positionRa = code.indexOf("if (user.role === 'responsable_administratif') {")
  const positionDirection = code.indexOf('INTERFACE DIRECTEUR')
  return positionDeclaration >= 0
    && positionDeclaration < positionRa
    && positionRa < positionDirection
    && (code.match(/const masseSalariale/g) || []).length === 1
}

test('RH-M1 · la masse salariale est déclarée dans la portée commune RA/Directeur', () => {
  assert.ok(verifierPortee(source))
})
test('RH-M2 · le Responsable administratif conserve ses indicateurs', () => {
  const blocRa = source.slice(debutRa, debutDirection)
  assert.match(blocRa, /fcfa\(masseSalariale\)/)
  assert.match(blocRa, /fcfa\(masseSalariale \* 12\)/)
})
test('RH-M3 · le Directeur peut afficher son référentiel salarial', () => {
  const blocDirection = source.slice(debutDirection)
  assert.match(blocDirection, /fcfa\(masseSalariale\)/)
})
test('RH-M4 mutation · le défaut de portée d’origine est détecté', () => {
  const mutation = source.replace(declaration, '').replace(
    "if (user.role === 'responsable_administratif') {",
    `if (user.role === 'responsable_administratif') {\n    ${declaration}`,
  )
  assert.equal(verifierPortee(mutation), false)
})

console.log(echecs ? `\n${echecs} garde(s) masse salariale en échec.` : '\n4 gardes masse salariale au vert.')
process.exit(echecs ? 1 : 0)

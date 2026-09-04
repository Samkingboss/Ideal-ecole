import fs from 'node:fs'
import assert from 'node:assert/strict'
import { moyenneEnsemble, moyenneMatiere, moyenneModalite, notesInvalides } from '../../src/lib/bulletinPrimaire.js'

let echecs = 0
const test = (nom, fn) => {
  try { fn(); console.log(`  \u001b[32m✓\u001b[0m ${nom}`) }
  catch (erreur) { echecs += 1; console.error(`  \u001b[31m✗\u001b[0m ${nom} — ${erreur.message}`) }
}

console.log('\nBULLETIN PRIMAIRE · calculs, rôles et continuité')

test('les notes de barèmes différents sont ramenées sur 20', () => {
  assert.equal(moyenneModalite([{ note: 8, bareme: 10 }, { note: 15, bareme: 20 }]), 15.5)
})

test('une matière uniquement orale n’est pas pénalisée par l’écrit absent', () => {
  assert.equal(moyenneMatiere({ notes: { ecrit: [], oral: [{ note: 18, bareme: 20 }] } }), 18)
})

test('écrit et oral disponibles pèsent chacun la moitié', () => {
  assert.equal(moyenneMatiere({ notes: { ecrit: [{ note: 12, bareme: 20 }], oral: [{ note: 16, bareme: 20 }] } }), 14)
})

test('les matières non évaluées ne deviennent jamais des zéros', () => {
  assert.equal(moyenneEnsemble({ lecture: { notes: { ecrit: [], oral: [] } }, maths: { notes: { ecrit: [{ note: 14, bareme: 20 }], oral: [] } } }), 14)
})

test('une note supérieure au barème est refusée', () => {
  assert.equal(notesInvalides({ notes: { ecrit: [{ note: 21, bareme: 20 }], oral: [] } }).length, 1)
})

const ecran = fs.readFileSync('src/pages/BulletinPrimaire.jsx', 'utf8')
const prof = fs.readFileSync('src/pages/ProfApp.jsx', 'utf8')
const sql = fs.readFileSync('sql/bulletins_primaire.sql', 'utf8')
const rollback = fs.readFileSync('sql/bulletins_primaire_rollback.sql', 'utf8')

test('le primaire dispose d’un chemin visible dans le compte enseignant', () => {
  assert.match(prof, /tab === 'bulletins-primaire'/)
  assert.match(prof, /<BulletinPrimaire user=\{user\} eleves=\{eleves\}/)
})

test('le bulletin sépare explicitement les programmes national et international', () => {
  assert.match(ecran, /Programme national malien/)
  assert.match(ecran, /International programme/)
})

test('la photo est réutilisée depuis le dossier officiel', () => {
  assert.match(sql, /left join public\.inscriptions i on i\.id = e\.inscription_id/)
  assert.match(ecran, /createSignedUrl\(lignePhoto\.photo_chemin/)
})

test('le serveur limite l’écriture à la matière affectée à l’enseignant', () => {
  assert.match(sql, /a\.prof_id = v_moi\.id/)
  assert.match(sql, /regexp_split_to_array/)
  assert.match(sql, /raise exception 'matiere_non_affectee'/)
})

test('les groupes pédagogiques combinés couvrent chaque classe primaire', () => {
  assert.match(ecran, /groupeCouvreClasse/)
  assert.match(ecran, /split\(\/\\s\*\\\/\\s\*\//)
})

test('la migration possède son retour arrière écrit à l’avance', () => {
  assert.match(rollback, /drop table if exists public\.primaire_bulletins/)
  assert.match(rollback, /drop function if exists public\.sauver_evaluation_primaire/)
})

if (echecs) process.exit(1)

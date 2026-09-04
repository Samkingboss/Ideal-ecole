import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lire = chemin => readFileSync(chemin, 'utf8')
const sql = lire('sql/personnel_sexe_fonctions.sql')
const rollback = lire('sql/personnel_sexe_fonctions_rollback.sql')
const page = lire('src/pages/DirecteurApp.jsx')
const api = lire('api/personnel-creer.js')
const app = lire('src/App.jsx')

let echecs = 0
const verifier = (nom, fn) => {
  try { fn(); console.log(`PASS — ${nom}`) }
  catch (e) { echecs++; console.log(`FAIL — ${nom} : ${e.message}`) }
}

verifier('source unique users.sexe contrainte à F ou M', () => {
  assert.match(sql, /alter table public\.users\s+add column if not exists sexe text/)
  assert.match(sql, /check \(sexe is null or sexe in \('F', 'M'\)\)/)
})

verifier('création exige et transmet le sexe déclaré', () => {
  assert.match(api, /const sexe = String\(corps\.sexe/)
  assert.match(api, /!\['F', 'M'\]\.includes\(sexe\)/)
  assert.match(api, /p_sexe: sexe/)
  assert.match(page, /value=\{newProf\.sexe\}/)
  assert.match(page, /sexe: newProf\.sexe/)
})

verifier('les fiches existantes sont corrigeables par la Direction', () => {
  assert.match(page, /rpc\('modifier_sexe_personnel'/)
  assert.match(page, /value=\{p\.sexe \|\| ''\}/)
  assert.match(sql, /create or replace function public\.modifier_sexe_personnel/)
  assert.match(sql, /ideal_est\(array\['directeur'\]\)/)
})

verifier('chaque correction de sexe est auditée', () => {
  const debut = sql.indexOf('create or replace function public.modifier_sexe_personnel')
  const fin = sql.indexOf('$function$;', debut)
  const corps = sql.slice(debut, fin)
  assert.match(corps, /insert into public\.journal_audit/)
  assert.match(corps, /'sexe', v_ancien, v_sexe/)
  assert.match(corps, /'modification_sexe_personnel'/)
})

verifier('RPC fermée à anon et accordée aux sessions authentifiées', () => {
  assert.match(sql, /revoke all on function public\.modifier_sexe_personnel\(uuid,text\)\s+from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.modifier_sexe_personnel\(uuid,text\)\s+to authenticated/)
})

verifier('le sexe suit la session vers tous les supports', () => {
  const liste = app.match(/const CHAMPS_SESSION = \[([\s\S]*?)\]/)?.[1] || ''
  assert.match(liste, /'sexe'/)
})

verifier('rollback disponible sans effacer les valeurs saisies', () => {
  assert.match(rollback, /drop function if exists public\.modifier_sexe_personnel/)
  assert.doesNotMatch(rollback, /drop column|update public\.users|delete from public\.users/)
})

process.exit(echecs ? 1 : 0)


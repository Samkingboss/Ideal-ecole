import assert from 'node:assert/strict'
import fs from 'node:fs'

const lire = chemin => fs.readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8')
const client = lire('src/pages/FichePreparation.jsx')
const sql = lire('sql/nettoyer_sequences_preparation.sql')
const rollback = lire('sql/nettoyer_sequences_preparation_rollback.sql')

assert.doesNotMatch(client, /from\('preparations'\)\.delete\(\)/)
assert.match(client, /rpc\(\s*['"]nettoyer_sequences_preparation['"]/)
assert.match(client, /if \(enTrop\.length\)/)
console.log('✓ S1/S8/S9 · aucun DELETE client, RPC seulement si nécessaire, erreur détaillée')

for (const garde of [
  /u\.auth_user_id = auth\.uid\(\)/,
  /v_prof\.role <> 'professeur'/,
  /p\.user_id = v_prof\.id/,
  /p\.date_cours = v_ancre\.date_cours/,
  /p\.matiere is not distinct from v_ancre\.matiere/,
  /p\.groupe is not distinct from v_ancre\.groupe/,
  /p\.sequence >= p_sequence_debut \+ p_nb_sequences/,
  /p\.sequence < p_sequence_debut \+ 6/,
  /p\.id = any\(v_ids\)/,
]) assert.match(sql, garde)
console.log('✓ S2/S3/S4 · propriétaire, IDs, plage, date, matière et groupe recoupés côté serveur')

assert.match(sql, /cardinality\(v_ids\) > 5/)
assert.match(sql, /'restantes', v_restantes/)
assert.match(sql, /sequence_cible_hors_bloc/)
console.log('✓ S5 · une cible hors bloc refuse toute la transaction')

assert.match(sql, /p\.id = any\(v_ids\)[\s\S]*v_hors_bloc/)
assert.match(sql, /IDs deja absents sont permis : le retry est idempotent/)
console.log('✓ S6/S7 · retry sans suppression supplémentaire')

assert.match(sql, /revoke all[\s\S]*from public, anon/)
assert.match(sql, /grant execute[\s\S]*to authenticated/)
assert.doesNotMatch(sql, /create policy|alter policy|disable row level security/i)
assert.match(rollback, /drop function if exists public\.nettoyer_sequences_preparation/)
console.log('✓ RLS · anon refusé, authenticated seul, policies inchangées, rollback présent')

for (const interdit of ['2a7def1e', 'Ornella', 'CP1', 'c33c5786']) {
  assert.ok(!client.includes(interdit) && !sql.includes(interdit), `hardcode interdit: ${interdit}`)
}
console.log('✓ Multi-enseignants · aucun professeur, groupe ou preparation_id codé en dur')

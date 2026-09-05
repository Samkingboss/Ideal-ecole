import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
const app = readFileSync('src/App.jsx', 'utf8')
const sql = readFileSync('sql/personnel_modification_direction.sql', 'utf8')
const rollback = readFileSync('sql/personnel_modification_direction_rollback.sql', 'utf8')
let echecs = 0

const verifier = (nom, fn) => {
  try { fn(); console.log(`PASS — ${nom}`) }
  catch (erreur) { echecs += 1; console.log(`FAIL — ${nom} : ${erreur.message}`) }
}

verifier('chaque fiche possède une option Modifier', () => {
  assert.match(page, /onClick=\{\(\) => ouvrirModificationPersonnel\(p\)\}/)
  assert.match(page, /Modifier la fiche/)
})

verifier('le formulaire distingue création et modification', () => {
  assert.match(page, /newProf\.id \? ["']Modifier la fiche du personnel/)
  assert.match(page, /newProf\.id \? 'Enregistrer les modifications'/)
})

verifier('la modification appelle une RPC dédiée et conserve le compte', () => {
  assert.match(page, /rpc\('modifier_membre_personnel'/)
  assert.match(page, /L'identifiant de connexion reste inchangé/)
  assert.doesNotMatch(sql, /set\s+identifiant\s*=/i)
  assert.doesNotMatch(sql, /set\s+auth_user_id\s*=/i)
})

verifier('la RPC est exclusivement gardée par le rôle Direction', () => {
  assert.match(sql, /ideal_est\(array\['directeur'\]\)/)
  assert.match(sql, /revoke all on function public\.modifier_membre_personnel[\s\S]*?from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.modifier_membre_personnel[\s\S]*?to authenticated/)
})

verifier('identité, fonction, contact et classes sont modifiables ensemble', () => {
  for (const repere of [
    'set prenom = v_prenom',
    'role = v_role',
    'fonction = v_fonction',
    'insert into public.personnel_contact',
    'delete from public.prof_classes',
    'insert into public.prof_classes',
  ]) assert.ok(sql.includes(repere), `${repere} absent`)
})

verifier('une lecture de contact impossible ne peut pas effacer le téléphone', () => {
  assert.match(page, /p_modifier_telephone: Boolean\(newProf\.telephone_charge\)/)
  assert.match(sql, /if coalesce\(p_modifier_telephone, false\) then/)
})

verifier('chaque changement est journalisé', () => {
  assert.match(sql, /insert into public\.journal_audit/)
  assert.match(sql, /'modification_fiche_personnel'/)
  assert.match(sql, /v_avant::text, v_apres::text/)
})

verifier('le compte déjà connecté adopte aussi sa fiche corrigée', () => {
  assert.match(app, /profil-session-\$\{user\.id\}/)
  assert.match(app, /table: 'users', filter: `id=eq\.\$\{user\.id\}`/)
  assert.match(app, /localStorage\.setItem\('ideal_user', serialise\)/)
})

verifier('le rollback ne supprime aucune fiche', () => {
  assert.match(rollback, /drop function if exists public\.modifier_membre_personnel/)
  assert.doesNotMatch(rollback, /delete from|update public\.users|drop table/i)
})

process.exit(echecs ? 1 : 0)

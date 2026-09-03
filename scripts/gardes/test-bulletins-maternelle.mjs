import assert from 'node:assert/strict'
import fs from 'node:fs'

const prof = fs.readFileSync('src/pages/ProfApp.jsx', 'utf8')
const studio = fs.readFileSync('src/pages/BulletinMaternelleStudio.jsx', 'utf8')
const bulletin = fs.readFileSync('public/bulletin-maternelle/index.html', 'utf8')
const sql = fs.readFileSync('sql/bulletins_maternelle.sql', 'utf8')

const test = (nom, condition) => { assert.ok(condition, nom); console.log(`PASS — ${nom}`) }

test('le bulletin est réservé aux comptes maternelle', /compteMaternelle && <button[\s\S]*?setTab\('bulletins-maternelle'\)/.test(prof))
test('la source canonique est la liste eleves IDEAL', /eleves\.filter\(e => estMaternelle\(e\.classes\?\.nom\)\)/.test(studio))
test('aucun élève de démonstration n’est chargé', /await window\.idealBridge\.ready/.test(bulletin) && !/loadPreloadedDemoData\(\);\s*\n\s*}\s*else/.test(bulletin))
test('création et suppression d’élève sont masquées', /id="btn-new-student"[^>]+hidden/.test(bulletin) && /id="btn-delete-student"[^>]+hidden/.test(bulletin))
test('identité et classe sont en lecture seule', /id="student-name"[^>]+readonly/.test(bulletin) && /id="student-section"[^>]+disabled/.test(bulletin))
test('une ligne serveur est unique par élève, trimestre et année', /unique \(eleve_id, trimestre, annee_scolaire\)/i.test(sql))
test('le serveur déduit le personnel depuis auth.uid', /auth\.uid\(\)/.test(sql) && /auth_user_id/.test(sql))
test('aucun accès direct à la table bulletins', /revoke all on table public\.maternelle_bulletins from public, anon, authenticated/.test(sql))
test('les RPC sont réservées aux comptes authentifiés', /grant execute on function public\.lire_bulletins_maternelle\(uuid\[\]\) to authenticated/.test(sql) && /grant execute on function public\.sauver_bulletin_maternelle\(uuid,text,text,jsonb\) to authenticated/.test(sql))

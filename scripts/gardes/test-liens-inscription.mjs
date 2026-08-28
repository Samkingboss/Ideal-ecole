import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('sql/liens_publics_inscription.sql', 'utf8')
const rollback = readFileSync('sql/liens_publics_inscription_rollback.sql', 'utf8')
const inscription = readFileSync('public/inscription.html', 'utf8')
const carte = readFileSync('public/fiche.html', 'utf8')
const suivi = readFileSync('public/suivi-inscription.html', 'utf8')
let echecs = 0
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`) } catch (e) { echecs++; console.log(`✗ ${nom} — ${e.message}`) } }

test('S1/S2 · token absent, mal formé ou inconnu : aucune donnée', () => {
  assert.ok(sql.includes("p_token is null or p_token !~ '^[0-9a-f]{64}$'"))
  assert.match(sql, /if not found then\s+return jsonb_build_object\('ok', false\)/)
})
test('S3 · le serveur résout seul l’inscription depuis le hash', () => {
  assert.match(sql, /join public\.inscriptions i on i\.id = l\.inscription_id/)
  assert.doesNotMatch(sql, /l\.inscription_id\s*=\s*p_/)
})
test('S4/S5/S6 · aucune lecture publique par UUID, matricule ou nom', () => {
  assert.doesNotMatch(sql, /get_inscription|p_inscription_id[^\n]*lire|p_matricule|p_nom/)
  assert.match(sql, /l\.token_hash = extensions\.digest/)
})
test('S7/S8 · le suivi ne retourne ni signature ni fiche définitive', () => {
  const lecture = sql.slice(sql.indexOf('create or replace function public.lire_suivi_inscription'))
  assert.doesNotMatch(lecture, /signature_chemin|signature_directeur|responsable|telephone|email|adresse|profession/)
  assert.match(lecture, /l\.type_lien = 'SUIVI'/)
})
test('S11 · révocation et expiration sont obligatoirement vérifiées', () => {
  assert.match(sql, /l\.revoked_at is null/)
  assert.match(sql, /l\.expires_at is null or l\.expires_at > now\(\)/)
})
test('S12 · aucun secret serveur dans le client', () => {
  assert.doesNotMatch(inscription, /SUPABASE_SECRET_KEY|service_role/i)
})
test('S13 · aucune policy Storage ni lecture directe de la table', () => {
  assert.doesNotMatch(sql, /storage\.objects|create policy/)
  assert.match(sql, /revoke all on table public\.liens_publics_inscription from public, anon, authenticated/)
})
test('S14 · le QR carte reste gelé et séparé', () => {
  assert.match(carte, /Vous avez trouvé cette carte/)
  assert.match(carte, /verifier_carte_scolaire/)
  assert.match(inscription, /suivi-inscription\.html#token=/)
  const premierMessage = inscription.slice(
    inscription.indexOf('function sendFicheWhatsApp'),
    inscription.indexOf("// GÉNÉRATION PDF")
  )
  assert.doesNotMatch(premierMessage, /fiche\.html\?matricule=/)
})
test('P1 · le token reste dans le fragment et hors des journaux HTTP', () => {
  assert.doesNotMatch(inscription, /suivi-inscription\.html\?token=/)
  assert.match(suivi, /location\.hash/)
  assert.doesNotMatch(suivi, /location\.search/)
})
test('P2 · la page appelle uniquement la projection minimale sans cache', () => {
  assert.match(suivi, /rpc\/lire_suivi_inscription/)
  assert.match(suivi, /cache:'no-store'/)
  assert.match(suivi, /referrerPolicy:'no-referrer'/)
  assert.doesNotMatch(suivi, /data\.(?:signature|signature_directeur|responsable|telephone|email|adresse|profession|inscription_id)/)
})
test('P3 · le statut avant validation reste explicitement non définitif', () => {
  assert.match(sql, /Dossier reçu — en cours de traitement/)
  assert.match(suivi, /Validation définitive/)
  assert.match(suivi, /const validee=data\.statut==='validee'/)
})
test('T1 · token serveur 256 bits, hash SHA-256 seulement en table', () => {
  assert.match(sql, /gen_random_bytes\(32\)/)
  assert.match(sql, /digest\(convert_to\(v_token, 'UTF8'\), 'sha256'\)/)
  assert.doesNotMatch(sql, /insert into public\.liens_publics_inscription\([^)]*token(?!_hash)/)
})
test('T2 · un seul lien actif par inscription et usage', () => {
  assert.match(sql, /unique index liens_publics_inscription_actif_unique/)
  assert.match(sql, /where revoked_at is null/)
})
test('R1 · rollback exact et sans suppression métier', () => {
  assert.match(rollback, /drop function if exists public\.lire_suivi_inscription/)
  assert.match(rollback, /drop table if exists public\.liens_publics_inscription/)
  assert.doesNotMatch(rollback, /delete from public\.inscriptions|storage\.objects/)
})

console.log(echecs ? `\n${echecs} garde(s) en échec.` : '\nLOOP 2 · gardes au vert.')
process.exit(echecs ? 1 : 0)

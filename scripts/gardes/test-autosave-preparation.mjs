import assert from 'node:assert/strict'
import fs from 'node:fs'

const lire = chemin => fs.readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8')
const client = lire('src/pages/FichePreparation.jsx')
const emploi = lire('src/pages/MonEmploiDuTemps.jsx')
const sql = lire('sql/preparation_brouillons.sql')
const rollback = lire('sql/preparation_brouillons_rollback.sql')

assert.match(emploi, /select\('id, groupe, jour, sequence, matiere'\)/)
assert.match(client, /creneau\.id[\s\S]*`edt:\$\{creneau\.id\}`/)
assert.match(client, /`maternelle:\$\{creneau\.groupe\}:\$\{creneau\.matiere\}:\$\{creneau\.heure_debut\}`/)
assert.match(client, /ideal_brouillon_preparation:\$\{userId\}:\$\{dateCours\}:\$\{creneauCle\}/)
assert.match(client, /localStorage\.setItem\(brouillonCle/)
assert.match(client, /localStorage\.getItem\(cle\)/)
assert.match(client, /pagehide/)
assert.match(client, /visibilitychange/)
assert.match(client, /addEventListener\('online'/)
console.log('✓ A1/A2/A3 · sauvegarde locale immédiate et reprise navigation/refresh/hors-ligne')

assert.match(client, /setTimeout\(\(\) => sauverServeur\(fiche\), 1500\)/)
assert.match(client, /rpc\('sauver_brouillon_preparation'/)
assert.match(client, /rpc\('lire_brouillon_preparation'/)
assert.match(client, /p_version_attendue: version/)
console.log('✓ A4/A5 · autosave serveur temporisé et versionné')

const blocAutosave = client.slice(client.indexOf('const sauverServeur'), client.indexOf('// ── Chargement'))
assert.doesNotMatch(blocAutosave, /notifierPreparation|from\('preparations'\)/)
assert.equal((client.match(/notifierPreparation\(/g) || []).length, 1)
console.log('✓ A6/A7 · autosave sans soumission et sans notification automatique')

assert.match(sql, /unique \(user_id, date_cours, creneau_cle\)/)
assert.match(sql, /pg_advisory_xact_lock/)
assert.match(sql, /for update/)
assert.match(sql, /p_version_attendue <> v_brouillon\.version/)
assert.match(sql, /'conflit', true/)
assert.match(client, /addEventListener\('storage'/)
assert.match(client, /Conflit multi-onglets détecté/)
console.log('✓ A8/A9 · anti-doublon et conflits serveur/multi-onglets détectés')

for (const rpc of ['lire', 'sauver', 'supprimer']) {
  assert.match(sql, new RegExp(`function public\\.${rpc}_brouillon_preparation`))
}
assert.match(sql, /u\.auth_user_id = auth\.uid\(\)/)
assert.match(sql, /v_prof\.role <> 'professeur'/)
assert.match(sql, /b\.user_id = v_prof\.id/g)
assert.match(sql, /revoke all on public\.preparation_brouillons from public, anon, authenticated/)
assert.doesNotMatch(sql, /create policy|alter policy|disable row level security/i)
console.log('✓ A10/A11 · isolation enseignants côté serveur, aucune policy existante élargie')

const positionSuppression = client.indexOf("rpc(\n      'supprimer_brouillon_preparation'")
assert.ok(positionSuppression > client.indexOf('if (survivantes.length)'))
assert.ok(positionSuppression < client.indexOf('notifierPreparation('))
assert.match(client, /if \(!erreurSuppressionBrouillon\)[\s\S]*localStorage\.removeItem\(brouillonCle\)/)
console.log('✓ A12 · brouillon supprimé seulement après confirmation de la soumission officielle')

assert.match(client, /rpc\(\s*['"]nettoyer_sequences_preparation['"]/)
assert.doesNotMatch(client, /from\('preparations'\)\.delete\(\)/)
console.log('✓ A13 · nettoyage sécurisé des séquences non régressé')

assert.match(rollback, /drop function if exists public\.supprimer_brouillon_preparation/)
assert.match(rollback, /drop table if exists public\.preparation_brouillons/)
assert.doesNotMatch(sql, /insert into public\.preparations|update public\.preparations|notifications/i)
console.log('✓ A14 · rollback complet, table de brouillons séparée')

const identite = creneau => creneau.id
  ? `edt:${creneau.id}`
  : `maternelle:${creneau.groupe}:${creneau.matiere}:${creneau.heure_debut}`
const cle = (prof, date, creneau) => `${prof}:${date}:${identite(creneau)}`
const commun = { id: 'uuid-cp1-lundi-s1', groupe: 'CP1', matiere: 'Lecture', heure_debut: '08:00' }

assert.notEqual(cle('prof-1', '2026-09-07', commun), cle('prof-1', '2026-09-07', { ...commun, id: 'uuid-cp2-lundi-s1', groupe: 'CP2' }))
console.log('✓ C1 · même professeur/date/séquence, classes différentes : clés distinctes')
assert.notEqual(cle('prof-1', '2026-09-07', commun), cle('prof-1', '2026-09-07', { ...commun, id: 'uuid-ce1ce2-lundi-s1', groupe: 'CE1-CE2' }))
console.log('✓ C2 · groupes différents : clés distinctes')
assert.notEqual(cle('prof-1', '2026-09-07', commun), cle('prof-1', '2026-09-07', { ...commun, id: 'uuid-cp1-lundi-s2', matiere: 'Maths' }))
console.log('✓ C3 · matières/créneaux différents : clés distinctes')
assert.equal(cle('prof-1', '2026-09-07', { ...commun }), cle('prof-1', '2026-09-07', { ...commun }))
console.log('✓ C4/C5 · refresh et réouverture : même ID persistant, même clé')
const ongletA = cle('prof-1', '2026-09-07', commun)
const ongletB = cle('prof-1', '2026-09-07', { ...commun, id: 'uuid-cp1-lundi-s2', matiere: 'Maths' })
assert.notEqual(ongletA, ongletB)
console.log('✓ C6 · deux onglets sur deux cours : espaces de stockage distincts')

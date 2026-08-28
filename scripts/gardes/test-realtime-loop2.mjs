import assert from 'node:assert/strict'
import fs from 'node:fs'

const lire = chemin => fs.readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8')
const notifications = lire('src/pages/NotificationCenter.jsx')
const professeur = lire('src/pages/ProfApp.jsx')
const direction = lire('src/pages/DirecteurApp.jsx')
const sources = [notifications, professeur, direction]

assert.match(notifications, /table:\s*'app_state'/)
assert.match(notifications, /filter:\s*`app=eq\.\$\{APP_NOTIFS\}`/)
assert.match(professeur, /filter:\s*`user_id=eq\.\$\{user\.id\}`/)
assert.match(direction, /table:'preparations'/)
console.log('✓ G1/G2/G3/G4 · préparations et notifications ont un réveil Realtime ciblé')

for (const [nom, source] of [['notifications', notifications], ['professeur', professeur], ['direction', direction]]) {
  const canaux = (source.match(/supabase\.channel\(/g) || []).length
  const nettoyages = (source.match(/supabase\.removeChannel\(/g) || []).length
  assert.equal(canaux, nettoyages, `${nom}: chaque channel doit être nettoyé`)
}
console.log('✓ G5/G6 · un cleanup pour chaque channel')

assert.match(professeur, /prepRefreshEnVol\.current/)
assert.match(direction, /prepRefreshEnVol\.current/)
assert.match(notifications, /if \(enVol\.current\) return/)
console.log('✓ G7 · les refetch concurrents sont fusionnés')

assert.ok(sources.every(source => !/window\.location\.reload\s*\(/.test(source)))
assert.ok(sources.every(source => !/auth\.signOut\s*\(/.test(source)))
console.log('✓ G8/G9 · aucun full reload ni déconnexion forcée')

assert.match(professeur, /visibilitychange/)
assert.match(direction, /visibilitychange/)
assert.match(notifications, /visibilitychange/)
console.log('✓ G10 · retour au premier plan = rattrapage ciblé')

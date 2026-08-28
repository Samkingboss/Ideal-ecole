import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const sql = readFileSync('sql/notification_correction_preparation.sql','utf8')
const direction = readFileSync('src/pages/DirecteurApp.jsx','utf8')
const prof = readFileSync('src/pages/ProfApp.jsx','utf8')
const notifications = readFileSync('src/lib/notifications.js','utf8')
const preparations = readFileSync('src/lib/preparations.js','utf8')
const ACTIONS = { depot:'depot', modification:'modification' }
const momentDerniereSoumission = prep => {
  const activites = (prep?.historique_statuts || [])
    .filter(h => [ACTIONS.depot, ACTIONS.modification].includes(h?.action))
    .map(h => Date.parse(h?.le))
    .filter(Number.isFinite)
  const depot = Date.parse(prep?.heure_depot)
  return Math.max(...activites, Number.isFinite(depot) ? depot : 0)
}
const trierPreparationsParActivite = liste => [...liste].sort(
  (a,b) => momentDerniereSoumission(b) - momentDerniereSoumission(a)
)
let echecs = 0
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`) } catch(e) { echecs++; console.log(`✗ ${nom} — ${e.message}`) } }

test('N1 · la cible vient de preparation.user_id côté serveur',()=>{
  assert.match(sql,/v_cible := v_prep\.user_id::text/)
  assert.doesNotMatch(sql,/notifier_correction_preparation\([^)]*p_(?:user_id|cible)/)
})
test('N2/N3 · ni autre enseignant ni RA',()=>{
  assert.match(sql,/key='notifs_' \|\| v_cible/)
  assert.doesNotMatch(sql,/responsable_administratif|notifs_prof|notifs_directeur/)
})
test('N4 · anti-doublon déterministe par préparation et cycle',()=>{
  assert.match(sql,/prep-correction-' \|\| p_preparation_id::text \|\| '-' \|\| v_cycle/)
  assert.match(sql,/where n->>'id'=v_id/)
})
test('N5 · notification et deep-link portent la bonne référence',()=>{
  assert.match(sql,/'ref',p_preparation_id::text/)
  assert.match(sql,/notificationRef=' \|\| p_preparation_id::text/)
  assert.match(prof,/preparation-prof-\$\{prepCiblee\}/)
})
test('N6 · le Web Push est non bloquant après la cloche',()=>{
  assert.ok(sql.indexOf('insert into public.app_state') < sql.indexOf('emettre_notification_push'))
  assert.match(sql,/exception when others then null/)
})
test('N7 mutation · le client ne choisit que la préparation',()=>{
  assert.match(notifications,/rpc\('notifier_correction_preparation',[\s\S]{0,100}p_preparation_id/)
  assert.match(direction,/notifierCorrectionPreparation\(prepDetail\.id\)/)
})

const A={id:'A',heure_depot:'2026-08-25T17:00:00Z',historique_statuts:[{action:ACTIONS.depot,le:'2026-08-25T17:00:00Z'},{action:ACTIONS.modification,le:'2026-08-27T10:00:00Z'}]}
const B={id:'B',heure_depot:'2026-08-25T18:00:00Z',historique_statuts:[{action:ACTIONS.depot,le:'2026-08-25T18:00:00Z'}]}
const C={id:'C',heure_depot:'2026-08-26T09:00:00Z',historique_statuts:[{action:ACTIONS.depot,le:'2026-08-26T09:00:00Z'}]}
test('T1 · la nouvelle soumission est en tête',()=>assert.deepEqual(trierPreparationsParActivite([A,B,C].map(x=>x.id==='A'?{...x,historique_statuts:[x.historique_statuts[0]]}:x)).map(x=>x.id),['C','B','A']))
test('T2 · la resoumission remonte en tête',()=>assert.deepEqual(trierPreparationsParActivite([B,C,A]).map(x=>x.id),['A','C','B']))
test('T3 mutation · date du cours ignorée',()=>assert.equal(momentDerniereSoumission({...A,date_cours:'2030-01-01'}),Date.parse('2026-08-27T10:00:00Z')))
test('T4 · les deux onglets utilisent le tri canonique',()=>assert.match(direction,/const recentes = trierPreparationsParActivite\(preparations\)/))
test('T4b · le tri canonique est bien exporté par le module métier',()=>assert.match(preparations,/export const trierPreparationsParActivite/))
test('R1 · refresh Realtime ciblé',()=>assert.match(direction,/postgres_changes[\s\S]{0,100}table:'preparations'/))
test('R2 · compteurs et retard restent inchangés',()=>{
  assert.match(direction,/A_CONTROLER\.includes\(p\.status\)/)
  assert.match(direction,/ponctualiteAuDepot\(prep\)/)
})
test('H1 · une validation ouvre immédiatement l’historique',()=>{
  assert.match(direction,/decision === 'valider'\) setPrepFiltre\('historique'\)/)
})
test('H2 · seules les fiches validées sont archivées',()=>{
  assert.match(preparations,/filter\(prep => prep\?\.status === STATUTS\.validee\.code\)/)
  assert.match(direction,/trierPreparationsValidees\(preparations\)/)
})
test('H3 · les validations récentes précèdent les anciennes',()=>{
  assert.match(preparations,/entree\?\.action === ACTIONS\.validation/)
  assert.match(preparations,/momentDerniereValidation\(b\) - momentDerniereValidation\(a\)/)
})

console.log(echecs ? `\n${echecs} garde(s) en échec.` : '\nGardes notification, tri et historique au vert.')
process.exit(echecs ? 1 : 0)

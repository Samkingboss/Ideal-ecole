import fs from 'node:fs'
import assert from 'node:assert/strict'

const agenda = fs.readFileSync('src/pages/AgendaCalendrier.jsx','utf8')
const prof = fs.readFileSync('src/pages/ProfApp.jsx','utf8')
const direction = fs.readFileSync('src/pages/DirecteurApp.jsx','utf8')
const sql = fs.readFileSync('sql/agenda_personnel.sql','utf8')

assert.match(prof, /<AgendaCalendrier user=\{user\}/)
assert.match(direction, /<AgendaCalendrier user=\{user\}/)
assert.match(direction, /<MonEmploiDuTemps user=\{user\}/)
assert.match(agenda, /\['professeur', 'directeur', 'responsable_administratif'\]\.includes\(user\?\.role\)/)
assert.match(agenda, /lire_mon_agenda/)
assert.match(agenda, /sauver_mon_evenement_agenda/)
assert.match(agenda, /supprimer_mon_evenement_agenda/)
assert.match(agenda, /traiter_mes_rappels_agenda/)
assert.match(agenda, /window\.setInterval\(verifier, 60000\)/)
assert.match(sql, /user_id uuid not null references public\.users\(id\)/)
assert.match(sql, /where id=p_id and user_id=v_user\.id/)
assert.match(sql, /rappel_envoye_at is null/)
assert.match(sql, /for update skip locked/)
assert.match(sql, /notifs_'\|\|v_user\.id::text/)
assert.match(sql, /exception when others then null; -- la cloche reste enregistrée/)
assert.match(sql, /revoke all on public\.agenda_personnel from public, anon, authenticated/)
assert.match(sql, /grant execute on function public\.traiter_mes_rappels_agenda\(\) to authenticated/)
assert.equal((sql.match(/role not in \('professeur','directeur','responsable_administratif'\)/g) || []).length, 4)
assert.doesNotMatch(sql, /grant (select|insert|update|delete).*agenda_personnel/i)

console.log('PASS — agenda personnel isolé, ouvert aux trois rôles enseignants, CRUD gardé et rappel idempotent')

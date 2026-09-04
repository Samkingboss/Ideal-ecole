import assert from 'node:assert/strict'
import fs from 'node:fs'

const sql = fs.readFileSync('sql/circuit_assistantes_maternelle.sql', 'utf8')
const rollback = fs.readFileSync('sql/circuit_assistantes_maternelle_rollback.sql', 'utf8')
const composant = fs.readFileSync('src/pages/CircuitAssistantesMaternelle.jsx', 'utf8')
const prof = fs.readFileSync('src/pages/ProfApp.jsx', 'utf8')
const surveillant = fs.readFileSync('src/pages/SurveillantApp.jsx', 'utf8')
const direction = fs.readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
const decisions = fs.readFileSync('docs/constitution/decisions.md', 'utf8')
const test = (nom, condition) => { assert.ok(condition, nom); console.log(`PASS — ${nom}`) }

test('la décision du promoteur et le barème validé sont mémorisés', /D5 — Circuit des préparations maternelles/.test(decisions) && /20 points/.test(decisions) && /10 points/.test(decisions))
test('le retour arrière existe avant la migration et ne touche pas aux préparations ni au stock', /drop table if exists public\.maternelle_circuit_evenements/.test(rollback) && !/drop table if exists public\.(preparations|materiels|demandes_materiel)/.test(rollback))
test('le circuit réutilise la préparation canonique', /references public\.preparations/.test(sql) && /from public\.preparations/.test(sql) && !/create table if not exists public\.maternelle_preparations/.test(sql))
test('le circuit réutilise le stock canonique', /references public\.demandes_materiel/.test(sql) && /references public\.materiels/.test(sql) && /insert into public\.mouvements_stock/.test(sql))
test('les valeurs initiales correspondent au barème validé', /points_preparation numeric\(6,2\) not null default 20/.test(sql) && (sql.match(/not null default 10/g) || []).length >= 4 && /default 24/.test(sql) && /default 5/.test(sql))
test('une préparation reçue sous cinq heures neutralise les points assistante', (sql.match(/v_avance < v_cfg\.heures_minimum then null/g) || []).length >= 2)
test('la dégressivité de la préparation est calculée heure par heure', /points_preparation-\(v_cfg\.heures_points_pleins-v_avance\)/.test(sql))
test('les quatre comptes n’écrivent que par RPC authentifiées', /auth\.uid\(\)/.test(sql) && /assistante_maternelle_requise/.test(sql) && /surveillant_requis/.test(sql) && /administration_requise/.test(sql) && /direction_requise/.test(sql))
test('les tables nouvelles ne sont jamais ouvertes directement au client', (sql.match(/revoke all on table public\.maternelle_/g) || []).length === 4)
test('chaque passage de relais est historisé', /maternelle_circuit_evenements/.test(sql) && /contribution_enregistree/.test(sql) && /materiel_demande/.test(sql) && /materiel_escalade/.test(sql) && /decision_administration/.test(sql) && /reception_confirmee/.test(sql))
test('le dernier maillon inachevé est nommé après l’échéance', /responsabilites/.test(sql) && /retour_surveillance' then 'surveillant'/.test(sql) && /Action non accomplie à l’échéance/.test(composant))
test('l’assistante dispose de sa page dédiée et non des outils de préparation', prof.includes("{compteAssistante && <button onClick={() => setTab('circuit-assistante')}") && prof.includes("{!compteAssistante && <button onClick={() => setTab('mespreps')}"))
test('le surveillant voit le circuit dans son espace maternelle', /mode="surveillant"/.test(surveillant))
test('le responsable administratif et la Direction voient chacun leur étape', /mode="administration"/.test(direction) && /mode="direction"/.test(direction))
test('le matériel de la fiche préremplit la demande de l’assistante', /preparation\.contenu\?\.materiel/.test(composant) && /extraireMateriels/.test(composant))
test('la demande de matériel exige une lecture déjà enregistrée', /contribution_assistante_requise/.test(sql) && /p\.contribution && !\(p\.materiels/.test(composant))
test('les écrans exposent les cinq postes du barème', /Préparation/.test(composant) && /Lecture & apport/.test(composant) && /Matériel assistante/.test(composant) && /Surveillance/.test(composant) && /Administration/.test(composant))

console.log('PASS — 17 gardes circuit assistantes maternelle')

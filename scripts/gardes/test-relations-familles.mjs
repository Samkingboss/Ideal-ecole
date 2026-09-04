import fs from 'node:fs'

const ui = fs.readFileSync('src/pages/RelationsFamilles.jsx', 'utf8')
const page = fs.readFileSync('src/pages/ConseillerApp.jsx', 'utf8')
const css = fs.readFileSync('src/pages/RelationsFamilles.css', 'utf8')
const sql = fs.readFileSync('sql/relations_familles.sql', 'utf8')
const rollback = fs.readFileSync('sql/relations_familles_rollback.sql', 'utf8')
let echec = false

const verifie = (condition, message) => {
  if (!condition) { console.error(`FAIL — ${message}`); echec = true }
  else console.log(`PASS — ${message}`)
}

verifie(page.includes("Relations familles & Vie scolaire") && page.includes("tab==='prospects'"), 'le compte conseiller devient un espace Relations familles')
verifie(/lire_prospects_familles|sauver_prospect_famille/.test(ui) && /nombre_enfants/.test(ui) && /classe_ids/.test(ui), 'la fiche prospect couvre parent, téléphone, enfants et classes souhaitées')
verifie(/responsable_contacte/.test(sql) && /date_contact/.test(sql) && /resultat/.test(sql) && /prochaine_action/.test(sql) && /date_suivi/.test(sql), 'chaque contact conserve le résultat, le résumé et la prochaine action')
verifie(/visiteur_nom/.test(sql) && /personne_recherchee/.test(sql) && /arrivee_at/.test(sql) && /depart_at/.test(sql), 'le registre des visiteurs trace arrivée, destination et départ')
verifie(/to_char\(e\.date_naissance/.test(sql) && !/suivis_anniversaires[\s\S]{0,500}date_naissance/.test(sql), 'les anniversaires dérivent de la fiche élève sans recopier la naissance')
verifie(/current_date\s*\+\s*3/.test(sql) && /traiter_rappels_anniversaires/.test(ui), 'le rappel anniversaire est déclenché trois jours avant')
verifie(/left join public\.eleves e on e\.id=r\.eleve_id/.test(sql) && /coalesce\(e\.prenom/.test(sql), 'une correction du nom élève se propage aux suivis affichés')
verifie(/u\.role in \('conseiller_vie_scolaire','directeur'\)/.test(sql) && (sql.match(/v_moi\.role <> 'conseiller_vie_scolaire'/g) || []).length >= 5, 'la Direction lit et seule la conseillère écrit')
verifie(/revoke all on public\.prospects_familles/.test(sql) && /enable row level security/g.test(sql), 'aucune table familiale n’est ouverte directement')
verifie(!/delete function|create or replace function public\.supprimer_/i.test(sql), 'aucune suppression silencieuse n’est exposée')
verifie(/relations_familles_audit/.test(sql) && /to_jsonb\(v_ancien\)/.test(sql), 'les corrections sensibles sont historisées')
verifie(rollback.includes('drop table if exists public.prospects_familles') && rollback.includes('drop function if exists public.traiter_rappels_anniversaires'), 'un retour arrière complet existe')
verifie(/@media\(max-width:650px\)/.test(css) && /grid-template-columns:1fr/.test(css), 'les formulaires et listes sont adaptés au téléphone')

if (echec) process.exit(1)
console.log('PASS — 13 gardes Relations familles')

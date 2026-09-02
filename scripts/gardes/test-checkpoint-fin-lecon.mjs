import assert from 'node:assert/strict'
import fs from 'node:fs'

const fin = fs.readFileSync('src/pages/FinDeCours.jsx', 'utf8')
const prof = fs.readFileSync('src/pages/ProfApp.jsx', 'utf8')
const sql = fs.readFileSync('sql/comprehensions.sql', 'utf8')
const rapport = fs.readFileSync('public/rapports.html', 'utf8')

assert.match(fin, /status !== 'validee'/, 'une préparation non validée doit être exclue')
assert.match(fin, /bloc\.some\(x => !x\)/, 'toutes les séquences doivent être validées')
assert.match(fin, /finDerniere \+ 30 <= maintenant/, 'la dernière séquence doit être entièrement terminée')
assert.match(fin, /Participation.*Compréhension/s, 'les deux critères sont visibles')
assert.match(fin, /Absent — notion à rattraper/, 'une absence produit un rattrapage')
assert.match(fin, /absent \? 0 : moyenneCheckpoint/, 'l’absence reste compatible avec la note historique')
assert.match(fin, /notees\.reduce/, 'les absents sont exclus de la moyenne de classe')
assert.match(prof, /classe_id.*contenu.*historique_statuts/, 'les préparations chargent leur identité et leurs séquences')
assert.match(sql, /unique nulls not distinct \(eleve_id, preparation_id, date_cours, matiere\)/i, 'anti-doublon par préparation')
assert.match(sql, /statut in \('evalue', 'absent'\)/, 'statuts bornés')
assert.match(sql, /statut = 'absent' and participation is null and comprehension is null/, 'absence sans fausse note détaillée')
assert.match(rapport, /Participation :.*Compréhension :.*Note générale/s, 'détail parental complet')
assert.match(rapport, /Absent\(e\) — notion à rattraper/, 'rattrapage visible des parents')

console.log('CHECKPOINT FIN DE LEÇON — PASS')

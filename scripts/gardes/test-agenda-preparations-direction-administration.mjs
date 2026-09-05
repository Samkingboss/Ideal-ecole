import assert from 'node:assert/strict'
import fs from 'node:fs'

const lire = chemin => fs.readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8')
const direction = lire('src/pages/DirecteurApp.jsx')
const affectations = lire('src/pages/AffectationsMatieres.jsx')
const emploi = lire('src/pages/MonEmploiDuTemps.jsx')
const agenda = lire('src/pages/AgendaCalendrier.jsx')
const migration = lire('sql/agenda_preparations_direction_administration.sql')
const rollback = lire('sql/agenda_preparations_direction_administration_rollback.sql')
const brouillons = lire('sql/preparation_brouillons.sql')
const nettoyage = lire('sql/nettoyer_sequences_preparation.sql')

// Les deux espaces administratifs réutilisent exactement le parcours des
// enseignants : affectation -> grille personnelle -> fiche de préparation.
assert.match(direction, /import MonEmploiDuTemps from '\.\/MonEmploiDuTemps'/)
assert.ok((direction.match(/<MonEmploiDuTemps user=\{user\}/g) || []).length >= 2)
assert.match(direction, /\['eleves', 'rh', 'compta', 'agenda'\]/)
assert.match(direction, /Mes cours à préparer/)
assert.match(direction, /Cours à préparer/)
assert.match(emploi, /\.eq\('prof_id', user\.id\)/)
assert.match(emploi, /<FichePreparation[\s\S]*user=\{user\}/)

// L'affectation reste dirigée par le compte Directeur, mais les deux rôles
// concernés sont présents et explicitement identifiés dans le menu.
assert.match(affectations, /\.in\('role', \['professeur', 'directeur', 'responsable_administratif'\]\)/)
assert.match(affectations, /directeur: 'Direction'/)
assert.match(affectations, /responsable_administratif: 'Administration'/)

// Agenda, brouillons et nettoyage restent liés à auth.uid() et au propriétaire.
assert.match(agenda, /\['professeur', 'directeur', 'responsable_administratif'\]\.includes\(user\?\.role\)/)
assert.equal((brouillons.match(/role not in \('professeur','directeur','responsable_administratif'\)/g) || []).length, 3)
assert.match(nettoyage, /role not in \('professeur','directeur','responsable_administratif'\)/)
assert.match(nettoyage, /p\.user_id = v_prof\.id/g)
assert.match(migration, /u\.auth_user_id = auth\.uid\(\)|pg_get_functiondef/)
assert.match(migration, /huit lignes, toutes a true/)
assert.doesNotMatch(migration, /grant (select|insert|update|delete).* to (anon|authenticated)/i)
assert.match(rollback, /Les agendas, brouillons et preparations deja enregistres sont conserves/)
assert.doesNotMatch(rollback, /delete from|drop table/i)

console.log('PASS — cours et agenda personnels ouverts au Directeur et au Responsable administratif sans accès croisé')

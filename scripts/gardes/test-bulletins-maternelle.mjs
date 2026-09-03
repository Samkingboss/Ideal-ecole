import assert from 'node:assert/strict'
import fs from 'node:fs'

const prof = fs.readFileSync('src/pages/ProfApp.jsx', 'utf8')
const studio = fs.readFileSync('src/pages/BulletinMaternelleStudio.jsx', 'utf8')
const bulletin = fs.readFileSync('public/bulletin-maternelle/index.html', 'utf8')
const sql = fs.readFileSync('sql/bulletins_maternelle.sql', 'utf8')
const sqlPhotos = fs.readFileSync('sql/bulletins_maternelle_photos.sql', 'utf8')

const test = (nom, condition) => { assert.ok(condition, nom); console.log(`PASS — ${nom}`) }

test('le bulletin est réservé aux comptes maternelle', /compteMaternelle && <button[\s\S]*?setTab\('bulletins-maternelle'\)/.test(prof))
test('les bulletins sont rangés dans Ma Classe et Évaluations', /activeProfSession === 'classe'[\s\S]*?setTab\('bulletins-maternelle'\)/.test(prof))
test('la source canonique est la liste eleves IDEAL', /eleves\.filter\(e => estMaternelle\(e\.classes\?\.nom\)\)/.test(studio))
test('aucun élève de démonstration n’est chargé', /await window\.idealBridge\.ready/.test(bulletin) && !/loadPreloadedDemoData\(\);\s*\n\s*}\s*else/.test(bulletin))
test('création et suppression d’élève sont masquées', /id="btn-new-student"[^>]+hidden/.test(bulletin) && /id="btn-delete-student"[^>]+hidden/.test(bulletin))
test('identité et classe sont en lecture seule', /id="student-name"[^>]+readonly/.test(bulletin) && /id="student-section"[^>]+disabled/.test(bulletin))
test('la fiche d’identité et les heures ne sont plus éditables par la maîtresse', /section class="section-card" hidden aria-hidden="true"[\s\S]*?Fiche d'Identité/.test(bulletin) && /section class="section-card" hidden aria-hidden="true"[\s\S]*?Heures de Cours/.test(bulletin))
test('les objectifs affichés sont filtrés selon la langue du compte', /editorLanguage/.test(bulletin) && /isEnglishCompetency\(compText\)/.test(bulletin))
test('l’impression est limitée à la titulaire de la classe', /canPrint/.test(studio) && /currentStudent\?\.canPrint/.test(bulletin))
test('la soumission Direction est limitée à la titulaire et exige les deux langues', /soumettre_bulletin_maternelle/.test(studio) && /titulaire_requise/.test(sql) && /contributions_fr_et_en_requises/.test(sql))
test('la Direction est notifiée après la soumission explicite', /type:\s*'ideal:bulletin:submit'/.test(bulletin) && /pushNotification\('directeur'/.test(studio))
test('les contributions française et anglaise sont fusionnées sans écrasement', /contributions\.fr/.test(studio) && /jsonb_set\(/.test(sql) && /jsonb_build_object\(v_langue,v_contribution\)/.test(sql))
test('les heures viennent du pilotage Direction', /lire_pilotage_heures_pedagogiques/.test(studio) && !/totalHours:\s*180/.test(studio))
test('la photo du bulletin vient du même photo_chemin que la carte scolaire', /lire_photos_bulletins_maternelle/.test(studio) && /i\.photo_chemin/.test(sqlPhotos) && /createSignedUrls\(chemins,3600\)/.test(studio))
test('la lecture Storage est limitée aux photos des classes affectées', /name like 'photos\/%'/.test(sqlPhotos) && /prof_classes/.test(sqlPhotos) && /peut_lire_photo_maternelle\(name\)/.test(sqlPhotos))
test('le bulletin présente une carte de développement et ses jauges par domaine', /class="development-map"/.test(bulletin) && /id="development-gauges"/.test(bulletin) && /body-left-hand/.test(bulletin) && /body-left-leg/.test(bulletin))
test('une compétence non évaluée ne vaut jamais Très Bien par défaut', /overallPercent = totalCount > 0[\s\S]*?: 0/.test(bulletin) && !/evals\[compKey\] \|\| "TB"/.test(bulletin))
test('l’atelier est utilisable sur téléphone', /@media \(max-width: 800px\)/.test(bulletin) && /\.control-panel \{ width: 100%/.test(bulletin) && /\.comp-pill-group \{ width: 100%; display: grid/.test(bulletin))
test('l’atelier reste intégré dans IDEAL', /sans quitter IDEAL/.test(studio) && /<iframe/.test(studio))
test('une ligne serveur est unique par élève, trimestre et année', /unique \(eleve_id, trimestre, annee_scolaire\)/i.test(sql))
test('le serveur déduit le personnel depuis auth.uid', /auth\.uid\(\)/.test(sql) && /auth_user_id/.test(sql))
test('aucun accès direct à la table bulletins', /revoke all on table public\.maternelle_bulletins from public, anon, authenticated/.test(sql))
test('les RPC sont réservées aux comptes authentifiés', /grant execute on function public\.lire_bulletins_maternelle\(uuid\[\]\) to authenticated/.test(sql) && /grant execute on function public\.sauver_bulletin_maternelle\(uuid,text,text,jsonb\) to authenticated/.test(sql))

#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// RECETTE POST-MIGRATION — Phase 2, accès du personnel.
//
// Ne rejoint PAS la suite ordinaire : elle ne peut être verte qu'après
// l'exécution de sql/personnel_acces_phase2.sql. Une garde rouge en
// permanence apprend à ignorer le rouge.
//
// NON DESTRUCTIVE : aucun compte créé, aucun lien émis, aucun mot de passe
// modifié. Chaque appel est refusé par le privilège ou par la forme.
//
//   node scripts/gardes/recette-acces-personnel.mjs
// ════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1'
const CLE = (readFileSync('public/inscription.html', 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/) || [])[1]

const rpc = async (nom, corps = {}) => {
  const r = await fetch(`${BASE}/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  let j = null
  const t = await r.text()
  try { j = JSON.parse(t) } catch { /* corps non JSON */ }
  return { status: r.status, code: j?.code || '', corps: j }
}

const resultats = []
const controle = (id, libelle, ok, detail) => {
  resultats.push(ok)
  console.log(`  ${ok ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mÉCHEC\x1b[0m'} ${id}  ${libelle}`)
  if (detail) console.log(`         ${detail}`)
}

console.log('\nRECETTE — accès du personnel, volet anonyme\n')

// ── Les cinq fonctions, appelées sans session ────────────────────────────
const FERMEES = {
  identifiant_disponible:     { p_prenom: 'X', p_nom: 'Y' },
  rattacher_membre_personnel: { p_auth_user_id: '00000000-0000-0000-0000-000000000000',
                                p_identifiant: 'x', p_prenom: 'X', p_nom: 'Y', p_role: 'professeur' },
  emettre_acces_personnel:    { p_user_id: '00000000-0000-0000-0000-000000000000' },
  consommer_acces_personnel:  { p_token: 'f'.repeat(64) },
}
for (const [nom, args] of Object.entries(FERMEES)) {
  const r = await rpc(nom, args)
  controle(`R-${nom}`, `${nom} refusé sans session`,
    r.code === '42501', `reçu ${r.status} ${r.code || '(aucun code)'} — attendu 42501`)
}

// `lire_etat_acces_personnel` est en `language sql` : sa garde vit dans le
// `where`. Elle ne peut pas lever d'exception — elle rend zéro ligne.
{
  const r = await rpc('lire_etat_acces_personnel')
  const vide = r.code === '42501' || (Array.isArray(r.corps) && r.corps.length === 0)
  controle('R-lire_etat', 'lire_etat_acces_personnel ne livre rien sans session',
    vide, `reçu ${r.status} ${r.code} — ${JSON.stringify(r.corps)?.slice(0, 60)}`)
}

// ── Témoin négatif ───────────────────────────────────────────────────────
//
// Sans lui, une panne réseau ferait passer tout ce qui précède au vert.
{
  const r = await rpc('ideal_est', { p_roles: ['directeur'] })
  controle('R-temoin', 'le capteur distingue encore ouvert de fermé',
    r.status === 200 && r.code !== '42501',
    `ideal_est répond ${r.status} ${r.code || ''} — doit rester atteignable`)
}

// ── La route publique d'activation ───────────────────────────────────────
//
// Elle n'existe qu'une fois le déploiement Vercel fait. Absente, on le dit
// plutôt que de compter un succès.
const ORIGINE = process.env.IDEAL_ORIGINE || 'https://ideal-ecole.vercel.app'
const activer = async (corps) => {
  const r = await fetch(`${ORIGINE}/api/personnel-activer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  })
  let j = null
  try { j = JSON.parse(await r.text()) } catch { /* page HTML : route absente */ }
  return { status: r.status, corps: j }
}

try {
  const inexistant = await activer({ token: 'a'.repeat(64), mot_de_passe: 'unmotdepasselong' })
  if (inexistant.corps === null) {
    controle('R-route', 'la route /api/personnel-activer est déployée', false,
      `${ORIGINE} ne rend pas de JSON — déploiement Vercel non fait ?`)
  } else {
    controle('R-inconnu', 'jeton inconnu refusé, sans indice',
      inexistant.corps?.ok === false && !inexistant.corps?.raison,
      `reçu ${JSON.stringify(inexistant.corps)}`)

    const malforme = await activer({ token: 'pas-un-jeton', mot_de_passe: 'unmotdepasselong' })
    controle('R-forme', 'jeton malformé refusé de la même manière',
      malforme.corps?.ok === false && !malforme.corps?.raison,
      `reçu ${JSON.stringify(malforme.corps)}`)

    const court = await activer({ token: 'a'.repeat(64), mot_de_passe: 'court' })
    controle('R-longueur', 'mot de passe de moins de dix caractères refusé',
      court.corps?.raison === 'mot_de_passe_trop_court',
      `reçu ${JSON.stringify(court.corps)}`)
  }
} catch (e) {
  controle('R-route', 'la route /api/personnel-activer est joignable', false, e.message)
}

// ── La route de création, sans session ───────────────────────────────────
try {
  const r = await fetch(`${ORIGINE}/api/personnel-creer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prenom: 'X', nom: 'Y', role: 'directeur' }),
  })
  controle('R-creer-anon', 'création refusée sans jeton', r.status === 401,
    `reçu ${r.status} — attendu 401`)
} catch (e) {
  controle('R-creer-anon', 'route de création joignable', false, e.message)
}

console.log(`
  ⚠ LE VOLET SESSION N'EST PAS AUTOMATISABLE ICI — les codes ne quittent
    pas la machine du directeur. Collez scripts/gardes/recette-personnel-session.js
    dans la console, puis suivez le protocole du rapport de Phase 2 :
    enseignant refusé, responsable administratif refusé, directeur autorisé,
    et la chaîne complète sur un membre de test.
`)

const echecs = resultats.filter((r) => !r).length
console.log(echecs
  ? `\x1b[31m${echecs} contrôle(s) en échec.\x1b[0m\n`
  : `\x1b[32mVolet automatisable : ${resultats.length}/${resultats.length}.\x1b[0m\n`)
process.exit(echecs ? 1 : 0)

#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// LE VERROU — tout ce qui a été validé, vérifié en une fois.
//
//   node scripts/gardes/recette-invariants-production.mjs
//
// À lancer APRÈS CHAQUE DÉPLOIEMENT, et après toute intervention d'une
// autre session sur la base ou sur le code. Elle interroge la PRODUCTION.
//
// ── Pourquoi elle existe ──────────────────────────────────────────────
//
// Le 02/09, neuf commits sont partis en production en trois heures. Ils
// ont apporté du bon — et, sans que rien ne rougisse :
//   · détourné la seule carte menant au formulaire d'inscription, rendant
//     impossible la création d'un dossier élève ;
//   · déployé du code lisant des colonnes qu'aucune migration n'avait
//     créées.
//
// Aucune garde ne surveillait ces deux choses. Celle-ci le fait.
//
// NON DESTRUCTIVE : lectures, et appels dont les arguments sont refusés
// avant toute écriture. Aucune donnée d'élève n'est récupérée — comptages
// et codes de réponse seulement.
// ════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co'
const REST = BASE + '/rest/v1'
const CLE = (readFileSync('public/inscription.html', 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
const H = { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' }
const NUL = '00000000-0000-0000-0000-000000000000'

let echecs = 0
const ok = (id, libelle, vrai, detail) => {
  if (!vrai) echecs++
  console.log(`  ${vrai ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mÉCHEC\x1b[0m'} ${id.padEnd(6)} ${libelle}`)
  if (detail && !vrai) console.log(`         ${detail}`)
}
const lire = async (chemin) => {
  const r = await fetch(REST + chemin, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } })
  let j = null; try { j = JSON.parse(await r.text()) } catch { /* — */ }
  return { status: r.status, code: j?.code || '', n: (r.headers.get('content-range') || '').split('/')[1] ?? null }
}
const rpc = async (nom, corps) => {
  const r = await fetch(`${REST}/rpc/${nom}`, { method: 'POST', headers: H, body: JSON.stringify(corps) })
  let j = null; try { j = JSON.parse(await r.text()) } catch { /* — */ }
  return { status: r.status, code: j?.code || '', corps: j }
}
const ferme = (r) => r.code === '42501' || r.n === '0'

console.log('\n═══ VERROU DES INVARIANTS · production ═══\n')

// ── A · S0 : les données d'élèves ne sont pas publiques ─────────────────
console.log('  A · Fermeture S0 — les dossiers d’enfants hors d’internet')
for (const [id, t] of [['A1', 'eleves'], ['A2', 'classes']]) {
  const r = await lire(`/${t}?select=id`)
  ok(id, `anon ne lit pas ${t}`, ferme(r), `reçu ${r.status} ${r.code} — ${r.n} ligne(s)`)
}
{
  const r = await rpc('', {})
  const w = await fetch(`${REST}/eleves`, { method: 'POST', headers: H, body: JSON.stringify({ classe_id: NUL }) })
  let j = null; try { j = JSON.parse(await w.text()) } catch { /* — */ }
  ok('A3', 'anon ne peut pas écrire dans eleves', j?.code === '42501',
    `reçu ${w.status} ${j?.code || ''} — 23502 signifierait que le privilège est accordé`)
  void r
}

// ── B · Phase 1 : la gestion des comptes du personnel ───────────────────
console.log('\n  B · Confinement Phase 1 — le cycle de vie des identités')
const P1 = {
  enregistrer_utilisateur: { p_id: null, p_prenom: '', p_nom: '', p_role: 'x', p_langue: null, p_fonction: null, p_code: '', p_plafond: null },
  desactiver_utilisateur: { p_id: NUL },
  authentifier_par_code: { p_code: '__aucun__' },
}
let i = 1
for (const [nom, args] of Object.entries(P1)) {
  const r = await rpc(nom, args)
  ok(`B${i++}`, `${nom} fermée à anon`, r.code === '42501', `reçu ${r.status} ${r.code}`)
}

// ── C · Phase 2 : l'accès du personnel ─────────────────────────────────
console.log('\n  C · Phase 2 — création et activation des comptes')
const P2 = {
  identifiant_disponible: { p_prenom: 'x', p_nom: 'y' },
  rattacher_membre_personnel: { p_auth_user_id: NUL, p_identifiant: 'x', p_prenom: 'x', p_nom: 'y', p_role: 'professeur' },
  emettre_acces_personnel: { p_user_id: NUL },
  consommer_acces_personnel: { p_token: 'f'.repeat(64) },
}
i = 1
for (const [nom, args] of Object.entries(P2)) {
  const r = await rpc(nom, args)
  ok(`C${i++}`, `${nom} fermée à anon`, r.code === '42501', `reçu ${r.status} ${r.code}`)
}

// ── D · Storage : le bucket des dossiers ───────────────────────────────
console.log('\n  D · Storage — les pièces des dossiers d’inscription')
{
  const r = await fetch(`${BASE}/storage/v1/object/list/inscriptions`, {
    method: 'POST', headers: H, body: JSON.stringify({ prefix: '', limit: 1 }),
  })
  const t = await r.text()
  ok('D1', 'le bucket inscriptions ne liste rien à anon',
    r.status !== 200 || t === '[]', `reçu ${r.status} — ${t.slice(0, 50)}`)
}

// ── E · Les flux publics légitimes restent vivants ─────────────────────
console.log('\n  E · Ce qui doit CONTINUER de fonctionner')
{
  const r = await rpc('creer_inscription_avec_suivi', { p_dossier: {} })
  ok('E1', 'l’inscription publique reste possible', r.code !== '42501',
    `reçu ${r.status} ${r.code} — 42501 signifierait qu’aucun parent ne peut déposer`)
}
{
  const r = await rpc('verifier_carte_scolaire', { p_matricule: '__x__', p_nom: '__y__' })
  ok('E2', 'le QR de la carte scolaire répond', r.status === 200 && Array.isArray(r.corps), `reçu ${r.status} ${r.code}`)
}
{
  const r = await rpc('lire_suivi_inscription', { p_token: 'z' })
  ok('E3', 'le suivi public d’inscription répond', r.status === 200, `reçu ${r.status} ${r.code}`)
}

// ── F · Le schéma attendu par le code existe-t-il vraiment ? ────────────
//
// C'est le contrôle qui manquait le 02/09 : du code déployé lisant des
// colonnes qu'aucune migration n'avait créées. On extrait les colonnes que
// le code demande, et on vérifie qu'elles existent.
//
// Limite assumée : ne couvre que les tables encore lisibles par la clé
// publique. Une table fermée rend 42501 quelle que soit la colonne.
console.log('\n  F · Le code déployé et le schéma réel concordent-ils ?')
{
  const src = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
    + readFileSync('src/pages/ProfApp.jsx', 'utf8')
  const demandes = [...src.matchAll(/\.from\('([a-z_]+)'\)\s*\.select\('([a-z_, ]+)'\)/g)]
  let verifiees = 0, absentes = []
  for (const [, table, colonnes] of demandes) {
    const liste = colonnes.split(',').map((c) => c.trim()).filter(Boolean)
    if (!liste.length) continue
    const r = await lire(`/${table}?select=${liste.join(',')}&limit=0`)
    if (r.code === '42501') continue          // table fermée : hors de portée
    verifiees++
    if (r.code === '42703') absentes.push(`${table} → ${liste.join(',')}`)
  }
  ok('F1', `les colonnes demandées existent (${verifiees} requête(s) vérifiable(s))`,
    absentes.length === 0, absentes.join(' · '))
}

// ── G · Témoin négatif ─────────────────────────────────────────────────
//
// Sans lui, une panne réseau ferait tout passer pour « fermé ».
console.log('\n  G · Le capteur sait-il encore distinguer ouvert de fermé ?')
{
  const r = await rpc('ideal_est', { p_roles: ['directeur'] })
  ok('G1', 'ideal_est reste atteignable par anon', r.status === 200 && r.code !== '42501',
    `reçu ${r.status} ${r.code}`)
}

console.log(echecs
  ? `\n\x1b[31m${echecs} invariant(s) rompu(s).\x1b[0m Quelque chose a défait ce qui avait été validé.\n`
  : `\n\x1b[32mTous les invariants tiennent.\x1b[0m\n`)
process.exit(echecs ? 1 : 0)

#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// RECETTE POST-MIGRATION — fermeture de public.eleves à anon.
//
// Ne rejoint PAS la suite ordinaire : elle ne peut être verte qu'après
// l'exécution du SQL de confinement. Une garde rouge en permanence apprend
// à ignorer le rouge.
//
// AUCUNE DONNÉE D'ÉLÈVE N'EST RÉCUPÉRÉE. Les lectures demandent un COMPTE
// (count=exact, Range 0-0) ou filtrent SUR une colonne sans la projeter.
// Les écritures portent un filtre ne correspondant à aucune ligne, ou une
// valeur refusée par une contrainte avant toute écriture.
//
//   node scripts/gardes/recette-fermeture-eleves.mjs
// ════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1'
const CLE = (readFileSync('public/inscription.html', 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
const NUL = '00000000-0000-0000-0000-000000000000'

const appel = async (chemin, methode = 'GET', corps = null) => {
  const entetes = { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' }
  if (methode === 'GET') { entetes.Prefer = 'count=exact'; entetes.Range = '0-0' }
  const r = await fetch(BASE + chemin, { method: methode, headers: entetes, ...(corps ? { body: JSON.stringify(corps) } : {}) })
  const plage = r.headers.get('content-range') || ''
  let j = null
  try { j = JSON.parse(await r.text()) } catch { /* corps vide ou non JSON */ }
  return { status: r.status, code: j?.code || '', lignes: plage.split('/')[1] ?? null }
}

const resultats = []
const controle = (id, libelle, ok, detail) => {
  resultats.push(ok)
  console.log(`  ${ok ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mÉCHEC\x1b[0m'} ${id}  ${libelle}`)
  if (detail) console.log(`         ${detail}`)
}
// « Fermée » se dit de deux façons : privilège refusé (42501), ou zéro ligne
// rendue. Les deux conviennent ; ce qui ne convient pas est une ligne.
const ferme = (r) => r.code === '42501' || r.lignes === '0'

console.log('\nRECETTE — fermeture de public.eleves à la clé publique\n')

// ── 1 à 4 · lecture ──────────────────────────────────────────────────────
{
  const r = await appel('/eleves?select=id')
  controle('R1', 'anon ne lit aucune ligne de eleves', ferme(r),
    `reçu ${r.status} ${r.code || ''} — ${r.lignes ?? '?'} ligne(s) (26 avant fermeture)`)
}
for (const [id, col, avant] of [['R2', 'photo_url', 1], ['R3', 'parent_phone', 14], ['R4', 'date_naissance', 14]]) {
  const r = await appel(`/eleves?select=id&${col}=not.is.null`)
  controle(id, `anon ne peut plus filtrer sur ${col}`, ferme(r),
    `reçu ${r.status} ${r.code || ''} — ${r.lignes ?? '?'} ligne(s) (${avant} avant fermeture)`)
}

// ── 5 à 7 · écriture ─────────────────────────────────────────────────────
//
// L'INSERT porte une classe inexistante : sans privilège il rend 42501,
// avec privilège il rend 23502/23503 — et n'écrit rien dans les deux cas.
{
  const r = await appel('/eleves', 'POST', { classe_id: NUL })
  controle('R5', 'anon ne peut pas insérer', r.code === '42501',
    `reçu ${r.status} ${r.code || ''} — attendu 42501 (23502 avant fermeture)`)
}
{
  const r = await appel(`/eleves?id=eq.${NUL}`, 'PATCH', { actif: true })
  controle('R6', 'anon ne peut pas modifier', r.code === '42501',
    `reçu ${r.status} ${r.code || ''} — attendu 42501 (204 avant fermeture)`)
}
{
  const r = await appel(`/eleves?id=eq.${NUL}`, 'DELETE')
  controle('R7', 'anon ne peut pas supprimer', r.code === '42501',
    `reçu ${r.status} ${r.code || ''} — attendu 42501 (204 avant fermeture)`)
}

// ── 8 · classes : écriture fermée, lecture selon la décision ─────────────
{
  const r = await appel('/classes', 'POST', { nom: null })
  controle('R8', 'anon ne peut pas écrire dans classes', r.code === '42501',
    `reçu ${r.status} ${r.code || ''} — attendu 42501 (23502 avant fermeture)`)
}

// ── 9 et 10 · les flux publics légitimes survivent ───────────────────────
{
  const r = await fetch(`${BASE}/rpc/verifier_carte_scolaire`, {
    method: 'POST',
    headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_matricule: '__aucun__', p_nom: '__aucun__' }),
  })
  let j = null; try { j = JSON.parse(await r.text()) } catch { /* — */ }
  controle('R9', 'le QR public répond toujours (projection inchangée)',
    r.status === 200 && Array.isArray(j),
    `reçu ${r.status} — la fonction doit rester joignable et rendre « non reconnue »`)
}
{
  const r = await fetch(`${BASE}/rpc/creer_inscription_avec_suivi`, {
    method: 'POST',
    headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_dossier: {} }),
  })
  let j = null; try { j = JSON.parse(await r.text()) } catch { /* — */ }
  // Le dossier vide est refusé par la logique métier, pas par le privilège :
  // c'est la preuve que l'inscription publique reste ouverte.
  controle('R10', 'l’inscription publique reste possible',
    j?.code !== '42501',
    `reçu ${r.status} ${j?.code || ''} — 42501 signifierait que l’inscription est cassée`)
}

// ── Témoin négatif ───────────────────────────────────────────────────────
//
// Sans lui, une panne réseau ferait passer toute la recette au vert : tout
// répondrait « fermé » pour la mauvaise raison.
{
  const r = await appel('/rpc/ideal_est', 'POST', { p_roles: ['directeur'] })
  controle('T', 'le capteur distingue encore ouvert de fermé',
    r.status === 200 && r.code !== '42501',
    `ideal_est répond ${r.status} ${r.code || ''} — doit rester atteignable par anon`)
}

console.log(`
  ⚠ LE VOLET AUTHENTIFIÉ N'EST PAS AUTOMATISABLE ICI — les codes ne quittent
    pas la machine du directeur. Connecté, vérifiez que restent lisibles :
    tableau de bord Direction, surveillant, conseiller, certificats,
    cartes scolaires, rapports.html et pedago-archive.
`)

const echecs = resultats.filter((r) => !r).length
console.log(echecs
  ? `\x1b[31m${echecs} contrôle(s) en échec.\x1b[0m\n`
  : `\x1b[32mVolet automatisable : ${resultats.length}/${resultats.length}.\x1b[0m\n`)
process.exit(echecs ? 1 : 0)

// Garde de FERMETURE : ce que la clé publique OBTIENT réellement.
//
// ── Pourquoi elle juge le CONTENU et non le code HTTP ─────────────────────
//
// Première version : elle exigeait un statut ≥ 300. Elle a déclaré FAIL sur
// une fermeture pourtant effective.
//
// Sous RLS, un SELECT non autorisé ne lève PAS d'erreur : la politique filtre
// les lignes, et PostgREST répond 200 avec `[]`. Un UPDATE ou un DELETE non
// autorisé touche zéro ligne et répond de même. Seul l'INSERT échoue
// franchement, parce qu'il n'y a aucune ligne à filtrer — la nouvelle viole
// le `with check`.
//
// Juger sur le statut, c'est donc confondre « refusé » et « en erreur ». La
// vraie question est : la clé publique repart-elle avec des données, ou les
// a-t-elle modifiées ? C'est ce que cette garde mesure.
//
// Elle n'écrit rien de persistant : les tentatives d'écriture portent sur des
// lignes que la politique rend invisibles, donc sans effet — et la garde le
// vérifie en comptant les lignes réellement touchées.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const U = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1'
const CLE = existsSync('public/inscription.html')
  ? (readFileSync('public/inscription.html', 'utf8').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
  : null

// Rend { statut, lignes } — `lignes` vaut null quand le corps n'est pas une liste.
const sonder = async (methode, chemin, corps, representation = false) => {
  const headers = {
    apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache',
  }
  if (representation) headers.Prefer = 'return=representation'
  try {
    const r = await fetch(U + chemin, { method: methode, headers, cache: 'no-store',
      body: corps === undefined ? undefined : JSON.stringify(corps) })
    let lignes = null
    try { const j = await r.json(); if (Array.isArray(j)) lignes = j.length } catch { /* corps vide */ }
    return { statut: r.status, lignes }
  } catch (e) { return { statut: 0, lignes: null, reseau: String(e).slice(0, 40) } }
}

// Refusé = soit une erreur franche, soit zéro donnée obtenue/touchée.
const refuse = r => r.statut >= 400 || r.lignes === 0
const detail = r => `— ${r.statut}${r.lignes !== null ? ` · ${r.lignes} ligne(s)` : ''}`

console.log(`\n${G}── FERMETURE · ce que la clé publique OBTIENT   [INV-SEC]${F}`)

if (!CLE) {
  verifier('clé publique introuvable', false, '— sonde impossible')
} else {
  const s1 = await sonder('GET', '/financement_params?select=state_json&id=eq.main')
  verifier('S1 · anon n’obtient aucune donnée comptable', refuse(s1), detail(s1))

  const s2 = await sonder('POST', '/financement_params',
    { id: '__sonde_garde_rls', state_json: { sonde: true } }, true)
  verifier('S2 · anon n’insère pas dans la comptabilité', refuse(s2), detail(s2))

  const s3 = await sonder('PATCH', '/financement_params?id=eq.main',
    { annee_scolaire: '2026-2027' }, true)
  verifier('S3 · anon ne modifie aucune ligne comptable', refuse(s3), detail(s3))

  const s4 = await sonder('DELETE', '/financement_params?id=eq.main', undefined, true)
  verifier('S4 · anon ne supprime aucune ligne comptable', refuse(s4), detail(s4))

  const s5 = await sonder('GET', '/inscriptions?select=nom,adresse&limit=1')
  verifier('S5 · anon n’obtient aucun dossier d’inscription', refuse(s5), detail(s5))

  const s6 = await sonder('GET', '/responsables?select=nom,tel1&limit=1')
  verifier('S6 · anon n’obtient aucun responsable légal', refuse(s6), detail(s6))

  // ── Les deux surfaces publiques doivent rester vivantes ────────────────
  //
  // Fermer trop large casserait le dépôt d'un dossier par un parent et la
  // vérification d'une carte trouvée. Un refus de DROIT (401/403/404) serait
  // une fermeture excessive ; un refus MÉTIER (400) prouve que la surface
  // répond.
  const s7 = await sonder('POST', '/rpc/creer_inscription', { p_dossier: {} })
  verifier('S7 · le dépôt public d’un dossier reste possible',
    ![401, 403, 404].includes(s7.statut) && s7.statut !== 0, detail(s7))

  const s8 = await sonder('POST', '/rpc/verifier_carte_scolaire',
    { p_matricule: '__inexistant__', p_nom: '__inexistant__' })
  verifier('S8 · la vérification de carte reste possible', s8.statut === 200, detail(s8))
}

console.log(echecs === 0
  ? `\n  ${V}8 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec — la fermeture n’est pas effective.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

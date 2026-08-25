// Garde de FERMETURE : ce que la clé publique peut réellement faire.
//
// ── Pourquoi elle est comportementale et non déclarative ──────────────────
//
// La migration RLS a « réussi » sans rien fermer. Ses `drop policy if exists`
// visaient neuf noms inventés ; la production en portait trois autres. Un
// `drop policy IF EXISTS` sur un nom inexistant est un NO-OP SILENCIEUX — ni
// erreur, ni avertissement.
//
// Lire `pg_policies` n'aurait rien changé : la clé publique n'y a pas accès,
// et surtout un nom de politique ne dit pas ce qu'elle autorise. Cette garde
// ne demande donc pas « quelles politiques existent » mais « qu'est-ce que la
// clé publique arrive à faire ». C'est la seule question qui compte.
//
// Elle écrit sur une ligne de sonde, jamais sur `main`, et nettoie derrière
// elle.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const U = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1'
const CLE = (existsSync('public/inscription.html')
  ? (readFileSync('public/inscription.html', 'utf8').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
  : null)

const appel = async (methode, chemin, corps, prefer) => {
  const headers = { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  try {
    const r = await fetch(U + chemin, { method: methode, headers,
      body: corps === undefined ? undefined : JSON.stringify(corps) })
    return r.status
  } catch { return 0 }
}

console.log(`\n${G}── FERMETURE · ce que la clé publique arrive à faire   [INV-SEC]${F}`)

if (!CLE) {
  verifier('clé publique introuvable', false, '— sonde impossible')
} else {
  const SONDE = '__sonde_garde_rls'

  // ── S1 à S4 · la comptabilité ──────────────────────────────────────────
  const lecture = await appel('GET', '/financement_params?select=state_json&id=eq.main')
  verifier('S1 · anon ne lit pas la comptabilité', lecture >= 300, `— ${lecture}`)

  const ecriture = await appel('POST', '/financement_params',
    { id: SONDE, state_json: { sonde: true } }, 'return=minimal')
  verifier('S2 · anon n’écrit pas dans la comptabilité', ecriture >= 300, `— ${ecriture}`)

  const maj = await appel('PATCH', `/financement_params?id=eq.${SONDE}`,
    { state_json: { sonde: 2 } }, 'return=minimal')
  verifier('S3 · anon ne modifie pas la comptabilité', maj >= 300, `— ${maj}`)

  const suppression = await appel('DELETE', `/financement_params?id=eq.${SONDE}`)
  verifier('S4 · anon ne supprime pas la comptabilité', suppression >= 300, `— ${suppression}`)

  // Ménage : si S2 a réussi, la sonde existe et doit partir.
  if (ecriture < 300) await appel('DELETE', `/financement_params?id=eq.${SONDE}`)

  // ── S5, S6 · les familles ──────────────────────────────────────────────
  const dossiers = await appel('GET', '/inscriptions?select=nom,adresse&limit=1')
  verifier('S5 · anon ne lit pas les dossiers d’inscription', dossiers >= 300, `— ${dossiers}`)

  const parents = await appel('GET', '/responsables?select=nom,tel1&limit=1')
  verifier('S6 · anon ne lit pas les responsables légaux', parents >= 300, `— ${parents}`)

  // ── S7, S8 · les deux surfaces publiques restent vivantes ──────────────
  //
  // Fermer trop large casserait le dépôt d'un dossier par un parent et la
  // vérification d'une carte trouvée. On vérifie que les deux répondent
  // encore — un refus de DROIT (401/403) serait une fermeture excessive ;
  // un refus MÉTIER (400) prouve au contraire que la surface est vivante.
  const depot = await appel('POST', '/rpc/creer_inscription', { p_dossier: {} })
  verifier('S7 · le dépôt public d’un dossier reste possible',
    depot !== 401 && depot !== 403 && depot !== 404, `— ${depot}`)

  const carte = await appel('POST', '/rpc/verifier_carte_scolaire',
    { p_matricule: '__inexistant__', p_nom: '__inexistant__' })
  verifier('S8 · la vérification de carte reste possible', carte === 200, `— ${carte}`)
}

console.log(echecs === 0
  ? `\n  ${V}8 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec — la fermeture n’est pas effective.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

// Garde globale : ce que la clé publique atteint réellement.
//
// Elle ne lit aucun nom de politique. Elle mesure — table par table, fichier
// par fichier — ce qu'un visiteur obtient avec la clé qu'embarque son
// navigateur. C'est la seule chose qui compte.
//
// Le plafond des tables ouvertes vit dans `.ideal-etat.json` et ne remonte
// jamais : chaque fermeture l'abaisse définitivement.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co'
const CLE = (lire('public/inscription.html').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
const ENTETES = () => ({ apikey: CLE, Authorization: `Bearer ${CLE}`,
  'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' })

const lignes = async (chemin) => {
  try {
    const r = await fetch(`${BASE}/rest/v1/${chemin}`, { headers: ENTETES(), cache: 'no-store' })
    if (!r.ok) return -1
    const j = await r.json()
    return Array.isArray(j) ? j.length : -1
  } catch { return -2 }
}

console.log(`\n${G}── SURFACE PUBLIQUE · ce que la clé publique atteint   [INV-SEC]${F}`)

if (!CLE) { verifier('clé publique introuvable', false); }
else {
  const etat = JSON.parse(lire('.ideal-etat.json') || '{}')

  // ── T1 · les tables fermées le restent ─────────────────────────────────
  //
  // Six fermetures ont été payées d'un audit chacune. Aucune ne doit se
  // rouvrir sans qu'on le sache le jour même.
  {
    const FERMEES = ['financement_params', 'inscriptions', 'responsables',
                     'documents_inscription', 'users', 'disciplines']
    const rouvertes = []
    for (const t of FERMEES) {
      const n = await lignes(`${t}?select=*&limit=1`)
      if (n > 0) rouvertes.push(`${t}:${n}`)
    }
    verifier('T1 · les six tables fermées le restent',
      rouvertes.length === 0, rouvertes.length ? `— ROUVERTES: ${rouvertes.join(', ')}` : '')
  }

  // ── T2 · le nombre de tables ouvertes ne remonte jamais ────────────────
  {
    const CANDIDATES = (lire('docs/constitution/tables-publiques.txt') || '')
      .split('\n').map(s => s.trim()).filter(Boolean)
    const plafond = (etat.plafonds || {}).tables_ouvertes_anon ?? 999
    let ouvertes = []
    for (const t of CANDIDATES) {
      const n = await lignes(`${t}?select=*&limit=1`)
      if (n > 0) ouvertes.push(t)
    }
    verifier('T2 · aucune table ne se rouvre à la clé publique',
      CANDIDATES.length > 0 && ouvertes.length <= plafond,
      `— ${ouvertes.length} ouverte(s), plafond ${plafond}`
      + (ouvertes.length > plafond ? ` · en trop: ${ouvertes.slice(plafond).join(', ')}` : ''))
  }

  // ── T3 · les fichiers des enfants ─────────────────────────────────────
  //
  // Mesuré : la photo d'un enfant (34 241 o), la signature de son parent
  // (55 696 o) et son acte de naissance (420 881 o) sont téléchargeables
  // avec la clé publique. Le bucket n'est « privé » qu'au sens où la route
  // /public/ est fermée.
  {
    let listable = false, telechargeable = false
    try {
      const r = await fetch(`${BASE}/storage/v1/object/list/inscriptions`, {
        method: 'POST', headers: { ...ENTETES(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: 'photos', limit: 1 }) })
      const j = await r.json()
      listable = Array.isArray(j) && j.length > 0
      if (listable) {
        const f = await fetch(
          `${BASE}/storage/v1/object/inscriptions/photos/${encodeURIComponent(j[0].name)}`,
          { headers: ENTETES() })
        telechargeable = f.ok && Number(f.headers.get('content-length') || 0) > 1000
      }
    } catch { /* réseau */ }
    verifier('T3 · les documents des enfants ne sont pas atteignables',
      !listable && !telechargeable,
      `— listable:${listable ? 'OUI' : 'non'} téléchargeable:${telechargeable ? 'OUI' : 'non'}`)
  }

  // ── T4 · les deux surfaces publiques répondent toujours ────────────────
  {
    const rpc = async (n, corps) => {
      try {
        const r = await fetch(`${BASE}/rest/v1/rpc/${n}`, { method: 'POST',
          headers: { ...ENTETES(), 'Content-Type': 'application/json' },
          body: JSON.stringify(corps) })
        return r.status
      } catch { return 0 }
    }
    const depot = await rpc('creer_inscription', { p_dossier: {} })
    const carte = await rpc('verifier_carte_scolaire',
      { p_matricule: '__x__', p_nom: '__x__' })
    verifier('T4 · dépôt public et vérification de carte répondent',
      ![401, 403, 404, 0].includes(depot) && carte === 200,
      `— dépôt:${depot} carte:${carte}`)
  }
}

console.log(echecs === 0
  ? `\n  ${V}4 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

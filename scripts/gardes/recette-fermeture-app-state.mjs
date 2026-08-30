// RECETTE POST-MIGRATION · à lancer APRÈS le REVOKE, jamais avant.
//
//     node scripts/gardes/recette-fermeture-app-state.mjs
//
// Ce fichier ne porte pas le préfixe `test-` : l'orchestrateur ne le découvre
// donc pas, et la suite ordinaire n'en est pas affectée. C'est voulu — cette
// recette DOIT être rouge tant que la fermeture n'a pas eu lieu, et une garde
// rouge en permanence dans la suite apprendrait à ignorer le rouge.
//
// Elle mesure le serveur, pas le dépôt. Aucune écriture n'est tentée sur une
// ligne réelle : le PATCH et le DELETE portent sur un couple (app, key) qui ne
// désigne rien.
import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1/app_state'
const CLE = (lire('public/inscription.html').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
const H = { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' }
const NUL = '?app=eq.__aucune_ligne__&key=eq.__aucune_ligne__'

console.log(`\n${G}── FERMETURE APP_STATE · ce que la clé publique atteint encore${F}`)

// Un privilège retiré se voit en 42501 — PostgreSQL refuse AVANT de regarder
// la moindre ligne. C'est le seul verdict qui ne se confonde avec rien : un
// 200 vide ou un 204 « zéro ligne » ne prouveraient rien.
const refuse = async (op, url, init) => {
  const r = await fetch(url, init)
  const t = await r.text()
  let code = ''
  try { code = (JSON.parse(t) || {}).code || '' } catch { /* corps non JSON */ }
  return { ferme: code === '42501' || r.status === 401 || r.status === 403, statut: r.status, code }
}

if (!CLE) { verifier('clé publique introuvable', false) }
else {
  const s = await refuse('SELECT', `${BASE}${NUL}&select=key`, { headers: H })
  verifier('F1 · anon ne lit plus app_state', s.ferme, `— ${s.statut} ${s.code}`)

  // Sonde d'INSERT qui n'écrit RIEN, en toutes circonstances : la colonne
  // `app` — obligatoire, elle fait partie de la clé primaire — est omise.
  //   42501 → le privilège est retiré, refus avant toute évaluation
  //   23502 → le privilège est encore là, mais aucune ligne n'a été créée
  //
  // La première version de cette sonde envoyait une ligne complète. Lancée
  // avant la migration, elle a réellement créé `__recette__/__recette__` —
  // une neuvième ligne de sonde, dans la table qu'elle prétendait surveiller.
  // Une sonde qui salit ce qu'elle mesure n'est pas une sonde.
  const i = await refuse('INSERT', BASE, { method: 'POST', headers: H,
    body: JSON.stringify({ key: '__sonde_privilege__' }) })
  verifier('F2 · anon n’écrit plus app_state', i.ferme, `— ${i.statut} ${i.code}`)

  const u = await refuse('UPDATE', `${BASE}${NUL}`, { method: 'PATCH', headers: H,
    body: JSON.stringify({ updated_at: new Date().toISOString() }) })
  verifier('F3 · anon ne met plus à jour app_state', u.ferme, `— ${u.statut} ${u.code}`)

  const d = await refuse('DELETE', `${BASE}${NUL}`, { method: 'DELETE', headers: H })
  verifier('F4 · anon ne supprime plus app_state', d.ferme, `— ${d.statut} ${d.code}`)

  // F5 · ce qui doit CONTINUER de marcher sans session : le dépôt public.
  // Le dossier vide est refusé à la validation, avant tout insert — la sonde
  // n'écrit rien. Ce qui compte est que la fonction soit encore ATTEINTE.
  const rp = await fetch(`${BASE.replace('/app_state', '')}/rpc/creer_inscription_avec_suivi`, {
    method: 'POST', headers: H, body: JSON.stringify({ p_dossier: {} }),
  })
  const tp = await rp.text()
  let cp = ''
  try { cp = (JSON.parse(tp) || {}).message || '' } catch { /* corps non JSON */ }
  verifier('F5 · le dépôt public répond toujours (sans session)',
    /responsable_incomplet/.test(cp), `— ${rp.status} ${cp.slice(0, 40)}`)

  // F6 · une lecture métier précise, pas seulement la table en général.
  const rb = await fetch(`${BASE}?app=eq.rapports_eleves&select=key`, { headers: H })
  const tb = await rb.text()
  let cb = ''
  try { cb = (JSON.parse(tb) || {}).code || '' } catch { /* corps non JSON */ }
  verifier('F6 · anon ne lit plus les rapports élèves',
    cb === '42501' || rb.status === 401 || rb.status === 403, `— ${rb.status} ${cb}`)

  // F7 · cette migration ne touche pas aux lignes de sonde.
  //
  // Leur nettoyage est un geste séparé. Si elles avaient disparu ici, c'est
  // que le script de fermeture a fait autre chose que ce qu'il annonce.
  console.log(`\n  ${G}F7 · les neuf lignes de sonde ne sont PAS l'affaire de cette${F}`)
  console.log(`  ${G}migration. Les vérifier avec sql/app_state_sondes_select.sql,${F}`)
  console.log(`  ${G}puis les supprimer avec sql/app_state_sondes_delete.sql — après.${F}`)

  // ── Ce que cette recette NE PEUT PAS mesurer ──────────────────────────
  //
  // Elle n'a pas de session. Tout ce qui concerne `authenticated` doit être
  // constaté depuis un navigateur connecté. Les inventer en vert ici serait
  // le pire service à rendre.
  console.log(`\n  ${G}À CONSTATER DEPUIS UN NAVIGATEUR CONNECTÉ (cette recette n'a pas de session) :${F}`)
  console.log(`  ${G}  · portail : la cloche affiche les notifications          (SELECT authenticated)${F}`)
  console.log(`  ${G}  · une demande RH déposée par un enseignant apparaît      (INSERT/UPDATE authenticated)${F}`)
  console.log(`  ${G}  · la direction répond à cette demande, la réponse tient  (UPDATE conditionnel)${F}`)
  console.log(`  ${G}  · rapports.html connecté : un rapport s'enregistre       (SELECT + INSERT)${F}`)
  console.log(`  ${G}  · rapports.html en navigation privée : refus            (aucun accès anon)${F}`)
  console.log(`  ${G}  · dépôt d'une inscription réelle : matricule + QR de suivi${F}`)
  console.log(`  ${G}  · la direction ET l'administratif reçoivent UNE notification${F}`)
  console.log(`  ${G}  · le lien de suivi ouvre le dossier déposé${F}`)
}

console.log(echecs === 0
  ? `\n  ${V}fermeture confirmée.${F}\n`
  : `\n  ${R}${echecs} contrôle(s) en échec — la fermeture n’est pas effective.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

// Garde réseau : toute fonction serveur nommée par une page publique EXISTE.
//
// ── Pourquoi cette garde ──────────────────────────────────────────────────
//
// `public/inscription.html` a vu son appel passer de `creer_inscription` à
// `creer_inscription_avec_suivi`. La seule garde qui surveillait ce point
// lisait une chaîne de caractères dans le fichier : elle a crié au loup sur le
// renommage, et elle serait restée muette dans le cas VRAIMENT dangereux —
// une page renommée qui appelle une fonction jamais déployée. Le formulaire
// d'inscription aurait alors échoué chez chaque parent, sans rien signaler
// dans le dépôt.
//
// On interroge donc le serveur. Une page publique qui nomme une fonction
// absente est une panne à trouver ici, pas le jour de la rentrée.
//
// ── Innocuité ─────────────────────────────────────────────────────────────
//
// Chaque appel est fait avec des arguments choisis pour être REFUSÉS par la
// validation d'entrée de la fonction, avant la moindre écriture. La raison est
// donnée cas par cas ci-dessous. Aucune ligne n'est créée, aucun message n'est
// émis.
import { readFileSync, existsSync, readdirSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co'
const CLE = (lire('public/inscription.html').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]

console.log(`\n${G}── RPC PUBLIQUES · ce que les pages appellent existe-t-il   [INV-FLUX]${F}`)

// Arguments d'appel, et pourquoi ils n'écrivent rien.
const APPELS = {
  // Dossier vide : `creer_inscription` lève `responsable_incomplet` à sa
  // première instruction, avant tout insert.
  creer_inscription_avec_suivi: { p_dossier: '{}' },
  // Zéro cible : la fonction lève `cible_requise` avant de chercher le
  // moindre abonnement. Aucun message n'est mis en file.
  emettre_notification_push: { p_cibles: '{}', p_titre: '', p_message: '', p_url: '', p_tag: '' },
  // Lecture seule.
  verifier_carte_scolaire: { p_matricule: '__GARDE__', p_nom: '__GARDE__' },
  lire_suivi_inscription: { p_token: '__GARDE__' },
  // Réservée aux sessions authentifiées : refusée en 42501 AVANT exécution.
  enregistrer_paiement: { p_matricule: '__GARDE__', p_montant: '0', p_mode: '', p_motif: '', p_recu: '', p_date_lisible: '' },
}

// PostgREST résout la signature d'après les NOMS d'arguments. Un GET sur une
// fonction absente répond PGRST202 ; toute autre réponse — refus métier,
// permission refusée — prouve que la fonction a été trouvée.
const existe = async (nom, args) => {
  const q = new URLSearchParams(args).toString()
  const r = await fetch(`${BASE}/rest/v1/rpc/${nom}?${q}`, {
    headers: { apikey: CLE, Authorization: `Bearer ${CLE}` },
  })
  const t = await r.text()
  let code = ''
  try { code = (JSON.parse(t) || {}).code || '' } catch { /* corps non JSON : la fonction a répondu */ }
  return { present: code !== 'PGRST202', code, statut: r.status }
}

if (!CLE) { verifier('clé publique introuvable', false) }
else {
  // ── P0 · la sonde sait dire « absente » ────────────────────────────────
  //
  // Sans ce témoin, une sonde qui répondrait « présente » à tout afficherait
  // un vert complet et ne prouverait rien.
  const temoin = await existe('fonction_ideal_qui_nexiste_pas_2026', { p_x: '1' })
  verifier('P0 · témoin négatif : une fonction absente est vue absente',
    temoin.present === false, `— ${temoin.code || temoin.statut}`)

  // ── P1 · chaque RPC nommée par une page publique existe ────────────────
  const pages = readdirSync('public').filter(f => f.endsWith('.html')).map(f => `public/${f}`)
  const nommees = new Set()
  for (const p of pages) {
    for (const m of lire(p).matchAll(/\.rpc\(\s*['"]([a-z0-9_]+)['"]/g)) nommees.add(m[1])
  }

  for (const nom of [...nommees].sort()) {
    if (!APPELS[nom]) {
      // Une RPC publique nouvelle, sans arguments d'appel déclarés ici, ne
      // doit pas passer inaperçue : elle serait vérifiée par personne.
      verifier(`P1 · ${nom}`, false, '— appel non décrit dans cette garde, donc non vérifié')
      continue
    }
    const r = await existe(nom, APPELS[nom])
    verifier(`P1 · ${nom} existe côté serveur`, r.present,
      r.present ? `— ${r.statut} ${r.code || ''}`.trimEnd() : '— PGRST202 : ABSENTE EN BASE')
  }

  // ── P2 · la page d'inscription garde une voie de dépôt vivante ─────────
  //
  // Le contrôle qui compte pour la rentrée : le parent peut-il déposer ?
  const voie = [...lire('public/inscription.html')
    .matchAll(/\.rpc\(\s*['"]([a-z0-9_]*creer_inscription[a-z0-9_]*)['"]/g)].map(m => m[1])[0]
  const dep = voie ? await existe(voie, APPELS[voie] || { p_dossier: '{}' }) : { present: false }
  verifier('P2 · la voie de dépôt du formulaire public répond',
    !!voie && dep.present, voie ? `— ${voie}` : '— aucune voie trouvée dans la page')
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

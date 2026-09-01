#!/usr/bin/env node
// Détecte une clé serveur réellement présente dans les fichiers suivis par
// git — et, depuis la Phase 2, tout chemin par lequel une telle clé
// pourrait ATTEINDRE le navigateur.
//
// La première version de cette garde cherchait le mot « service_role » —
// elle rougissait sur des commentaires et n'aurait jamais trouvé une vraie
// clé : dans un JWT, ce mot est encodé en base64. On décode donc la charge
// utile de chaque jeton pour lire le rôle qu'il porte.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g
// Les clés secrètes du nouveau format ne sont pas des JWT : le décodage ne
// les verrait pas. Elles se reconnaissent à leur préfixe.
const SECRETE = /\bsb_secret_[A-Za-z0-9_-]{10,}/g
// Les fichiers suivis ET les fichiers neufs non ignores. Ne lire que
// `git ls-files` rendait la garde aveugle aux fichiers pas encore ajoutes —
// exactement ceux ou une cle arrive. Les `.gitignore` sont respectes, donc
// `.env` reste hors du champ.
const fichiers = execSync('git ls-files --cached --others --exclude-standard',
  { encoding: 'utf8' }).split('\n').filter(Boolean)
const fuites = []

for (const f of fichiers) {
  let contenu
  try { contenu = readFileSync(f, 'utf8') } catch { continue }
  for (const cle of contenu.match(SECRETE) || []) {
    fuites.push(`${f} → clé secrète sb_secret_…`)
  }
  for (const jeton of contenu.match(JWT) || []) {
    try {
      const charge = JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8'))
      if (charge.role && charge.role !== 'anon') fuites.push(`${f} → rôle « ${charge.role} »`)
    } catch { /* pas un JWT lisible */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2 — les chemins par lesquels une clé serveur pourrait fuiter
//
// La détection ci-dessus cherche une clé DÉJÀ écrite dans un fichier. Elle
// ne verrait pas une clé qui n'arrive qu'au moment du build, par une
// variable d'environnement mal nommée. Ces cinq contrôles ferment cela.
// ═══════════════════════════════════════════════════════════════════════

const CLE_ADMIN = /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/
const POINT_UNIQUE = 'api/_supabase.js'

// ── S1 · aucune variable VITE_ ne peut porter un secret ────────────────
//
// Vite n'expose au navigateur QUE les variables préfixées `VITE_`. C'est
// ce préfixe, et lui seul, qui décide si une valeur part dans le bundle.
for (const f of fichiers) {
  let contenu
  try { contenu = readFileSync(f, 'utf8') } catch { continue }
  for (const nom of contenu.match(/\bVITE_[A-Z0-9_]+/g) || []) {
    if (/SERVICE|SECRET|ROLE_KEY|SB_SECRET/i.test(nom)) {
      fuites.push(`${f} → S1 : « ${nom} » est exposée au navigateur par son préfixe VITE_`)
    }
  }
}

// ── S2/S3 · la clé admin n'est lue qu'en un seul endroit ───────────────
for (const f of fichiers) {
  if (f === POINT_UNIQUE) continue
  let contenu
  try { contenu = readFileSync(f, 'utf8') } catch { continue }
  // On ne compte que les LECTURES réelles, pas les mentions en prose : un
  // commentaire qui explique la règle n'est pas une infraction. Leçon
  // apprise cinq fois dans ce dépôt.
  const lectures = (contenu.match(new RegExp(`process\\.env(\\.|\\[['"])\\s*(${CLE_ADMIN.source})`, 'g')) || [])
  if (lectures.length) {
    const zone = f.startsWith('src/') || f.startsWith('public/') ? 'S2' : 'S3'
    fuites.push(`${f} → ${zone} : lit la clé admin hors de ${POINT_UNIQUE}`)
  }
}

// ── S5 · aucune trace de secret dans les journaux ──────────────────────
//
// Un `console.log` qui affiche un jeton le dépose dans les journaux
// Vercel, consultables longtemps après.
const SENSIBLE = /\b(token|password|mot_de_passe|jetable|authorization|secret_key|service_role)\b/i
for (const f of fichiers) {
  if (!/^(api|src|public)\//.test(f)) continue
  let contenu
  try { contenu = readFileSync(f, 'utf8') } catch { continue }
  contenu.split('\n').forEach((ligne, i) => {
    const nue = ligne.replace(/^\s*(\/\/|\*|--).*$/, '')
    if (!/console\.(log|error|warn|info|debug)\s*\(/.test(nue)) return
    const args = nue.slice(nue.indexOf('console.'))
    if (SENSIBLE.test(args)) fuites.push(`${f}:${i + 1} → S5 : un journal mentionne un secret`)
  })
}

// ── S4 · le bundle construit, s'il existe ──────────────────────────────
//
// `dist/` n'est pas suivi par git : la boucle du haut ne le voit jamais.
// C'est pourtant le seul artefact réellement servi au navigateur.
if (existsSync('dist')) {
  const empiler = (dossier) => readdirSync(dossier, { withFileTypes: true })
    .flatMap((e) => e.isDirectory() ? empiler(`${dossier}/${e.name}`) : [`${dossier}/${e.name}`])
  for (const f of empiler('dist')) {
    let contenu
    try { contenu = readFileSync(f, 'utf8') } catch { continue }
    if (SECRETE.test(contenu)) fuites.push(`${f} → S4 : clé sb_secret_… dans le bundle servi`)
    SECRETE.lastIndex = 0
    for (const jeton of contenu.match(JWT) || []) {
      try {
        const charge = JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8'))
        if (charge.role && charge.role !== 'anon') fuites.push(`${f} → S4 : rôle « ${charge.role} » dans le bundle servi`)
      } catch { /* pas un JWT lisible */ }
    }
  }
}

if (fuites.length) {
  console.log(fuites.join('\n'))
  process.exit(1)
}
process.exit(0)

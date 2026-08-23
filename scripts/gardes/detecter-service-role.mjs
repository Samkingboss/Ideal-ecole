#!/usr/bin/env node
// Détecte une clé `service_role` réellement présente dans les fichiers
// suivis par git.
//
// La première version de cette garde cherchait le mot « service_role » —
// elle rougissait sur des commentaires et n'aurait jamais trouvé une vraie
// clé : dans un JWT, ce mot est encodé en base64. On décode donc la charge
// utile de chaque jeton pour lire le rôle qu'il porte.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g
// Les clés secrètes du nouveau format ne sont pas des JWT : le décodage ne
// les verrait pas. Elles se reconnaissent à leur préfixe.
const SECRETE = /\bsb_secret_[A-Za-z0-9_-]{10,}/g
const fichiers = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
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

if (fuites.length) {
  console.log(fuites.join('\n'))
  process.exit(1)
}
process.exit(0)

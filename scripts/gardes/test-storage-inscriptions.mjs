// Gardes STATIQUES sur le bucket privé `inscriptions`.
//
// Le bucket contient les pièces d'identité d'enfants : acte de naissance,
// photo, signature du responsable légal. Il a été ouvert en lecture à `anon`
// pendant toute la phase de mise en service ; la fermeture est acquise, ce
// fichier existe pour qu'elle le reste.
//
// Les gardes COMPORTEMENTALES vivent ailleurs, parce qu'elles exigent le
// réseau ou une session :
//   scripts/gardes/test-storage-anon-live.mjs   G1 G2 G3 G4  (clé publiable)
//   scripts/verif-storage-direction.sh          G5 G6 G7      (comptes)

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// Un `//` en début de ligne ou un `/* */` ne sont pas du code. Une garde qui
// compte les commentaires se déclenche sur sa propre explication.
const sansCommentaires = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n')

const SOURCES = [
  'src/pages/InscriptionsValidation.jsx',
  'src/pages/CartesScolaires.jsx',
  'src/pages/DirecteurApp.jsx',
  'public/inscription.html',
  'public/comptabilite.html',
  'public/fiche.html',
]

console.log(`\n${G}── STORAGE · bucket privé inscriptions            [INV-SECURITE]${F}`)

// ── G8 · aucun `getPublicUrl` sur ce bucket ───────────────────────────────
//
// `getPublicUrl` ne demande rien au serveur : il fabrique une chaîne. Sur un
// bucket privé elle répond 400, mais le code, lui, croit avoir une adresse et
// l'enregistre en base. C'est le défaut qui a laissé des `justificatif_url`
// morts dans `absences_enseignants` : la pièce paraissait jointe et n'était
// jamais lisible.
const chercherPublicUrl = src => {
  const net = sansCommentaires(src)
  return /from\(\s*['"]inscriptions['"]\s*\)\s*\.\s*getPublicUrl/.test(net)
      || /getPublicUrl[\s\S]{0,60}['"]inscriptions['"]/.test(net)
}
{
  const coupables = SOURCES.filter(f => chercherPublicUrl(lire(f)))
  verifier('G8 aucun getPublicUrl sur `inscriptions`', coupables.length === 0,
    coupables.length ? R + coupables.join(', ') + F : '')

  // AUTO-TEST : la garde doit voir le défaut qu'on vient de retirer.
  const defaut = `const { data: pub } = _supa.storage.from('inscriptions').getPublicUrl(chemin);`
  const commentaire = `// getPublicUrl sur 'inscriptions' rendait une adresse morte`
  verifier('G8 auto-test · voit le défaut réintroduit', chercherPublicUrl(defaut) === true)
  verifier('G8 auto-test · ne voit pas un commentaire', chercherPublicUrl(commentaire) === false)
}

// ── G9 · aucun droit DELETE Storage supposé sur ce bucket ─────────────────
//
// Décision explicite du 25/08/2026 : pas de policy DELETE `authenticated`.
// Un droit de suppression sur tout le bucket pour rattraper une panne rare
// est un mauvais échange. Le code doit donc ASSUMER l'orphelin, pas tenter
// de le retirer — un `remove()` qui échoue en silence dans un `catch` ferait
// croire au ménage.
const chercherRemove = src =>
  /from\(\s*['"]inscriptions['"]\s*\)\s*\.\s*remove\s*\(/.test(sansCommentaires(src))
{
  const coupables = SOURCES.filter(f => chercherRemove(lire(f)))
  verifier('G9 aucun remove() sur `inscriptions`', coupables.length === 0,
    coupables.length ? R + coupables.join(', ') + F : '')

  const defaut = `if (chemin) await supabase.storage.from('inscriptions').remove([chemin])`
  verifier('G9 auto-test · voit le défaut réintroduit', chercherRemove(defaut) === true)
}

// ── G10 · l'orphelin est NOMMÉ, pas avalé ─────────────────────────────────
//
// Renoncer au retrait n'autorise pas à perdre le fichier. Sans son chemin
// dans la console, un dépôt sans validation devient introuvable.
{
  const src = lire('src/pages/InscriptionsValidation.jsx')
  const trace = /console\.(warn|error)\([^)]*inscriptions\/\$\{chemin\}/.test(src)
  verifier('G10 le dépôt sans validation trace son chemin', trace)

  const defaut = 'if (chemin) console.warn(`[IDEAL] déposée : inscriptions/${chemin}`)'
  const muet = 'if (chemin) { /* rien */ }'
  const juge = s => /console\.(warn|error)\([^)]*inscriptions\/\$\{chemin\}/.test(s)
  verifier('G10 auto-test · distingue tracé et muet', juge(defaut) === true && juge(muet) === false)
}

// ── G11 · toute lecture privée passe par un lien signé ────────────────────
//
// La seule voie de lecture autorisée depuis le retrait de la policy anon.
{
  const iv = lire('src/pages/InscriptionsValidation.jsx')
  const cs = lire('src/pages/CartesScolaires.jsx')
  const cp = lire('public/comptabilite.html')
  verifier('G11a signature parent lue par lien signé',
    /createSignedUrl\(/.test(iv))
  verifier('G11b photos des cartes lues par lien signé',
    /from\('inscriptions'\)[\s\S]{0,80}createSignedUrls\(/.test(cs))
  verifier('G11c justificatif lu par lien signé',
    /createSignedUrl\(/.test(cp))
}

// ── G12 · le formulaire public n'écrit que dans les trois dossiers prévus ──
//
// `upload_inscriptions` couvre le parcours parent. Un quatrième préfixe
// apparu dans `inscription.html` serait une écriture qu'aucune policy ne
// couvre — ou pire, une que `upload_justificatifs` couvrirait par accident.
{
  const src = sansCommentaires(lire('public/inscription.html'))
  const prefixes = new Set(
    [...src.matchAll(/from\('inscriptions'\)\.upload\(\s*([A-Za-z_$][\w$]*)/g)]
      .map(m => m[1])
      .map(v => {
        const d = src.match(new RegExp(`${v}\\s*=\\s*\`([a-z-]+)/`))
        return d ? d[1] : '?'
      })
  )
  const attendus = ['photos', 'documents', 'signatures']
  const inconnus = [...prefixes].filter(p => !attendus.includes(p))
  verifier('G12 formulaire public : 3 préfixes, pas un de plus',
    prefixes.size === 3 && inconnus.length === 0,
    inconnus.length ? R + 'inconnu: ' + inconnus.join(', ') + F : G + [...prefixes].join(' ') + F)
}

console.log(echecs === 0
  ? `\n  ${V}Gardes statiques Storage : ${'aucun écart'}${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

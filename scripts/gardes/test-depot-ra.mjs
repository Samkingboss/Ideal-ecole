// Gardes sur le dépôt d'un dossier par le responsable administratif.
//
// ── La cause du blocage ────────────────────────────────────────────────────
//
//   DirecteurApp.jsx:875    le RA ouvre /inscription.html pour créer un
//                           dossier — c'est SON parcours
//   inscription.html:899    storageKey: 'ideal-auth' — le formulaire partage
//                           la session du portail
//   → un RA connecté y arrive donc avec un jeton `authenticated`
//   upload_inscriptions     INSERT · TO anon
//
// Une policy `to anon` ne s'applique jamais au rôle `authenticated`. Le
// premier dépôt du parcours — la photo — est refusé.
//
// Ce n'est pas la fermeture des lectures anonymes qui a cassé ce parcours :
// c'est la fusion des sessions, antérieure.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── DÉPÔT RA · le parcours d'inscription           [INV-SECURITE]${F}`)

const form = lire('public/inscription.html')
const sql = lire('sql/storage_inscriptions_depot_direction.sql')

// ── D1 · le parcours réel, et rien d'autre ────────────────────────────────
//
// Les policies ouvrent exactement les préfixes que le code écrit. Un
// quatrième préfixe apparu ici sans policy échouerait en production ; une
// policy sans préfixe correspondant serait un droit que rien n'exerce.
{
  const prefixes = [...form.matchAll(/from\('inscriptions'\)\.upload\(\s*([A-Za-z_$][\w$]*)/g)]
    .map(m => m[1])
    .map(v => {
      const d = form.match(new RegExp(`${v}\\s*=\\s*\`([a-z-]+)/`))
      return d ? d[1] : '?'
    })
  const attendus = ['photos', 'documents', 'signatures']
  const uniques = [...new Set(prefixes)].sort()
  verifier('D1 le formulaire écrit dans trois préfixes, pas un de plus',
    uniques.length === 3 && uniques.join(',') === attendus.slice().sort().join(','),
    uniques.join(' '))

  const couverts = attendus.filter(p => new RegExp(`\\[1\\] = '${p}'`).test(sql))
  verifier('D1 chaque préfixe écrit a sa policy',
    couverts.length === 3, couverts.join(' '))
}

// ── D2 · aucun droit qui dépasse le besoin ────────────────────────────────
{
  verifier('D2 aucun upsert sur ce bucket dans le parcours',
    !/from\('inscriptions'\)\.upload\([^)]*upsert/.test(form),
    'un upsert réclamerait UPDATE, et SELECT pour lire la ligne en conflit')
  verifier('D2 aucun remove() : pas de DELETE à accorder',
    !/from\('inscriptions'\)\.remove\(/.test(form),
    'un orphelin rare vaut mieux qu’un droit de suppression sur tout un préfixe')
  verifier('D2 aucun update() direct', !/from\('inscriptions'\)\.update\(/.test(form))

  // Les trois policies sont des INSERT, bornées au bucket, au préfixe et au
  // rôle métier. Aucune ne peut être « à tout le bucket ».
  const blocs = [...sql.matchAll(/depot_\w+\n[\s\S]{0,400}?ideal_est_direction\(\)/g)].map(m => m[0])
  verifier('D2 chaque policy est bornée bucket + préfixe + rôle',
    blocs.length >= 3 && blocs.every(b =>
      /bucket_id = 'inscriptions'/.test(b) && /foldername\(name\)\)\[1\]/.test(b)),
    `${blocs.length} policies décrites`)
  // Chaque mention du bucket dans une clause WITH CHECK doit être suivie
  // d'une contrainte de préfixe. Un compte qui ne tombe pas juste signale une
  // policy ouverte à tout le bucket — c'est le seul dérapage possible ici.
  const clauses = (sql.match(/bucket_id = 'inscriptions'\n\s*--\s*and \(storage\.foldername/g) || []).length
  const mentions = (sql.match(/bucket_id = 'inscriptions'\n/g) || []).length
  verifier('D2 chaque clause de bucket est suivie d’un préfixe',
    mentions > 0 && clauses === mentions,
    `${clauses}/${mentions} clauses bornées`)
  verifier('D2 aucun UPDATE, DELETE ni SELECT ajouté',
    !/Allowed operation\s*=\s*(UPDATE|DELETE|SELECT)/.test(sql)
    && !/create policy[\s\S]*for (update|delete|select)/i.test(sql))
}

// ── D3 · le rôle métier est réutilisé, pas redoublé ───────────────────────
{
  const roleSql = lire('sql/rls_finances_et_dossiers.sql')
  verifier('D3 ideal_est_direction couvre directeur ET responsable administratif',
    /ideal_est\(array\['directeur', 'responsable_administratif'\]\)/.test(roleSql))
  verifier('D3 les policies s’appuient dessus, sans logique parallèle',
    (sql.match(/ideal_est_direction\(\)/g) || []).length >= 3
    && !/role\s*=\s*'responsable_administratif'/.test(sql),
    'une seconde logique de rôle finirait par diverger de la première')
}

// ── D4 · le parcours du parent reste ouvert ───────────────────────────────
//
// La moitié du sujet, et la façon la plus simple de « faire marcher » le RA
// aurait été de l'élargir.
{
  verifier('D4 les policies anon ne sont pas touchées',
    !/drop policy[\s\S]*upload_inscriptions/i.test(sql)
    && /upload_inscriptions\s+INSERT\s+\{anon\}/.test(sql),
    'un parent non connecté doit toujours pouvoir déposer')
  verifier('D4 aucune lecture anonyme réintroduite',
    !/for select[\s\S]{0,120}to anon/i.test(sql)
    && !/getPublicUrl/.test(sql))
}

// ── D5 · le retour arrière existe et reste étroit ─────────────────────────
{
  const rb = lire('sql/storage_inscriptions_depot_rollback.sql')
  verifier('D5 un retour arrière est écrit', rb.length > 200)
  verifier('D5 il ne retire que les trois policies ajoutées',
    /depot_photo_direction/.test(rb) && /depot_documents_direction/.test(rb)
    && /depot_signature_parent_direction/.test(rb))
  verifier('D5 il épargne la signature de validation',
    /Ne PAS supprimer `depot_signature_direction`/.test(rb),
    'elle sert un autre parcours, déjà en service')
}

// ── D6 · la recette sait échouer ──────────────────────────────────────────
{
  const rec = lire('scripts/verif-depot-ra.sh')
  const temoins = ['N1 enseignant -> photos/', 'N2 enseignant -> documents/',
                   'N3 RA -> interdit/', 'N4 anon lit', 'N5 anon liste']
  const manquants = temoins.filter(t => !rec.includes(t.split(' ')[0]))
  verifier('D6 les cinq témoins négatifs sont dans la recette',
    manquants.length === 0, manquants.length ? R + manquants.join(', ') + F : '5 témoins')
  verifier('D6 un dépôt se juge sur le corps, pas sur le statut',
    /grep -q 'row-level security'/.test(rec),
    'un refus RLS arrive en http 400 portant un 403')
  verifier('D6 une lecture se juge sur les octets',
    /taille" -gt 3/.test(rec), 'un refus de lecture se présente en « Object not found »')
  verifier('D6 le second dépôt distingue doublon et droit manquant',
    /Duplicate\\\|already exists/.test(rec) || /Duplicate/.test(rec),
    'sinon on ne saurait pas si le remplacement échoue faute de droit')
  verifier('D6 le parcours parent est vérifié après coup',
    /anon depose toujours une photo/.test(rec))
  verifier('D6 les fixtures sont nommées et listées',
    /FIXTURE-RA-CLOTURE/.test(rec) && /a supprimer au tableau de bord/i.test(rec))
}

console.log(echecs === 0
  ? `\n  ${V}Dépôt RA : périmètre borné au parcours réel${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

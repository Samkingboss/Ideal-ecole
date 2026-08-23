#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// MIGRATION DES IDENTITÉS VERS SUPABASE AUTH — mécanisme officiel
// ═══════════════════════════════════════════════════════════════════════
//
//   node scripts/auth-migration.mjs --verifier   état actuel, sans rien écrire
//   node scripts/auth-migration.mjs --migrer     remplace les identités
//
// ── Pourquoi ce script existe ──────────────────────────────────────────
//
// La première tentative insérait directement dans `auth.users` et
// `auth.identities`. Elle devait renifler l'existence de la colonne
// `provider_id` pour s'adapter à la version de GoTrue — l'aveu qu'elle
// travaillait contre le grain. Une authentification bâtie sur les tables
// internes d'un service casse à la première montée de version, et rien ne
// permet de vérifier qu'une identité ainsi fabriquée est réellement
// exploitable : GoTrue répond `invalid_credentials` aussi bien pour un
// compte inexistant que pour un compte mal formé.
//
// `auth.admin.createUser()` est le mécanisme supporté. Il renvoie l'identité
// créée, et ce script la vérifie ensuite par une vraie connexion.
//
// ── La clé de service ──────────────────────────────────────────────────
//
// Lue dans `.env.local`, déjà ignoré par git. Elle ne quitte jamais cette
// machine : ni dépôt, ni journal, ni conversation. Le script ne l'affiche
// jamais et refuse de démarrer si `.env.local` est suivi par git.
//
// ── Les codes ──────────────────────────────────────────────────────────
//
// Générés ici, affichés une seule fois dans ce terminal, jamais écrits sur
// disque ni enregistrés en base. Le code devient un credential Supabase
// Auth, haché par bcrypt. Aucune table applicative ne le détient.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const URL = 'https://jircuneixzwsmtktxrkh.supabase.co'
const DOMAINE = '@comptes.ideal-ecole.ml'
const V = '\x1b[0;32m', R = '\x1b[0;31m', J = '\x1b[0;33m', G = '\x1b[0;90m', N = '\x1b[0m'

// ── Garde-fous sur le secret ───────────────────────────────────────────

if (!existsSync('.env.local')) {
  console.error(`${R}✗ .env.local introuvable.${N}

  Crée-le à la racine du dépôt avec ces deux lignes :

    SUPABASE_SECRET_KEY=sb_secret_...
    SUPABASE_ANON_KEY=<la clé publique>

  La clé secrète se trouve dans Supabase → Project Settings → API Keys.
  Si le projet n'expose encore que l'ancienne clé JWT, la variable
  SUPABASE_SERVICE_ROLE_KEY est acceptée en repli.

  L'une comme l'autre contourne toute RLS : elle ne doit jamais quitter
  cette machine.
`)
  process.exit(2)
}

try {
  const suivi = execSync('git ls-files .env.local', { encoding: 'utf8' }).trim()
  if (suivi) {
    console.error(`${R}✗ .env.local est suivi par git. Retire-le de l'index avant de continuer :${N}
    git rm --cached .env.local`)
    process.exit(2)
  }
} catch { /* hors dépôt git : on poursuit */ }

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

// Supabase recommande désormais une clé secrète `sb_secret_...` pour les
// opérations serveur. L'ancienne clé JWT `service_role` reste acceptée en
// repli, pour les projets qui ne l'exposent pas encore.
const SECRETE = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const LEGACY  = !env.SUPABASE_SECRET_KEY && !!env.SUPABASE_SERVICE_ROLE_KEY
const ANON    = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

if (!SECRETE) {
  console.error(`${R}✗ Aucune clé d'administration dans .env.local.${N}
  Attendu : SUPABASE_SECRET_KEY=sb_secret_...
  Ou, en repli : SUPABASE_SERVICE_ROLE_KEY=<ancienne clé JWT>`)
  process.exit(2)
}
if (!ANON) { console.error(`${R}✗ SUPABASE_ANON_KEY absente de .env.local${N}`); process.exit(2) }

// La clé n'est jamais affichée. On en dit seulement la nature, pour que
// l'opérateur sache laquelle il utilise.
console.log(`${G}  clé d'administration : ${LEGACY ? 'JWT service_role (repli historique)' : 'sb_secret (recommandée)'}${N}`)

const admin = createClient(URL, SECRETE, { auth: { persistSession: false, autoRefreshToken: false } })

// ── Génération des codes ───────────────────────────────────────────────
//
// Dix caractères, alphabet sans I, L, O, 0 ni 1 : ces signes se confondent
// à l'oral, et un code se transmet de vive voix dans une école.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const genererCode = () => {
  const buf = new Uint32Array(10)
  globalThis.crypto.getRandomValues(buf)
  return [...buf].map(n => ALPHABET[n % ALPHABET.length]).join('')
}

// ═══════════════════════════════════════════════════════════════════════

async function etat() {
  const { data: profils, error: e1 } = await admin
    .from('users').select('id, identifiant, prenom, nom, role, actif, auth_user_id').order('nom')
  if (e1) throw e1

  const { data: liste, error: e2 } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (e2) throw e2
  const comptes = liste.users.filter(u => (u.email || '').endsWith(DOMAINE))

  return { profils, comptes }
}

async function verifier() {
  const { profils, comptes } = await etat()
  console.log(`\n${G}── ÉTAT ACTUEL ──${N}`)
  console.log(`  profils IDEAL                    : ${profils.length}`)
  console.log(`  avec identifiant                 : ${profils.filter(p => p.identifiant).length}`)
  console.log(`  avec auth_user_id                : ${profils.filter(p => p.auth_user_id).length}`)
  console.log(`  identités Auth sur le domaine    : ${comptes.length}`)

  const orphelines = comptes.filter(c => !profils.some(p => p.auth_user_id === c.id))
  const sansIdentite = profils.filter(p => !p.auth_user_id)
  const nonConfirmees = comptes.filter(c => !c.email_confirmed_at)

  console.log(`\n${G}── COHÉRENCE ──${N}`)
  console.log(`  ${orphelines.length ? R + '✗' : V + '✓'}${N} identités sans profil        : ${orphelines.length}`)
  console.log(`  ${sansIdentite.length ? R + '✗' : V + '✓'}${N} profils sans identité        : ${sansIdentite.length}`)
  console.log(`  ${nonConfirmees.length ? R + '✗' : V + '✓'}${N} identités non confirmées     : ${nonConfirmees.length}`)

  // Une identité créée par INSERT direct n'a pas de ligne `identities`
  // exploitable sur toutes les versions. L'Admin API la remonte toujours.
  const sansProvider = comptes.filter(c => !(c.identities || []).some(i => i.provider === 'email'))
  console.log(`  ${sansProvider.length ? R + '✗' : V + '✓'}${N} sans fournisseur « email »   : ${sansProvider.length}`)
  if (sansProvider.length) {
    console.log(`\n  ${J}Ces identités ne sont pas exploitables par GoTrue. Elles ont été`)
    console.log(`  fabriquées par insertion directe. Relance avec --migrer.${N}`)
  }
  console.log()
  return { orphelines, sansIdentite, nonConfirmees, sansProvider }
}

async function migrer() {
  const { profils, comptes } = await etat()
  console.log(`\n${G}── MIGRATION VERS L'API ADMIN ──${N}\n`)

  // Un compte à la fois : retirer, recréer, vérifier.
  //
  // La première version supprimait les treize identités puis les recréait
  // toutes. Une panne au milieu aurait laissé des profils sans identité —
  // c'est-à-dire personne capable de se connecter. Ici, un échec ne touche
  // qu'un compte, et les douze autres restent opérationnels.
  //
  // L'adresse étant unique, on ne peut pas créer avant de supprimer : la
  // fenêtre d'indisponibilité par compte est de quelques millisecondes.
  const codes = []
  let ok = 0, ko = 0

  for (const p of profils) {
    const email = `${p.identifiant}${DOMAINE}`
    const ancienne = comptes.find(c => c.email === email || c.id === p.auth_user_id)

    if (ancienne) {
      const { error } = await admin.auth.admin.deleteUser(ancienne.id)
      if (error) {
        console.log(`  ${R}✗${N} ${p.identifiant.padEnd(14)} retrait impossible : ${error.message}`)
        ko++; continue
      }
    }

    const code = genererCode()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: code,
      email_confirm: true,          // aucun courriel ne sera jamais envoyé ici
      user_metadata: { identifiant: p.identifiant, prenom: p.prenom, nom: p.nom },
      app_metadata: { profil_ideal: p.id },
    })

    if (error) {
      console.log(`  ${R}✗${N} ${p.identifiant.padEnd(14)} ${error.message}`)
      ko++; continue
    }

    const { error: eLien } = await admin
      .from('users').update({ auth_user_id: data.user.id }).eq('id', p.id)
    if (eLien) {
      console.log(`  ${R}✗${N} ${p.identifiant.padEnd(14)} liaison au profil : ${eLien.message}`)
      ko++; continue
    }

    // La vérification que l'insertion directe ne permettait pas : une vraie
    // connexion, avec la clé publique, exactement comme le fera le personnel.
    const client = createClient(URL, ANON, { auth: { persistSession: false } })
    const { data: sess, error: eConn } = await client.auth.signInWithPassword({ email, password: code })
    const fournisseurs = (sess?.user?.identities || []).map(i => i.provider)
    await client.auth.signOut()

    if (eConn || !sess?.user) {
      console.log(`  ${R}✗${N} ${p.identifiant.padEnd(14)} créée mais connexion refusée : ${eConn?.message}`)
      ko++; continue
    }

    codes.push({ identifiant: p.identifiant, nom: `${p.prenom} ${p.nom}`, role: p.role, actif: p.actif, code })
    console.log(`  ${V}✓${N} ${p.identifiant.padEnd(14)} recréée, liée, connexion vérifiée` +
                (fournisseurs.length ? ` (${fournisseurs.join(',')})` : ''))
    ok++
  }

  console.log(`\n  ${ko ? R : V}${ok} identité(s) opérationnelle(s), ${ko} en échec${N}`)

  // ── Les codes ne s'affichent que dans un vrai terminal ──────────────
  //
  // Sans ce garde-fou, un agent qui lance le script fait atterrir les treize
  // codes dans sa sortie, donc dans une conversation et son historique.
  // C'est arrivé deux fois lors de la rotation de la phase 0 : le mécanisme
  // était en cause, pas la vigilance. Une sortie redirigée, capturée ou
  // encapsulée n'est pas un terminal — le script s'en aperçoit et se tait.
  if (codes.length && !process.stdout.isTTY) {
    console.log(`\n${R}══════════════════════════════════════════════════════════════`)
    console.log(`  ${codes.length} identités recréées, mais LES CODES NE SERONT PAS AFFICHÉS.`)
    console.log(`══════════════════════════════════════════════════════════════${N}`)
    console.log(`
  La sortie n'est pas un terminal interactif : l'afficher ici reviendrait
  à écrire treize secrets dans un journal.

  ${J}Les comptes sont créés et vérifiés, mais personne ne connaît les codes.${N}

  Relance depuis ton propre terminal pour les obtenir :

      node scripts/auth-migration.mjs --migrer

  Les identités seront recréées une nouvelle fois, avec de nouveaux codes,
  et ceux-là s'afficheront.
`)
    return ko === 0
  }

  if (codes.length) {
    console.log(`\n${J}══════════════════════════════════════════════════════════════`)
    console.log(`  LES CODES CI-DESSOUS N'APPARAÎTRONT QU'UNE FOIS`)
    console.log(`  Ils ne sont écrits nulle part : ni fichier, ni base, ni journal.`)
    console.log(`  Recopie-les vers un gestionnaire de mots de passe, puis`)
    console.log(`  transmets chaque code individuellement à son titulaire.`)
    console.log(`══════════════════════════════════════════════════════════════${N}\n`)
    for (const c of codes.filter(c => c.actif)) {
      console.log(`  ${c.identifiant.padEnd(14)} ${c.code}   ${c.nom} · ${c.role}`)
    }
    const inactifs = codes.filter(c => !c.actif)
    if (inactifs.length) {
      console.log(`\n  ${G}— comptes inactifs, à ne pas distribuer —${N}`)
      for (const c of inactifs) console.log(`  ${G}${c.identifiant.padEnd(14)} ${c.code}   ${c.nom}${N}`)
    }
    console.log()
  }

  return ko === 0
}

const mode = process.argv[2]
try {
  if (mode === '--migrer') {
    const bon = await migrer()
    console.log(`${G}── vérification finale ──${N}`)
    await verifier()
    process.exit(bon ? 0 : 1)
  } else {
    await verifier()
  }
} catch (e) {
  console.error(`${R}✗ ${e.message}${N}`)
  process.exit(1)
}

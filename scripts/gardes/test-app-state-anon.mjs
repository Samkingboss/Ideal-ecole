// Gardes : plus aucune page ne touche `app_state` sans session.
//
// ── Ce qui est en jeu ────────────────────────────────────────────────────
//
// `app_state` est aujourd'hui lisible ET inscriptible avec la clé publique —
// celle qu'embarque le navigateur de tout visiteur. Y vivent la grille des
// salaires, les dossiers du personnel, le registre RH et les boîtes de
// notifications.
//
// Fermer la table à `anon` est un geste SQL. Mais il casse la production tant
// qu'une page y accède sans session. Ces gardes tiennent la condition
// préalable : elles décrivent, fichier par fichier, ce qui doit être vrai
// AVANT que le REVOKE soit exécuté.
//
// Elles ne mesurent pas le serveur — c'est le rôle de
// `scripts/gardes/recette-fermeture-app-state.mjs`, qui n'est lancée qu'APRÈS
// la migration et qui échoue tant qu'elle n'a pas eu lieu.
import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const sansCommentaires = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*(\/\/|--|\*)/.test(l)).join('\n')

console.log(`\n${G}── APP_STATE SANS SESSION · condition préalable au REVOKE   [INV-SEC]${F}`)

// Détecteur : un accès `app_state` dans le code réellement livré.
const accedeAppState = src => /app_state/.test(sansCommentaires(src))

// ── N1 · les pages sans session ne touchent plus app_state ───────────────
//
// `inscription.html` est publique par nature : un parent n'a pas de session.
// `pedago-archive/app.js` n'embarque aucune bibliothèque Supabase et parlait
// donc en `anon` quoi qu'il arrive.
{
  const sansSession = [
    ['public/inscription.html', 'formulaire public — le parent n’a pas de session'],
    ['public/pedago-archive/app.js', 'archive — aucune bibliothèque Supabase chargée'],
  ]
  const fautifs = sansSession.filter(([f]) => accedeAppState(lire(f)))
  verifier('N1 · aucune page sans session n’accède à app_state',
    fautifs.length === 0,
    fautifs.length ? `— ${fautifs.map(f => f[0]).join(', ')}` : `— ${sansSession.length} pages vérifiées`)
}

// ── N2 · auto-test du détecteur ──────────────────────────────────────────
//
// Sans lui, N1 pourrait être vert parce qu'il ne cherche rien.
{
  const avec = "const r = await fetch(SB_URL + '/rest/v1/app_state?app=eq.pedago');"
  const sans = "// on n'utilise plus app_state ici\nconst r = await fetch('/rest/v1/eleves');"
  verifier('N2 · le détecteur voit un accès et ignore un commentaire',
    accedeAppState(avec) === true && accedeAppState(sans) === false)
}

// ── N3 · les pages qui accèdent encore à app_state portent la session ────
{
  // `src` était lu BRUT. Les deux fichiers expliquent en commentaire pourquoi
  // ils reprennent `storageKey: 'ideal-auth'` — la garde reconnaissait donc
  // cette phrase et restait verte même après avoir retiré le vrai réglage.
  // On ne lit que le code.
  const avecSession = ['public/rapports.html', 'public/comptabilite.html']
  const manquantes = avecSession.filter(f => {
    const code = sansCommentaires(lire(f))
    return accedeAppState(code) && !/storageKey:\s*'ideal-auth'/.test(code)
  })
  verifier('N3 · toute page touchant app_state reprend la session ideal-auth',
    manquantes.length === 0, manquantes.length ? `— ${manquantes.join(', ')}` : '')
}

// ── N4 · un seul mécanisme d'authentification par page ───────────────────
//
// Deux clients, c'est deux sessions : l'un des deux repartirait en `anon`
// sans que rien ne le signale.
{
  const fautifs = []
  for (const f of ['public/rapports.html', 'public/comptabilite.html', 'public/inscription.html']) {
    const n = (sansCommentaires(lire(f)).match(/createClient\s*\(/g) || []).length
    if (n > 1) fautifs.push(`${f} (${n} clients)`)
  }
  verifier('N4 · aucune page ne crée un second client Supabase',
    fautifs.length === 0, fautifs.length ? `— ${fautifs.join(', ')}` : '')
}

// ── N5 · rapports.html n'interroge rien avant d'avoir le jeton ───────────
//
// Une requête émise pendant que la session n'est pas encore lue repart en
// `anon`. Elle passe aujourd'hui, et échouera silencieusement après la
// fermeture — le pire moment pour s'en apercevoir.
{
  const src = lire('public/rapports.html')
  const adopte = /adopterSession\s*=\s*async/.test(src)
  const attendu = /await\s+adopterSession\(\)\s*;\s*loadAll\(\)/.test(src.replace(/\s+/g, ' '))
  const suitLesChangements = /onAuthStateChange/.test(src)
  verifier('N5 · rapports.html attend la session avant sa première requête',
    adopte && attendu && suitLesChangements,
    `— session:${adopte ? 'oui' : 'NON'} attente:${attendu ? 'oui' : 'NON'} suivi:${suitLesChangements ? 'oui' : 'NON'}`)
}

// ── N6 · aucune clé privilégiée dans le navigateur ───────────────────────
{
  const fichiers = ['public/inscription.html', 'public/rapports.html', 'public/comptabilite.html',
    'public/fiche.html', 'public/pedago-archive/app.js', 'src/lib/supabase.js']
  const fautifs = fichiers.filter(f => /service_role|SUPABASE_SERVICE|secret_key|sb_secret/i.test(lire(f)))
  verifier('N6 · aucune clé service_role côté navigateur',
    fautifs.length === 0, fautifs.length ? `— ${fautifs.join(', ')}` : `— ${fichiers.length} fichiers`)
}

// ── N7 · la notification d'inscription est bien passée au serveur ────────
{
  // Deux pièges du même genre ont été trouvés ici, et tous deux rendaient la
  // garde incapable d'échouer :
  //
  //   · le fichier explique longuement pourquoi une RPC exposée à anon a été
  //     écartée — chercher ce nom dans le texte brut le trouvait dans la
  //     prose ;
  //   · le script porte son PROPRE contrôle interne, qui cite les jetons
  //     recherchés entre guillemets — `strpos(v_src, 'pg_advisory_xact_lock')`
  //     suffisait à faire croire que le verrou était posé, même après l'avoir
  //     supprimé du corps.
  //
  // On n'examine donc que le CORPS de la fonction, entre ses deux marqueurs
  // `$function$`, commentaires retirés.
  const fichierSql = lire('sql/inscription_notification_serveur.sql')
  const corps = (fichierSql.match(/as \$function\$([\s\S]*?)\$function\$;/) || [])[1] || ''
  const sql = sansCommentaires(corps)
  const verrou = /pg_advisory_xact_lock/.test(sql)
  const idDeterministe = /'insc-' \|\| v_inscription_id/.test(sql)
  const creationConservee = /public\.creer_inscription\(p_dossier\)/.test(sql)
  const suiviConserve = /liens_publics_inscription/.test(sql) && /suivi_token/.test(sql)
  // Les destinataires doivent être EXACTEMENT ceux d'avant.
  const memesCibles = /array\['directeur', 'responsable_administratif'\]/.test(sql)
  // Aucun paramètre d'entrée nouveau : la fonction ne reçoit pas d'inscription
  // à notifier, elle notifie celle qu'elle vient de créer.
  const entete = sansCommentaires(fichierSql)
  const signatureIntacte = /creer_inscription_avec_suivi\(p_dossier jsonb\)/.test(entete)
    && !/create\s+or\s+replace\s+function\s+public\.notifier_inscription/.test(entete)
    && !/rpc\(\s*'notifier_inscription'/.test(entete)
  verifier('N7 · la définition serveur tient ses sept exigences',
    verrou && idDeterministe && creationConservee && suiviConserve && memesCibles && signatureIntacte,
    `— verrou:${verrou ? 'oui' : 'NON'} idempotence:${idDeterministe ? 'oui' : 'NON'}`
    + ` création:${creationConservee ? 'oui' : 'NON'} suivi:${suiviConserve ? 'oui' : 'NON'}`
    + ` cibles:${memesCibles ? 'identiques' : 'CHANGÉES'} signature:${signatureIntacte ? 'intacte' : 'ÉLARGIE'}`)
}

// ── N8 · le QR de la carte scolaire n'a pas été touché ───────────────────
//
// Périmètre gelé, explicitement hors de ce chantier.
{
  const fiche = lire('public/fiche.html')
  const intacte = /verifier_carte_scolaire/.test(fiche) && !accedeAppState(fiche)
  verifier('N8 · fiche.html et le QR carte scolaire sont intacts', intacte)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

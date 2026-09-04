// ════════════════════════════════════════════════════════════════════════
// PHASE 2 — création sécurisée des comptes du personnel.
//
// Garde STATIQUE : elle est verte avant toute exécution SQL et tout
// déploiement. Le volet comportemental vit dans
// `recette-acces-personnel.mjs`, qui ne peut passer qu'après la migration.
// ════════════════════════════════════════════════════════════════════════
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const lire = (f) => readFileSync(f, 'utf8')
const sql        = lire('sql/personnel_acces_phase2.sql')
const rollback   = lire('sql/personnel_acces_phase2_rollback.sql')
const creer      = lire('api/personnel-creer.js')
const activer    = lire('api/personnel-activer.js')
const fabrique   = lire('api/_supabase.js')
const directeur  = lire('src/pages/DirecteurApp.jsx')
const page       = lire('public/activer-acces.html')

let echecs = 0
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`) } catch (e) { echecs++; console.log(`✗ ${nom} — ${e.message}`) } }

// Le SQL débarrassé de ses commentaires. Sans cela une garde rougit sur sa
// propre prose : le fichier EXPLIQUE pourquoi il n'écrit pas
// `update auth.users …`, et la phrase ressemble à ce qu'elle interdit.
// Dépouillement LIGNE PAR LIGNE — une passe globale a déjà avalé du code
// ailleurs dans ce dépôt.
const sansCommentaires = (texte) => texte
  .split('\n')
  .map((l) => {
    const i = l.indexOf('--')
    if (i < 0) return l
    // Un `--` à l'intérieur d'une chaîne n'est pas un commentaire.
    const avant = l.slice(0, i)
    const guillemets = (avant.match(/'/g) || []).length
    return guillemets % 2 === 0 ? avant : l
  })
  .join('\n')

const sqlNu = sansCommentaires(sql)

// Le même service pour le JavaScript. `sansCommentaires` ne connaît que le
// `--` du SQL ; ici les commentaires commencent par `//`. Sans ce second
// dépouilleur, un repère cherché dans le code retombait sur la PROSE qui le
// décrit — le contrôle 22 mesurait la position d'une phrase, pas celle d'un
// appel, et ne pouvait donc pratiquement pas échouer.
//
// Ligne par ligne, jamais en une passe globale : une passe globale a déjà
// avalé du code ailleurs dans ce dépôt.
const sansCommentairesJS = (texte) => texte
  .split('\n')
  .map((l) => {
    const i = l.indexOf('//')
    if (i < 0) return l
    const avant = l.slice(0, i)
    // Un `//` dans une chaîne ou une URL n'ouvre pas un commentaire.
    const guillemets = (avant.match(/['"`]/g) || []).length
    return guillemets % 2 === 0 ? avant : l
  })
  .join('\n')

// Le corps d'une fonction SQL nommée, isolé de ses voisines : sans cela un
// contrôle passerait pour la mauvaise raison, en lisant la fonction d'à côté.
const corpsSql = (nom) => {
  const d = sql.indexOf(`create or replace function public.${nom}`)
  assert.ok(d >= 0, `fonction ${nom} absente`)
  const f = sql.indexOf('$function$;', d)
  assert.ok(f > d, `fin de ${nom} introuvable`)
  return sql.slice(d, f)
}

// Le chemin de création du personnel, côté écran directeur : de `saveProf`
// à la fonction suivante. Chercher dans tout le fichier laisserait passer
// un `Math.random` légitime ailleurs, et rougirait pour rien.
const cheminCreation = (() => {
  const d = directeur.indexOf('const saveProf = async () => {')
  assert.ok(d >= 0, 'saveProf introuvable')
  return directeur.slice(d, directeur.indexOf('const chargerEtatsAcces', d))
})()

// ── 1 à 3 · le secret quitte l'écran du directeur ──────────────────────

test("1 · aucun champ « Code d'accès » dans le formulaire directeur", () => {
  assert.doesNotMatch(directeur, /newProf\.code_acces/)
  assert.doesNotMatch(directeur, /Code d\s?.?acces \(laisser vide/i)
  // Le champ qui le remplace existe bien : sans cela le contrôle serait
  // vert sur un formulaire amputé.
  assert.match(directeur, /newProf\.telephone/)
})

test('2 · aucun Math.random sur le chemin de création du personnel', () => {
  assert.doesNotMatch(cheminCreation, /Math\.random/)
  assert.doesNotMatch(directeur, /const generateCode/)
})

test('3 · aucun secret dans le message rendu au directeur', () => {
  // Le message de succès ne doit porter que l'identifiant.
  assert.doesNotMatch(directeur, /setMsg\([^)]*[Cc]ode\s*:/)
  assert.match(cheminCreation, /Identifiant : \$\{resultat\.identifiant\}/)
  // La réponse de la route ne contient que ok, id, identifiant.
  const retour = creer.slice(creer.lastIndexOf('return repondre(res, 200'))
  assert.doesNotMatch(retour, /jetable|password|mot_de_passe|token/)
})

// ── 4 à 8 · le jeton ───────────────────────────────────────────────────

test('4 · le jeton brut n’est jamais stocké ni relu', () => {
  const emission = corpsSql('emettre_acces_personnel')
  // Ce qui entre en base est l'empreinte, pas la valeur.
  assert.match(emission, /insert into public\.acces_personnel \(user_id, token_hash, expires_at\)\s*\n\s*values \(p_user_id,\s*\n\s*extensions\.digest/)
  // Dans l'INSERT, `v_token` n'apparait qu'a l'interieur du hachage. Une
  // colonne qui le recevrait tel quel serait visible ici.
  const nu = sansCommentaires(emission)
  const insert = nu.slice(nu.indexOf('insert into public.acces_personnel'),
                          nu.indexOf(';', nu.indexOf('insert into public.acces_personnel')))
  const bruts = insert.split(/v_token/).length - 1
  const haches = insert.split(/digest\(convert_to\(v_token/).length - 1
  assert.equal(bruts, haches, `${bruts - haches} occurrence(s) de v_token hors hachage dans l'INSERT`)
  // Aucune fonction de lecture ne rend un jeton.
  assert.doesNotMatch(corpsSql('lire_etat_acces_personnel'), /token/)
  // L'audit trace QUE, pas QUOI. On borne a l'instruction d'audit : au-dela
  // vient le `return`, ou le jeton doit legitimement figurer une fois.
  const iAudit = nu.indexOf('insert into public.journal_audit')
  const audit = nu.slice(iAudit, nu.indexOf(';', iAudit))
  assert.doesNotMatch(audit, /v_token|token_hash/)
  // Et il n'y sort qu'une seule fois, vers le directeur qui compose le lien.
  assert.equal(nu.split('v_token').length - 1, 4,
    'v_token doit apparaitre exactement 4 fois : declaration, affectation, hachage, retour')
})

test('5 · seule une empreinte sha256 de 32 octets est stockée', () => {
  assert.match(sql, /check \(octet_length\(token_hash\) = 32\)/)
  assert.match(sql, /extensions\.digest\(convert_to\(v_token, 'UTF8'\), 'sha256'\)/)
  assert.match(sql, /token_hash\s+bytea not null/)
})

test('6 · expiration de 48 heures, non nulle et postérieure à la création', () => {
  assert.match(sql, /expires_at\s+timestamptz not null/)
  assert.match(sql, /check \(expires_at > created_at\)/)
  assert.match(corpsSql('emettre_acces_personnel'), /now\(\) \+ interval '48 hours'/)
})

test('7 · usage unique, garanti par un UPDATE conditionnel atomique', () => {
  const conso = corpsSql('consommer_acces_personnel')
  // Le marquage et la sélection sont la MÊME instruction : deux requêtes
  // simultanées portant le même jeton, une seule gagne.
  assert.match(conso, /update public\.acces_personnel a\s*\n\s*set used_at = now\(\)/)
  assert.match(conso, /and a\.used_at\s+is null/)
  assert.match(conso, /returning a\.user_id into v_user_id/)
  // Un `select` préalable suivi d'un `update` rouvrirait le rejeu.
  assert.doesNotMatch(conso, /select[^;]*from public\.acces_personnel[^;]*;[\s\S]*update public\.acces_personnel/)
})

test('8 · un renvoi révoque le lien précédent, et la base l’impose', () => {
  const emission = corpsSql('emettre_acces_personnel')
  const iVerrou = emission.indexOf('for update of u')
  const iRevoke = emission.indexOf('set revoked_at = now()')
  const iInsert = emission.indexOf('insert into public.acces_personnel')
  assert.ok(iVerrou > 0 && iRevoke > iVerrou,
    'la fiche personnel doit etre verrouillee avant la revocation')
  assert.ok(iRevoke > 0 && iInsert > iRevoke, 'la révocation doit précéder l’insertion')
  assert.match(sql, /create unique index if not exists acces_personnel_vivant_unique[\s\S]*?where used_at is null and revoked_at is null/)
})

// ── 9 à 10 · qui a le droit ────────────────────────────────────────────

test('9 · garde « directeur seul » sur les quatre fonctions Direction', () => {
  for (const f of ['identifiant_disponible', 'rattacher_membre_personnel',
                   'emettre_acces_personnel', 'lire_etat_acces_personnel']) {
    assert.match(corpsSql(f), /ideal_est\(array\['directeur'\]\)/, `${f} sans garde`)
  }
  // La consommation n'est atteignable ni par anon ni par authenticated :
  // aucune fonction touchant l'authentification n'est joignable d'un
  // navigateur.
  assert.match(sql, /revoke all on function public\.consommer_acces_personnel\(text\)\s*\n\s*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.consommer_acces_personnel\(text\)\s+to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.consommer_acces_personnel\(text\)\s+to (anon|authenticated)/)
  // Toutes les fonctions sont d'abord révoquées de PUBLIC — leçon de la
  // Phase 1 : PostgreSQL accorde EXECUTE à PUBLIC par défaut.
  for (const f of ['identifiant_disponible', 'rattacher_membre_personnel',
                   'emettre_acces_personnel', 'lire_etat_acces_personnel',
                   'consommer_acces_personnel']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\)\\s*\\n?\\s*from public, anon, authenticated`), `${f} : PUBLIC non révoqué`)
  }
})

test('10 · la route vérifie le rôle RÉEL, jamais celui annoncé par le client', () => {
  // Le rôle est demandé à la base avec le jeton de l'appelant.
  assert.match(creer, /appelant\.rpc\('ideal_est', \{ p_roles: \['directeur'\] \}\)/)
  assert.match(creer, /if \(estDirecteur !== true\) return repondre\(res, 403/)
  // Le jeton vient de l'en-tête, jamais du corps.
  assert.match(fabrique, /req\.headers\?\.authorization/)
  const corpsRoute = creer.slice(creer.indexOf('const corps = await corpsDe(req)'))
  assert.doesNotMatch(corpsRoute, /corps\.(role_appelant|est_directeur|admin)/)
  // Le contrôle de rôle précède la lecture du corps : on ne travaille pas
  // pour un appelant qu'on n'a pas encore autorisé.
  assert.ok(creer.indexOf("rpc('ideal_est'") < creer.indexOf('await corpsDe(req)'))
})

// ── 11 à 13 · les trois refus ──────────────────────────────────────────

test('11-13 · jeton expiré, consommé ou révoqué : refusé, et sans indice', () => {
  const conso = corpsSql('consommer_acces_personnel')
  assert.match(conso, /and a\.expires_at > now\(\)/, 'expiration non vérifiée')
  assert.match(conso, /and a\.used_at\s+is null/, 'consommation non vérifiée')
  assert.match(conso, /and a\.revoked_at is null/, 'révocation non vérifiée')
  // Une seule et même réponse : rien ne permet de distinguer les cas, donc
  // rien ne permet d'énumérer les comptes.
  const neutres = conso.match(/return jsonb_build_object\('ok', false\)/g) || []
  assert.ok(neutres.length >= 3, `réponses neutres attendues, ${neutres.length} trouvée(s)`)
  assert.doesNotMatch(conso, /'ok', false, '/, 'une réponse négative porte un détail')
  // La page publique dit la même chose dans tous les cas.
  assert.match(page, /Ce lien n’est plus valable/)
})

// ── 14 à 15 · l'identité Auth ──────────────────────────────────────────

test('14 · le rattachement pose auth_user_id dans la même écriture', () => {
  const rat = corpsSql('rattacher_membre_personnel')
  assert.match(rat, /insert into public\.users \(id, identifiant, auth_user_id/)
  assert.match(rat, /values \(gen_random_uuid\(\), lower\(btrim\(p_identifiant\)\), p_auth_user_id/)
  // L'identifiant est obligatoire : `users.identifiant` est NOT NULL, et
  // c'est ce que l'ancienne création oubliait.
  assert.match(rat, /identifiant_manquant/)
})

test('15 · compensation deleteUser obligatoire si le rattachement échoue', () => {
  assert.match(creer, /admin\.auth\.admin\.deleteUser\(idAuth\)/)
  const iRat = creer.indexOf("rpc('rattacher_membre_personnel'")
  const iDel = creer.indexOf('deleteUser(idAuth)')
  assert.ok(iDel > iRat, 'la compensation doit suivre le rattachement')
  // L'échec de la compensation elle-même est signalé, pas avalé.
  assert.match(creer, /compensation: errMenage \? 'echouee' : 'faite'/)
  assert.match(directeur, /resultat\?\.compensation === 'echouee'/)
})

// ── 16 à 18 · ce qui ne doit pas bouger ────────────────────────────────

test('16 · les anciens comptes ne sont pas touchés', () => {
  // Aucune écriture dans users_secrets : ni insert, ni update, ni delete.
  assert.doesNotMatch(sqlNu, /(insert into|update|delete from)\s+public\.users_secrets/)
  // Aucune écriture directe dans le schéma auth : c'est tout l'objet de
  // l'Option A.
  assert.doesNotMatch(sqlNu, /(insert into|update|delete from)\s+auth\./)
  // Le confinement Phase 1 n'est pas rouvert.
  assert.doesNotMatch(sqlNu, /enregistrer_utilisateur|desactiver_utilisateur|authentifier_par_code/)
  // Le rollback ne supprime aucune identité : cela enfermerait des gens
  // dehors.
  assert.doesNotMatch(sansCommentaires(rollback), /deleteUser|delete from auth|drop table.*users\b/)
})

test('17 · LoginPage et la session Auth validée restent intactes', () => {
  const modifies = execSync('git status --porcelain', { encoding: 'utf8' })
    .split('\n').map(l => l.slice(3).trim()).filter(Boolean)
  for (const f of ['src/pages/LoginPage.jsx', 'src/App.jsx', 'src/lib/supabase.js']) {
    assert.ok(!modifies.includes(f), `${f} modifié`)
  }
})

test('18 · aucune zone gelée modifiée', () => {
  const GELES = [
    'src/pages/FichePreparation.jsx', 'src/pages/CorrectionDirecteur.jsx',
    'src/lib/preparations.js', 'src/lib/notifications.js',
    'src/pages/DevoirsDocument.jsx', 'src/pages/DocumentPrintStudio.jsx',
    'src/pages/FichesCahiers.jsx', 'src/lib/fichesCahiers.js',
    'src/lib/devoirsSelection.js', 'src/lib/coursAssocie.js',
    'src/lib/etatPartage.js',
  ]
  const modifies = execSync('git status --porcelain', { encoding: 'utf8' })
    .split('\n').map(l => l.slice(3).trim()).filter(Boolean)
  const touches = GELES.filter(f => modifies.includes(f))
  assert.deepEqual(touches, [], `zones gelées touchées : ${touches.join(', ')}`)
})

// ── La page publique ───────────────────────────────────────────────────

test('19 · le jeton vit dans le fragment, jamais dans la query string', () => {
  assert.match(page, /new URLSearchParams\(location\.hash\.slice\(1\)\)\.get\('token'\)/)
  assert.doesNotMatch(page, /location\.search/)
  assert.match(directeur, /activer-acces\.html#token=\$\{data\.token\}/)
  // Il quitte la barre d'adresse dès sa lecture, et n'est jamais écrit
  // dans la page.
  assert.match(page, /history\.replaceState\(null, '', location\.pathname\)/)
  assert.doesNotMatch(page, /textContent\s*=\s*[^\n]*\bcle\b/)
})

test('20 · dix caractères minimum, contrôlés côté serveur', () => {
  assert.match(activer, /LONGUEUR_MINIMALE = 10/)
  assert.match(activer, /nouveau\.length < LONGUEUR_MINIMALE/)
  // Aucune règle artificielle de casse, chiffre ou symbole.
  assert.doesNotMatch(activer, /[A-Z].*\[0-9\].*special|majuscule|uppercase/i)
  // Le miroir côté page est un confort, pas la protection.
  assert.match(page, /mdp\.length < 10/)
})

test('21 · le message WhatsApp ne porte que le lien et l’identifiant', () => {
  const i = directeur.indexOf('const envoyerAcces')
  const envoi = directeur.slice(i, directeur.indexOf('\n  }\n', i))
  assert.match(envoi, /Identifiant : \$\{data\.identifiant\}/)
  assert.doesNotMatch(envoi, /mot de passe :|code|secret/i)
  // Le point d'entrée WhatsApp partagé, pas une neuvième URL en dur.
  assert.match(envoi, /lienWhatsApp\(data\.telephone, message\)/)
  assert.doesNotMatch(envoi, /wa\.me/)
})

test('21 bis · un double appui ne lance pas deux emissions', () => {
  const i = directeur.indexOf('const envoyerAcces')
  const envoi = directeur.slice(i, directeur.indexOf('\n  }\n', i))
  assert.match(envoi, /if \(envoiAccesEnCours\.current\) return/)
  assert.match(envoi, /envoiAccesEnCours\.current = true/)
  assert.match(envoi, /envoiAccesEnCours\.current = false/)
  assert.match(envoi, /setEnvoiAccesId\(membre\.id\)/)
  assert.match(directeur, /disabled=\{Boolean\(envoiAccesId\)\}/)
  assert.match(envoi, /window\.open\('', '_blank'\)/,
    'la fenetre WhatsApp doit etre ouverte pendant le geste utilisateur')
})

// ── 22 à 27 · l'écran d'après-activation ───────────────────────────────

test("22 · l'identifiant n'est rendu qu'après une consommation valide", () => {
  // Un seul `return` porte l'identifiant, et il est en aval de la
  // consommation. Tous les refus renvoient sans lui.
  const retours = [...activer.matchAll(/return repondre\(res, \d+, (\{[^}]*\})/g)].map(m => m[1])
  const avecIdent = retours.filter(r => /identifiant/.test(r))
  assert.equal(avecIdent.length, 1, `${avecIdent.length} retour(s) portent l'identifiant, 1 attendu`)
  assert.match(avecIdent[0], /ok: true/)
  // Et il se situe APRÈS la consommation et APRÈS la pose du mot de passe.
  //
  // Sur le CODE, jamais sur la prose : le fichier explique en tête pourquoi il
  // passe par `auth.admin.updateUserById`, et un `indexOf` brut tombait sur
  // cette phrase ligne 9 au lieu de l'appel ligne 74. L'assertion ne pouvait
  // alors plus échouer, donc ne prouvait plus rien.
  const activerNu = sansCommentairesJS(activer)
  const iConso = activerNu.indexOf("rpc('consommer_acces_personnel'")
  const iMaj = activerNu.indexOf('await admin.auth.admin.updateUserById')
  const iIdent = activerNu.indexOf('ok: true, identifiant')

  assert.ok(iConso > 0, 'appel réel à consommer_acces_personnel introuvable dans le code')
  assert.ok(iMaj > 0, 'appel réel à updateUserById introuvable dans le code')
  assert.ok(iIdent > 0, "retour portant l'identifiant introuvable dans le code")
  assert.ok(iConso < iMaj, 'le mot de passe est posé avant la consommation du jeton')
  assert.ok(iMaj < iIdent, "l'identifiant est construit avant la pose du mot de passe")
})

test('23 · ni mot de passe ni jeton ne reviennent au navigateur', () => {
  const retours = [...activer.matchAll(/return repondre\(res, \d+, (\{[^}]*\})/g)].map(m => m[1])
  for (const r of retours) {
    assert.doesNotMatch(r, /\bnouveau\b|password|mot_de_passe:|jetonLien|token/, `réponse fuyante : ${r}`)
  }
  // La page n'écrit jamais le jeton ni le mot de passe dans le DOM.
  assert.doesNotMatch(page, /textContent\s*=\s*[^\n]*\b(cle|mdp)\b/)
})

test("24 · l'identifiant ne coûte aucune requête ni aucun privilège de plus", () => {
  // Il sort de la réponse de `updateUserById`, déjà appelée. Aucun appel
  // supplémentaire au client admin, aucune lecture de `public.users`.
  assert.match(activer, /const \{ data: majUser, error: errMaj \} =\s*\n?\s*await admin\.auth\.admin\.updateUserById/)
  assert.equal((activer.match(/admin\.(rpc|from|auth)/g) || []).length, 2,
    'la route ne doit faire que deux appels au client admin')
  assert.doesNotMatch(activer, /from\(\s*['"]users['"]\s*\)/)
})

test('25 · « Ouvrir IDEAL » mène à l’entrée réelle de l’application', () => {
  assert.match(page, /<a class="principal" href="\/">Ouvrir IDEAL<\/a>/)
  // `/` est bien l'entrée : index.html monte React, qui rend LoginPage sans
  // session, et c'est le `start_url` du manifeste.
  const manifeste = JSON.parse(lire('public/manifest.json'))
  assert.equal(manifeste.start_url, '/')
  assert.match(lire('index.html'), /<div id="root"><\/div>/)
})

test('26 · aucune installation simulée : la branche suit la plateforme', () => {
  const bloc = page.slice(page.indexOf('const ua = navigator.userAgent'), page.indexOf('const aide ='))
  const fenetre = { matchMedia: () => ({ matches: false }), navigator: { standalone: false } }
  const evaluer = (ua, mt) => new Function('navigator', 'window',
    bloc + '; return { estAndroid, estIOS, estSafariIOS }')({ userAgent: ua, maxTouchPoints: mt }, fenetre)

  const CAS = [
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/148 Mobile Safari/537.36', 5,
      { estAndroid: true, estIOS: false, estSafariIOS: false }],
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1', 5,
      { estAndroid: false, estIOS: true, estSafariIOS: true }],
    ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120 Mobile/15E148 Safari/604.1', 5,
      { estAndroid: false, estIOS: true, estSafariIOS: false }],
    ['iPad OS 17', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 5,
      { estAndroid: false, estIOS: true, estSafariIOS: true }],
    ['Mac de bureau', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/148 Safari/537.36', 0,
      { estAndroid: false, estIOS: false, estSafariIOS: false }],
  ]
  for (const [nom, ua, mt, attendu] of CAS) {
    assert.deepEqual(evaluer(ua, mt), attendu, `plateforme mal reconnue : ${nom}`)
  }

  // L'invite native n'est jamais fabriquée : `prompt()` n'est appelée que sur
  // l'événement réellement reçu du navigateur.
  assert.match(page, /window\.addEventListener\('beforeinstallprompt'/)
  assert.match(page, /if \(_invite\) \{[\s\S]{0,200}_invite\.prompt\(\)/)
  assert.doesNotMatch(page, /prompt\(\)[\s\S]{0,80}else if \(est(IOS|Android)/)
  // Sur un ordinateur sans invite native, on masque au lieu de conseiller.
  assert.match(page, /Ordinateur sans invite native[\s\S]{0,200}bouton\.hidden = true/)
  // Déjà installée : ni bouton ni conseil.
  assert.match(page, /if \(dejaInstallee\) \{ bouton\.hidden = true/)
})

test('27 · le service worker n’expose rien de neuf et ne gêne pas l’activation', () => {
  // La page l'enregistre pour que `beforeinstallprompt` soit possible.
  assert.match(page, /navigator\.serviceWorker\.register\('\/sw\.js'\)/)
  // Et le worker ne touche jamais un POST : l'activation ne peut pas être
  // interceptée. C'est la condition qui rend cet enregistrement sans risque.
  assert.match(lire('public/sw.js'), /req\.method !== 'GET' \|\| url\.origin !== self\.location\.origin\) return/)
  // Aucun secret, aucune clé, aucune RPC nouvelle dans la page.
  assert.doesNotMatch(page, /sb_secret_|service_role|SUPABASE_SECRET|rest\/v1\/rpc/)
})

console.log(echecs === 0
  ? `\n✅ test-acces-personnel : tout est vert.`
  : `\n❌ test-acces-personnel : ${echecs} contrôle(s) en échec.`)
process.exit(echecs ? 1 : 0)

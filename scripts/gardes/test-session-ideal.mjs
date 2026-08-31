// Gardes : l'écran affiche la session que le serveur reconnaît.
//
// ── La panne ─────────────────────────────────────────────────────────────
//
// `ideal_user` n'était qu'un drapeau dans le stockage local, sans lien avec la
// session Supabase Auth. Quand celle-ci disparaissait, le drapeau survivait :
// l'enseignante se voyait connectée, ses requêtes partaient en `anon`, et
//
//   · le brouillon échouait en 42501 ;
//   · la notification à la direction échouait en 42501 ;
//   · la préparation, elle, S'ÉCRIVAIT — `preparations` est inscriptible par
//     `anon` — en portant un identifiant que le serveur n'a jamais vérifié.
//
// Les trois messages de production se reproduisent en appelant sans session :
// R1 et R2 ci-dessous le refont à chaque exécution.
//
// ── Nettoyage des commentaires : ligne à ligne ───────────────────────────
//
// Un effacement global de `{/* … */}` avait déjà avalé du code et fait
// conclure « absent » à une garde qui n'examinait plus rien. Ici, le pire est
// de garder un commentaire.
import { readFileSync, existsSync } from 'node:fs'
import { AuthRetryableFetchError, AuthApiError, AuthSessionMissingError, isAuthRetryableFetchError }
  from '@supabase/supabase-js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const sansCommentaires = src => src.split('\n')
  .filter(l => !/^\s*(\/\/|\*|\{\/\*|\/\*)/.test(l))
  .map(l => l.replace(/\{\/\*.*?\*\/\}/g, ' ').replace(/\/\*.*?\*\//g, ' '))
  .join('\n')

const app = lire('src/App.jsx')
const appCode = sansCommentaires(app)
const fiche = lire('src/pages/FichePreparation.jsx')
const ficheCode = sansCommentaires(fiche)

console.log(`\n${G}── SESSION IDEAL · l'écran suit le serveur   [INV-SEC, INV-UI]${F}`)

// ── S1 · la session réelle est demandée au démarrage ─────────────────────
{
  const demande = /supabase\.auth\.getSession\(\)/.test(appCode)
  const utilise = /if \(sessionPerdue\(data\?\.session, error\)\)/.test(appCode)
  verifier('S1 · App demande la session Auth et applique la règle',
    demande && utilise, `— appel:${demande ? 'oui' : 'NON'} règle appliquée:${utilise ? 'oui' : 'NON'}`)
}

// ── S2 · transport ≠ session morte ───────────────────────────────────────
//
// Deux échecs très différents sortent de `getSession()` :
//
//   TRANSPORT   réseau coupé, délai dépassé — la session existe peut-être
//               encore, on ne déconnecte pas.
//   DÉFINITIF   jeton de rafraîchissement invalide, expiré, révoqué — plus
//               rien ne partira en `authenticated`, il faut déconnecter.
//
// La frontière n'est pas devinée sur un message : c'est celle que le SDK
// trace lui-même, `if (!isAuthRetryableFetchError(error))` dans
// `_callRefreshToken`, juste avant de supprimer la session.
//
// La règle est EXTRAITE de App.jsx et exécutée avec les VRAIES classes
// d'erreur du SDK. Une garde qui recopierait la règle serait verte quel que
// soit l'état du fichier.
{
  const expr = (app.match(/const sessionPerdue = \(session, error\) =>\n\s*(.+)/) || [])[1]
  verifier('S2a · la règle de décision est extraite de App.jsx', !!expr, expr ? `— ${expr}` : '')

  const litLeSdk = /isAuthRetryableFetchError/.test(appCode)
    && /from '@supabase\/supabase-js'/.test(appCode)
  verifier('S2b · elle lit le prédicat du SDK, pas un texte deviné',
    litLeSdk && !/message.*(fetch|network|Failed)/i.test(appCode))

  if (expr) {
    const perdue = new Function('session', 'error', 'isAuthRetryableFetchError', `return ${expr}`)
    const decide = (session, error) => perdue(session, error, isAuthRetryableFetchError)

    const SESSION = { access_token: 'x', refresh_token: 'y' }
    const cas = [
      ['session présente, aucune erreur',        SESSION, null, false],
      ['session présente malgré une erreur',     SESSION, new AuthRetryableFetchError('Failed to fetch', 0), false],
      ['session absente, aucune erreur',         null, null, true],
      ['panne réseau (AuthRetryableFetchError)', null, new AuthRetryableFetchError('Failed to fetch', 0), false],
      ['serveur momentanément muet (503)',       null, new AuthRetryableFetchError('Service unavailable', 503), false],
      ['refresh token invalide (AuthApiError)',  null, new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'), true],
      ['refresh token expiré',                   null, new AuthApiError('Refresh Token Expired', 401, 'refresh_token_not_found'), true],
      ['refresh token révoqué / déjà utilisé',   null, new AuthApiError('Already Used', 400, 'refresh_token_already_used'), true],
      ['session absente selon Auth',             null, new AuthSessionMissingError(), true],
      ['erreur inconnue, sans session',          null, new Error('boum'), true],
    ]
    const faux = cas.filter(([, s2, e, attendu]) => decide(s2, e) !== attendu)
    for (const [libelle, s2, e, attendu] of cas) {
      const obtenu = decide(s2, e)
      console.log(`      ${obtenu === attendu ? '·' : '✗'} ${libelle.padEnd(42)} → ${obtenu ? 'déconnecter' : 'rester connecté'}`)
    }
    verifier('S2c · dix cas classés correctement', faux.length === 0,
      faux.length ? `— ${faux.map(c => c[0]).join(' · ')}` : '')
  }
}

// ── S3 · l'écran reste synchronisé, et se désabonne ──────────────────────
{
  const ecoute = /supabase\.auth\.onAuthStateChange\(/.test(appCode)
  const desabonne = /subscription\.unsubscribe\(\)/.test(appCode)
  verifier('S3 · onAuthStateChange posé et désabonné au démontage',
    ecoute && desabonne, `— écoute:${ecoute ? 'oui' : 'NON'} désabonnement:${desabonne ? 'oui' : 'NON'}`)
}

// ── S4 · la table de décision de l'écouteur, exécutée ────────────────────
//
// On extrait le corps réel du rappel et on le fait tourner. Une garde qui
// recopierait la règle serait verte quel que soit l'état du fichier.
{
  const corps = (app.match(/onAuthStateChange\(\(evenement, session\) => \{([\s\S]*?)\n    \}\)/) || [])[1]
  verifier('S4a · le rappel de session est extrait du fichier', !!corps)
  if (corps) {
    const jouer = (evenement, session) => {
      const vu = { efface: 0, deconnecte: 0 }
      const localStorage = { removeItem: () => { vu.efface++ } }
      const setUser = f => { if (typeof f === 'function' && f('un-utilisateur') === null) vu.deconnecte++ }
      new Function('evenement', 'session', 'localStorage', 'setUser', corps)(evenement, session, localStorage, setUser)
      return vu
    }
    const cas = [
      ['INITIAL_SESSION', null, false, 'le démarrage est décidé ailleurs, pas ici'],
      ['SIGNED_OUT', null, true, 'déconnexion explicite, ici ou dans un autre onglet'],
      ['TOKEN_REFRESHED', { access_token: 'x' }, false, 'jeton renouvelé : rien à faire'],
      ['SIGNED_IN', { access_token: 'x' }, false, 'connexion : rien à effacer'],
      ['TOKEN_REFRESHED', null, true, 'la session a disparu en cours de route'],
    ]
    const faux = cas.filter(([e, s, attendu]) => (jouer(e, s).deconnecte > 0) !== attendu)
    verifier('S4b · la table de décision est exacte sur 5 cas',
      faux.length === 0, faux.length ? `— ${faux.map(c => c[0] + '/' + (c[1] ? 'session' : 'null')).join(', ')}` : '')

    // Pas de boucle : l'état n'est réécrit que s'il change réellement.
    const bailOut = /setUser\(u => \(u === null \? u : null\)\)/.test(appCode)
    verifier('S4c · l’état n’est réécrit que s’il change (aucune boucle)', bailOut)
  }
}

// ── S5 · la déconnexion ferme la session Auth ────────────────────────────
{
  const bloc = (appCode.match(/const handleLogout = async \(\) => \{[\s\S]*?\n  \}/) || [''])[0]
  const ferme = /supabase\.auth\.signOut\(\)/.test(bloc)
  const avant = bloc.indexOf('signOut') < bloc.indexOf("removeItem('ideal_user')")
  verifier('S5 · handleLogout ferme Auth AVANT de nettoyer le local',
    ferme && avant, `— signOut:${ferme ? 'oui' : 'NON'} ordre:${avant ? 'correct' : 'INVERSÉ'}`)
}

// ── S6 · aucune écriture de préparation sans identité serveur ────────────
{
  const garde = /const auteur = await auteurAuthentifie\(supabase\)/.test(ficheCode)
  const avantEcriture = ficheCode.indexOf('auteurAuthentifie(supabase)') < ficheCode.indexOf("from('preparations').insert")
  const importee = /import \{ auteurAuthentifie \} from '\.\.\/lib\/devoirs'/.test(fiche)
  verifier('S6 · la préparation passe la garde avant toute écriture',
    garde && avantEcriture && importee,
    `— garde:${garde ? 'oui' : 'NON'} avant l’insert:${avantEcriture ? 'oui' : 'NON'}`)
}

// ── S7 · rien n'est perdu quand la garde refuse ──────────────────────────
{
  const bloc = (ficheCode.match(/const auteur = await auteurAuthentifie\(supabase\)[\s\S]{0,1400}?const nb\s+=/) || [''])[0]
  const brouillon = (bloc.match(/sauverLocal\(\)/g) || []).length >= 2
  const rendLaMain = (bloc.match(/setEnCours\(false\)/g) || []).length >= 2
  const dit = /Reconnectez-vous/.test(bloc) && /conservée sur cet appareil/.test(bloc)
  const sort = (bloc.match(/\n      return\n/g) || []).length >= 2
  verifier('S7 · refus : brouillon gardé, message clair, rien d’écrit',
    brouillon && rendLaMain && dit && sort,
    `— brouillon:${brouillon ? 'oui' : 'NON'} message:${dit ? 'oui' : 'NON'} sortie:${sort ? 'oui' : 'NON'}`)
}

// ── S8 · la sauvegarde automatique n'appelle pas le serveur en plus ──────
//
// Elle se déclenche à la frappe : un appel d'identité par frappe coûterait
// plus que le message qu'il apporterait. Elle interprète le code reçu.
{
  const bloc = (ficheCode.match(/const sauverServeur = useCallback\([\s\S]*?\n  \}, \[/) || [''])[0]
  const sansAppel = !/auteurAuthentifie/.test(bloc)
  const interprete = /error\.code === '42501'/.test(bloc) && /votre session a expiré/.test(bloc)
  verifier('S8 · l’autosave interprète 42501 sans appel supplémentaire',
    sansAppel && interprete, `— sans appel:${sansAppel ? 'oui' : 'NON'} message:${interprete ? 'oui' : 'NON'}`)
}

// ── S9 · une seule garde d'identité dans le dépôt ────────────────────────
{
  const definitions = ['src/lib/devoirs.js'].filter(f => /export async function auteurAuthentifie/.test(lire(f)))
  verifier('S9 · `auteurAuthentifie` n’est définie qu’une fois',
    definitions.length === 1, `— ${definitions.join(', ') || 'AUCUNE'}`)
}

// ── R1/R2 · la reproduction, refaite à chaque exécution ──────────────────
{
  const CLE = (lire('public/inscription.html').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
  const H = { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' }
  const rpc = async (nom, corps) => {
    const r = await fetch(`https://jircuneixzwsmtktxrkh.supabase.co/rest/v1/rpc/${nom}`,
      { method: 'POST', headers: H, body: JSON.stringify(corps) })
    const t = await r.text(); let j = {}
    try { j = JSON.parse(t) || {} } catch { /* corps non JSON */ }
    return { statut: r.status, code: j.code || '', profil: Array.isArray(j) ? j[0] : j }
  }

  const p = await rpc('ideal_profil', {})
  verifier('R1 · sans session, ideal_profil rend un profil VIDE',
    p.statut === 200 && p.profil && p.profil.id === null,
    `— ${p.statut} id:${p.profil?.id === null ? 'null' : String(p.profil?.id)}`)

  const b = await rpc('sauver_brouillon_preparation',
    { p_date_cours: '2026-01-01', p_creneau_cle: '__garde__', p_contenu: {}, p_version_attendue: null })
  const n = await rpc('notifier_preparation', { p_preparation_id: '00000000-0000-0000-0000-000000000000' })
  verifier('R2 · sans session, brouillon et notification sont refusés',
    b.code === '42501' && n.code === '42501', `— brouillon:${b.code} notification:${n.code}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

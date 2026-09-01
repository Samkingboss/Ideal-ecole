// ═══════════════════════════════════════════════════════════════════════
// LES DEUX CLIENTS SUPABASE DU CÔTÉ SERVEUR
//
// SEUL FICHIER DU DÉPÔT AUTORISÉ À LIRE LA CLÉ ADMIN.
// La garde `detecter-service-role.mjs` le vérifie : tout `process.env`
// nommant une clé admin ailleurs — et surtout sous `src/` ou `public/` —
// fait rougir la suite.
//
// ── Pourquoi le préfixe compte plus que l'emplacement ──────────────────
//
// Vite n'expose au navigateur QUE les variables préfixées `VITE_`. C'est
// ce préfixe, et lui seul, qui décide si une valeur part dans le bundle.
// Une clé admin ne doit donc JAMAIS s'appeler `VITE_…`, où qu'elle vive.
//
// ── Pourquoi deux clients et non un ────────────────────────────────────
//
// Le client APPELANT porte le jeton du directeur : il permet de vérifier
// son rôle auprès de la base, et de faire écrire les RPC métier sous SON
// identité — donc avec la garde `ideal_est(['directeur'])` active et un
// `auth.uid()` exploitable dans le journal d'audit.
//
// Le client ADMIN porte la clé serveur. Il ne sert QU'À DEUX CHOSES :
// créer une identité Auth, et poser un mot de passe. Rien d'autre ne doit
// passer par lui — chaque appel supplémentaire contourne les RLS.
// ═══════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'

const URL_BASE = 'https://jircuneixzwsmtktxrkh.supabase.co'

export const urlSupabase = () => process.env.SUPABASE_URL || URL_BASE

// La clé publique « anon » n'est pas un secret : elle est déjà dans le
// bundle. Elle sert ici à porter le jeton du directeur.
export const clePublique = () => process.env.SUPABASE_ANON_KEY || ''

// ── La clé serveur ─────────────────────────────────────────────────────
//
// Supabase remplace progressivement les clés `service_role` (JWT hérités)
// par des clés secrètes `sb_secret_…`, conçues pour les backends. Les deux
// contournent les RLS et ne doivent jamais atteindre un navigateur. On
// préfère la moderne, on accepte l'héritée le temps de la transition.
export const cleServeur = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const OPTIONS_SERVEUR = {
  auth: {
    // Un processus serverless n'a ni disque durable, ni utilisateur, ni
    // URL de retour. Persister une session y serait au mieux inutile, au
    // pire une fuite d'état entre deux requêtes de deux personnes.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
}

// Client portant l'identité de l'appelant. Le jeton vient de l'en-tête
// Authorization, jamais du corps de la requête.
export const clientAppelant = (jeton) =>
  createClient(urlSupabase(), clePublique(), {
    ...OPTIONS_SERVEUR,
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  })

// Client administrateur. `null` si aucune clé n'est configurée : l'appelant
// doit traiter ce cas plutôt que de partir avec une clé vide, qui
// produirait un 401 illisible.
export const clientAdmin = () => {
  const cle = cleServeur()
  if (!cle) return null
  return createClient(urlSupabase(), cle, OPTIONS_SERVEUR)
}

// ── Utilitaires de réponse ─────────────────────────────────────────────

export const repondre = (res, code, corps) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Ces routes ne sont jamais mises en cache : elles portent des jetons.
  res.setHeader('Cache-Control', 'no-store')
  res.status(code).end(JSON.stringify(corps))
}

// Le jeton de l'appelant, lu dans l'en-tête et nulle part ailleurs. Un
// rôle transmis dans le corps de la requête serait une déclaration de
// l'appelant sur lui-même : sans valeur.
export const jetonDe = (req) => {
  const brut = req.headers?.authorization || req.headers?.Authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(String(brut).trim())
  return m ? m[1] : ''
}

// Le corps, quel que soit le parseur en amont.
export const corpsDe = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  const morceaux = []
  for await (const m of req) morceaux.push(m)
  if (!morceaux.length) return {}
  try { return JSON.parse(Buffer.concat(morceaux).toString('utf8')) } catch { return {} }
}

export const EMAIL_DOMAINE = '@comptes.ideal-ecole.ml'
export const identifiantVersEmail = (ident) =>
  String(ident || '').trim().toLowerCase() + EMAIL_DOMAINE

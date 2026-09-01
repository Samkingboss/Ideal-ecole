// ═══════════════════════════════════════════════════════════════════════
// ACTIVATION D'UN ACCÈS — route serveur PUBLIQUE
//
// Le membre arrive avec un lien reçu par WhatsApp et choisit son mot de
// passe. Aucune session n'est requise : le jeton EST l'autorisation.
//
// ── Pourquoi une route et non une RPC ouverte à anon ───────────────────
//
// Poser un mot de passe exige `auth.admin.updateUserById`. Écrire
// directement `auth.users.encrypted_password` en SQL aurait évité cette
// route — mais GoTrue ne verrait pas passer le changement et NE
// RÉVOQUERAIT PAS LES SESSIONS EN COURS. Un membre reprenant la main sur
// un compte compromis laisserait vivante la session de l'intrus.
//
// Conséquence heureuse : `consommer_acces_personnel` n'est ouverte qu'à
// la clé serveur. Aucune fonction touchant l'authentification n'est
// joignable depuis un navigateur.
//
// ── Réponses neutres ───────────────────────────────────────────────────
//
// Jeton inconnu, expiré, déjà consommé, révoqué, ou compte désactivé :
// une seule et même réponse. Rien ne permet de savoir si un compte existe.
//
// ── Échec fermé, assumé ────────────────────────────────────────────────
//
// Le jeton est consommé AVANT que le mot de passe soit posé. Si l'appel
// Admin échoue ensuite, le lien est brûlé et le membre doit en redemander
// un. L'ordre inverse laisserait une fenêtre de rejeu — on préfère un
// renvoi de lien à un jeton réutilisable.
// ═══════════════════════════════════════════════════════════════════════
import { clientAdmin, corpsDe, repondre } from './_supabase.js'

// Choisi court exprès : dix caractères, aucune règle de casse, de chiffre
// ni de symbole. Ces règles produisent « Ideal2026! » partout et
// n'ajoutent pas d'entropie réelle — elles ajoutent des oublis.
export const LONGUEUR_MINIMALE = 10

const FORME_JETON = /^[0-9a-f]{64}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return repondre(res, 405, { ok: false })

  const corps = await corpsDe(req)
  const jetonLien = String(corps.token || '')
  const nouveau = String(corps.mot_de_passe || '')

  // Forme d'abord : un jeton malformé ne déclenche aucune requête, donc
  // aucun coût serveur et aucun signal temporel exploitable.
  if (!FORME_JETON.test(jetonLien)) return repondre(res, 200, { ok: false })

  // La longueur, elle, est dite franchement : c'est une erreur de saisie,
  // pas une tentative. La taire ferait croire à un lien mort.
  if (nouveau.length < LONGUEUR_MINIMALE) {
    return repondre(res, 200, { ok: false, raison: 'mot_de_passe_trop_court' })
  }

  const admin = clientAdmin()
  if (!admin) return repondre(res, 500, { ok: false, raison: 'configuration_serveur_incomplete' })

  // ── Consommation atomique ────────────────────────────────────────────
  //
  // L'UPDATE conditionnel avec RETURNING, côté base, garantit qu'entre
  // deux requêtes simultanées portant le même jeton une seule gagne.
  const { data: consommation, error: errConso } =
    await admin.rpc('consommer_acces_personnel', { p_token: jetonLien })

  if (errConso) return repondre(res, 502, { ok: false })
  if (!consommation?.ok || !consommation?.auth_user_id) {
    return repondre(res, 200, { ok: false })
  }

  // ── Le mot de passe, posé par GoTrue ─────────────────────────────────
  const { data: majUser, error: errMaj } =
    await admin.auth.admin.updateUserById(consommation.auth_user_id, { password: nouveau })

  if (errMaj) {
    // Le lien est brûlé, le mot de passe n'a pas changé. On le dit : le
    // membre doit savoir qu'il lui faut un nouveau lien, pas réessayer.
    return repondre(res, 502, { ok: false, raison: 'lien_consomme_sans_effet' })
  }

  // ── L'identifiant, pour que le membre puisse se connecter ────────────
  //
  // Il sort de la réponse que GoTrue vient de rendre : aucune requête
  // supplémentaire, aucune lecture de `public.users`, aucun usage de plus
  // de la clé serveur. `user_metadata.identifiant` est posé à la création ;
  // l'adresse synthétique `identifiant@comptes.ideal-ecole.ml` sert de
  // repli, car tout compte en possède une.
  //
  // Il n'est atteignable qu'ICI, après une consommation valide. Un jeton
  // inconnu, expiré, révoqué ou déjà consommé n'arrive jamais jusqu'à
  // cette ligne : aucune énumération n'est possible.
  //
  // Un identifiant n'est pas un secret — le membre doit le connaître pour
  // se connecter, et il figure déjà dans le message WhatsApp du directeur.
  const utilisateur = majUser?.user
  const identifiant = utilisateur?.user_metadata?.identifiant
    || String(utilisateur?.email || '').split('@')[0]
    || null

  return repondre(res, 200, { ok: true, identifiant })
}

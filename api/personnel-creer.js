// ═══════════════════════════════════════════════════════════════════════
// CRÉATION D'UN MEMBRE DU PERSONNEL — route serveur
//
// Le directeur crée le membre ; l'identité Auth naît ici, côté serveur.
// Aucun secret n'est rendu, aucun secret n'est tracé.
//
// ── Pourquoi cette route existe ────────────────────────────────────────
//
// Créer une identité Supabase Auth exige une clé serveur. Cette clé ne
// peut pas vivre dans un navigateur. La route est donc le seul endroit où
// `auth.admin.createUser` peut être appelée — et le seul endroit qu'il
// faut protéger, puisqu'une route de création de comptes ouverte à
// internet serait pire que tout ce que la Phase 1 a fermé.
//
// ── Le contrôle de rôle ────────────────────────────────────────────────
//
// Le rôle est demandé À LA BASE, avec le jeton de l'appelant. Il n'est
// jamais lu dans le corps de la requête : ce que le client dit de
// lui-même n'a aucune valeur. `ideal_est` lit `auth.uid()`, côté serveur.
//
// ── L'atomicité, qui n'existe pas ──────────────────────────────────────
//
// L'identité Auth et le profil IDEAL sont deux écritures dans deux
// systèmes. Aucune transaction ne les couvre. Si le rattachement échoue,
// l'identité créée est SUPPRIMÉE immédiatement : sans cela, l'adresse
// resterait prise et le même membre ne pourrait plus jamais être créé.
// ═══════════════════════════════════════════════════════════════════════
import { randomBytes } from 'node:crypto'
import {
  clePublique, clientAdmin, clientAppelant, corpsDe, identifiantVersEmail, jetonDe, repondre,
} from './_supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return repondre(res, 405, { ok: false, raison: 'methode' })

  const jeton = jetonDe(req)
  if (!jeton) return repondre(res, 401, { ok: false, raison: 'session_absente' })

  // Une variable d'environnement manquante doit se dire, pas se déguiser.
  // Sans la clé publique, le client appelant partirait avec une clé vide et
  // la base répondrait 401 : le directeur lirait « session expirée » et
  // chercherait au mauvais endroit pendant une heure.
  if (!clientAdmin() || !clePublique()) {
    return repondre(res, 500, { ok: false, raison: 'configuration_serveur_incomplete' })
  }
  const admin = clientAdmin()

  const appelant = clientAppelant(jeton)

  // ── 1 · Le rôle réel, demandé à la base ──────────────────────────────
  const { data: estDirecteur, error: errRole } =
    await appelant.rpc('ideal_est', { p_roles: ['directeur'] })

  if (errRole) return repondre(res, 401, { ok: false, raison: 'session_invalide' })
  if (estDirecteur !== true) return repondre(res, 403, { ok: false, raison: 'reserve_a_la_direction' })

  // ── 2 · Les données métier ───────────────────────────────────────────
  const corps = await corpsDe(req)
  const prenom = String(corps.prenom || '').trim()
  const nom = String(corps.nom || '').trim()
  const role = String(corps.role || '').trim()
  const sexe = String(corps.sexe || '').trim().toUpperCase()

  if (!prenom || !nom) return repondre(res, 400, { ok: false, raison: 'identite_incomplete' })
  if (!role) return repondre(res, 400, { ok: false, raison: 'role_manquant' })
  if (!['F', 'M'].includes(sexe)) return repondre(res, 400, { ok: false, raison: 'sexe_invalide' })
  if (role === 'directeur') return repondre(res, 400, { ok: false, raison: 'role_directeur_interdit' })

  // ── 3 · L'identifiant ────────────────────────────────────────────────
  //
  // Proposé par la base, pas réservé. Deux créations simultanées
  // pourraient recevoir la même valeur ; la collision est alors refusée
  // DEUX fois en aval — par l'unicité d'adresse de GoTrue, puis par
  // `users_identifiant_unique`. Aucun état corrompu n'est atteignable.
  const { data: identifiant, error: errIdent } =
    await appelant.rpc('identifiant_disponible', { p_prenom: prenom, p_nom: nom })

  if (errIdent || !identifiant) {
    return repondre(res, 400, { ok: false, raison: errIdent?.code === '42501'
      ? 'reserve_a_la_direction' : 'identifiant_indisponible' })
  }

  // ── 4 · L'identité Auth ──────────────────────────────────────────────
  //
  // Le mot de passe posé ici est JETABLE : 384 bits d'aléa cryptographique,
  // jamais rendu, jamais tracé, jamais réutilisé. Il n'existe que pour
  // satisfaire l'API le temps que le membre choisisse le sien. Personne —
  // ni le directeur, ni nous — ne le connaît.
  const jetable = randomBytes(48).toString('base64url')

  const { data: creation, error: errAuth } = await admin.auth.admin.createUser({
    email: identifiantVersEmail(identifiant),
    password: jetable,
    // Les adresses sont synthétiques : aucun courriel n'est délivrable.
    // Sans cette confirmation, le compte naîtrait inutilisable et
    // attendrait un message que personne n'enverra jamais.
    email_confirm: true,
    user_metadata: { identifiant, prenom, nom, role, sexe },
  })

  if (errAuth || !creation?.user?.id) {
    const deja = /already|exists|registered/i.test(errAuth?.message || '')
    return repondre(res, deja ? 409 : 502,
      { ok: false, raison: deja ? 'identifiant_deja_pris' : 'identite_non_creee' })
  }

  const idAuth = creation.user.id

  // ── 5 · Le profil IDEAL, sous l'identité du directeur ────────────────
  const { data: profil, error: errProfil } =
    await appelant.rpc('rattacher_membre_personnel', {
      p_auth_user_id: idAuth,
      p_identifiant: identifiant,
      p_prenom: prenom,
      p_nom: nom,
      p_role: role,
      p_langue: corps.langue ? String(corps.langue).trim() : null,
      p_fonction: corps.fonction ? String(corps.fonction).trim() : null,
      p_telephone: corps.telephone ? String(corps.telephone).trim() : null,
      p_sexe: sexe,
    })

  // ── 6 · La compensation, obligatoire ─────────────────────────────────
  if (errProfil || !profil) {
    // Sans cette suppression, l'adresse reste prise dans Auth et le même
    // membre devient définitivement impossible à créer. L'échec de la
    // compensation elle-même est signalé au directeur : il faut alors une
    // intervention manuelle, et le taire serait pire.
    const { error: errMenage } = await admin.auth.admin.deleteUser(idAuth)
    return repondre(res, 500, {
      ok: false,
      raison: errProfil?.code === '42501' ? 'reserve_a_la_direction' : 'profil_non_rattache',
      compensation: errMenage ? 'echouee' : 'faite',
    })
  }

  // Aucun secret dans la réponse. L'identifiant n'en est pas un : le
  // membre doit le connaître pour se connecter.
  return repondre(res, 200, {
    ok: true,
    id: profil.id,
    identifiant: profil.identifiant,
  })
}

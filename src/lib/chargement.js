// ═══════════════════════════════════════════════════════════════════════
// CHARGEMENT, ERREUR, VIDE — trois états, jamais deux
// ═══════════════════════════════════════════════════════════════════════
//
// Le motif `data || []` est la plaie la plus répandue de la plateforme :
// soixante-sept occurrences transformaient une panne réseau, un refus RLS
// ou une session non prête en liste vide silencieuse. Un tableau de bord
// affichait « 0 élève » avec le même aplomb qu'il aurait affiché 12.
//
// La règle : LOADING ≠ EMPTY ≠ ERROR.
//
//   chargement  la requête est en cours — on ne sait pas encore
//   erreur      la requête a échoué — on ne saura pas
//   vide        la requête a réussi et il n'y a rien — c'est une réponse
//   ok          la requête a réussi et il y a quelque chose
//
// Les deux premiers ne sont pas des valeurs métier. Les rendre comme un
// zéro, c'est mentir avec assurance.

/**
 * Enveloppe une réponse supabase-js en état explicite.
 * Ne masque jamais l'erreur : elle est conservée et rendue observable.
 */
export function resultat({ data, error }) {
  if (error) return { etat: 'erreur', donnees: [], erreur: error, message: messageLisible(error) }
  const d = Array.isArray(data) ? data : data == null ? [] : [data]
  return { etat: d.length === 0 ? 'vide' : 'ok', donnees: d, erreur: null, message: null }
}

/**
 * Agrège plusieurs réponses — typiquement un `Promise.all`.
 *
 * Signale par bloc, jamais par page : une requête en échec ne doit pas
 * masquer les onze autres qui ont abouti. `DirecteurApp` en lance douze ;
 * tout perdre parce que l'une échoue serait remplacer une panne discrète
 * par une panne totale.
 */
export function agreger(resultats) {
  const enEchec = Object.entries(resultats).filter(([, r]) => r?.error)
  return {
    aDesEchecs: enEchec.length > 0,
    nbEchecs: enEchec.length,
    blocsEnEchec: enEchec.map(([cle]) => cle),
    messages: enEchec.map(([cle, r]) => `${cle} : ${messageLisible(r.error)}`),
  }
}

/**
 * Message destiné à l'utilisateur. Ne divulgue ni nom de table, ni SQL —
 * `comptabilite.html` affiche déjà `e1.message` brut à l'écran, ce motif ne
 * doit pas se généraliser.
 */
export function messageLisible(error) {
  if (!error) return null
  const m = String(error.message || error.details || '').toLowerCase()

  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch'))
    return 'Connexion au serveur impossible. Vérifiez la connexion internet.'
  if (error.code === '42501' || m.includes('permission denied') || m.includes('row-level security'))
    return "Accès refusé par le serveur. Votre compte n'a pas les droits nécessaires."
  if (error.code === 'PGRST301' || m.includes('jwt') || m.includes('expired'))
    return 'Session expirée. Reconnectez-vous.'
  if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST204')
    return 'Une donnée attendue est absente du serveur. Signalez-le à la direction.'

  return 'Chargement impossible. Réessayez dans un instant.'
}

/**
 * Ce qu'un indicateur numérique doit afficher.
 *
 * Un tableau de bord qui affiche « 0 » sur une panne est pire qu'un tableau
 * de bord vide : il donne une valeur fausse à quelqu'un qui va décider avec.
 * En erreur on rend `null`, à charge de l'appelant d'afficher « — ».
 */
export function indicateur(etat, valeur) {
  if (etat === 'erreur' || etat === 'chargement') return null
  return valeur
}

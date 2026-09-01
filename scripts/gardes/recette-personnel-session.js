// ============================================================
// RECETTE — volet « session réelle », à coller dans la console du
// navigateur sur ideal-ecole.vercel.app, une fois connecté.
//
// À lancer TROIS FOIS : en enseignant, en responsable administratif,
// puis en directeur. Les codes ne sortent pas de votre machine ; ce
// script ne lit que le jeton déjà présent dans l'onglet.
//
// NON DESTRUCTIF : l'identifiant nul ne correspond à aucun compte, la
// fonction s'arrête avant toute écriture.
// ============================================================
(async () => {
  const URL = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1'
  const CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcmN1bmVpeHp3c210a3R4cmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzI0ODQsImV4cCI6MjA4Nzc0ODQ4NH0.MLAV60tPKhFP8BixVavW3SU-npe8YvS0lKQ493AYNls'
  const jeton = JSON.parse(localStorage.getItem('ideal-auth') || '{}').access_token
  if (!jeton) return console.error('Aucune session IDEAL dans cet onglet — connectez-vous d\'abord.')

  const appeler = async (nom, corps) => {
    const r = await fetch(`${URL}/rpc/${nom}`, {
      method: 'POST',
      headers: { apikey: CLE, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    let j = {}; try { j = JSON.parse(await r.text()) || {} } catch { /* corps non JSON */ }
    return { status: r.status, code: j.code || '', message: j.message || '' }
  }

  const role = await appeler('ideal_role', {})
  console.log('Rôle vu par la base :', role.message || '(voir la réponse brute ci-dessous)')
  console.table({
    'ideal_role()':            await appeler('ideal_role', {}),
    'desactiver_utilisateur':  await appeler('desactiver_utilisateur',
                                 { p_id: '00000000-0000-0000-0000-000000000000' }),
    'enregistrer_utilisateur': await appeler('enregistrer_utilisateur',
                                 { p_id: null, p_prenom: '', p_nom: '', p_role: 'professeur',
                                   p_langue: null, p_fonction: null, p_code: '', p_plafond: null }),
    'authentifier_par_code':   await appeler('authentifier_par_code', { p_code: '__aucun_code_reel__' }),
  })

  console.log(`
ATTENDU APRÈS MIGRATION
  enseignant / resp. administratif
    desactiver_utilisateur   → 42501  reserve_a_la_direction
    enregistrer_utilisateur  → 42501  reserve_a_la_direction
  directeur
    desactiver_utilisateur   → P0001  compte_introuvable     (garde franchie)
    enregistrer_utilisateur  → P0001  identite_incomplete    (garde franchie)
  tous les rôles
    authentifier_par_code    → 42501  (plus aucun appelant)`)
})()

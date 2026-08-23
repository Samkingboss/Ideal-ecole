import { supabase } from './supabase'

/**
 * Journal d'audit — trace des modifications qui influent sur les points
 * et la prime des enseignants.
 *
 * Objectif : qu'un désaccord se règle sur un fait daté plutôt que sur une
 * parole contre une autre. Le journal enregistre l'ancienne et la nouvelle
 * valeur, l'auteur et l'horodatage.
 *
 * Limite assumée : tant que la plateforme n'a pas d'authentification réelle,
 * l'auteur est celui que déclare l'application. C'est un garde-fou de bonne
 * foi, pas une preuve infalsifiable.
 */

const utilisateurCourant = () => {
  try { return JSON.parse(localStorage.getItem('ideal_user') || 'null') } catch (e) { return null }
}

const texte = v => {
  if (v === null || v === undefined || v === '') return null
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

/**
 * Consigne une modification. Ne bloque jamais l'action en cours : si le
 * journal échoue, on le signale en console mais l'utilisateur n'est pas
 * empêché de travailler.
 */
export async function journaliser({ table, ligneId, champ, avant, apres, action = 'modification' }) {
  const u = utilisateurCourant()
  try {
    const { error } = await supabase.from('journal_audit').insert({
      table_cible: table,
      ligne_id: ligneId ? String(ligneId) : null,
      champ: champ || null,
      ancienne_valeur: texte(avant),
      nouvelle_valeur: texte(apres),
      auteur_id: u?.id || null,
      auteur_nom: u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : null,
      action,
    })
    if (error) console.warn('[audit] écriture refusée :', error.message)
  } catch (e) {
    console.warn('[audit] indisponible :', e.message)
  }
}

/** Consigne plusieurs champs d'un coup, en ignorant ceux qui n'ont pas bougé */
export async function journaliserChamps({ table, ligneId, avant = {}, apres = {}, action = 'modification' }) {
  const champs = Object.keys(apres).filter(k => texte(avant[k]) !== texte(apres[k]))
  await Promise.all(champs.map(champ => journaliser({
    table, ligneId, champ, avant: avant[champ], apres: apres[champ], action,
  })))
  return champs.length
}

/** Dernières entrées, éventuellement filtrées sur une table ou une ligne */
export async function lireJournal({ table = null, ligneId = null, limite = 60 } = {}) {
  let q = supabase.from('journal_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)
  if (table) q = q.eq('table_cible', table)
  if (ligneId) q = q.eq('ligne_id', String(ligneId))
  const { data, error } = await q
  // Renvoyer `[]` sur échec ferait lire « aucune trace » à quelqu'un qui
  // vérifie précisément qu'une trace existe. On renvoie `null` : l'appelant
  // doit distinguer « pas d'historique » de « historique illisible ».
  if (error) { console.warn('[audit] lecture impossible :', error.message); return null }
  return Array.isArray(data) ? data : []
}

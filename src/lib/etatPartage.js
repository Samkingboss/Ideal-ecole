// ═══════════════════════════════════════════════════════════════════════════
// LISTES PARTAGÉES DANS `app_state` — PLUS D'ÉCRASEMENT SILENCIEUX
// ═══════════════════════════════════════════════════════════════════════════
//
// Plusieurs listes métier vivent comme un unique document JSON sous une clé
// d'`app_state` : les boîtes de notifications, le registre des demandes RH.
// Chaque écrivain faisait la même chose :
//
//     lire la liste  →  y ajouter sa ligne  →  réécrire la liste ENTIÈRE
//
// Entre la lecture et la réécriture, rien n'empêchait un autre appareil
// d'écrire. Le second effaçait alors le travail du premier, sans erreur,
// sans trace. Deux exemples réels du dépôt :
//
//   · deux enseignants signalent un incident à la même minute : la direction
//     n'en voit qu'un ;
//   · la direction répond à une demande RH en réécrivant la liste qu'elle a
//     chargée à l'ouverture de l'écran — toute demande déposée depuis cette
//     ouverture disparaît.
//
// Le projet connaissait déjà le problème : `notifier_preparation` prend un
// verrou consultatif précisément pour cela. Mais ce verrou ne protège que les
// deux chemins passés par le serveur ; les dix appels côté navigateur
// écrivaient à découvert.
//
// ── Le remède ────────────────────────────────────────────────────────────
//
// Écriture conditionnelle. On retient l'horodatage lu, et l'on n'écrit QUE si
// la ligne le porte encore. Si quelqu'un a écrit entre-temps, notre écriture
// ne touche aucune ligne : on relit, on rejoue la transformation sur la liste
// à jour, on réessaie. Personne n'écrase personne, et l'échec réel — cinq
// tentatives perdues — se dit au lieu de se taire.
//
// Aucun droit nouveau n'est requis : un `upsert` exigeait déjà INSERT et
// UPDATE, qui sont exactement ce qu'on utilise ici.

export const TENTATIVES = 5

// L'horodatage sert de jeton de version. Il doit donc STRICTEMENT augmenter :
// deux écritures dans la même milliseconde produiraient sinon la même valeur,
// et la garde de concurrence laisserait passer le second écrivain.
export const tamponSuivant = (ancien) => {
  const maintenant = Date.now()
  const precedent = ancien ? Date.parse(ancien) : NaN
  const t = Number.isFinite(precedent) && precedent >= maintenant ? precedent + 1 : maintenant
  return new Date(t).toISOString()
}

/**
 * Applique `transformer` à une liste partagée, sans jamais écraser une
 * écriture concurrente.
 *
 * @param {object}   o
 * @param {string}   o.app          colonne `app` de la ligne
 * @param {string}   o.cle          colonne `key` de la ligne
 * @param {Function} o.transformer  (listeÀJour) => nouvelleListe — appelée à
 *                                  chaque tentative sur la liste FRAÎCHE, donc
 *                                  elle doit rester pure et rejouable
 * @param {object}   o.client       le client Supabase. Il est PASSÉ, non
 *                                  importé : c'est ce qui permet aux gardes
 *                                  de rejouer une collision réelle sans
 *                                  toucher la base de production.
 * @returns {Promise<{ok:boolean, valeur?:any[], essais:number, raison?:string, message?:string}>}
 */
export async function modifierEtatPartage({
  app, cle, transformer, parDefaut = null, tentatives = TENTATIVES, client,
}) {
  if (!client) throw new Error('modifierEtatPartage : client Supabase manquant')

  let dernier = null

  for (let essai = 1; essai <= tentatives; essai++) {
    const { data, error } = await client
      .from('app_state').select('value, updated_at')
      .eq('app', app).eq('key', cle).maybeSingle()

    if (error) return { ok: false, raison: 'lecture', message: error.message, essais: essai }

    const ancienne = data && data.value != null ? data.value : parDefaut
    const nouvelle = transformer(ancienne)
    const horodatage = tamponSuivant(data?.updated_at)

    // ── La ligne n'existe pas encore ──────────────────────────────────────
    if (!data) {
      const { error: eIns } = await client
        .from('app_state').insert({ app, key: cle, value: nouvelle, updated_at: horodatage })
      if (!eIns) return { ok: true, valeur: nouvelle, essais: essai }

      // 23505 : quelqu'un a créé la ligne entre notre lecture et notre insert.
      // Une SEULE fois : si la ligne existe mais reste invisible à la lecture,
      // insister reviendrait à réécrire par-dessus un contenu qu'on ne voit
      // pas. On préfère refuser et le dire.
      if (eIns.code !== '23505') {
        return { ok: false, raison: 'ecriture', message: eIns.message, essais: essai }
      }
      if (dernier === 'ligne-invisible') {
        return { ok: false, raison: 'ligne-invisible', essais: essai,
          message: 'la ligne existe mais n’est pas lisible par cette session' }
      }
      dernier = 'ligne-invisible'
      continue
    }

    // ── Écriture conditionnelle sur l'horodatage lu ───────────────────────
    let maj = client.from('app_state')
      .update({ value: nouvelle, updated_at: horodatage })
      .eq('app', app).eq('key', cle)
    maj = data.updated_at == null ? maj.is('updated_at', null) : maj.eq('updated_at', data.updated_at)

    const { data: touchees, error: eMaj } = await maj.select('key')
    if (eMaj) return { ok: false, raison: 'ecriture', message: eMaj.message, essais: essai }
    if (touchees && touchees.length > 0) return { ok: true, valeur: nouvelle, essais: essai }

    // Zéro ligne touchée a deux causes très différentes, et les confondre
    // ferait réécrire cinq fois une modification déjà passée : soit un autre
    // écrivain est arrivé avant nous, soit notre écriture a bien eu lieu mais
    // la politique de lecture masque la ligne renvoyée. On tranche en
    // relisant.
    //
    // On compare le CONTENU, pas l'horodatage. Deux écrivains partis de la
    // même ligne calculent la même milliseconde et donc le même horodatage :
    // s'y fier ferait prendre l'écriture du voisin pour la sienne, et c'est
    // exactement la perte qu'on cherche à empêcher. Le contenu, lui, porte
    // l'identifiant de notre propre ajout.
    const { data: apres } = await client
      .from('app_state').select('value')
      .eq('app', app).eq('key', cle).maybeSingle()
    if (JSON.stringify(apres?.value) === JSON.stringify(nouvelle)) {
      return { ok: true, valeur: nouvelle, essais: essai }
    }

    dernier = 'concurrence'
  }

  return {
    ok: false, raison: dernier || 'concurrence', essais: tentatives,
    message: `${tentatives} tentatives : une autre écriture est arrivée avant chacune`,
  }
}

// Cas particulier le plus fréquent : la valeur est une liste. La transformation
// reçoit alors toujours un tableau, même quand la ligne n'existe pas encore.
export const modifierListePartagee = (o) => modifierEtatPartage({
  ...o,
  parDefaut: [],
  transformer: valeur => o.transformer(Array.isArray(valeur) ? valeur : []),
})

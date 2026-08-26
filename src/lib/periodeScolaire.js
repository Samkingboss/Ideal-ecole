// La période scolaire d'une date — une seule source, un seul calcul.
//
// ── Trois référentiels existaient ──────────────────────────────────────────
//
//   `AgendaCalendrier.jsx`  5 périodes 2026-2027, écrites en dur, avec la
//                           fonction de calcul déjà là
//   `points.js`             3 trimestres 2026-2027, bornes de la prime d'été
//   table `periodes`        15 lignes = 5 périodes × 3 exemplaires identiques,
//                           toutes en `annee_scolaire = '2024-2025'`
//
// Et un quatrième, non écrit : le `<select>` du formulaire de devoir, où
// l'enseignant tapait « Période 3 » à la main sans qu'aucun calendrier ne le
// contredise. Un devoir de novembre pouvait porter « Période 5 ».
//
// Ce fichier est le point d'entrée unique. Il ne crée pas de table : la table
// `periodes` porte déjà `date_debut`, `date_fin`, `annee_scolaire` et `ordre`
// — tout ce qu'il faut. Il lui manque seulement les lignes de l'année en
// cours, et c'est une migration, pas du code.
//
// Les bornes de `points.js` ne sont PAS touchées : ce sont celles de la prime
// d'été, un arbitrage du directeur, pas une donnée pédagogique.

export const ANNEE_SCOLAIRE = '2026-2027'

// Le calendrier de repli — celui qu'`AgendaCalendrier` affiche déjà. Il sert
// tant que la table ne porte pas l'année en cours. Ce n'est pas un doublon
// qu'on installe : c'est celui qui existait, ramené à un seul endroit.
export const PERIODES_PAR_DEFAUT = [
  { ordre: 1, nom: 'Période 1 (T1)', date_debut: '2026-10-01', date_fin: '2026-11-13', couleur: '#1AAFE0' },
  { ordre: 2, nom: 'Période 2 (T1)', date_debut: '2026-11-23', date_fin: '2026-12-18', couleur: '#8DC63F' },
  { ordre: 3, nom: 'Période 3 (T2)', date_debut: '2027-01-04', date_fin: '2027-02-19', couleur: '#F7941D' },
  { ordre: 4, nom: 'Période 4 (T2)', date_debut: '2027-03-01', date_fin: '2027-04-16', couleur: '#EC008C' },
  { ordre: 5, nom: 'Période 5 (T3)', date_debut: '2027-04-26', date_fin: '2027-06-25', couleur: '#00B5B8' },
]

// La forme attendue par l'agenda, qui nommait ses champs autrement. Il les
// lisait depuis sa propre copie ; deux copies finissent par diverger, et
// c'est précisément ce qu'on reproche à la table `periodes`.
export const PERIODES_AGENDA = PERIODES_PAR_DEFAUT.map(p => ({
  num: p.ordre, debut: p.date_debut, fin: p.date_fin, color: p.couleur, label: p.nom,
}))

/**
 * Les périodes utilisables : celles de l'année en cours, dédoublonnées.
 *
 * Le dédoublonnage ici n'est PAS le correctif. La cause est en base — un seed
 * passé trois fois, sans contrainte d'unicité — et elle se répare par une
 * migration. Ce filtre empêche seulement l'écran d'afficher trois fois « 1er
 * Trimestre » en attendant, et il le fait sur (`annee_scolaire`, `ordre`),
 * pas sur le libellé : deux périodes peuvent légitimement porter le même nom
 * dans deux années différentes.
 */
export const periodesUtilisables = (lignes, annee = ANNEE_SCOLAIRE) => {
  const deLAnnee = (lignes || []).filter(p => p && p.annee_scolaire === annee)
  const source = deLAnnee.length ? deLAnnee : PERIODES_PAR_DEFAUT
  const vues = new Map()
  for (const p of source) {
    const cle = `${p.annee_scolaire || annee}§${p.ordre}`
    if (!vues.has(cle)) vues.set(cle, p)
  }
  return [...vues.values()].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
}

/** Vrai si la table ne porte pas encore l'année en cours — l'écran doit le dire. */
export const calendrierEnBase = (lignes, annee = ANNEE_SCOLAIRE) =>
  (lignes || []).some(p => p && p.annee_scolaire === annee)

/**
 * La période d'une date.
 *
 * ── Quelle date fait foi ───────────────────────────────────────────────────
 *
 * `date_rendu`, et non la date de création ni la date où le devoir a été
 * donné. C'est la date que l'élève, le parent et le bulletin ont en tête :
 * un devoir donné le 30 novembre et rendu le 2 décembre appartient à la
 * période où il est ÉVALUÉ, pas à celle où il a été annoncé.
 *
 * ── Hors calendrier ────────────────────────────────────────────────────────
 *
 * Rend `null`. Jamais la période la plus proche, jamais la première, jamais
 * un repli. Une date de vacances ou d'une autre année n'a pas de période, et
 * en inventer une écrirait un faux en base — c'est ce que faisait la saisie
 * manuelle.
 */
export const periodePourDate = (dateISO, periodes) => {
  const d = String(dateISO || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const liste = periodesUtilisables(periodes)
  return liste.find(p => d >= String(p.date_debut) && d <= String(p.date_fin)) || null
}

/** Ce qu'on affiche à l'enseignant, en lecture seule. */
export const libellePeriode = (periode) =>
  periode ? (periode.nom || `Période ${periode.ordre}`) : null

/** Le message quand la date ne tombe nulle part. On ne devine pas. */
export const MESSAGE_HORS_CALENDRIER =
  'Cette date ne correspond à aucune période du calendrier scolaire configuré.'

/**
 * Le libellé d'une période telle qu'elle est STOCKÉE sur un devoir.
 *
 * L'ancien formulaire enregistrait le chiffre seul — « 1 », « 3 » — parce que
 * son `<select>` proposait `['1'..'5']`. Le calcul actuel écrit le libellé
 * complet, « Période 1 (T1) ». Les deux formes coexistent en base et y
 * resteront : on ne réécrit pas quatorze devoirs pour une question
 * d'affichage.
 *
 * Un chiffre seul se lit « Période 3 » ; un libellé se rend tel quel.
 */
export const libellePeriodeStockee = (valeur) => {
  const v = String(valeur ?? '').trim()
  if (!v) return null
  return /^\d+$/.test(v) ? `Période ${v}` : v
}

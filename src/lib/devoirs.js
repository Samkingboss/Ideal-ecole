// Le devoir de maison — une seule lecture pour deux écritures d'origines
// différentes.
//
// ── Pourquoi ce fichier existe ─────────────────────────────────────────────
//
// Deux modules ont écrit dans la table `devoirs` : la plateforme historique
// (`public/pedago-archive/`) et l'écran intégré au portail. Ils écrivent dans
// la MÊME table — ce qui évite toute migration — mais pas sous la même forme.
//
// Relevé sur les quatorze devoirs en base, le 24 août 2026 :
//
//   forme historique (13)   contenu = { id, date, type, grade, bareme, images,
//                                       period, content, dueDate, subject,
//                                       teacher, objectives, destinataires }
//   forme intégrée   (1)    contenu = { destinataire_mode, eleve_ids }
//
// La forme historique est la plus riche : elle porte le type de devoir, la
// période, l'énoncé, les objectifs et le barème. L'écran intégré n'en a jamais
// rien su, et un enseignant qui passait de l'un à l'autre perdait la moitié de
// sa fiche.
//
// Ce fichier lit les deux et n'en rend qu'une. Les anciens devoirs restent
// lisibles sans être réécrits : aucune migration, donc aucun risque de perte.

// ── Colonnes à charger ─────────────────────────────────────────────────────
//
// Explicites, jamais `select('*')` : la leçon du chargement de 1,7 Mo sur
// `eleves` vaut pour toutes les tables. `contenu` est nécessaire — c'est là que
// vit la fiche.
export const CHAMPS_DEVOIR = [
  'id', 'user_id', 'classe_id', 'groupe', 'matiere', 'titre',
  'description', 'date_donne', 'date_rendu', 'contenu',
  'fichiers', 'fichier_url', 'fichier_nom', 'created_at',
].join(',')

// ── Vocabulaire ────────────────────────────────────────────────────────────
//
// « Devoir de maison », jamais « du soir ». Les autres types viennent de la
// plateforme historique, où ils étaient déjà proposés.
export const TYPES_DEVOIR = [
  'Devoir de Maison',
  'Exercice de consolidation',
  'Lecture à préparer',
  'Recherche',
  'Révision',
]

export const TYPE_PAR_DEFAUT = TYPES_DEVOIR[0]

// ── Lecture ────────────────────────────────────────────────────────────────

// La plateforme historique préfixait ses identifiants d'élève par « el: ».
const sansPrefixe = c => String(c || '').replace(/^el:/, '')

/**
 * Rend un devoir sous une forme unique, quelle que soit son origine.
 * Ne modifie rien en base : c'est une lecture.
 */
export const lireDevoir = (ligne) => {
  const c = (ligne && ligne.contenu) || {}

  // Destinataires : deux encodages, un seul résultat.
  //
  //   historique  { mode: 'choix', eleves: [{ cle: 'el:<uuid>', nom: '…' }] }
  //   intégré     { destinataire_mode: 'choix', eleve_ids: ['<uuid>'] }
  //
  // Le nom présent dans la forme historique est conservé : il permet
  // d'afficher un destinataire même si l'élève a quitté l'école depuis.
  const dHist = c.destinataires
  const mode = c.destinataire_mode
    || (dHist && dHist.mode)
    || 'classe'
  const elevesHist = (dHist && Array.isArray(dHist.eleves)) ? dHist.eleves : []
  const eleveIds = Array.isArray(c.eleve_ids) && c.eleve_ids.length
    ? c.eleve_ids.map(sansPrefixe)
    : elevesHist.map(e => sansPrefixe(e && e.cle))

  // Les pièces jointes vivent à deux endroits : la colonne `fichiers` pour
  // l'écran intégré, `contenu.images` pour la plateforme historique.
  const images = Array.isArray(c.images) ? c.images : []
  const fichiers = Array.isArray(ligne?.fichiers) && ligne.fichiers.length
    ? ligne.fichiers
    : (ligne?.fichier_url ? [{ url: ligne.fichier_url, nom: ligne.fichier_nom }] : [])
  const piecesJointes = [
    ...fichiers,
    ...images.map(u => ({ url: u, nom: null })),
  ].filter(p => p && p.url)

  return {
    id: ligne?.id,
    classeId: ligne?.classe_id,
    groupe: ligne?.groupe || c.grade || null,
    matiere: ligne?.matiere || c.subject || null,
    // `description` est la colonne ; `objectives` son équivalent historique.
    objectif: ligne?.description || c.objectives || '',
    // L'énoncé n'existait que côté historique : l'écran intégré n'avait pas de
    // champ pour lui, et le devoir se réduisait à son objectif.
    enonce: c.enonce || c.content || '',
    bareme: c.bareme || '',
    type: c.type || TYPE_PAR_DEFAUT,
    periode: c.periode || c.period || null,
    dateDonne: ligne?.date_donne || null,
    dateRendu: ligne?.date_rendu || c.dueDate || null,
    destinataireMode: mode === 'choix' ? 'choix' : 'classe',
    eleveIds: mode === 'choix' ? eleveIds : [],
    // Noms figés au moment de l'envoi, quand la plateforme historique les
    // avait enregistrés.
    eleveNoms: elevesHist.map(e => e && e.nom).filter(Boolean),
    piecesJointes,
    // L'auteur : `user_id` sur les devoirs récents, un nom en clair sur les
    // anciens. Treize des quatorze devoirs en base n'ont pas d'auteur
    // identifié — seulement ce texte, quand il existe.
    auteurId: ligne?.user_id || null,
    auteurNomHistorique: c.teacher || null,
    // La forme d'origine, pour savoir ce qu'on regarde.
    origine: ligne?.user_id ? 'portail' : (c.teacher ? 'historique' : 'inconnue'),
    brut: ligne,
  }
}

// ── Écriture ───────────────────────────────────────────────────────────────

/**
 * La forme canonique de `contenu`. Les clés historiques ne sont plus écrites,
 * mais `lireDevoir` continue de les comprendre : les anciens devoirs restent
 * lisibles sans être réécrits.
 */
export const contenuCanonique = (saisie) => ({
  type: saisie.type || TYPE_PAR_DEFAUT,
  periode: saisie.periode || null,
  enonce: (saisie.enonce || '').trim() || null,
  bareme: (saisie.bareme || '').trim() || null,
  destinataire_mode: saisie.destinataireMode === 'choix' ? 'choix' : 'classe',
  eleve_ids: saisie.destinataireMode === 'choix' ? (saisie.eleveIds || []) : [],
})

// ── Règles ─────────────────────────────────────────────────────────────────

/**
 * Ce qui empêche l'enregistrement. Renvoie un message, ou null si tout va bien.
 * Rassemblé ici pour que l'écran et les tests jugent avec la même règle.
 */
export const refusDeSaisie = (saisie) => {
  if (!saisie.matiere) return 'Choisissez la matière.'
  if (!String(saisie.objectif || '').trim()) return "Indiquez l'objectif du devoir."
  // `date_rendu` est NOT NULL en base : sans ce contrôle, l'enregistrement
  // revenait avec « null value violates not-null constraint », que personne ne
  // peut interpréter.
  if (!saisie.dateRendu) return 'Indiquez la date de remise.'
  if (!saisie.classeId) return 'Sélectionnez d’abord une classe.'
  if (saisie.destinataireMode === 'choix' && !(saisie.eleveIds || []).length) {
    return 'Sélectionnez au moins un élève, ou choisissez toute la classe.'
  }
  return null
}

/** Un devoir concerne-t-il cet élève ? */
export const viseEleve = (devoir, eleveId) => {
  const d = devoir.destinataireMode ? devoir : lireDevoir(devoir)
  return d.destinataireMode === 'classe' || d.eleveIds.includes(String(eleveId))
}

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

// ── Deux espaces de clés, à ne pas confondre ───────────────────────────────
//
// La plateforme historique préfixait ses destinataires :
//
//   el:<uuid>        un élève inscrit, ligne de `eleves`
//   ins:<matricule>  un CANDIDAT, ligne de `inscriptions` — pas encore élève
//
// En début d'année, `inscriptions` est la seule source des nouveaux : un
// devoir pouvait légitimement viser un enfant qui n'avait pas encore de ligne
// dans `eleves`.
//
// Retirer les deux préfixes ferait cohabiter des UUID et des matricules dans
// la même liste. Un matricule ne correspondra JAMAIS à un `eleves.id` : le
// destinataire disparaîtrait silencieusement du ciblage. On les garde donc
// séparés — l'un ne peut pas se faire passer pour l'autre.
const idEleve = c => {
  const t = String(c || '')
  return t.startsWith('el:') ? t.slice(3) : (t.startsWith('ins:') ? null : t)
}
const matriculeCandidat = c => {
  const t = String(c || '')
  return t.startsWith('ins:') ? t.slice(4) : null
}

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
  const clesHist = elevesHist.map(e => e && e.cle)
  const eleveIds = Array.isArray(c.eleve_ids) && c.eleve_ids.length
    ? c.eleve_ids.map(idEleve).filter(Boolean)
    : clesHist.map(idEleve).filter(Boolean)
  // Les candidats visés, gardés à part : ils n'ont pas d'identifiant d'élève.
  // Deux écritures possibles, comme pour les élèves : la clé canonique
  // `candidat_matricules`, et les clés `ins:` de la forme historique.
  const candidatMatricules = Array.isArray(c.candidat_matricules) && c.candidat_matricules.length
    ? c.candidat_matricules.map(String)
    : clesHist.map(matriculeCandidat).filter(Boolean)

  // Les pièces jointes vivent à deux endroits : la colonne `fichiers` pour
  // l'écran intégré, `contenu.images` pour la plateforme historique.
  const images = Array.isArray(c.images) ? c.images : []
  const fichiers = Array.isArray(ligne?.fichiers) && ligne.fichiers.length
    ? ligne.fichiers
    : (ligne?.fichier_url ? [{ url: ligne.fichier_url, nom: ligne.fichier_nom }] : [])
  //
  // Les deux listes se recouvrent : la plateforme historique écrivait le même
  // fichier dans `fichiers` ET dans `contenu.images`. Mesuré sur les quatorze
  // devoirs, chaque pièce jointe était comptée deux fois — un devoir de deux
  // pages en annonçait quatre au parent. On dédoublonne sur l'URL, la seule
  // valeur identique dans les deux écritures.
  const piecesJointes = []
  const vues = new Set()
  for (const p of [...fichiers, ...images.map(u => ({ url: u, nom: null }))]) {
    if (!p || !p.url || vues.has(p.url)) continue
    vues.add(p.url)
    piecesJointes.push(p)
  }

  return {
    id: ligne?.id,
    classeId: ligne?.classe_id,
    // Le cours préparé auquel ce devoir se rattache, quand il y en a un.
    // FACULTATIF par construction : un devoir libre porte `null`, et reste un
    // devoir entier. Les quatorze devoirs déjà en base n'ont pas cette clé —
    // ils lisent donc `null`, sans rien changer pour eux.
    preparationId: (typeof c.preparation_id === 'string' && c.preparation_id.trim()) || null,
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
    candidatMatricules: mode === 'choix' ? candidatMatricules : [],
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

// ── L'auteur d'un nouveau devoir ───────────────────────────────────────────
//
// Treize devoirs sur quatorze n'ont pas d'auteur identifié : seulement un nom
// en clair dans `contenu.teacher`. Ces attributions restent telles quelles.
// On ne fabrique AUCUNE relation rétroactive à partir d'un nom — deux
// personnes peuvent porter le même, un nom se saisit à la main, et une
// attribution fausse est pire qu'une attribution absente.
//
// Pour les devoirs créés désormais, l'auteur ne vient ni d'un champ de
// formulaire ni du `localStorage` : il est demandé au serveur. `ideal_profil()`
// lit `auth.uid()` dans le jeton et renvoie le profil correspondant. Une
// valeur transmise par le client n'y change rien.
export async function auteurAuthentifie(client) {
  const { data, error } = await client.rpc('ideal_profil')
  const profil = Array.isArray(data) ? data[0] : data
  if (error) return { id: null, refus: `le serveur n'a pas confirmé votre identité (${error.message})` }
  if (!profil || !profil.id) {
    return { id: null, refus: "aucune session IDEAL active : reconnectez-vous avant d'enregistrer un devoir" }
  }
  return { id: profil.id, profil, refus: null }
}

// ── Regrouper à la RESTITUTION, jamais en base ─────────────────────────────
//
// L'ancienne plateforme créait une ligne PAR PHOTO : trois pages d'un même
// devoir de Mathematics font trois lignes. Les fusionner en base serait
// destructif et reposerait sur des présomptions. Les quatorze lignes restent
// donc intactes ; c'est l'AFFICHAGE qui les présente comme un seul devoir.
//
// Le regroupement n'a lieu que si tous les critères sûrs, déjà présents dans
// les données, coïncident — et uniquement entre devoirs HISTORIQUES. Deux
// devoirs créés par le portail ne sont jamais regroupés : le format canonique
// range déjà N pages dans une seule ligne.
//
// Dans le doute, on affiche séparément. Un devoir montré deux fois est une
// gêne ; deux devoirs différents présentés comme un seul est une erreur.
const cleRegroupement = (d) => {
  if (d.origine !== 'historique') return null
  // Un objectif vide ne dit rien : sans lui, deux devoirs de la même matière
  // le même jour seraient regroupés à tort.
  const objectif = String(d.objectif || '').trim().toLowerCase()
  if (!objectif) return null
  if (!d.matiere || !d.dateDonne) return null
  return [
    d.matiere, objectif, d.dateDonne, d.dateRendu || '',
    d.type || '', d.destinataireMode,
    [...d.eleveIds].sort().join('|'),
    [...d.candidatMatricules].sort().join('|'),
  ].join('§')
}

/**
 * Regroupe les lignes qui décrivent le même devoir physique multi-pages.
 * N'écrit rien, ne fusionne aucun identifiant, ne supprime rien : chaque
 * groupe garde la liste de ses lignes d'origine.
 */
export const regrouperPages = (devoirs) => {
  const groupes = []
  const parCle = new Map()
  for (const d of devoirs) {
    const cle = cleRegroupement(d)
    if (!cle) {
      // `pages: 1` était écrit en dur ici. Un devoir non regroupable — ce
      // qu'est TOUT devoir créé par le portail, dont le format range déjà N
      // pages dans une seule ligne — annonçait donc « 1 page jointe » au
      // parent, qu'il en porte une ou cinq. `pages` est le nombre réel de
      // feuilles, ici comme dans l'autre branche.
      groupes.push({ tete: d, lignes: [d], pages: d.piecesJointes.length, regroupe: false })
      continue
    }
    const deja = parCle.get(cle)
    if (deja) {
      deja.lignes.push(d)
      deja.regroupe = true
      // Les pièces des lignes réunies, dédoublonnées : une même photo pourrait
      // figurer dans deux lignes du groupe.
      const vues = new Set()
      deja.tete = { ...deja.tete, piecesJointes: deja.lignes
        .flatMap(x => x.piecesJointes)
        .filter(p => p && p.url && !vues.has(p.url) && vues.add(p.url)) }
      deja.pages = deja.tete.piecesJointes.length
      continue
    }
    // `pages` est le nombre réel de feuilles, pas le nombre de lignes : un
    // devoir sans pièce jointe en compte zéro et n'en annonce aucune.
    const g = { tete: d, lignes: [d], pages: d.piecesJointes.length, regroupe: false }
    parCle.set(cle, g)
    groupes.push(g)
  }
  return groupes
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
  // Les CANDIDATS visés — des enfants inscrits mais pas encore élèves, donc
  // sans identifiant dans `eleves`. La forme canonique les ignorait : rouvrir
  // un devoir historique pour corriger sa date et le réenregistrer effaçait
  // définitivement le candidat de son ciblage. Quatre devoirs en base visent
  // `ins:IDEAL-2027-008` et l'auraient perdu à la première retouche.
  candidat_matricules: saisie.destinataireMode === 'choix' ? (saisie.candidatMatricules || []) : [],
  // Le cours préparé de référence. `contenu` est une colonne JSON qui porte
  // déjà des clés libres : aucune migration n'est nécessaire pour ce lien.
  //
  // On enregistre l'IDENTIFIANT, jamais l'intitulé : celui-ci se relit sur la
  // préparation. Le recopier ici en ferait une deuxième vérité, qui vieillirait
  // dès la première correction du titre de la leçon.
  preparation_id: (typeof saisie.preparationId === 'string' && saisie.preparationId.trim()) || null,
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
export const viseEleve = (devoir, eleveId, matricule = null) => {
  const d = devoir.destinataireMode ? devoir : lireDevoir(devoir)
  if (d.destinataireMode === 'classe') return true
  if (d.eleveIds.includes(String(eleveId))) return true
  // Un devoir posé sur un candidat le vise encore une fois qu'il est devenu
  // élève : c'est son matricule qui fait le lien, pas son identifiant.
  return Boolean(matricule && d.candidatMatricules.includes(String(matricule)))
}

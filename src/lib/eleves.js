// Quelles colonnes d'un élève un écran a réellement besoin de charger.
//
// ── Pourquoi ce fichier existe ─────────────────────────────────────────────
//
// Mesuré le 24 août 2026, sur les douze élèves de la base :
//
//   select=*                                   1 701 Ko
//   les colonnes réellement affichées               2 Ko
//
// Huit cent cinquante fois moins. La totalité de l'écart tient dans une seule
// colonne, `photo_url`, et dans un seul élève : sa photo y est stockée en
// base64 — 1 735 280 octets — au lieu d'une référence au Storage.
//
// Six écrans faisaient `select('*')`. Cinq d'entre eux n'affichent aucune
// photo : ils téléchargeaient 1,7 Mo pour ne rien en faire, à chaque ouverture.
// Sur le réseau du personnel, c'est la différence entre une seconde et
// plusieurs minutes — le défaut que le promoteur observait sans pouvoir le
// nommer.
//
// ── Ce que ce fichier ne corrige pas ───────────────────────────────────────
//
// La photo reste en base64 dans la table. La déplacer vers le Storage est une
// migration de données, pas un changement d'écran ; elle reste à faire, et
// `CartesScolaires` continue de la charger parce qu'elle l'imprime.

// Ce qu'une liste d'élèves affiche : identité, classe, statut, cantine.
// Jamais la photo.
export const CHAMPS_ELEVE_LISTE = [
  'id', 'prenom', 'nom', 'sexe', 'classe_id', 'actif', 'matricule',
  'date_naissance', 'points_discipline', 'inscription_id',
  'cantine', 'allergies_connues', 'restrictions_alimentaires',
  'notes_alimentaires', 'declaration_alim_parent', 'fiche_alim_statut',
  'parent_nom', 'parent_phone', 'created_at',
].join(',')

// La même chose, avec le nom de la classe joint.
export const CHAMPS_ELEVE_AVEC_CLASSE = `${CHAMPS_ELEVE_LISTE},classes(nom)`

// Un élève dont on va imprimer la carte : la photo est alors nécessaire.
// À réserver au petit nombre — jamais pour une liste entière.
export const CHAMPS_ELEVE_AVEC_PHOTO = `${CHAMPS_ELEVE_LISTE},photo_url`

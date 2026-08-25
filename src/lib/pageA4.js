// La géométrie d'une feuille A4, en millimètres.
//
// Ces valeurs vivaient dans `DocumentPrintStudio.jsx`. Le cahier de devoirs
// en a besoin — une fiche jointe doit occuper exactement la hauteur utile
// d'une page — et les exporter depuis un fichier de composants casse le
// rechargement à chaud de Vite. Elles vivent donc ici, où les deux peuvent
// les lire.

export const A4 = { largeur: 210, hauteur: 297, marge: 14 }

// L'en-tête et le pied consomment de la hauteur : ils étaient oubliés, et le
// moteur croyait disposer de 223 mm là où la feuille n'en offre que 218. Il
// pouvait donc placer un bloc qui ne tenait pas tout à fait.
// Mesuré au banc d'essai — en-tête 33,4 mm, pied 9,6 mm — la réserve retenue
// reste prudente.
export const RESERVE_ENTETE_MM = 34
export const RESERVE_PIED_MM   = 12
export const ECARTS_MM         = 8      // deux gaps de 4 mm

export const HAUTEUR_UTILE_MM =
  A4.hauteur - 2 * A4.marge - RESERVE_ENTETE_MM - RESERVE_PIED_MM - ECARTS_MM

export const MM_EN_PX = 3.779528   // 1 mm à 96 dpi

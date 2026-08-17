// Programme officiel de Mathématiques CE1 — « La méthode de Singapour »
// (La Librairie des Écoles).
//
// L'année tient en deux fichiers de l'élève, et non en deux manuels : la
// numérotation des leçons court d'un bout à l'autre — le fichier 1 va de la
// leçon 1 à la leçon 76, le fichier 2 reprend à la leçon 77 et s'arrête à la
// 148. C'est donc un seul programme, une seule progression, un seul
// avancement. Seule la pagination repart de zéro : la page 6 existe dans les
// deux fichiers. D'où le champ `tome` sur chaque leçon — sans lui,
// « manuel p. 6 » désignerait deux séances différentes.
//
// La différence avec le CP1 et le CP2 de la même collection tient à cela :
// là-bas, deux volumes pour deux niveaux, donc deux manuels rattachés chacun
// à son groupe. Ici, deux fichiers pour une même année.
//
// Le livre classe ses unités en trois domaines, signalés par une couleur dans
// le sommaire imprimé. On les conserve dans `rubrique`, comme au CP2.
//
// L'avant-propos (fichier 1, p. 4) n'est pas au programme : il s'adresse à
// l'enseignant et aux parents, il ne se prépare pas comme une séance.
//
// Le groupe est « CE1-CE2 » parce que c'est ainsi que la classe figure dans
// l'emploi du temps — les deux niveaux y sont réunis. Le jour où le volume
// CE2 sera transcrit, il viendra s'ajouter sur le même couple (groupe,
// matière) comme second manuel, chacun gardant son avancement.

const NOMBRES = 'Nombres et calculs'
const MESURES = 'Grandeurs et mesures'
const ESPACE  = 'Espace et géométrie'

export default {
  cle: 'maths-ce1',
  groupe: 'CE1-CE2',
  matiere: 'Maths',
  langue: 'fr',
  titre: 'Mathématiques CE1 — La méthode de Singapour',

  // Ce livre appelle ses deux tomes des « fichiers » : c'est le mot imprimé
  // sur la couverture que l'élève a en main.
  libelleTome: 'fichier',

  unites: [
    {
      numero: 1,
      titre: "Les nombres jusqu'à 1 000",
      rubrique: `${NOMBRES} · fichier 1`,
      lecons: [
        { numero: 1,  tome: 1, titre: 'Utilisons les nombres', page: 6 },
        { numero: 2,  tome: 1, titre: 'Revoyons les nombres à deux chiffres', page: 8 },
        { numero: 3,  tome: 1, titre: 'Comparons les nombres à deux chiffres', page: 10 },
        { numero: 4,  tome: 1, titre: 'Comptons (1)', page: 11 },
        { numero: 5,  tome: 1, titre: 'Comptons (2)', page: 13 },
        { numero: 6,  tome: 1, titre: 'Comptons (3)', page: 15 },
        { numero: 7,  tome: 1, titre: 'Analysons les centaines, les dizaines et les unités (1)', page: 16 },
        { numero: 8,  tome: 1, titre: 'Analysons les centaines, les dizaines et les unités (2)', page: 19 },
        { numero: 9,  tome: 1, titre: 'Comparons et ordonnons les nombres (1)', page: 21 },
        { numero: 10, tome: 1, titre: 'Comparons et ordonnons les nombres (2)', page: 23 },
        { numero: 11, tome: 1, titre: 'Comparons et ordonnons les nombres (3)', page: 25 },
        { numero: 12, tome: 1, titre: 'Découvrons les nombres pairs et impairs', page: 26 },
        { numero: 13, tome: 1, titre: "Explorons d'autres suites de nombres", page: 28 },
        { numero: 14, tome: 1, titre: "Ce que j'ai appris", page: 31, bilan: true },
      ],
    },
    {
      numero: 2,
      titre: "L'addition et la soustraction jusqu'à 1 000",
      rubrique: `${NOMBRES} · fichier 1`,
      lecons: [
        { numero: 15, tome: 1, titre: 'Comprenons le sens des opérations (1)', page: 32 },
        { numero: 16, tome: 1, titre: 'Comprenons le sens des opérations (2)', page: 35 },
        { numero: 17, tome: 1, titre: 'Additionnons et soustrayons (1)', page: 37 },
        { numero: 18, tome: 1, titre: 'Additionnons et soustrayons (2)', page: 40 },
        { numero: 19, tome: 1, titre: 'Additionnons sans retenue (1)', page: 42 },
        { numero: 20, tome: 1, titre: 'Additionnons sans retenue (2)', page: 43 },
        { numero: 21, tome: 1, titre: 'Additionnons sans retenue (3)', page: 45 },
        { numero: 22, tome: 1, titre: 'Soustrayons sans retenue (1)', page: 46 },
        { numero: 23, tome: 1, titre: 'Soustrayons sans retenue (2)', page: 47 },
        { numero: 24, tome: 1, titre: 'Soustrayons sans retenue (3)', page: 49 },
        { numero: 25, tome: 1, titre: 'Additionnons avec retenue (1)', page: 50 },
        { numero: 26, tome: 1, titre: 'Additionnons avec retenue (2)', page: 52 },
        { numero: 27, tome: 1, titre: 'Additionnons avec retenue (3)', page: 54 },
        { numero: 28, tome: 1, titre: 'Additionnons avec retenue (4)', page: 55 },
        { numero: 29, tome: 1, titre: 'Soustrayons avec retenue (1)', page: 57 },
        { numero: 30, tome: 1, titre: 'Soustrayons avec retenue (2)', page: 59 },
        { numero: 31, tome: 1, titre: 'Soustrayons avec retenue (3)', page: 61 },
        { numero: 32, tome: 1, titre: 'Soustrayons avec retenue (4)', page: 62 },
        { numero: 33, tome: 1, titre: "Ce que j'ai appris", page: 64, bilan: true },
      ],
    },
    {
      numero: 3,
      titre: 'La longueur',
      rubrique: `${MESURES} · fichier 1`,
      lecons: [
        { numero: 34, tome: 1, titre: 'Mesurons les longueurs en mètres (1)', page: 66 },
        { numero: 35, tome: 1, titre: 'Mesurons les longueurs en mètres (2)', page: 68 },
        { numero: 36, tome: 1, titre: 'Mesurons les longueurs en centimètres (1)', page: 69 },
        { numero: 37, tome: 1, titre: 'Mesurons les longueurs en centimètres (2)', page: 71 },
        { numero: 38, tome: 1, titre: 'Mesurons les longueurs en mètres, en décimètres et en centimètres', page: 73 },
        { numero: 39, tome: 1, titre: 'Mesurons les distances en kilomètres', page: 74 },
        { numero: 40, tome: 1, titre: 'Résolvons des problèmes (1)', page: 75 },
        { numero: 41, tome: 1, titre: 'Résolvons des problèmes (2)', page: 76 },
        { numero: 42, tome: 1, titre: "Ce que j'ai appris", page: 77, bilan: true },
      ],
    },
    {
      numero: 4,
      titre: 'La multiplication et la division',
      rubrique: `${NOMBRES} · fichier 1`,
      lecons: [
        { numero: 43, tome: 1, titre: 'Multiplions (1)', page: 78 },
        { numero: 44, tome: 1, titre: 'Multiplions (2)', page: 80 },
        { numero: 45, tome: 1, titre: 'Multiplions (3)', page: 81 },
        { numero: 46, tome: 1, titre: 'Multiplions (4)', page: 82 },
        { numero: 47, tome: 1, titre: 'Pouvons-nous multiplier ?', page: 83 },
        { numero: 48, tome: 1, titre: 'Divisons (situations de partages)', page: 85 },
        { numero: 49, tome: 1, titre: 'Divisons (situations de groupements)', page: 86 },
        { numero: 50, tome: 1, titre: 'Divisons (1)', page: 87 },
        { numero: 51, tome: 1, titre: 'Divisons (2)', page: 89 },
        { numero: 52, tome: 1, titre: 'Divisons (3)', page: 90 },
        { numero: 53, tome: 1, titre: "Ce que j'ai appris", page: 91, bilan: true },
      ],
    },
    {
      numero: 5,
      titre: 'La multiplication et la division par 2, 5 et 10',
      rubrique: `${NOMBRES} · fichier 1`,
      lecons: [
        { numero: 54, tome: 1, titre: 'Calculons des doubles', page: 92 },
        { numero: 55, tome: 1, titre: 'Comptons de 2 en 2', page: 94 },
        { numero: 56, tome: 1, titre: 'Multiplions : la table de 2', page: 96 },
        { numero: 57, tome: 1, titre: 'Divisons par 2', page: 98 },
        { numero: 58, tome: 1, titre: 'Multiplions : la table de 5 (1)', page: 100 },
        { numero: 59, tome: 1, titre: 'Multiplions : la table de 5 (2)', page: 101 },
        { numero: 60, tome: 1, titre: 'Divisons par 5', page: 102 },
        { numero: 61, tome: 1, titre: 'Multiplions : la table de 10 (1)', page: 104 },
        { numero: 62, tome: 1, titre: 'Multiplions : la table de 10 (2)', page: 105 },
        { numero: 63, tome: 1, titre: 'Divisons par 10', page: 106 },
        { numero: 64, tome: 1, titre: 'Résolvons des problèmes de multiplications', page: 108 },
        { numero: 65, tome: 1, titre: 'Résolvons des problèmes de divisions', page: 110 },
        { numero: 66, tome: 1, titre: 'Multiplier ou diviser ?', page: 112 },
        { numero: 67, tome: 1, titre: "Ce que j'ai appris", page: 113, bilan: true },
      ],
    },
    {
      numero: 6,
      titre: "Le repérage dans l'espace",
      rubrique: `${ESPACE} · fichier 1`,
      lecons: [
        { numero: 68, tome: 1, titre: 'Lisons un plan et sa légende', page: 114 },
        { numero: 69, tome: 1, titre: 'Repérons-nous sur un plan', page: 117 },
        { numero: 70, tome: 1, titre: 'Déplaçons-nous sur un plan', page: 118 },
        { numero: 71, tome: 1, titre: 'Identifions les points de vue', page: 120 },
        { numero: 72, tome: 1, titre: "Ce que j'ai appris", page: 123, bilan: true },
      ],
    },
    {
      numero: 7,
      titre: 'Les tableaux',
      rubrique: `${NOMBRES} · fichier 1`,
      lecons: [
        { numero: 73, tome: 1, titre: 'Analysons des tableaux (1)', page: 124 },
        { numero: 74, tome: 1, titre: 'Analysons des tableaux (2)', page: 126 },
        { numero: 75, tome: 1, titre: 'Analysons des tableaux (3)', page: 127 },
        { numero: 76, tome: 1, titre: "Ce que j'ai appris", page: 128, bilan: true },
      ],
    },

    // ── Fichier 2 — la pagination repart à 6, la numérotation continue ──────
    {
      numero: 8,
      titre: 'La multiplication et la division par 3 et 4',
      rubrique: `${NOMBRES} · fichier 2`,
      lecons: [
        { numero: 77, tome: 2, titre: 'Comptons de 3 en 3', page: 6 },
        { numero: 78, tome: 2, titre: 'Multiplions : la table de 3', page: 9 },
        { numero: 79, tome: 2, titre: 'Divisons par 3', page: 10 },
        { numero: 80, tome: 2, titre: 'Comptons de 4 en 4', page: 12 },
        { numero: 81, tome: 2, titre: 'Multiplions : la table de 4', page: 14 },
        { numero: 82, tome: 2, titre: 'Divisons par 4', page: 15 },
        { numero: 83, tome: 2, titre: 'Multiplions en utilisant les familles de nombres', page: 17 },
        { numero: 84, tome: 2, titre: 'Résolvons des problèmes de multiplications', page: 18 },
        { numero: 85, tome: 2, titre: 'Résolvons des problèmes de divisions', page: 19 },
        { numero: 86, tome: 2, titre: 'Multiplier ou diviser ?', page: 20 },
        { numero: 87, tome: 2, titre: "Ce que j'ai appris", page: 21, bilan: true },
      ],
    },
    {
      numero: 9,
      titre: 'Les modèles en barres',
      rubrique: `${NOMBRES} · fichier 2`,
      lecons: [
        { numero: 88, tome: 2, titre: 'Cherchons le tout ou une partie', page: 22 },
        { numero: 89, tome: 2, titre: 'Ajoutons ou retranchons', page: 25 },
        { numero: 90, tome: 2, titre: 'Comparons', page: 27 },
        { numero: 91, tome: 2, titre: 'Résolvons des problèmes', page: 28 },
        { numero: 92, tome: 2, titre: 'Résolvons des problèmes à deux étapes (1)', page: 29 },
        { numero: 93, tome: 2, titre: 'Résolvons des problèmes à deux étapes (2)', page: 30 },
        { numero: 94, tome: 2, titre: "Ce que j'ai appris", page: 31, bilan: true },
      ],
    },
    {
      numero: 10,
      titre: 'La masse',
      rubrique: `${MESURES} · fichier 2`,
      lecons: [
        { numero: 95,  tome: 2, titre: 'Comparons et ordonnons les masses', page: 32 },
        { numero: 96,  tome: 2, titre: 'Mesurons les masses en kilogrammes (1)', page: 36 },
        { numero: 97,  tome: 2, titre: 'Mesurons les masses en kilogrammes (2)', page: 38 },
        { numero: 98,  tome: 2, titre: 'Mesurons les masses en grammes (1)', page: 41 },
        { numero: 99,  tome: 2, titre: 'Mesurons les masses en grammes (2)', page: 43 },
        { numero: 100, tome: 2, titre: 'Résolvons des problèmes (1)', page: 45 },
        { numero: 101, tome: 2, titre: 'Résolvons des problèmes (2)', page: 46 },
        { numero: 102, tome: 2, titre: "Ce que j'ai appris", page: 47, bilan: true },
      ],
    },
    {
      numero: 11,
      titre: 'Les euros',
      rubrique: `${MESURES} · fichier 2`,
      lecons: [
        { numero: 103, tome: 2, titre: 'Les euros et les centimes (1)', page: 48 },
        { numero: 104, tome: 2, titre: 'Les euros et les centimes (2)', page: 51 },
        { numero: 105, tome: 2, titre: 'Les euros et les centimes (3)', page: 52 },
        { numero: 106, tome: 2, titre: "Comparons des sommes d'argent", page: 53 },
        { numero: 107, tome: 2, titre: "Additionnons et soustrayons des sommes d'argent", page: 55 },
        { numero: 108, tome: 2, titre: 'Résolvons des problèmes (1)', page: 57 },
        { numero: 109, tome: 2, titre: 'Résolvons des problèmes (2)', page: 59 },
        { numero: 110, tome: 2, titre: "Ce que j'ai appris", page: 61, bilan: true },
      ],
    },
    {
      numero: 12,
      titre: 'Les formes',
      rubrique: `${ESPACE} · fichier 2`,
      lecons: [
        { numero: 111, tome: 2, titre: 'Découvrons les disques (1)', page: 62 },
        { numero: 112, tome: 2, titre: 'Découvrons les disques (2)', page: 65 },
        { numero: 113, tome: 2, titre: 'Lignes droites et lignes courbes', page: 66 },
        { numero: 114, tome: 2, titre: 'Décrivons des figures', page: 68 },
        { numero: 115, tome: 2, titre: 'Créons des figures (1)', page: 70 },
        { numero: 116, tome: 2, titre: 'Créons des figures (2)', page: 72 },
        { numero: 117, tome: 2, titre: 'Reproduisons des figures', page: 73 },
        { numero: 118, tome: 2, titre: 'Décrivons des solides', page: 74 },
        { numero: 119, tome: 2, titre: 'Faces, arêtes et sommets (1)', page: 76 },
        { numero: 120, tome: 2, titre: 'Faces, arêtes et sommets (2)', page: 77 },
        { numero: 121, tome: 2, titre: 'Classons des solides', page: 78 },
        { numero: 122, tome: 2, titre: 'Créons des structures avec des solides', page: 80 },
        { numero: 123, tome: 2, titre: 'Créons des suites de figures', page: 82 },
        { numero: 124, tome: 2, titre: 'Créons des suites de solides', page: 85 },
        { numero: 125, tome: 2, titre: "Ce que j'ai appris", page: 88, bilan: true },
      ],
    },
    {
      numero: 13,
      titre: 'Les fractions',
      rubrique: `${NOMBRES} · fichier 2`,
      lecons: [
        { numero: 126, tome: 2, titre: 'Découvrons les fractions', page: 90 },
        { numero: 127, tome: 2, titre: 'Écrivons les fractions (1)', page: 93 },
        { numero: 128, tome: 2, titre: 'Écrivons les fractions (2)', page: 95 },
        { numero: 129, tome: 2, titre: "Les parties et le tout d'une fraction (1)", page: 96 },
        { numero: 130, tome: 2, titre: "Les parties et le tout d'une fraction (2)", page: 98 },
        { numero: 131, tome: 2, titre: 'Comparons et ordonnons les fractions (1)', page: 99 },
        { numero: 132, tome: 2, titre: 'Comparons et ordonnons les fractions (2)', page: 101 },
        { numero: 133, tome: 2, titre: 'Additionnons les fractions', page: 102 },
        { numero: 134, tome: 2, titre: 'Soustrayons les fractions', page: 104 },
        { numero: 135, tome: 2, titre: "Ce que j'ai appris", page: 106, bilan: true },
      ],
    },
    {
      numero: 14,
      titre: "L'heure",
      rubrique: `${MESURES} · fichier 2`,
      lecons: [
        { numero: 136, tome: 2, titre: 'Lisons les heures (1)', page: 108 },
        { numero: 137, tome: 2, titre: 'Lisons les heures (2)', page: 110 },
        { numero: 138, tome: 2, titre: 'Lisons les heures et les minutes', page: 111 },
        { numero: 139, tome: 2, titre: 'Calculons la durée (1)', page: 113 },
        { numero: 140, tome: 2, titre: 'Calculons la durée (2)', page: 115 },
        { numero: 141, tome: 2, titre: "Ce que j'ai appris", page: 117, bilan: true },
      ],
    },
    {
      numero: 15,
      titre: 'La contenance et le volume',
      rubrique: `${MESURES} · fichier 2`,
      lecons: [
        { numero: 142, tome: 2, titre: 'Comparons et ordonnons les contenances', page: 118 },
        { numero: 143, tome: 2, titre: 'Comparons et ordonnons les volumes', page: 121 },
        { numero: 144, tome: 2, titre: 'Mesurons en litres', page: 122 },
        { numero: 145, tome: 2, titre: 'Résolvons des problèmes (1)', page: 123 },
        { numero: 146, tome: 2, titre: 'Résolvons des problèmes (2)', page: 125 },
        { numero: 147, tome: 2, titre: 'Résolvons des problèmes (3)', page: 126 },
        { numero: 148, tome: 2, titre: "Ce que j'ai appris", page: 128, bilan: true },
      ],
    },
  ],
}

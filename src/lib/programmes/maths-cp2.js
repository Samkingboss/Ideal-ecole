// Programme officiel de Mathématiques CP2 — sommaire du manuel de l'élève.
//
// C'est le second volume de la même collection que le CP1 : la numérotation
// des unités et des leçons continue (unité 8, leçon 65), mais la pagination
// repart à 7. Les deux livres restent donc deux manuels distincts, chacun
// rattaché à son groupe.
//
// Contrairement au premier volume, ce sommaire ne saute aucun numéro : chaque
// unité s'ouvre par un « Observons l'image » numéroté et se referme par un
// « Ce que j'ai appris », qui tient ici le rôle du bilan.
//
// Le livre classe ses unités en trois domaines, signalés par une couleur dans
// le sommaire imprimé. On les conserve dans `rubrique` — le champ que tout
// manuel utilise pour la mention imprimée au-dessus de ses unités.

const NOMBRES = 'Nombres et calculs'
const MESURES = 'Grandeurs et mesures'
const ESPACE  = 'Espace et géométrie'

export default {
  cle: 'maths-cp2',
  groupe: 'CP2',
  matiere: 'Maths',
  langue: 'fr',
  titre: 'Mathématiques CP2 — La méthode de Singapour',

  unites: [
    {
      numero: 8,
      titre: 'La longueur',
      rubrique: MESURES,
      lecons: [
        { numero: 65, titre: "Observons l'image", page: 7 },
        { numero: 66, titre: 'Comparons et ordonnons des longueurs', page: 8 },
        { numero: 67, titre: 'Estimons et mesurons des longueurs', page: 10 },
        { numero: 68, titre: "Trouvons la moitié et le double d'une longueur", page: 12 },
        { numero: 69, titre: 'Mesurons les longueurs en mètres et en centimètres', page: 14 },
        { numero: 70, titre: 'Traçons des segments', page: 16 },
        { numero: 71, titre: "Ce que j'ai appris", page: 18, bilan: true },
      ],
    },
    {
      numero: 9,
      titre: "Les nombres jusqu'à 69",
      rubrique: NOMBRES,
      lecons: [
        { numero: 72, titre: "Observons l'image", page: 19 },
        { numero: 73, titre: 'Les nombres de 20 à 40', page: 20 },
        { numero: 74, titre: 'Les nombres de 40 à 69', page: 22 },
        { numero: 75, titre: 'Comptons en faisant des groupes de 10', page: 24 },
        { numero: 76, titre: 'Dizaines et unités', page: 26 },
        { numero: 77, titre: 'Comptons de 1 en 1, comptons de 10 en 10', page: 28 },
        { numero: 78, titre: 'Comparons deux nombres', page: 30 },
        { numero: 79, titre: 'Comparons et ordonnons des nombres', page: 32 },
        { numero: 80, titre: "Ce que j'ai appris", page: 34, bilan: true },
      ],
    },
    {
      numero: 10,
      titre: 'La masse',
      rubrique: MESURES,
      lecons: [
        { numero: 81, titre: "Observons l'image", page: 35 },
        { numero: 82, titre: 'Comparons des masses', page: 36 },
        { numero: 83, titre: 'Découvrons la balance Roberval', page: 38 },
        { numero: 84, titre: "Ce que j'ai appris", page: 40, bilan: true },
      ],
    },
    {
      numero: 11,
      titre: "L'addition et la soustraction jusqu'à 69",
      rubrique: NOMBRES,
      lecons: [
        { numero: 85, titre: "Observons l'image", page: 41 },
        { numero: 86, titre: 'Additionnons des unités', page: 42 },
        { numero: 87, titre: 'Soustrayons des unités', page: 44 },
        { numero: 88, titre: 'Additionnons des dizaines', page: 46 },
        { numero: 89, titre: 'Soustrayons des dizaines', page: 48 },
        { numero: 90, titre: 'Additionnons des dizaines et des unités', page: 50 },
        { numero: 91, titre: 'Soustrayons des dizaines et des unités', page: 52 },
        { numero: 92, titre: 'Additionnons en échangeant 10 unités contre 1 dizaine', page: 54 },
        { numero: 93, titre: 'Résolvons des problèmes', page: 56 },
        { numero: 94, titre: "Ce que j'ai appris", page: 58, bilan: true },
      ],
    },
    {
      numero: 12,
      titre: "Le repérage dans l'espace",
      rubrique: ESPACE,
      lecons: [
        { numero: 95, titre: "Observons l'image", page: 59 },
        { numero: 96, titre: 'Repérons-nous sur un plan ou sur un dessin', page: 60 },
        { numero: 97, titre: "Repérons-nous sur les cases d'un quadrillage", page: 62 },
        { numero: 98, titre: 'Codons des déplacements', page: 64 },
        { numero: 99, titre: "Ce que j'ai appris", page: 66, bilan: true },
      ],
    },
    {
      numero: 13,
      titre: "Les nombres jusqu'à 100",
      rubrique: NOMBRES,
      lecons: [
        { numero: 100, titre: "Observons l'image", page: 67 },
        { numero: 101, titre: 'Les nombres de 70 à 100', page: 68 },
        { numero: 102, titre: 'Revoyons les dizaines et les unités', page: 70 },
        { numero: 103, titre: 'Le tableau des nombres de 1 à 100', page: 72 },
        { numero: 104, titre: "Additionnons des nombres jusqu'à 100", page: 74 },
        { numero: 105, titre: "Soustrayons des nombres jusqu'à 100", page: 76 },
        { numero: 106, titre: 'Résolvons des problèmes', page: 78 },
        { numero: 107, titre: "Ce que j'ai appris", page: 80, bilan: true },
      ],
    },
    {
      numero: 14,
      titre: "L'heure",
      rubrique: MESURES,
      lecons: [
        { numero: 108, titre: "Observons l'image", page: 81 },
        { numero: 109, titre: "Lisons l'heure (1)", page: 82 },
        { numero: 110, titre: "Lisons l'heure (2)", page: 84 },
        { numero: 111, titre: 'Utilisons une horloge', page: 86 },
        { numero: 112, titre: "Ce que j'ai appris", page: 88, bilan: true },
      ],
    },
    {
      numero: 15,
      titre: 'La multiplication et la division',
      rubrique: NOMBRES,
      lecons: [
        { numero: 113, titre: "Observons l'image", page: 89 },
        { numero: 114, titre: 'Additionnons des groupes égaux', page: 90 },
        { numero: 115, titre: 'Inventons des histoires de multiplications', page: 92 },
        { numero: 116, titre: 'Multiplions', page: 94 },
        { numero: 117, titre: 'Divisons en partageant', page: 96 },
        { numero: 118, titre: 'Divisons en groupant', page: 98 },
        { numero: 119, titre: "Ce que j'ai appris", page: 100, bilan: true },
      ],
    },
    {
      numero: 16,
      titre: 'Les euros',
      rubrique: MESURES,
      lecons: [
        { numero: 120, titre: "Observons l'image", page: 101 },
        { numero: 121, titre: 'Les pièces et les billets', page: 102 },
        { numero: 122, titre: 'Les achats', page: 104 },
        { numero: 123, titre: "Ce que j'ai appris", page: 106, bilan: true },
      ],
    },
    {
      numero: 17,
      titre: 'Les tableaux',
      rubrique: NOMBRES,
      lecons: [
        { numero: 124, titre: "Observons l'image", page: 107 },
        { numero: 125, titre: 'Découvrons les tableaux', page: 108 },
        { numero: 126, titre: 'Analysons et construisons des tableaux', page: 110 },
        { numero: 127, titre: "Ce que j'ai appris", page: 112, bilan: true },
      ],
    },
  ],
}

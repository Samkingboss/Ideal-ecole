// Programme officiel de Mathématiques CP1 (cours en français) — sommaire du
// manuel de l'élève, transcrit à l'identique.
//
// Pourquoi un fichier et non une table : ce programme est le sommaire d'un
// livre imprimé. Il ne change pas en cours d'année, il ne se saisit pas, il ne
// se supprime pas. Le mettre en base obligerait à un script DDL (impossible par
// l'API, cf. docs/etat-des-lieux.md § 5.1) et exposerait à une suppression
// accidentelle un référentiel qui doit rester fidèle au livre que l'enfant a
// entre les mains. Il vit donc dans le dépôt, versionné, relisible.
//
// L'avancement, lui, est bien une donnée : il se lit dans les préparations
// déposées (`preparations.contenu.programme`), jamais ici.
//
// Les numéros sont ceux imprimés dans le manuel — ils sautent (8, 14, 24, 35,
// 43, 53) parce que ces numéros portent les pages d'ouverture d'unité, qui ne
// sont pas des leçons. On garde la numérotation du livre telle quelle : c'est
// elle que l'enseignant et l'élève ont sous les yeux.

export default {
  cle: 'maths-cp1',
  groupe: 'CP1',
  matiere: 'Maths',
  langue: 'fr',
  // Titre exact et édition à confirmer par le directeur avant impression.
  titre: 'Mathématiques CP1',

  unites: [
    {
      numero: 1,
      titre: 'Les nombres de 0 à 10',
      lecons: [
        { numero: 2, titre: 'Comptons', page: 6 },
        { numero: 3, titre: 'Relions pour comparer', page: 8 },
        { numero: 4, titre: 'Comparons', page: 10 },
        { numero: 5, titre: 'Représentons les nombres et comparons (1)', page: 12 },
        { numero: 6, titre: 'Représentons les nombres et comparons (2)', page: 14 },
        { numero: 7, titre: "Bilan de l'unité 1", page: 16, bilan: true, journal: 18 },
      ],
    },
    {
      numero: 2,
      titre: 'Les familles de nombres',
      lecons: [
        { numero: 9,  titre: 'Inventons des histoires de nombres', page: 19 },
        { numero: 10, titre: 'Cherchons les familles de 6 et de 7', page: 20 },
        { numero: 11, titre: 'Cherchons les familles de 8 et de 9', page: 22 },
        { numero: 12, titre: 'Cherchons les familles de 10', page: 25 },
        { numero: 13, titre: "Bilan de l'unité 2", page: 28, bilan: true, journal: 30 },
      ],
    },
    {
      numero: 3,
      titre: "L'addition",
      lecons: [
        { numero: 15, titre: "Découvrons des histoires d'additions", page: 31 },
        { numero: 16, titre: "Inventons des histoires d'additions", page: 33 },
        { numero: 17, titre: 'Additionnons avec les familles de nombres (1)', page: 35 },
        { numero: 18, titre: 'Additionnons avec les familles de nombres (2)', page: 37 },
        { numero: 19, titre: 'Additionnons sur la bande numérique', page: 40 },
        { numero: 20, titre: "Additionnons à l'aide de dessins", page: 42 },
        { numero: 21, titre: "Revoyons les additions jusqu'à 10", page: 44 },
        { numero: 22, titre: 'Résolvons des problèmes', page: 47 },
        { numero: 23, titre: "Bilan de l'unité 3", page: 49, bilan: true, journal: 53 },
      ],
    },
    {
      numero: 4,
      titre: 'La soustraction',
      lecons: [
        { numero: 25, titre: 'Découvrons des histoires de soustractions', page: 54 },
        { numero: 26, titre: 'Inventons des histoires de soustractions', page: 56 },
        { numero: 27, titre: 'Soustrayons avec les familles de nombres', page: 58 },
        { numero: 28, titre: 'Soustrayons sur la bande numérique', page: 60 },
        { numero: 29, titre: "Soustrayons à l'aide de dessins", page: 62 },
        { numero: 30, titre: 'Égalités dans les familles de nombres (1)', page: 64 },
        { numero: 31, titre: 'Égalités dans les familles de nombres (2)', page: 66 },
        { numero: 32, titre: 'Résolvons des problèmes (1)', page: 68 },
        { numero: 33, titre: 'Résolvons des problèmes (2)', page: 70 },
        { numero: 34, titre: "Bilan de l'unité 4", page: 72, bilan: true, journal: 74 },
      ],
    },
    {
      numero: 5,
      titre: 'Les formes',
      lecons: [
        { numero: 36, titre: 'Identifions les figures', page: 75 },
        { numero: 37, titre: 'Nommons les figures', page: 77 },
        { numero: 38, titre: 'Créons des figures', page: 81 },
        { numero: 39, titre: 'Traçons des figures', page: 85 },
        { numero: 40, titre: 'Nommons les solides', page: 87 },
        { numero: 41, titre: 'Solides et figures', page: 90 },
        { numero: 42, titre: "Bilan de l'unité 5", page: 92, bilan: true, journal: 94 },
      ],
    },
    {
      numero: 6,
      titre: "Les nombres jusqu'à 20",
      lecons: [
        { numero: 44, titre: 'Les nombres de 11 à 16', page: 95 },
        { numero: 45, titre: 'Les nombres de 17 à 20', page: 97 },
        { numero: 46, titre: 'Comptons et comptons à rebours', page: 100 },
        { numero: 47, titre: 'Comptons en faisant un groupe de 10', page: 103 },
        { numero: 48, titre: 'Comparons deux nombres', page: 105 },
        { numero: 49, titre: 'Comparons deux nombres par soustraction', page: 107 },
        { numero: 50, titre: 'Comparons et ordonnons trois nombres ou plus', page: 109 },
        { numero: 51, titre: 'Découvrons les nombres ordinaux', page: 112 },
        { numero: 52, titre: "Bilan de l'unité 6", page: 114, bilan: true, journal: 116 },
      ],
    },
    {
      numero: 7,
      titre: "L'addition et la soustraction jusqu'à 20",
      lecons: [
        { numero: 54, titre: 'Additionnons sur la bande numérique', page: 117 },
        { numero: 55, titre: 'Additionnons en décomposant un des nombres', page: 119 },
        { numero: 56, titre: 'Additionnons en décomposant le plus grand nombre', page: 121 },
        { numero: 57, titre: 'Additionnons trois nombres', page: 123 },
        { numero: 58, titre: 'Soustrayons sur la bande numérique', page: 125 },
        { numero: 59, titre: 'Soustrayons en décomposant le plus grand nombre (1)', page: 127 },
        { numero: 60, titre: 'Soustrayons en décomposant le plus grand nombre (2)', page: 129 },
        { numero: 61, titre: 'Revoyons les familles de nombres', page: 131 },
        { numero: 62, titre: 'Résolvons des problèmes (1)', page: 133 },
        { numero: 63, titre: 'Résolvons des problèmes (2)', page: 135 },
        { numero: 64, titre: "Bilan de l'unité 7", page: 137, bilan: true, journal: 139 },
      ],
    },
  ],
}

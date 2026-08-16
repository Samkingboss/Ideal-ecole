// Programme officiel de Lecture CP1 — sommaire du manuel « Pas à Pas, je lis ».
//
// Ce manuel n'est pas bâti comme celui de maths : pas d'unités, pas de leçons
// numérotées, mais une progression continue en 24 étapes, chacune couvrant une
// plage de pages. Les pages s'enchaînent sans trou de la page 5 à la page 129.
//
// L'identifiant d'une étape est donc sa **page de début**, et non un rang.
// C'est ce qui la rend stable : corriger une plage ou en insérer une plus tard
// ne renumérote pas les étapes déjà visées par des préparations déposées.
//
// Les deux « mots outils » sont signalés en rouge dans le sommaire : ce sont
// des étapes courtes de deux pages, d'une autre nature que la syllabation. On
// garde la distinction, elle guide la préparation.

export default {
  cle: 'lecture-cp1',
  groupe: 'CP1',
  matiere: 'Lecture',
  langue: 'fr',
  titre: 'Pas à Pas, je lis — CP1',

  // Le livre ne numérote pas ses étapes : l'écran les désigne par leurs pages.
  numerote: false,

  lecons: [
    { numero: 5,   titre: 'La voyelle « I »',    page: 5,   pageFin: 9 },
    { numero: 10,  titre: 'La voyelle « U »',    page: 10,  pageFin: 15 },
    { numero: 16,  titre: 'La voyelle « O »',    page: 16,  pageFin: 20 },
    { numero: 21,  titre: 'La voyelle « A »',    page: 21,  pageFin: 25 },
    { numero: 26,  titre: 'La voyelle « E »',    page: 26,  pageFin: 30 },
    { numero: 31,  titre: 'É è ê',               page: 31,  pageFin: 35 },
    { numero: 36,  titre: 'Syllabation avec P',  page: 36,  pageFin: 41 },
    { numero: 42,  titre: 'Syllabation avec T',  page: 42,  pageFin: 50 },
    { numero: 51,  titre: 'Mot outil « est »',   page: 51,  pageFin: 52, motOutil: true },
    { numero: 53,  titre: 'Syllabation avec M',  page: 53,  pageFin: 58 },
    { numero: 59,  titre: 'Syllabation avec L',  page: 59,  pageFin: 64 },
    { numero: 65,  titre: 'Syllabation avec N',  page: 65,  pageFin: 70 },
    { numero: 71,  titre: 'Syllabation avec S',  page: 71,  pageFin: 76 },
    { numero: 77,  titre: 'Mot outil « et »',    page: 77,  pageFin: 78, motOutil: true },
    { numero: 79,  titre: 'Syllabation avec D',  page: 79,  pageFin: 84 },
    { numero: 85,  titre: 'Syllabation avec R',  page: 85,  pageFin: 90 },
    { numero: 91,  titre: 'Syllabation avec V',  page: 91,  pageFin: 96 },
    { numero: 97,  titre: 'Syllabation avec C',  page: 97,  pageFin: 102 },
    { numero: 103, titre: 'Syllabation avec K',  page: 103, pageFin: 107 },
    { numero: 108, titre: 'Syllabation avec B',  page: 108, pageFin: 113 },
    { numero: 114, titre: 'Syllabation avec F',  page: 114, pageFin: 118 },
    { numero: 119, titre: 'Syllabation avec G',  page: 119, pageFin: 122 },
    { numero: 123, titre: 'Syllabation avec J',  page: 123, pageFin: 127 },
    { numero: 128, titre: 'Lecture libre',       page: 128, pageFin: 129 },
  ],
}

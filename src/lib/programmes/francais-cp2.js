// Programme officiel de Français CP2 — « Les Petits Devoirs · Français »
// (La Librairie des Écoles).
//
// Livre numéroté sans découpage en unités : 58 leçons qui se suivent, paginées
// de deux en deux (leçon 1 p. 4, leçon 2 p. 6…). Chaque leçon occupe donc une
// double page. Comme pour les autres manuels, on ne transcrit que la page
// imprimée au sommaire.
//
// Deux annexes du sommaire ne figurent pas dans le programme : le « Mémento :
// analyse grammaticale » (p. 124) et les « Dictées » (p. 126). Ni l'un ni
// l'autre n'est une leçon numérotée du livre. Le mémento est une page de
// référence ; les dictées sont un réservoir d'exercices où l'on puise tout au
// long de l'année, pas une étape du parcours. Les compter aurait fausse
// l'avancement. Si le directeur veut que les dictées se préparent comme des
// séances, il suffira de les ajouter ici.
//
// Deux fidélités au sommaire imprimé, signalées pour qu'on ne les « corrige »
// pas par erreur plus tard :
//   - la leçon 24 s'intitule comme la 23 sans le « (1) ». Le livre ne porte
//     pas « (2) », on ne l'invente pas.
//   - le sommaire écrit « La lettres s » à la leçon 5 : coquille manifeste du
//     livre, rétablie en « La lettre s ».

export default {
  cle: 'francais-cp2',
  groupe: 'CP2',
  matiere: 'Français',
  langue: 'fr',
  titre: 'Les Petits Devoirs — Français',

  lecons: [
    { numero: 1,  titre: 'Les mots, les syllabes, les lettres', page: 4 },
    { numero: 2,  titre: 'Les accents', page: 6 },
    { numero: 3,  titre: 'La lettre e : le son « è »', page: 8 },
    { numero: 4,  titre: 'n = m devant m, b, p', page: 10 },
    { numero: 5,  titre: 'La lettre s : le son « z » et le son « ss »', page: 12 },
    { numero: 6,  titre: 'La lettre g : le son « g » et le son « j »', page: 14 },
    { numero: 7,  titre: 'Les mots en ill', page: 16 },
    { numero: 8,  titre: 'Les mots en ay, oy, uy', page: 18 },
    { numero: 9,  titre: 'Le son « s » : ce, ci, cy — ça, ço, çu', page: 20 },
    { numero: 10, titre: 'La phrase simple', page: 22 },
    { numero: 11, titre: "L'écriture des majuscules", page: 24 },
    { numero: 12, titre: 'Le nom commun et le nom propre', page: 26 },
    { numero: 13, titre: 'Le genre du nom', page: 28 },
    { numero: 14, titre: 'Le nombre du nom', page: 30 },
    { numero: 15, titre: 'Les articles définis et indéfinis', page: 32 },
    { numero: 16, titre: 'La règle du féminin des noms', page: 34 },
    { numero: 17, titre: 'Le féminin des noms terminés par l, n, t', page: 36 },
    { numero: 18, titre: 'Règles particulières du féminin des noms', page: 38 },
    { numero: 19, titre: 'Les noms féminins en aille, eille, euille, ouille', page: 40 },
    { numero: 20, titre: 'Le féminin des noms en er et en ier', page: 42 },
    { numero: 21, titre: 'Le féminin des noms en eur et teur', page: 44 },
    { numero: 22, titre: "L'adjectif qualificatif", page: 46 },
    { numero: 23, titre: "Le féminin de l'adjectif qualificatif (1)", page: 48 },
    { numero: 24, titre: "Le féminin de l'adjectif qualificatif", page: 50 },
    { numero: 25, titre: "Trouver la lettre finale d'un nom ou d'un adjectif", page: 52 },
    { numero: 26, titre: 'Le pluriel des noms', page: 54 },
    { numero: 27, titre: 'Le verbe et son sujet', page: 56 },
    { numero: 28, titre: 'Le pluriel des noms en eau et eu', page: 58 },
    { numero: 29, titre: 'Le pluriel des noms en al', page: 60 },
    { numero: 30, titre: 'Le pluriel des noms en ou', page: 62 },
    { numero: 31, titre: 'Le pluriel des adjectifs (s)', page: 64 },
    { numero: 32, titre: 'Le pluriel des adjectifs en eau et au', page: 66 },
    { numero: 33, titre: 'Les adjectifs possessifs mon, ma, mes', page: 68 },
    { numero: 34, titre: "L'accord du verbe avec son sujet", page: 70 },
    { numero: 35, titre: 'Le passé, le présent, le futur', page: 72 },
    { numero: 36, titre: 'Les pronoms personnels je, tu, il, elle', page: 74 },
    { numero: 37, titre: 'Les pronoms personnels nous, vous, ils, elles', page: 76 },
    { numero: 38, titre: 'Le présent des verbes en er (chanter)', page: 78 },
    { numero: 39, titre: 'Le futur des verbes en er (chanter)', page: 80 },
    { numero: 40, titre: "L'imparfait des verbes en er (chanter)", page: 82 },
    { numero: 41, titre: 'Le verbe être', page: 84 },
    { numero: 42, titre: 'Le verbe avoir', page: 86 },
    { numero: 43, titre: 'Le passé composé des verbes en er (chanter)', page: 88 },
    { numero: 44, titre: 'Le présent des verbes en ir (finir)', page: 90 },
    { numero: 45, titre: 'Le présent du verbe voir', page: 92 },
    { numero: 46, titre: 'Le présent du verbe vouloir', page: 94 },
    { numero: 47, titre: 'Le présent du verbe faire', page: 96 },
    { numero: 48, titre: 'Le présent du verbe aller', page: 98 },
    { numero: 49, titre: 'La phrase négative', page: 100 },
    { numero: 50, titre: 'La phrase interrogative', page: 102 },
    { numero: 51, titre: 'La phrase exclamative', page: 104 },
    { numero: 52, titre: 'Analyse du nom', page: 106 },
    { numero: 53, titre: "Analyse de l'article", page: 108 },
    { numero: 54, titre: "Analyse de l'adjectif qualificatif", page: 110 },
    { numero: 55, titre: 'Analyse du verbe', page: 112 },
    { numero: 56, titre: 'Les familles de mots', page: 114 },
    { numero: 57, titre: 'Les catégories de noms', page: 116 },
    { numero: 58, titre: 'Révision', page: 118, bilan: true },
  ],
}

// Programme officiel de Grammaire CP2 — « Les Petits Devoirs · Grammaire »
// (La Librairie des Écoles).
//
// Livre numéroté mais sans découpage en unités : 29 leçons qui se suivent.
// C'est la troisième forme de sommaire rencontrée, et elle ne demande aucun
// réglage particulier — un manuel numéroté qui déclare `lecons` plutôt que
// `unites` s'affiche en liste continue avec ses numéros.
//
// La pagination avance de deux en deux (leçon 1 p. 4, leçon 2 p. 6…) : chaque
// leçon occupe visiblement une double page. Le sommaire n'imprimant qu'une
// page par leçon, on transcrit celle-là seule — si le directeur confirme les
// doubles pages, il suffira d'ajouter `pageFin` pour afficher « p. 4–5 ».
//
// Les corrigés (p. 62) ne figurent pas ici : ce n'est pas une séance, on ne
// prépare pas un cours dessus, et les compter fausserait l'avancement.

export default {
  cle: 'grammaire-cp2',
  groupe: 'CP2',
  matiere: 'Grammaire',
  langue: 'fr',
  titre: 'Les Petits Devoirs — Grammaire',

  lecons: [
    { numero: 1,  titre: 'Le nom : personne, chose, animal, lieu', page: 4 },
    { numero: 2,  titre: 'Le nom commun, le nom propre', page: 6 },
    { numero: 3,  titre: 'Les articles définis et indéfinis', page: 8 },
    { numero: 4,  titre: 'Les articles contractés', page: 10 },
    { numero: 5,  titre: "D'autres déterminants", page: 12 },
    { numero: 6,  titre: "L'adjectif qualificatif", page: 14 },
    { numero: 7,  titre: 'Le genre du nom', page: 16 },
    { numero: 8,  titre: 'Règle générale du féminin des noms', page: 18 },
    { numero: 9,  titre: 'Règles particulières du féminin des noms', page: 20 },
    { numero: 10, titre: 'Le nombre du nom', page: 22 },
    { numero: 11, titre: 'Règle générale du pluriel des noms', page: 24 },
    { numero: 12, titre: 'Règles particulières du pluriel des noms', page: 26 },
    { numero: 13, titre: 'Règle générale du féminin des adjectifs qualificatifs', page: 28 },
    { numero: 14, titre: 'Règles particulières du féminin des adjectifs qualificatifs', page: 30 },
    { numero: 15, titre: 'Règle générale du pluriel des adjectifs', page: 32 },
    { numero: 16, titre: 'Règles particulières du pluriel des adjectifs qualificatifs', page: 34 },
    { numero: 17, titre: 'Révision', page: 36, bilan: true },
    { numero: 18, titre: 'Le passé – Le présent – Le futur', page: 38 },
    { numero: 19, titre: 'Le verbe', page: 40 },
    { numero: 20, titre: "L'infinitif du verbe", page: 42 },
    { numero: 21, titre: 'Les groupes du verbe', page: 44 },
    { numero: 22, titre: 'Les pronoms personnels singuliers', page: 46 },
    { numero: 23, titre: 'Les pronoms personnels pluriels', page: 48 },
    { numero: 24, titre: 'Le sujet du verbe', page: 50 },
    { numero: 25, titre: "L'adverbe", page: 52 },
    { numero: 26, titre: 'Le complément circonstanciel', page: 54 },
    { numero: 27, titre: 'La phrase', page: 56 },
    { numero: 28, titre: 'La phrase négative', page: 58 },
    { numero: 29, titre: 'La phrase interrogative', page: 60 },
  ],
}

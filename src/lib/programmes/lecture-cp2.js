// Programme officiel de Lecture CP2 — méthode Boscher, « La journée des tout
// petits » (Éditions Belin).
//
// Source : le sommaire paginé établi par l'école, qui porte le programme sur
// les pages 4 à 72. Les pages 1 à 3 (titre, crédits, préface et conseils
// pédagogiques) n'y figurent pas : ce ne sont pas des séances, la préface
// s'adresse à l'enseignant et aux parents. Elles sont donc volontairement
// absentes d'ici — les compter fausserait l'avancement.
//
// Ce livre travaille page par page : une page, une notion. L'identifiant d'une
// entrée est donc sa page, comme dans « Pas à Pas, je lis », et pour la même
// raison — c'est le repère stable, celui que l'enseignant et l'élève ont sous
// les yeux.
//
// Le sommaire a trois niveaux : partie › phase › page. Les phases deviennent
// les unités de l'écran, et la partie dont elles relèvent est portée par
// `rubrique`, affichée sous le titre de l'unité.

const SYLLABIQUE = "Première partie — L'apprentissage syllabique"
const ALPHABET   = 'Deuxième partie — L’alphabet'
const MORCEAUX   = 'Troisième partie — Morceaux choisis et lectures courantes'

export default {
  cle: 'lecture-cp2',
  groupe: 'CP2',
  matiere: 'Lecture',
  langue: 'fr',
  titre: 'Méthode Boscher — La journée des tout petits',

  // Le livre ne numérote pas ses leçons : chaque page en est une.
  numerote: false,

  // Pages liminaires : affichées sur le sommaire imprimé, jamais comptées
  // comme des séances. `leconsDe()` ne les voit pas, l'avancement non plus —
  // c'est exactement la distinction posée en tête de ce fichier. Elles étaient
  // jusqu'ici codées en dur dans le document ; les voici à leur place.
  liminaire: [
    { page: '1 – 2', titre: "Page de titre et crédits d'édition (Éditions Belin)" },
    { page: '3',     titre: 'Préface et conseils pédagogiques aux enseignants et aux parents' },
  ],

  unites: [
    {
      numero: 1,
      titre: 'Phase 1 — Les voyelles et les premières consonnes',
      rubrique: SYLLABIQUE,
      lecons: [
        { numero: 4,  titre: 'Les voyelles i et u', page: 4 },
        { numero: 5,  titre: 'Les voyelles o et a', page: 5 },
        { numero: 6,  titre: 'Les voyelles e, é, è, ê', page: 6 },
        { numero: 7,  titre: 'Révision des voyelles et la consonne p', page: 7 },
        { numero: 8,  titre: 'La consonne t', page: 8 },
        { numero: 9,  titre: 'La consonne r', page: 9 },
        { numero: 10, titre: 'La consonne n', page: 10 },
        { numero: 11, titre: 'La consonne m', page: 11 },
        { numero: 12, titre: 'La consonne l', page: 12 },
        { numero: 13, titre: 'La consonne c / k', page: 13 },
      ],
    },
    {
      numero: 2,
      titre: 'Phase 2 — Consonnes simples et sons de base',
      rubrique: SYLLABIQUE,
      lecons: [
        { numero: 14, titre: 'La consonne d', page: 14 },
        { numero: 15, titre: 'La consonne v', page: 15 },
        { numero: 16, titre: 'La consonne s', page: 16 },
        { numero: 17, titre: 'La consonne b', page: 17 },
        { numero: 18, titre: 'La consonne f', page: 18 },
        { numero: 19, titre: 'La consonne j', page: 19 },
        { numero: 20, titre: 'La consonne g', page: 20 },
        { numero: 21, titre: 'Le son ch', page: 21 },
        { numero: 22, titre: 'Le son ou', page: 22 },
        { numero: 23, titre: 'Le son on', page: 23 },
        { numero: 24, titre: 'Le son oi', page: 24 },
        { numero: 25, titre: 'Les sons an et en', page: 25 },
        { numero: 26, titre: 'Le son in', page: 26 },
      ],
    },
    {
      numero: 3,
      titre: 'Phase 3 — Sons complexes et combinatoires',
      rubrique: SYLLABIQUE,
      lecons: [
        { numero: 27, titre: 'Le son eu / œu', page: 27 },
        { numero: 28, titre: 'Révision des sons complexes (in, oi, eu, un, on, an)', page: 28 },
        { numero: 29, titre: 'Consonnes suivies de r (br, cr, dr, fr, gr, pr, tr)', page: 29 },
        { numero: 30, titre: 'Consonnes suivies de l (bl, cl, fl, gl, pl)', page: 30 },
        { numero: 31, titre: 'Assemblages cl, cr, pl, fr', page: 31 },
        { numero: 32, titre: 'Inversions des voyelles avec r (ar, er, ir, or, ur)', page: 32 },
        { numero: 33, titre: 'Inversions des voyelles avec l (al, el, il, ol, ul)', page: 33 },
        { numero: 34, titre: 'Inversions avec c (ac, oc, ic, uc)', page: 34 },
        { numero: 35, titre: 'Assemblages our, eur, oir', page: 35 },
        { numero: 36, titre: 'Le son ill', page: 36 },
        { numero: 37, titre: 'Les sons ail, eil, euil, eille', page: 37 },
        { numero: 38, titre: 'Le son eau / au', page: 38 },
        { numero: 39, titre: 'Les sons ien et oin', page: 39 },
        { numero: 40, titre: 'Le son gn', page: 40 },
        { numero: 41, titre: 'Synthèse et assemblage des sons complexes', page: 41 },
      ],
    },
    {
      numero: 4,
      titre: 'Phase 4 — Règles orthographiques et grammaire',
      rubrique: SYLLABIQUE,
      lecons: [
        { numero: 42, titre: 'Terminaisons ec, el, er, es', page: 42 },
        { numero: 43, titre: 'La consonne z et la valeur du s', page: 43 },
        { numero: 44, titre: 'Les sons ai, ei, air', page: 44 },
        { numero: 45, titre: 'Le son et, est', page: 45 },
        { numero: 46, titre: 'Terminaisons en é, er, et, ez / ier', page: 46 },
        { numero: 47, titre: 'Le son in écrit ain et ein', page: 47 },
        { numero: 48, titre: 'Le son y / yn / en', page: 48 },
        { numero: 49, titre: 'Le son y décomposé (ay, oy, uy)', page: 49 },
        { numero: 50, titre: 'La valeur du s entre voyelles (s = z) et c / g doux', page: 50 },
        { numero: 51, titre: 'Le son k écrit qu, c, k', page: 51 },
        { numero: 52, titre: 'Le g dur écrit gu', page: 52 },
        { numero: 53, titre: 'Le son f écrit ph et la cédille ç', page: 53 },
        { numero: 54, titre: 'La règle du m devant p et b', page: 54 },
        { numero: 55, titre: 'Les assemblages sp, st, str, scr', page: 55 },
        { numero: 56, titre: 'Les lettres finales muettes', page: 56 },
        { numero: 57, titre: 'Le singulier et le pluriel (marque du -s)', page: 57 },
      ],
    },
    {
      numero: 5,
      titre: "L'alphabet",
      rubrique: ALPHABET,
      lecons: [
        { numero: 58, titre: "Planche générale de l'alphabet (minuscules et majuscules, imprimerie et cursive)", page: 58 },
      ],
    },
    {
      numero: 6,
      titre: 'Morceaux choisis et lectures courantes',
      rubrique: MORCEAUX,
      lecons: [
        { numero: 59, titre: 'La petite Poule rouge (conte traditionnel)', page: 59 },
        { numero: 60, titre: 'Ma Sœur la pluie (poésie — Charles Van Lerberghe)', page: 60 },
        { numero: 61, titre: 'Le petit Poucet (d’après Charles Perrault)', page: 61 },
        { numero: 62, titre: 'Les lapins (récit champêtre)', page: 62 },
        { numero: 63, titre: 'La Bique, le Loup et les Biquets (conte)', page: 63 },
        { numero: 64, titre: 'Les chats de mon grand-père (récit)', page: 64 },
        { numero: 65, titre: "La pêche d'Isengrin (Roman de Renart)", page: 65 },
        { numero: 66, titre: 'Au printemps (poésie — Lucie Delarue-Mardrus)', page: 66 },
        { numero: 67, titre: 'La chèvre de M. Seguin (Alphonse Daudet)', page: 67 },
        { numero: 68, titre: 'Je suis le vent (poésie — Émile Verhaeren)', page: 68 },
        { numero: 69, titre: 'Le petit sapin (d’après Hans Christian Andersen)', page: 69 },
        { numero: 70, titre: 'Zette (d’après Paul et Victor Margueritte)', page: 70 },
        { numero: 71, titre: 'Jean et Jeanne à la pêche (Anatole France)', page: 71 },
        { numero: 72, titre: 'La Ronde (poésie — Paul Fort)', page: 72 },
      ],
    },
  ],
}

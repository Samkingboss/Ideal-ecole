// Programme officiel de Mathematics CP1 — « Cambridge Primary Mathematics »,
// Learner's Book (cours d'anglais).
//
// Le livre découpe ses 16 unités en sections numérotées 1.1, 1.2, 2.1… C'est
// cette référence que l'enseignant et l'élève ont sous les yeux : elle est
// portée par `code` et s'affiche telle quelle dans la pastille de l'écran.
//
// L'identifiant interne, lui, reste un entier — `unité × 10 + section`, soit 11
// pour la section 1.1 et 134 pour la 13.4. Une section décimale ferait un
// mauvais identifiant : 1.1 n'a pas de représentation binaire exacte, et rien
// ne garantirait qu'une future section 1.10 ne se confonde pas avec 1.1.
//
// Trois entrées du sommaire ne figurent pas dans le programme : « How to use
// this book » (p. 5), « Thinking and Working Mathematically » (p. 6) et les
// « Acknowledgements » (p. 228). Les deux premières s'adressent à l'enseignant
// et présentent la démarche du livre ; la dernière est une page de crédits.
// Aucune n'est une séance.
//
// À la date d'écriture, aucun enseignant n'est affecté à Mathematics CP1
// (7 séquences par semaine). Ce programme ne s'affichera donc dans aucun compte
// tant que l'affectation n'est pas faite.

// Sommaire tel qu'imprimé. Les identifiants sont dérivés plus bas.
const UNITES = [
  { u: 1,  titre: 'Numbers to 10', sections: [
    { s: 1, t: 'Counting sets of objects', p: 8 },
    { s: 2, t: 'Say, read and write numbers to 10', p: 17 },
    { s: 3, t: 'Comparing numbers', p: 20 },
    { s: 4, t: 'Number words', p: 24 },
    { s: 5, t: 'Odd and even numbers', p: 27 },
  ] },
  { u: 2,  titre: 'Geometry', sections: [
    { s: 1, t: '3D shapes', p: 30 },
    { s: 2, t: '2D shapes', p: 37 },
  ] },
  { u: 3,  titre: 'Fractions', sections: [
    { s: 1, t: 'Fractions', p: 43 },
  ] },
  { u: 4,  titre: 'Measures', sections: [
    { s: 1, t: 'Length', p: 49 },
  ] },
  { u: 5,  titre: 'Working with numbers to 10', sections: [
    { s: 1, t: 'Addition as combining', p: 56 },
    { s: 2, t: 'Subtraction as take away', p: 63 },
  ] },
  { u: 6,  titre: 'Position', sections: [
    { s: 1, t: 'Position', p: 70 },
  ] },
  { u: 7,  titre: 'Statistics', sections: [
    { s: 1, t: 'Sets', p: 79 },
    { s: 2, t: 'Venn diagrams', p: 89 },
  ] },
  { u: 8,  titre: 'Time', sections: [
    { s: 1, t: 'Time', p: 97 },
  ] },
  { u: 9,  titre: 'Numbers to 20', sections: [
    { s: 1, t: 'Counting to 20', p: 105 },
    { s: 2, t: 'Counting, comparing, ordering and estimating', p: 108 },
    { s: 3, t: 'Number patterns', p: 118 },
  ] },
  { u: 10, titre: 'Geometry (2)', sections: [
    { s: 1, t: '3D shapes', p: 125 },
    { s: 2, t: '2D shapes', p: 133 },
  ] },
  { u: 11, titre: 'Fractions (2)', sections: [
    { s: 1, t: 'Halves', p: 144 },
  ] },
  { u: 12, titre: 'Measures (2)', sections: [
    { s: 1, t: 'Mass and capacity', p: 156 },
    { s: 2, t: 'How do we measure?', p: 162 },
  ] },
  { u: 13, titre: 'Working with numbers to 20', sections: [
    { s: 1, t: 'Addition by counting on', p: 170 },
    { s: 2, t: 'Subtraction by counting back', p: 176 },
    { s: 3, t: 'Using the number line', p: 181 },
    { s: 4, t: 'Money', p: 186 },
  ] },
  { u: 14, titre: 'Statistics (2)', sections: [
    { s: 1, t: 'Venn diagrams, Carroll diagrams and pictograms', p: 189 },
    { s: 2, t: 'Lists, tables and block graphs', p: 196 },
  ] },
  { u: 15, titre: 'Time (2)', sections: [
    { s: 1, t: 'Time', p: 208 },
  ] },
  { u: 16, titre: 'Position, direction and patterns', sections: [
    { s: 1, t: 'Position, direction and patterns', p: 216 },
  ] },
]

export default {
  cle: 'mathematics-cp1',
  groupe: 'CP1',
  matiere: 'Mathematics',
  langue: 'en',
  titre: 'Cambridge Primary Mathematics',

  // Les sections portent leur propre référence imprimée (`code`) : l'entier
  // interne ne doit jamais s'afficher.
  numerote: false,

  unites: UNITES.map(({ u, titre, sections }) => ({
    numero: u,
    titre,
    lecons: sections.map(({ s, t, p }) => ({
      numero: u * 10 + s,
      code: `${u}.${s}`,
      titre: t,
      page: p,
    })),
  })),
}

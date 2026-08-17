// Programme officiel de Mathematics CM (cours en anglais) — « Math in Focus:
// The Singapore Approach », cahiers d'exercices A et B.
//
// Les deux niveaux du CM sont jumelés : ce manuel sert au CM1 comme au CM2, et
// il est rattaché au groupe CM1-CM2 tel qu'il figure à l'emploi du temps.
//
// À ne pas confondre avec le manuel de Maths du même groupe : le CM travaille
// les mathématiques dans les deux langues, avec deux ouvrages distincts. Deux
// matières à l'emploi du temps, donc deux manuels séparés, chacun avec son
// avancement.
//
// ── Deux cahiers, deux paginations ──────────────────────────────────────────
// Le cahier A porte les chapitres 1 à 7, le cahier B les chapitres 8 à 15, et
// chacun repart de la page 1. La page 1 désigne donc « Numbers to 10,000,000 »
// dans l'un et « Understanding Thousandths » dans l'autre. Le cahier est porté
// par `tome`, et l'identifiant interne mêle le cahier à la page — 1001 pour la
// page 1 du cahier A, 2001 pour celle du cahier B. Ce nombre ne s'affiche
// jamais.
//
// ── L'entrée est la feuille de travail ──────────────────────────────────────
// Le sommaire descend à la worksheet, et c'est elle qui fait la séance. Les
// numéros de worksheet repartent à 1 à chaque chapitre — il y a quinze
// « Worksheet 1 » dans l'ouvrage — d'où la numérotation par page et le rappel
// du numéro dans l'intitulé.
//
// Une worksheet couvre plusieurs pages. Chaque entrée porte donc sa page de
// fin, déduite du début de la suivante dans le même cahier ; la dernière de
// chaque cahier s'arrête à la page qui précède le corrigé.
//
// Le livre répète parfois un titre : le chapitre 1 a deux « Numbers to
// 10,000,000 », le chapitre 2 deux « Real-World Problems: Multiplication and
// Division », le chapitre 7 deux « Real-World Problems: Ratios ». Ce sont bien
// des feuilles distinctes, que leur numéro sépare.
//
// Les corrigés (cahier A p. 199, cahier B p. 183) ne sont pas au programme.

const CAHIERS = [
  {
    tome: 'A',
    finale: 198,   // dernière page avant les corrigés
    chapitres: [
      { n: 1, titre: 'Whole Numbers', feuilles: [
        ['Numbers to 10,000,000', 1],
        ['Numbers to 10,000,000', 3],
        ['Place Value', 5],
        ['Comparing Numbers to 10,000,000', 9],
        ['Rounding and Estimating', 15],
      ] },
      { n: 2, titre: 'Whole Number Multiplication and Division', feuilles: [
        ['Using a Calculator', 27],
        ['Multiplying by Tens, Hundreds, or Thousands', 31],
        ['Multiplying by 2-Digit Numbers', 39],
        ['Dividing by Tens, Hundreds, or Thousands', 47],
        ['Dividing by 2-Digit Numbers', 53],
        ['Order of Operations', 63],
        ['Real-World Problems: Multiplication and Division', 71],
        ['Real-World Problems: Multiplication and Division', 75],
      ] },
      { n: 3, titre: 'Fractions and Mixed Numbers', feuilles: [
        ['Adding Unlike Fractions', 79],
        ['Subtracting Unlike Fractions', 89],
        ['Fractions, Mixed Numbers, and Division Expressions', 95],
        ['Expressing Fractions, Division Expressions, and Mixed Numbers as Decimals', 101],
        ['Adding Mixed Numbers', 105],
        ['Subtracting Mixed Numbers', 109],
        ['Real-World Problems: Fractions and Mixed Numbers', 113],
      ] },
      { n: 4, titre: 'Multiplying and Dividing Fractions and Mixed Numbers', feuilles: [
        ['Multiplying Proper Fractions', 117],
        ['Real-World Problems: Multiplying with Proper Fractions', 123],
        ['Multiplying Improper Fractions by Fractions', 129],
        ['Multiplying Mixed Numbers and Whole Numbers', 131],
        ['Real-World Problems: Multiplying with Mixed Numbers', 135],
        ['Dividing a Fraction by a Whole Number', 137],
        ['Real-World Problems: Multiplying and Dividing with Fractions', 141],
      ] },
      { n: 5, titre: 'Algebra', feuilles: [
        ['Using Letters as Numbers', 143],
        ['Simplifying Algebraic Expressions', 147],
        ['Inequalities and Equations', 153],
        ['Real-World Problems: Algebra', 157],
      ] },
      { n: 6, titre: 'Area of a Triangle', feuilles: [
        ['Base and Height of a Triangle', 159],
        ['Finding the Area of a Triangle', 165],
      ] },
      { n: 7, titre: 'Ratio', feuilles: [
        ['Finding Ratio', 171],
        ['Equivalent Ratios', 175],
        ['Real-World Problems: Ratios', 181],
        ['Real-World Problems: Ratios', 183],
        ['Ratio in Fraction Form', 187],
        ['Comparing Three Quantities', 191],
        ['Real-World Problems: More Ratios', 195],
      ] },
    ],
  },
  {
    tome: 'B',
    finale: 182,
    chapitres: [
      { n: 8, titre: 'Decimals', feuilles: [
        ['Understanding Thousandths', 1],
        ['Comparing and Rounding Decimals', 9],
        ['Rewriting Decimals as Fractions', 17],
      ] },
      { n: 9, titre: 'Multiplying and Dividing Decimals', feuilles: [
        ['Multiplying Decimals', 19],
        ['Multiplying by Tens, Hundreds, and Thousands', 31],
        ['Dividing Decimals', 39],
        ['Dividing by Tens, Hundreds, and Thousands', 57],
        ['Estimating Decimals', 63],
        ['Real-World Problems: Decimals', 69],
      ] },
      { n: 10, titre: 'Percent', feuilles: [
        ['Percent', 73],
        ['Converting Fractions to Percents', 81],
        ['Percent of a Number', 87],
        ['Real-World Problems: Percent', 93],
      ] },
      { n: 11, titre: 'Graphs and Probability', feuilles: [
        ['Making and Interpreting Double Bar Graphs', 97],
        ['Graphing an Equation', 103],
        ['Combinations', 107],
        ['Theoretical Probability and Experimental Probability', 111],
      ] },
      { n: 12, titre: 'Angles', feuilles: [
        ['Angles on a Line', 115],
        ['Angles at a Point', 121],
        ['Vertical Angles', 125],
      ] },
      { n: 13, titre: 'Properties of Triangles and 4-Sided Figures', feuilles: [
        ['Classifying Triangles', 129],
        ['Measures of Angles of a Triangle', 133],
        ['Right, Isosceles, and Equilateral Triangles', 139],
        ['Triangle Inequalities', 143],
        ['Parallelogram, Rhombus, and Trapezoid', 147],
      ] },
      { n: 14, titre: 'Three-Dimensional Shapes', feuilles: [
        ['Prisms and Pyramids', 153],
        ['Cylinder, Sphere, and Cone', 159],
      ] },
      { n: 15, titre: 'Surface Area and Volume', feuilles: [
        ['Building Solids Using Unit Cubes', 163],
        ['Drawing Cubes and Rectangular Prisms', 165],
        ['Nets and Surface Area', 169],
        ['Understanding and Measuring Volume', 173],
        ['Volume of a Rectangular Prism and Liquid', 177],
      ] },
    ],
  },
]

// Une worksheet court jusqu'à ce que la suivante commence, dans son cahier.
// La dernière de chaque cahier s'arrête avant les corrigés.
const unites = CAHIERS.flatMap(cahier => {
  const pages = cahier.chapitres.flatMap(c => c.feuilles.map(([, p]) => p))
  const finDe = p => {
    const suivante = pages.find(x => x > p)
    return (suivante || cahier.finale + 1) - 1
  }
  return cahier.chapitres.map(c => ({
    numero: c.n,
    titre: `Chapter ${c.n} — ${c.titre}`,
    rubrique: `Cahier ${cahier.tome}`,
    lecons: c.feuilles.map(([titre, page], i) => {
      const fin = finDe(page)
      return {
        numero: (cahier.tome === 'A' ? 1000 : 2000) + page,
        tome: cahier.tome,
        titre: `Worksheet ${i + 1} — ${titre}`,
        page,
        ...(fin > page ? { pageFin: fin } : {}),
      }
    }),
  }))
})

export default {
  cle: 'mathematics-cm',
  groupe: 'CM1-CM2',
  matiere: 'Mathematics',
  langue: 'en',
  titre: 'Math in Focus — The Singapore Approach',

  // Les worksheets repartent à 1 à chaque chapitre : leur numéro ne peut pas
  // servir de repère unique, il est rappelé dans l'intitulé.
  numerote: false,
  libelleUnite: 'Chapitre',
  libelleTome: 'cahier',

  unites,
}

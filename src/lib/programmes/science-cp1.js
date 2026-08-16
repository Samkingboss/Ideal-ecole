// Programme officiel de Science CP1 — « Science : A Closer Look »
// (Macmillan / McGraw-Hill, édition Ohio).
//
// Même collection que le CP2, un cran en dessous : sept chapitres au lieu de
// six, répartis dans les trois mêmes domaines. La marche d'un chapitre est
// identique — des leçons, chacune suivie d'un encart de méthode, puis une
// lecture de révision et une évaluation.
//
// Une différence avec le volume du CP2 : le livre s'ouvre sur une partie
// « Be a Scientist » qui n'est pas de la page de garde. Compétences
// scientifiques, démarche d'investigation, démarche de conception et règles de
// sécurité : cela se travaille en classe, on l'inscrit donc au programme comme
// un chapitre préliminaire. Les sous-entrées (Observe, Compare, Classify…)
// tiennent dans les pages de leur section et n'en sont pas détachées.
//
// Comme au CP2, les pages « Ohio: A Closer Look » ne sont pas reprises — East
// Fork State Park, Holden Arboretum, Dayton Air Show : des sites régionaux
// américains, à des élèves de Bamako. Elles se trouvent aux pages 20, 102
// et 204 si le directeur veut les traiter.
//
// L'index « Activities and Investigations » n'est pas transcrit en entrées :
// il renvoie aux mêmes pages que les leçons. Les activités sont rattachées à
// leur chapitre et s'affichent sous son titre.

const VIE      = 'Life Sciences'
const TERRE    = 'Earth and Space Sciences'
const PHYSIQUE = 'Physical Sciences'
const METHODE  = 'Démarche scientifique'

export default {
  cle: 'science-cp1',
  groupe: 'CP1',
  matiere: 'Science',
  langue: 'en',
  titre: 'Science: A Closer Look',

  numerote: false,
  libelleUnite: 'Chapitre',

  unites: [
    {
      numero: 0,
      titre: 'Be a Scientist',
      rubrique: METHODE,
      lecons: [
        { numero: 2,  titre: 'Science Skills — observer, comparer, classer, mesurer, inférer, prédire…', page: 2 },
        { numero: 10, titre: 'Scientific Method — de la question à la conclusion', page: 10 },
        { numero: 16, titre: 'The Design Process', page: 16 },
        { numero: 18, titre: 'Safety Tips', page: 18 },
      ],
    },
    {
      numero: 1,
      titre: 'Chapter 1 — Plants Are Living Things',
      rubrique: VIE,
      activites: [
        'Explore : What is living and nonliving? (p. 27)',
        'Explore : What are the parts of a plant? (p. 35)',
        'Explore : How are plants different? (p. 43)',
        'Explore : How can you classify seeds? (p. 51)',
        'Quick Lab : Living and Nonliving Things (p. 29)',
        'Quick Lab : How Stems Work (p. 38)',
        'Quick Lab : Plant Parts We Eat (p. 46)',
        'Quick Lab : Inside a Lima Bean (p. 54)',
      ],
      lecons: [
        { numero: 26, titre: 'Lesson 1 — Learning About Living Things', page: 26 },
        { numero: 32, titre: 'Reading in Science', page: 32 },
        { numero: 34, titre: 'Lesson 2 — Parts of Plants', page: 34 },
        { numero: 40, titre: 'Writing in Science · Math in Science', page: 40 },
        { numero: 42, titre: 'Lesson 3 — Different Plants', page: 42 },
        { numero: 48, titre: 'Writing in Science · Math in Science', page: 48 },
        { numero: 50, titre: 'Lesson 4 — Flowers, Fruits, and Seeds', page: 50 },
        { numero: 56, titre: 'Focus on Skills : Classify', page: 56 },
        { numero: 58, titre: 'I Read to Review : My Plant Book', page: 58 },
        { numero: 62, titre: 'Chapter Review', page: 62, bilan: true },
      ],
    },
    {
      numero: 2,
      titre: 'Chapter 2 — All About Animals',
      rubrique: VIE,
      activites: [
        'Explore : What are some different kinds of animals? (p. 67)',
        'Explore : How do animals get what they need to live? (p. 77)',
        'Explore : How do teeth help you eat different foods? (p. 85)',
        'Quick Lab : Animal Guessing Game (p. 71)',
        'Quick Lab : Comparing Animal Parts (p. 81)',
        'Quick Lab : What First Graders Like to Eat (p. 89)',
      ],
      lecons: [
        { numero: 66, titre: 'Lesson 1 — All Kinds of Animals', page: 66 },
        { numero: 74, titre: 'Focus on Skills : Compare', page: 74 },
        { numero: 76, titre: 'Lesson 2 — What Animals Need to Live', page: 76 },
        { numero: 82, titre: 'Writing in Science · Math in Science', page: 82 },
        { numero: 84, titre: 'Lesson 3 — How Animals Eat Food', page: 84 },
        { numero: 90, titre: 'Be a Scientist', page: 90 },
        { numero: 92, titre: 'I Read to Review : My Animal Book', page: 92 },
        { numero: 96, titre: 'Chapter Review', page: 96, bilan: true },
        { numero: 98, titre: 'Unit Literature : Giraffes', page: 98 },
        { numero: 100, titre: 'Careers in Science', page: 100 },
      ],
    },
    {
      numero: 3,
      titre: 'Chapter 3 — Looking At Earth',
      rubrique: TERRE,
      activites: [
        'Explore : What can an island look like? (p. 109)',
        'Explore : How can you classify rocks? (p. 119)',
        'Explore : How can water break rock? (p. 127)',
        'Quick Lab : Water Near You (p. 112)',
        'Quick Lab : Hard and Soft Rocks (p. 121)',
        'Quick Lab : Sand Erosion (p. 133)',
      ],
      lecons: [
        { numero: 108, titre: 'Lesson 1 — What Earth Looks Like', page: 108 },
        { numero: 116, titre: 'Focus on Skills : Make A Model', page: 116 },
        { numero: 118, titre: 'Lesson 2 — Rocks and Soil', page: 118 },
        { numero: 124, titre: 'Reading in Science', page: 124 },
        { numero: 126, titre: 'Lesson 3 — Changing the Land', page: 126 },
        { numero: 134, titre: 'Writing in Science · Math in Science', page: 134 },
        { numero: 136, titre: 'I Read to Review : My Earth Book', page: 136 },
        { numero: 140, titre: 'Chapter Review', page: 140, bilan: true },
      ],
    },
    {
      numero: 4,
      titre: 'Chapter 4 — Caring for Earth',
      rubrique: TERRE,
      activites: [
        'Explore : What things are made from plants or animals? (p. 145)',
        'Explore : When do you use water every day? (p. 155)',
        'Explore : What happens to plastic when you throw it away? (p. 163)',
        'Quick Lab : Soil as a Home for Animals (p. 150)',
        'Quick Lab : Blowing in the Wind (p. 158)',
        'Quick Lab : Use It Again (p. 165)',
      ],
      lecons: [
        { numero: 144, titre: "Lesson 1 — Earth's Resources", page: 144 },
        { numero: 152, titre: 'Focus on Skills : Investigate', page: 152 },
        { numero: 154, titre: "Lesson 2 — Using Earth's Resources", page: 154 },
        { numero: 160, titre: 'Reading in Science', page: 160 },
        { numero: 162, titre: "Lesson 3 — Saving Earth's Resources", page: 162 },
        { numero: 168, titre: 'Writing in Science · Math in Science', page: 168 },
        { numero: 170, titre: 'I Read to Review : My Resources Book', page: 170 },
        { numero: 174, titre: 'Chapter Review', page: 174, bilan: true },
      ],
    },
    {
      numero: 5,
      titre: 'Chapter 5 — Seasons and Living Things',
      rubrique: TERRE,
      activites: [
        'Explore : Do seeds grow faster when it is warm or cold? (p. 179)',
        'Explore : How do sweaters keep us warm? (p. 187)',
        'Quick Lab : Clothes for All Seasons (p. 181)',
        'Quick Lab : Leaves in Different Seasons (p. 189)',
      ],
      lecons: [
        { numero: 178, titre: 'Lesson 1 — Spring and Summer', page: 178 },
        { numero: 184, titre: 'Reading in Science', page: 184 },
        { numero: 186, titre: 'Lesson 2 — Fall and Winter', page: 186 },
        { numero: 192, titre: 'Writing in Science · Math in Science', page: 192 },
        { numero: 194, titre: 'I Read to Review : My Seasons Book', page: 194 },
        { numero: 198, titre: 'Chapter Review', page: 198, bilan: true },
        { numero: 200, titre: 'Unit Literature : Weather and Animals', page: 200 },
        { numero: 202, titre: 'Careers in Science', page: 202 },
      ],
    },
    {
      numero: 6,
      titre: 'Chapter 6 — Matter Everywhere',
      rubrique: PHYSIQUE,
      activites: [
        'Explore : How can you compare objects? (p. 211)',
        'Explore : How can you change some solids? (p. 219)',
        'Explore : Can you take a mixture apart? (p. 225)',
        'Explore : How can heat change ice? (p. 233)',
        'Quick Lab : Describing Classroom Objects (p. 213)',
        'Quick Lab : Paper in the Sun (p. 221)',
        'Quick Lab : Objects That Float or Sink (p. 227)',
        'Quick Lab : Mass of Water and Ice (p. 235)',
      ],
      lecons: [
        { numero: 210, titre: 'Lesson 1 — Describing Matter', page: 210 },
        { numero: 216, titre: 'Reading in Science', page: 216 },
        { numero: 218, titre: 'Lesson 2 — Matter Can Change', page: 218 },
        { numero: 222, titre: 'Focus on Skills : Measure', page: 222 },
        { numero: 224, titre: 'Lesson 3 — Making Mixtures', page: 224 },
        { numero: 230, titre: 'Writing in Science · Math in Science', page: 230 },
        { numero: 232, titre: 'Lesson 4 — Heat Can Change Matter', page: 232 },
        { numero: 238, titre: 'Be a Scientist', page: 238 },
        { numero: 240, titre: 'I Read to Review : My Mixtures Book', page: 240 },
        { numero: 244, titre: 'Chapter Review', page: 244, bilan: true },
      ],
    },
    {
      numero: 7,
      titre: 'Chapter 7 — Motion and Energy',
      rubrique: PHYSIQUE,
      activites: [
        'Explore : How do you know something moved? (p. 249)',
        'Explore : How can you make something move? (p. 257)',
        'Explore : What will a magnet pull? (p. 265)',
        'Explore : How can heat change things? (p. 273)',
        'Explore : What do some things need to work? (p. 281)',
        'Quick Lab : Changing the Way a Ball Moves (p. 252)',
        'Quick Lab : Sliding a Checker Piece (p. 260)',
        "Quick Lab : A Magnet's Strength (p. 268)",
        "Quick Lab : Using the Sun's Energy (p. 275)",
        'Quick Lab : Using Electricity in School (p. 283)',
      ],
      lecons: [
        { numero: 249, titre: 'Lesson 1 — Position and Motion', page: 249 },
        { numero: 254, titre: 'Focus on Skills : Infer', page: 254 },
        { numero: 256, titre: 'Lesson 2 — Pushes and Pulls', page: 256 },
        { numero: 262, titre: 'Be a Scientist', page: 262 },
        { numero: 264, titre: 'Lesson 3 — Magnets', page: 264 },
        { numero: 270, titre: 'Writing in Science · Math in Science', page: 270 },
        { numero: 272, titre: 'Lesson 4 — Energy and Heat', page: 272 },
        { numero: 278, titre: 'Focus on Skills : Draw Conclusions', page: 278 },
        { numero: 280, titre: 'Lesson 5 — Electricity', page: 280 },
        { numero: 284, titre: 'Writing in Science · Math in Science', page: 284 },
        { numero: 286, titre: 'I Read to Review : My Motion Book', page: 286 },
        { numero: 290, titre: 'Chapter Review', page: 290, bilan: true },
        { numero: 292, titre: 'Unit Literature : For A Quick Exit', page: 292 },
        { numero: 294, titre: 'Careers in Science', page: 294 },
      ],
    },
  ],
}

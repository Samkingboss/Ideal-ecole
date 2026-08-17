// Programme officiel de Science CE1 — « Science : A Closer Look »
// (Macmillan / McGraw-Hill, édition Ohio).
//
// Troisième volume de la collection déjà transcrite pour le CP1 et le CP2, et
// même marche : six chapitres répartis dans trois domaines, des leçons suivies
// chacune d'un encart de méthode — Reading in Science, Inquiry Skill Builder,
// Inquiry Investigation, ou le couple Writing / Math in Science — puis une
// évaluation de fin de chapitre. Le dernier chapitre de chaque domaine se
// referme sur une lecture littéraire et une page métiers.
//
// Une différence avec les deux volumes précédents : les leçons y sont
// numérotées par le livre (Lesson 1, Lesson 2…) et le chapitre porte lui aussi
// un titre et une page d'ouverture. L'identifiant reste la page, comme au CP1
// et au CP2 — le livre ne numérote pas ses entrées de bout en bout, et deux
// « Lesson 1 » cohabitent dans six chapitres différents.
//
// Ce que le livre appelle « Ohio: A Closer Look » — deux pages de sites
// régionaux ouvrant chaque domaine — n'est pas repris, comme au CP1 et au
// CP2 : Wayne National Forest, Malabar Farm, le musée de l'US Air Force, à des
// élèves de Bamako. Les pages sont notées plutôt que passées sous silence :
// p. 18, p. 158 et p. 232.
//
// La partie « Be a Scientist » qui ouvre le livre (pages 1 à 17, avant le
// premier chapitre) n'a pas pu être transcrite : le sommaire transmis en
// montre la planche « Scientific Method » mais n'en détaille aucune entrée
// paginée. Au CP1, cette partie figure au programme comme chapitre
// préliminaire ; elle pourra être ajoutée ici de la même façon dès que ses
// pages seront connues.
//
// L'index « Activities and Investigations » ne devient pas des entrées de
// programme : il renvoie aux mêmes pages que les leçons — l'Explore Activity
// de la page 25 se déroule pendant la leçon des pages 24 à 31. En faire des
// entrées séparées compterait deux fois la même séance et fausserait
// l'avancement. Les Explore Activities et les Quick Labs sont donc rattachées
// à leur chapitre dans `activites`, pour rester sous la main.
//
// Les « Inquiry Skills and Investigations » de cet index ne sont pas reprises
// du tout : elles pointent les pages exactes des Inquiry Skill Builder et
// Inquiry Investigation déjà inscrits au programme (42, 82, 110, 126, 174,
// 212, 256, 266). Les répéter afficherait deux fois la même séance.

const VIE      = 'Life Sciences'
const TERRE    = 'Earth and Space Sciences'
const PHYSIQUE = 'Physical Sciences'

export default {
  cle: 'science-ce1',
  groupe: 'CE1-CE2',
  matiere: 'Science',
  langue: 'en',
  titre: 'Science: A Closer Look',

  numerote: false,
  libelleUnite: 'Chapitre',

  unites: [
    {
      numero: 1,
      titre: 'Chapter 1 — A Look at Living Things (p. 22)',
      rubrique: VIE,
      activites: [
        'Explore : How do living and nonliving things differ? (p. 25)',
        "Explore : How do an animal's structures help it meet its needs? (p. 35)",
        'Explore : How can you classify animals? (p. 45)',
        'Explore : How does a caterpillar grow and change? (p. 57)',
        'Quick Lab : Observe Cells (p. 30)',
        'Quick Lab : Observe Animal Structures (p. 39)',
        'Quick Lab : Model a Backbone (p. 47)',
        "Quick Lab : A Bird's Life Cycle (p. 61)",
      ],
      lecons: [
        { numero: 24, titre: 'Lesson 1 — Living Things and Their Needs', page: 24 },
        { numero: 32, titre: 'Reading in Science', page: 32 },
        { numero: 34, titre: 'Lesson 2 — Animals and Their Parts', page: 34 },
        { numero: 42, titre: 'Inquiry Skill Builder', page: 42 },
        { numero: 44, titre: 'Lesson 3 — Classifying Animals', page: 44 },
        { numero: 54, titre: 'Writing in Science · Math in Science', page: 54 },
        { numero: 56, titre: 'Lesson 4 — Animal Life Cycles', page: 56 },
        { numero: 64, titre: 'Writing in Science · Math in Science', page: 64 },
        { numero: 66, titre: 'Chapter 1 Review and Benchmark Practice', page: 66, bilan: true },
      ],
    },
    {
      numero: 2,
      titre: 'Chapter 2 — Survival in Ecosystems (p. 70)',
      rubrique: VIE,
      activites: [
        'Explore : What kind of food do owls need? (p. 73)',
        'Explore : Can ocean animals live and grow in fresh water? (p. 85)',
        'Explore : Does fat help animals survive in cold environments? (p. 99)',
        'Quick Lab : Observe Decomposers (p. 80)',
        'Quick Lab : Water Temperatures (p. 93)',
        'Quick Lab : Storing Water (p. 103)',
      ],
      lecons: [
        { numero: 72,  titre: 'Lesson 1 — Food Chains and Food Webs', page: 72 },
        { numero: 82,  titre: 'Inquiry Skill Builder', page: 82 },
        { numero: 84,  titre: 'Lesson 2 — Types of Ecosystems', page: 84 },
        { numero: 96,  titre: 'Reading in Science', page: 96 },
        { numero: 98,  titre: 'Lesson 3 — Adaptations', page: 98 },
        { numero: 110, titre: 'Inquiry Investigation', page: 110 },
        { numero: 112, titre: 'Chapter 2 Review and Benchmark Practice', page: 112, bilan: true },
      ],
    },
    {
      numero: 3,
      titre: 'Chapter 3 — Changes in Ecosystems (p. 116)',
      rubrique: VIE,
      activites: [
        'Explore : How can worms change their environment? (p. 119)',
        'Explore : How can a flood affect plants? (p. 129)',
        'Explore : How do fossils tell us about the past? (p. 141)',
        'Quick Lab : Model Pollution (p. 123)',
        'Quick Lab : A Changing Ecosystem (p. 135)',
        'Quick Lab : A Fossil Mystery (p. 145)',
      ],
      lecons: [
        { numero: 118, titre: 'Lesson 1 — Living Things Change Their Environments', page: 118 },
        { numero: 126, titre: 'Inquiry Skill Builder', page: 126 },
        { numero: 128, titre: 'Lesson 2 — Changes Affect Living Things', page: 128 },
        { numero: 138, titre: 'Writing in Science · Math in Science', page: 138 },
        { numero: 140, titre: 'Lesson 3 — Living Things of the Past', page: 140 },
        { numero: 148, titre: 'Reading in Science', page: 148 },
        { numero: 150, titre: 'Chapter 3 Review and Benchmark Practice', page: 150, bilan: true },
        { numero: 154, titre: 'Unit Literature : Monarch Butterfly', page: 154 },
        { numero: 156, titre: 'Careers in Science', page: 156 },
      ],
    },
    {
      numero: 4,
      titre: 'Chapter 4 — Earth (p. 162)',
      rubrique: TERRE,
      activites: [
        "Explore : Does land or water cover more of Earth's surface? (p. 165)",
        'Explore : How can rocks change in moving water? (p. 177)',
        "Quick Lab : Your State's Features (p. 169)",
        'Quick Lab : Materials Settle (p. 181)',
      ],
      lecons: [
        { numero: 164, titre: "Lesson 1 — Earth's Features", page: 164 },
        { numero: 174, titre: 'Inquiry Skill Builder', page: 174 },
        { numero: 176, titre: 'Lesson 2 — Weathering and Erosion', page: 176 },
        { numero: 184, titre: 'Writing in Science · Math in Science', page: 184 },
        { numero: 186, titre: 'Chapter 4 Review and Benchmark Practice', page: 186, bilan: true },
      ],
    },
    {
      numero: 5,
      titre: "Chapter 5 — Using Earth's Resources (p. 190)",
      rubrique: TERRE,
      activites: [
        "Explore : How do a mineral's color and mark compare? (p. 193)",
        'Explore : What makes up soil? (p. 205)',
        'Explore : How do some fossils form? (p. 215)',
        'Quick Lab : Classify Rocks (p. 197)',
        'Quick Lab : Classify Soils (p. 209)',
        'Quick Lab : Model Imprints (p. 217)',
      ],
      lecons: [
        { numero: 192, titre: 'Lesson 1 — Minerals and Rocks', page: 192 },
        { numero: 202, titre: 'Writing in Science · Math in Science', page: 202 },
        { numero: 204, titre: 'Lesson 2 — Soil', page: 204 },
        { numero: 212, titre: 'Inquiry Skill Builder', page: 212 },
        { numero: 214, titre: 'Lesson 3 — Fossils and Fuels', page: 214 },
        { numero: 222, titre: 'Reading in Science', page: 222 },
        { numero: 224, titre: 'Chapter 5 Review and Benchmark Practice', page: 224, bilan: true },
        { numero: 228, titre: 'Unit Literature : One Cool Adventure', page: 228 },
        { numero: 230, titre: 'Careers in Science', page: 230 },
      ],
    },
    {
      numero: 6,
      titre: 'Chapter 6 — Forces and Motion (p. 236)',
      rubrique: PHYSIQUE,
      activites: [
        "Explore : How can you describe an object's position? (p. 239)",
        'Explore : How can pushes affect the way objects move? (p. 249)',
        'Explore : What is work? (p. 259)',
        'Quick Lab : Measure Speed (p. 244)',
        'Quick Lab : Observe Gravity (p. 253)',
        'Quick Lab : Using Energy (p. 263)',
      ],
      lecons: [
        { numero: 238, titre: 'Lesson 1 — Position and Motion', page: 238 },
        { numero: 246, titre: 'Reading in Science', page: 246 },
        { numero: 248, titre: 'Lesson 2 — Forces', page: 248 },
        { numero: 256, titre: 'Inquiry Investigation', page: 256 },
        { numero: 258, titre: 'Lesson 3 — Work and Energy', page: 258 },
        { numero: 266, titre: 'Inquiry Skill Builder', page: 266 },
        { numero: 268, titre: 'Chapter 6 Review and Benchmark Practice', page: 268, bilan: true },
        { numero: 272, titre: 'Unit Literature : Jump Rope', page: 272 },
        { numero: 274, titre: 'Careers in Science', page: 274 },
      ],
    },
  ],
}

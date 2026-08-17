// Programme officiel de langue anglaise CP1 — « Treasures » Grade 1,
// Grammar Practice Book (Macmillan / McGraw-Hill).
//
// Le directeur l'appelle le cahier de Language Arts ; c'est le cahier de
// grammaire qui accompagne le manuel de lecture. Il suit ses six unités et ses
// trente thèmes dans le même ordre, et chaque thème renvoie à la lecture
// principale de Treasures — « We Are Special » travaille la phrase à partir de
// « Pam and Sam ».
//
// C'est donc un troisième manuel de la matière English au CP1, avec Treasures
// et Phonics Pathways. Les trois se travaillent dans les mêmes heures,
// l'enseignant choisit lequel il prépare, et chacun garde son avancement.
//
// ── Cinq feuilles par thème ─────────────────────────────────────────────────
// Plus court que son homologue du CM, qui en compte six : ici pas de Test
// séparé, l'évaluation tient dans la dernière feuille. Les trois dernières
// places sont invariables — Mechanics, Proofreading, Review and Assess — et
// les deux premières nomment le point de langue, répété d'une feuille à
// l'autre. Le contrôle vérifie cette régularité plutôt que de la supposer.
//
// Chaque feuille tient sur une page et fait une séance : c'est elle qui est
// l'entrée du programme. Aucun bilan de fin d'unité, contrairement au CM.
//
// La pagination court de la page 1 à la page 150, sans interruption : les six
// unités occupent vingt-cinq pages chacune, exactement.
//
// « Contractions with Not » revient deux fois, à l'unité 3 (p. 71) et à
// l'unité 4 (p. 96). C'est le livre qui reprend le point, pas une erreur de
// lecture.

// thème · lecture du manuel de lecture · point de langue · première page
const UNITES = [
  { unite: 1, titre: 'All About Us', themes: [
    ['We Are Special', 'Pam and Sam', 'Sentences', 1],
    ['Ready, Set, Move!', 'I Can! Can You?', 'Word Order', 6],
    ['Growing Up', 'Time For Kids: How You Grew', 'Statements', 11],
    ['Pets', 'Pet Tricks', 'Questions and Exclamations', 16],
    ['Teamwork', 'Soccer', 'Writing Sentences', 21],
  ] },
  { unite: 2, titre: 'Outside My Door', themes: [
    ['Animal Families', 'Animal Moms and Dads', 'Nouns', 26],
    ['Helping Out', 'Little Red Hen', 'Plural Nouns', 31],
    ['Where Animals Live', 'Time For Kids: A Prairie Dog Home', 'Irregular Plural Nouns', 36],
    ['Sing and Dance!', "The Fun Kids' Band", 'Proper Nouns', 41],
    ["Let's Laugh", 'On My Way to School', 'Days, Months, and Holidays', 46],
  ] },
  { unite: 3, titre: "Let's Connect", themes: [
    ['Being Friends', "Kate's Game", 'Verbs', 51],
    ['Kids Around the World', 'Kids Can Help', 'Present Tense Verbs', 56],
    ['Me and My Shadow', 'Time For Kids: Short Shadows, Long Shadows', 'Past Tense Verbs', 61],
    ['Our Families', 'Smile Mike!', 'Is and Are', 66],
    ['Family Time', 'Gram and Me', 'Contractions with Not', 71],
  ] },
  { unite: 4, titre: 'Our Earth', themes: [
    ['Birds', 'Pelican Was Hungry', 'Was and Were', 76],
    ['Recycling', 'June Robot Cleans Up', 'Has and Have', 81],
    ["What's the Weather?", 'Time For Kids: Stormy Weather', 'Go and Do', 86],
    ['What Scientists Do', 'Meet Ben Franklin', 'See and Say', 91],
    ['Favorite Stories', 'Little Rabbit and the Falling Fruit', 'Contractions with Not', 96],
  ] },
  { unite: 5, titre: 'I Can Do It!', themes: [
    ['Express Yourself', 'Olivia', 'Adjectives', 101],
    ['Watch It Go', 'Frog and Toad: The Kite', 'Adjectives That Compare', 106],
    ['Inventions', "Time For Kids: Kids' Great Inventions", 'Color Words', 111],
    ['I Can Do It', 'Whistle for Willie', 'Number Words', 116],
    ['How Does It Grow?', 'A Fruit Is a Suitcase for Seeds', 'Synonyms and Antonyms', 121],
  ] },
  { unite: 6, titre: "Let's Discover", themes: [
    ['Bugs, Bugs, Bugs!', 'Dot and Jabber and the Big Bug Mystery', 'Subjects', 126],
    ['Exploring Space', 'Blue Jay Finds a Way', 'Predicates', 131],
    ['At Work', 'Time For Kids: Cool Jobs', 'Pronouns', 136],
    ['Watching Animals Grow', 'A Tiger Cub Grows Up', 'I or Me', 141],
    ["Let's Build", 'Sand Castle', 'Combining Sentences', 146],
  ] },
]

let rang = 0
const unites = UNITES.flatMap(u =>
  u.themes.map(([theme, lecture, point, depart]) => ({
    numero: ++rang,
    titre: `${theme} — ${point}`,
    rubrique: `Unit ${u.unite} — ${u.titre} · ${lecture}`,
    // Les deux premières feuilles portent le point de langue, les trois
    // suivantes sont les mêmes d'un bout à l'autre du cahier.
    lecons: [point, point, 'Mechanics', 'Proofreading', 'Review and Assess'].map((feuille, i) => ({
      numero: depart + i,
      titre: feuille,
      page: depart + i,
      ...(i === 4 ? { bilan: true } : {}),
    })),
  }))
)

export default {
  cle: 'grammar-cp1',
  groupe: 'CP1',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Grammar Practice Book (Grade 1)',

  numerote: false,
  libelleUnite: 'Thème',

  unites,
}

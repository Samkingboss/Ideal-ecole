// Programme officiel de grammaire anglaise CM — « Treasures » Grade 4,
// Grammar Practice Book (Macmillan / McGraw-Hill).
//
// Troisième cahier de la matière English au CM, avec le manuel de lecture et
// le cahier d'orthographe. Tous trois suivent les mêmes six unités et les
// mêmes trente thèmes, dans le même ordre, et chaque thème renvoie à la
// lecture principale de Treasures. L'enseignant choisit lequel il prépare,
// et chacun garde son avancement propre.
//
// ── Six feuilles par thème, mais des intitulés propres ──────────────────────
// La marche est celle du cahier d'orthographe — six pages consécutives par
// thème, une unité refermée par un Review de deux pages — mais les feuilles ne
// portent pas partout le même nom. Seules les troisième et quatrième sont
// invariables (Mechanics, Proofreading) ; les deux premières nomment le point
// de grammaire travaillé, les deux dernières l'évaluent.
//
// Chaque feuille tient sur une page et fait une séance : c'est elle qui est
// l'entrée du programme.
//
// Le cahier suit une progression grammaticale d'ensemble, unité par unité :
// la phrase, le nom, le verbe, le pronom, l'adjectif, l'adverbe. C'est le mot
// que porte le Review de fin d'unité.
//
// La pagination court de la page 1 à la page 192, comme dans le cahier
// d'orthographe — mais ce sont deux livres différents, chacun avec sa propre
// page 1. Ils ne se confondent pas : ce sont deux manuels distincts, chacun
// avec sa clé et son avancement.
//
// Deux thèmes reprennent le même point à deux endroits éloignés du cahier :
// « Sentence Combining » ouvre l'unité 1 (p. 13) et referme l'unité 6
// (p. 185). C'est le livre qui boucle, pas une erreur de lecture.

// thème · lecture du manuel de lecture · première page · les six intitulés
const UNITES = [
  { unite: 1, titre: 'Challenges', revision: 31, domaine: 'Sentences', themes: [
    ['School Contests', 'Miss Alaineus', 1, [
      'Sentence Types', 'Commands and Exclamations', 'Mechanics', 'Proofreading',
      'Test: Sentence Types', 'Review: Sentence Types']],
    ['American Legends', 'Davy Crockett Saves the World', 7, [
      'Subjects and Predicates', 'Compound Subjects and Predicates', 'Mechanics', 'Proofreading',
      'Test: Subjects and Predicates', 'Review: Subjects and Predicates']],
    ['Trees for Life', 'Time For Kids: Forests of the World', 13, [
      'Sentence Combining', 'Conjunctions', 'Mechanics', 'Proofreading',
      'Test: Sentence Combining', 'Review: Sentence Combining']],
    ['Exploring Space', 'Ultimate Field Trip 5: Blasting Off to Space Academy', 19, [
      'More Sentence Combining', 'Complex Sentences', 'Mechanics', 'Proofreading',
      'Test: More Sentence Combining', 'Review: More Sentence Combining']],
    ['Rescue Dogs', 'Pipiolo and the Roof Dogs', 25, [
      'Run-on Sentences', 'Correcting Run-on Sentences', 'Mechanics', 'Proofreading',
      'Test: Run-on Sentences', 'Review: Run-on Sentences']],
  ] },
  { unite: 2, titre: 'Discoveries', revision: 63, domaine: 'Nouns', themes: [
    ['People Helping Animals', 'Shiloh', 33, [
      'Common and Proper Nouns', 'Using Proper Nouns', 'Mechanics', 'Proofreading',
      'Test: Common and Proper Nouns', 'Review: Common and Proper Nouns']],
    ['Slithery Snakes!', 'Rattlers!', 39, [
      'Singular and Plural Nouns', 'Making Special Forms of Plural Nouns', 'Mechanics', 'Proofreading',
      'Test: Singular and Plural Nouns', 'Review: Singular and Plural Nouns']],
    ['Remembering the Past', 'Time For Kids: Maya Lin, Architect of Memory', 45, [
      'More Plural Nouns', 'More Plural Nouns', 'Mechanics', 'Proofreading',
      'Test: Plural Nouns', 'Review: Plural Nouns']],
    ['The Caribbean Islands', 'The Night of San Juan', 51, [
      'Singular Possessive Nouns', 'Singular and Plural Possessive Nouns', 'Mechanics', 'Proofreading',
      'Test: Possessive Nouns', 'Review: Possessive Nouns']],
    ['Cowboys and Cowgirls', 'Black Cowboy Wild Horses', 57, [
      'Plurals and Possessives', 'Plurals and Possessives', 'Mechanics', 'Proofreading',
      'Test: Plurals and Possessives', 'Review: Plurals and Possessives']],
  ] },
  { unite: 3, titre: 'Turning Points', revision: 95, domaine: 'Verbs', themes: [
    ['The American Revolution', 'Sleds on Boston Common', 65, [
      'Action Verbs', 'Action Verbs', 'Mechanics', 'Proofreading',
      'Test: Action Verbs', 'Review: Action Verbs']],
    ['The Right to Vote', 'When Esther Morris Headed West', 71, [
      'Present Tense', 'Past Tense and Future Tense', 'Mechanics', 'Proofreading',
      'Test: Verb Tenses', 'Review: Verb Tenses']],
    ['Protecting the Environment', 'Time For Kids: Beyond the Horizon', 77, [
      'Main and Helping Verbs', 'More Helping Verbs', 'Mechanics', 'Proofreading',
      'Test: Main and Helping Verbs', 'Review: Contractions']],
    ['Desert Habitats', "My Great-Grandmother's Gourd", 83, [
      'Linking Verbs', 'Linking Verbs', 'Mechanics', 'Proofreading',
      'Test: Linking Verbs', 'Review: Linking Verbs']],
    ['Into the Future', 'Zathura', 89, [
      'Irregular Verbs', 'Irregular Verbs', 'Mechanics', 'Proofreading',
      'Test: Irregular Verbs', 'Review: Irregular Verbs']],
  ] },
  { unite: 4, titre: 'Experiences', revision: 127, domaine: 'Pronouns', themes: [
    ['Civil Rights', "Goin' Someplace Special", 97, [
      'Pronouns and Antecedents', 'Pronouns', 'Mechanics', 'Proofreading',
      'Test: Pronouns', 'Review: Pronouns']],
    ['Animal Defenses', 'Carlos and the Skunk', 103, [
      'Subject and Object Pronouns', 'Subject and Object Pronouns', 'Mechanics', 'Proofreading',
      'Test: Subject and Object Pronouns', 'Review: Subject and Object Pronouns']],
    ['Democracy', 'Time For Kids: Getting Out the Vote', 109, [
      'Pronoun-Verb Agreement', 'The Verbs Have and Be', 'Mechanics', 'Proofreading',
      'Test: Pronoun-Verb Agreement', 'Review: Pronoun-Verb Agreement']],
    ['Extreme Weather', 'Hurricanes', 115, [
      'Possessive Pronouns', 'Ways to Use Possessive Pronouns', 'Mechanics', 'Proofreading',
      'Test: Possessive Pronouns', 'Review: Possessive Pronouns and Hyphens']],
    ['Trickster Tales', 'The Catch of the Day: A Trickster Play', 121, [
      'Pronouns and Homophones', 'Homophones', 'Mechanics', 'Proofreading',
      'Test: Pronouns and Homophones', 'Review: Possessive Pronouns']],
  ] },
  { unite: 5, titre: 'Achievements', revision: 159, domaine: 'Adjectives', themes: [
    ['North Pole, South Pole', 'Spirit of Endurance', 129, [
      'Adjectives', 'Demonstrative Adjectives', 'Mechanics', 'Proofreading',
      'Test: Adjectives', 'Review: Adjectives']],
    ['Fantastic Foods', 'Weslandia', 135, [
      'The Articles A, An, and The', 'Articles', 'Mechanics', 'Proofreading',
      'Test: Articles', 'Review: Articles']],
    ['Learning from Nature', 'Time For Kids: A Historic Journey', 141, [
      'Adjectives That Compare', 'More Adjectives That Compare', 'Mechanics', 'Proofreading',
      'Test: Adjectives That Compare', 'Review: Adjectives That Compare']],
    ['Talking in Codes', 'The Unbreakable Code', 147, [
      'Comparing with More and Most', 'Comparing with More and Most', 'Mechanics', 'Proofreading',
      'Test: Comparing with More and Most', 'Review: Comparing with More and Most']],
    ['Whales', 'The Gri Gri Tree', 153, [
      'Comparing with Good', 'Comparing with Bad', 'Mechanics', 'Proofreading',
      'Test: Comparing with Good and Bad', 'Review: Comparing with Good and Bad']],
  ] },
  { unite: 6, titre: 'Great Ideas', revision: 191, domaine: 'Adverbs', themes: [
    ['Fairy Tales', 'The Golden Mare, the Firebird, and the Magic Ring', 161, [
      'Adverbs', 'Adverbs', 'Mechanics', 'Proofreading',
      'Test: Adverbs', 'Review: Adverbs']],
    ['Camping Out', 'Skunk Scout', 167, [
      'Adverbs That Compare', 'Adverbs That Compare', 'Mechanics', 'Proofreading',
      'Test: Adverbs That Compare', 'Review: Adverbs That Compare']],
    ['Improving Lives', 'Time For Kids: A Dream Comes True', 173, [
      'Negatives', 'Negatives', 'Mechanics', 'Proofreading',
      'Test: Negatives and Double Negatives', 'Review: Negatives']],
    ['Balloon Flight', 'Up in the Air: The Story of Balloon Flight', 179, [
      'Prepositions', 'Prepositional Phrases', 'Mechanics', 'Proofreading',
      'Test: Prepositions', 'Review: Commas and Prepositional Phrases']],
    ['Scientists at Work', 'Hidden Worlds', 185, [
      'Sentence Combining', 'Sentence Combining', 'Mechanics', 'Proofreading',
      'Test: Sentence Combining and Punctuation Marks', 'Review: Sentence Combining']],
  ] },
]

let rang = 0
const unites = UNITES.flatMap(u => [
  ...u.themes.map(([theme, lecture, depart, feuilles]) => ({
    numero: ++rang,
    // Le point de grammaire du thème est celui de sa première feuille.
    titre: `${theme} — ${feuilles[0]}`,
    rubrique: `Unit ${u.unite} — ${u.titre} · ${lecture}`,
    lecons: feuilles.map((feuille, i) => ({
      numero: depart + i,
      titre: feuille,
      page: depart + i,
    })),
  })),
  {
    numero: ++rang,
    titre: `Unit ${u.unite} Review: ${u.domaine}`,
    rubrique: `Unit ${u.unite} — ${u.titre}`,
    lecons: [{
      numero: u.revision,
      titre: `Unit ${u.unite} Review: ${u.domaine}`,
      page: u.revision,
      pageFin: u.revision + 1,
      bilan: true,
    }],
  },
])

export default {
  cle: 'grammar-cm',
  groupe: 'CM1-CM2',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Grammar Practice Book (Grade 4)',

  numerote: false,
  libelleUnite: 'Thème',

  unites,
}

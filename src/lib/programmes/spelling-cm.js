// Programme officiel d'orthographe anglaise CM — « Treasures » Grade 4,
// Spelling Practice Book (Macmillan / McGraw-Hill).
//
// Ce cahier accompagne le manuel de lecture : il suit ses six unités et ses
// trente thèmes dans le même ordre, et chaque thème y reprend la lecture
// principale du manuel — « School Contests » travaille l'orthographe à partir
// de « Miss Alaineus », comme dans Treasures.
//
// C'est donc un second manuel de la matière English, aux côtés de Treasures,
// exactement comme Phonics Pathways au CP1 : les deux se travaillent dans les
// mêmes heures, l'enseignant choisit lequel il prépare, et chacun garde son
// avancement propre.
//
// ── Six feuilles par thème, toujours les mêmes ──────────────────────────────
// Chaque thème se déroule en six pages consécutives, dans un ordre invariable
// d'un bout à l'autre du cahier : Pretest, Practice, Word Sort, Word Meaning,
// Proofreading, Posttest. La première page du thème porte le Pretest et les
// cinq suivantes la suite — c'est vrai des trente thèmes sans exception, ce
// que le contrôle vérifie plutôt que de le supposer.
//
// Chaque feuille fait une séance : c'est elle qui est l'entrée du programme,
// et non le thème. Une unité se referme sur un Review Test de deux pages.
//
// La pagination court d'un bout à l'autre, de la page 1 à la page 192 : un
// seul cahier, la page suffit à désigner une entrée.
//
// Un thème s'écrit différemment dans les deux livres : « Learning From
// Nature » dans le manuel de lecture, « Learning from Nature » ici. Chacun
// garde l'orthographe de son propre sommaire — les deux photos sont nettes,
// c'est bien l'éditeur qui varie.

// thème · lecture du manuel de lecture · compétence orthographique · première
// page (celle du Pretest)
const UNITES = [
  { unite: 1, titre: 'Challenges', revision: 31, themes: [
    ['School Contests', 'Miss Alaineus', 'Short Vowels', 1],
    ['American Legends', 'Davy Crockett Saves the World', 'Long Vowels', 7],
    ['Trees for Life', 'Time For Kids: Forests of the World', 'Words with /ü/, /ū/, /u̇/', 13],
    ['Exploring Space', 'Ultimate Field Trip 5: Blasting Off to Space Academy', 'Words with /är/, /âr/, /ôr/', 19],
    ['Rescue Dogs', 'Pipiolo and the Roof Dogs', 'Words with /ûr/, /îr/', 25],
  ] },
  { unite: 2, titre: 'Discoveries', revision: 63, themes: [
    ['People Helping Animals', 'Shiloh', 'Compound Words', 33],
    ['Slithery Snakes!', 'Rattlers!', 'Plurals', 39],
    ['Remembering the Past', 'Time For Kids: Maya Lin, Architect of Memory', 'Words with Inflected Endings -ed and -ing', 45],
    ['The Caribbean Islands', 'The Night of San Juan', 'Words with /ô/, /ou/, /oi/', 51],
    ['Cowboys and Cowgirls', 'Black Cowboy Wild Horses', 'VCCV Pattern', 57],
  ] },
  { unite: 3, titre: 'Turning Points', revision: 95, themes: [
    ['The American Revolution', 'Sleds on Boston Common', 'V/CV and VC/V Patterns', 65],
    ['The Right to Vote', 'When Esther Morris Headed West', 'V/V Pattern', 71],
    ['Protecting the Environment', 'Time For Kids: Beyond the Horizon', 'VCCCV Pattern', 77],
    ['Desert Habitats', "My Great-Grandmother's Gourd", 'Vowel Patterns in Accented Syllables', 83],
    ['Into the Future', 'Zathura', 'Words with Final /ər/', 89],
  ] },
  { unite: 4, titre: 'Experiences', revision: 127, themes: [
    ['Civil Rights', "Goin' Someplace Special", 'Words with Final /əl/ and /ən/', 97],
    ['Animal Defenses', 'Carlos and the Skunk', 'Words with Accented Syllables', 103],
    ['Democracy', 'Time For Kids: Getting Out the Vote', 'Accented Syllables in Homographs', 109],
    ['Extreme Weather', 'Hurricanes', 'Words with /chər/ and /zhər/', 115],
    ['Trickster Tales', 'The Catch of the Day: A Trickster Play', 'Words with -ance and -ence', 121],
  ] },
  { unite: 5, titre: 'Achievements', revision: 159, themes: [
    ['North Pole, South Pole', 'Spirit of Endurance', 'Words with Soft g', 129],
    ['Fantastic Foods', 'Weslandia', 'Homophones', 135],
    ['Learning from Nature', 'Time For Kids: A Historic Journey', 'Words with Prefixes dis-, in-, mis-, and pre-', 141],
    ['Talking in Codes', 'The Unbreakable Code', 'Words with Suffixes -less and -ness', 147],
    ['Whales', 'The Gri Gri Tree', 'Adding -ion', 153],
  ] },
  { unite: 6, titre: 'Great Ideas', revision: 191, themes: [
    ['Fairy Tales', 'The Golden Mare, the Firebird, and the Magic Ring', 'Greek Roots', 161],
    ['Camping Out', 'Skunk Scout', 'Latin Roots', 167],
    ['Improving Lives', 'Time For Kids: A Dream Comes True', 'Words from Mythology', 173],
    ['Balloon Flight', 'Up in the Air: The Story of Balloon Flight', 'Number Prefixes uni-, bi-, tri-, and cent-', 179],
    ['Scientists at Work', 'Hidden Worlds', 'Words with -able and -ible', 185],
  ] },
]

// L'ordre des six feuilles, identique dans les trente thèmes.
const FEUILLES = ['Pretest', 'Practice', 'Word Sort', 'Word Meaning', 'Proofreading', 'Posttest']

let rang = 0
const unites = UNITES.flatMap(u => [
  ...u.themes.map(([theme, lecture, competence, depart]) => ({
    numero: ++rang,
    titre: `${theme} — ${competence}`,
    rubrique: `Unit ${u.unite} — ${u.titre} · ${lecture}`,
    lecons: FEUILLES.map((feuille, i) => ({
      numero: depart + i,
      titre: feuille,
      page: depart + i,
    })),
  })),
  {
    numero: ++rang,
    titre: `Unit ${u.unite} Review Test`,
    rubrique: `Unit ${u.unite} — ${u.titre}`,
    lecons: [{
      numero: u.revision,
      titre: `Unit ${u.unite} Review Test`,
      page: u.revision,
      pageFin: u.revision + 1,
      bilan: true,
    }],
  },
])

export default {
  cle: 'spelling-cm',
  groupe: 'CM1-CM2',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Spelling Practice Book (Grade 4)',

  numerote: false,
  // Les sections de l'écran sont les thèmes du cahier ; « Unit » désigne le
  // grand découpage, rappelé sous chaque titre avec la lecture associée.
  libelleUnite: 'Thème',

  unites,
}

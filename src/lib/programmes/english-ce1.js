// Programme officiel d'English CE1 — « Treasures », Grade 3
// (Macmillan / McGraw-Hill).
//
// Troisième niveau de la collection déjà transcrite pour le CP1 et le CP2, et
// même architecture : six unités, cinq thèmes par unité, cinq entrées par
// thème — Talk About It, la page de vocabulaire et compréhension, la lecture
// principale, la lecture associée, l'atelier d'écriture — et une Test Strategy
// qui referme chaque unité sans appartenir à aucun thème.
//
// Les six unités tiennent en deux volumes : les unités 1 à 3 de la page 10 à
// la page 418, les unités 4 à 6 de la page 10 à la page 404. La page 10 existe
// donc deux fois. L'identifiant mêle le volume à la page — 1010 pour la page
// 10 du premier volume, 2010 pour celle du second — et `tome` fait afficher
// « volume 2, p. 10 » partout où la référence est lue.
//
// ── Où passent les frontières d'unité ───────────────────────────────────────
// Le sommaire imprimé pose ses bandeaux d'unité en haut des pages de droite,
// alors que la liste d'une unité déborde sur la page de gauche suivante. Le
// découpage retenu ici est celui qui rend le livre régulier : chaque unité
// compte cinq thèmes, son thème TIME For Kids en troisième position, et se
// referme sur sa Test Strategy — vérifié six fois sur six. Lire les bandeaux
// au pied de la lettre donnerait deux unités de trois thèmes sans Test
// Strategy et deux groupes de thèmes orphelins en fin de volume.
//
// Ce choix ne touche que la mention « Unit N — … » portée par `rubrique` :
// l'ordre des séances, lui, est celui des pages et ne change pas d'une lecture
// à l'autre.
//
// ── Trois pages déduites ────────────────────────────────────────────────────
// Six pages n'étaient pas lisibles sur le sommaire transmis, coupées au bord
// de l'image : les trois dernières entrées d'« Ecosystems in Balance » et les
// trois dernières de « Good Citizens ». Elles sont reconstituées d'après
// l'écart constant des quatre autres thèmes TIME For Kids (0, +2, +4, +8, +10)
// et bornées par le thème suivant, qui commence bien deux pages plus loin.
// Elles sont signalées par un commentaire, à vérifier sur le livre.
//
// Les glossaires de fin de volume (v. 1 p. 422, v. 2 p. 408) ne figurent pas
// au programme : pages de référence, pas des séances.
//
// Le groupe est « CE1-CE2 », tel que la classe figure à l'emploi du temps.

const VOLUMES = [
  {
    volume: 1,
    unites: [
      {
        unite: 1, titre: 'Our World',
        themes: [
          { titre: 'New Beginnings', entrees: [
            { t: 'Talk About It', p: 10 },
            { t: "Tina's Try-Out Day (Vocabulary/Comprehension : Character, Setting, Plot)", p: 12 },
            { t: 'First Day Jitters (Humorous Fiction)', p: 14, auteur: 'Julie Danneberg, ill. Judy Love' },
            { t: 'Making New Friends (Health)', p: 34, auteur: 'Jan Smith' },
            { t: 'Writing: Personal Narrative', p: 36 },
          ] },
          { titre: 'Keeping in Touch', entrees: [
            { t: 'Talk About It', p: 38 },
            { t: 'Mail for Matty (Vocabulary/Comprehension : Character, Setting, Plot)', p: 40 },
            { t: 'Dear Juno (Realistic Fiction)', p: 42, auteur: 'Soyung Pak, ill. Susan Kathleen Hartung' },
            { t: 'How We Keep in Touch (Social Studies)', p: 68, auteur: 'Eric Michaels' },
            { t: 'Writing: Personal Narrative', p: 72 },
          ] },
          { titre: 'Building Communities (TIME For Kids)', entrees: [
            { t: 'Talk About It', p: 74 },
            { t: 'Home Sweet Harlem (Vocabulary/Comprehension : Main Idea and Details)', p: 76 },
            { t: 'Whose Habitat Is It? (Nonfiction Article)', p: 78 },
            { t: "All Are Equal: It's the Law! (Social Studies)", p: 82 },
            { t: 'Writing: Extended Response to Literature', p: 84 },
          ] },
          { titre: 'Antarctic Life', entrees: [
            { t: 'Talk About It', p: 86 },
            { t: 'Life in Antarctica (Vocabulary/Comprehension : Main Idea and Details)', p: 88 },
            { t: 'Penguin Chick (Narrative Nonfiction)', p: 90, auteur: 'Betty Tatham, ill. Helen K. Davie' },
            { t: 'Antarctic Anthem (Poetry)', p: 112, auteur: 'Judy Sierra' },
            { t: 'Writing: Poem', p: 114 },
          ] },
          { titre: 'People and Their Pets', entrees: [
            { t: 'Talk About It', p: 116 },
            { t: 'Choosing a Pet (Vocabulary/Comprehension : Problem and Solution)', p: 118 },
            { t: 'The Perfect Pet (Humorous Fiction)', p: 120, auteur: 'Margie Palatini, ill. Bruce Whatley' },
            { t: 'Pets: True or False? (Science)', p: 142, auteur: 'Gillian Reed' },
            { t: 'Writing: Personal Narrative', p: 146 },
          ] },
        ],
        test: { titre: 'Test Strategy: Think and Search', entrees: [
          { t: "Evan's Welcome (Drama)", p: 148 },
        ] },
      },
      {
        unite: 2, titre: 'Investigations',
        themes: [
          { titre: 'Putting on a Performance', entrees: [
            { t: 'Talk About It', p: 152 },
            { t: "The Wind and the Sun: An Aesop's Fable (Vocabulary/Comprehension : Summarize)", p: 154 },
            { t: 'The Strongest One (Play)', p: 156, auteur: 'Joseph Bruchac, ill. Lucia Angela Perez' },
            { t: 'Behind the Scenes at a Play (Performing Arts)', p: 172, auteur: 'Candice Bertoline' },
            { t: 'Writing: Persuasive Writing', p: 176 },
          ] },
          { titre: 'Wolves', entrees: [
            { t: 'Talk About It', p: 178 },
            { t: 'The Boy Who Cried Wolf (Vocabulary/Comprehension : Fantasy and Reality)', p: 180 },
            { t: 'Wolf! (Fantasy)', p: 182, auteur: 'Becky Bloom, ill. Pascal Biet' },
            { t: 'The Truth About Wolves (Science)', p: 206, auteur: 'Paul Netcher' },
            { t: 'Writing: Persuasive Writing', p: 210 },
          ] },
          { titre: 'Past, Present, and Future (TIME For Kids)', entrees: [
            { t: 'Talk About It', p: 212 },
            { t: 'Where Did the First Americans Live? (Vocabulary/Comprehension : Fact and Opinion)', p: 214 },
            { t: "What's in Store for the Future? (Nonfiction Article)", p: 216 },
            { t: 'Will Robots Do All the Work? (Social Studies)', p: 220 },
            { t: 'Writing: Personal Narrative', p: 222 },
          ] },
          { titre: 'Out in Space', entrees: [
            { t: 'Talk About It', p: 224 },
            { t: 'Constellations: Pictures in the Sky (Vocabulary/Comprehension : Summarize)', p: 226 },
            { t: 'The Planets in Our Solar System (Informational Nonfiction)', p: 228, auteur: "Franklyn M. Branley, ill. Kevin O'Malley" },
            { t: 'Star Research (Science)', p: 250 },
            { t: 'Writing: Persuasive Writing', p: 254 },
          ] },
          { titre: 'Being a Writer', entrees: [
            { t: 'Talk About It', p: 256 },
            { t: "Talking to Lulu Delacre, Children's Author (Vocabulary/Comprehension : Author's Purpose)", p: 258 },
            { t: 'Author: A True Story (Autobiography)', p: 260, auteur: 'Helen Lester' },
            { t: 'Where I Sit Writing (Poetry)', p: 274, auteur: 'Allan Ahlberg' },
            { t: 'Writing: Persuasive Writing', p: 276 },
          ] },
        ],
        test: { titre: 'Test Strategy: Author and Me', entrees: [
          { t: 'Venus Flytrap: The Plant with Bite! (Informational Nonfiction)', p: 278 },
        ] },
      },
      {
        unite: 3, titre: 'Discoveries',
        themes: [
          { titre: 'Food Around the World', entrees: [
            { t: 'Talk About It', p: 282 },
            { t: 'Family Feast (Vocabulary/Comprehension : Make Inferences)', p: 284 },
            { t: 'Stone Soup (Folktale)', p: 286, auteur: 'Jon J Muth' },
            { t: "What's for Lunch? (Social Studies)", p: 308, auteur: 'Leonard Mercury' },
            { t: 'Writing: Personal Narrative', p: 312 },
          ] },
          { titre: 'Solving Riddles', entrees: [
            { t: 'Talk About It', p: 314 },
            { t: 'Count on Detective Drake! (Vocabulary/Comprehension : Plot and Setting)', p: 316 },
            { t: 'One Riddle, One Answer (Fairy Tale)', p: 318, auteur: 'Lauren Thompson, ill. Linda S. Wingerter' },
            { t: 'Haiku (Poetry)', p: 336 },
            { t: 'Writing: Story', p: 338 },
          ] },
          { titre: 'Ecosystems in Balance (TIME For Kids)', entrees: [
            { t: 'Talk About It', p: 340 },
            { t: 'For the Birds! (Vocabulary/Comprehension : Cause and Effect)', p: 342 },
            // Trois pages coupées sur le sommaire transmis : déduites de l'écart
            // constant des autres thèmes TIME For Kids. À vérifier sur le livre.
            { t: 'Saving the Sand Dunes (Nonfiction Article)', p: 344 },
            { t: 'Frog Frenzy! (Science)', p: 348 },
            { t: 'Writing: Persuasive Writing', p: 350 },
          ] },
          { titre: 'Making Journeys', entrees: [
            { t: 'Talk About It', p: 352 },
            { t: 'My Winter Vacation (Vocabulary/Comprehension : Make Inferences)', p: 354 },
            { t: 'The Jones Family Express (Realistic Fiction)', p: 356, auteur: 'Javaka Steptoe' },
            { t: 'Tips for Trips (Social Studies)', p: 380, auteur: 'Lauren Eckler' },
            { t: 'Writing: Story', p: 382 },
          ] },
          { titre: 'The Art of Illustrating', entrees: [
            { t: 'Talk About It', p: 384 },
            { t: 'Draw! (Vocabulary/Comprehension : Sequence)', p: 386 },
            { t: 'What Do Illustrators Do? (Narrative Nonfiction)', p: 388, auteur: 'Eileen Christelow' },
            { t: 'Jobs in Animation (Fine Arts)', p: 412, auteur: 'Lisa Soo' },
            { t: 'Writing: Play', p: 416 },
          ] },
        ],
        test: { titre: 'Test Strategy: Right There', entrees: [
          { t: 'Design Your Own Journal (Directions)', p: 418 },
        ] },
      },
    ],
  },
  {
    volume: 2,
    unites: [
      {
        unite: 4, titre: 'Determination',
        themes: [
          { titre: "What's Cooking?", entrees: [
            { t: 'Talk About It', p: 10 },
            { t: 'Red and Her Friends (Vocabulary/Comprehension : Compare and Contrast)', p: 12 },
            { t: 'Cook-a-Doodle-Doo! (Humorous Fiction)', p: 14, auteur: 'Janet Stevens et Susan Stevens Crummel, ill. Janet Stevens' },
            { t: 'Welcome to the Bakery! (Social Studies)', p: 40, auteur: 'Eric Michaels' },
            { t: 'Writing: Explanatory Writing', p: 44 },
          ] },
          { titre: 'Getting Along', entrees: [
            { t: 'Talk About It', p: 46 },
            { t: 'Community Works (Vocabulary/Comprehension : Draw Conclusions)', p: 48 },
            { t: 'Seven Spools of Thread (Fable)', p: 50, auteur: 'Angela Shelf Medearis, ill. Daniel Minter' },
            { t: 'Our Class Newsletter (Social Studies)', p: 74 },
            { t: 'Writing: Explanatory Writing', p: 76 },
          ] },
          { titre: 'Protecting Our Natural Resources (TIME For Kids)', entrees: [
            { t: 'Talk About It', p: 78 },
            { t: "Saving Egypt's Great Desert (Vocabulary/Comprehension : Compare and Contrast)", p: 80 },
            { t: 'Washington Weed Whackers (Nonfiction Article)', p: 82 },
            { t: 'Up a Creek (Science)', p: 86 },
            { t: 'Writing: Fictional Narrative', p: 88 },
          ] },
          { titre: 'Getting Involved', entrees: [
            { t: 'Talk About It', p: 90 },
            { t: "Gorilla Garden (Vocabulary/Comprehension : Author's Purpose)", p: 92 },
            { t: "Here's My Dollar (Nonfiction Article)", p: 94, auteur: 'Gary Soto' },
            { t: 'Neighbors (Poetry)', p: 108, auteur: 'Mari Paz Pradillo' },
            { t: 'Recycling (Poetry)', p: 109, auteur: 'J. Z. Belle' },
            { t: 'Writing: Explanatory Writing', p: 110 },
          ] },
          { titre: 'A Place of My Own', entrees: [
            { t: 'Talk About It', p: 112 },
            { t: 'Pond Street Clubhouse (Vocabulary/Comprehension : Make and Confirm Predictions)', p: 114 },
            { t: 'My Very Own Room (Realistic Fiction)', p: 116, auteur: 'Amada Irma Pérez, ill. Maya Christina Gonzalez' },
            { t: "Frank Lloyd Wright (Social Studies)", p: 140, auteur: "Karen O'Malley" },
            { t: 'Writing: Explanatory Writing', p: 144 },
          ] },
        ],
        test: { titre: 'Test Strategy: Author and Me', entrees: [
          { t: "Susan B. Anthony: A Pioneer for Women's Rights (Biography)", p: 146 },
        ] },
      },
      {
        unite: 5, titre: 'Challenges',
        themes: [
          { titre: 'Making Money', entrees: [
            { t: 'Talk About It', p: 150 },
            { t: "Let's Trade! (Vocabulary/Comprehension : Sequence)", p: 152 },
            { t: 'Boom Town (Historical Fiction)', p: 154, auteur: 'Sonia Levitin, ill. Cat Bowman Smith' },
            { t: 'How to Earn Money! (Social Studies)', p: 178, auteur: 'R. J. Harkin' },
            { t: 'Writing: Descriptive Writing', p: 182 },
          ] },
          { titre: 'Making a Difference', entrees: [
            { t: 'Talk About It', p: 184 },
            { t: 'Helping People Help Themselves (Vocabulary/Comprehension : Cause and Effect)', p: 186 },
            { t: "Beatrice's Goat (Narrative Nonfiction)", p: 188, auteur: 'Page McBrier, ill. Lori Lohstoeter' },
            { t: 'Ugandan Girl Reaches Goal (Social Studies)', p: 212, auteur: 'Ann Frost' },
            { t: 'Writing: Descriptive Writing', p: 216 },
          ] },
          { titre: 'In Motion (TIME For Kids)', entrees: [
            { t: 'Talk About It', p: 218 },
            { t: 'Visions of the Future from the Past (Vocabulary/Comprehension : Fact and Opinion)', p: 220 },
            { t: 'A Carousel of Dreams (Nonfiction Article)', p: 222 },
            { t: 'Getting a Free Ride (Social Studies)', p: 226 },
            { t: 'Writing: Personal Narrative', p: 228 },
          ] },
          { titre: 'Heroes', entrees: [
            { t: 'Talk About It', p: 230 },
            { t: 'To The Rescue (Vocabulary/Comprehension : Make and Confirm Predictions)', p: 232 },
            { t: 'The Printer (Realistic Fiction)', p: 234, auteur: 'Myron Uhlberg, ill. Henri Sørensen' },
            { t: 'Smokejumpers (Social Studies)', p: 254, auteur: 'Roland Hosein' },
            { t: 'Writing: Descriptive Writing', p: 258 },
          ] },
          { titre: 'Animal Architects', entrees: [
            { t: 'Talk About It', p: 260 },
            { t: 'Web Spinners (Vocabulary/Comprehension : Description)', p: 262 },
            { t: 'Animal Homes (Informational Nonfiction)', p: 264, auteur: 'Ann O. Squire' },
            { t: 'Limericks (Poetry)', p: 282, auteur: 'John Ciardi et David McCord' },
            { t: 'Writing: Poem', p: 284 },
          ] },
        ],
        test: { titre: 'Test Strategy: Think and Search', entrees: [
          { t: 'Twister (Poetry)', p: 286 },
          { t: "Tornadoes: Nature's Toughest Storms (Informational Nonfiction)", p: 287 },
        ] },
      },
      {
        unite: 6, titre: 'Achievements',
        themes: [
          { titre: 'Helping Our Neighbors', entrees: [
            { t: 'Talk About It', p: 290 },
            { t: 'What Should I Be? (Vocabulary/Comprehension : Theme)', p: 292 },
            { t: 'A Castle on Viola Street (Realistic Fiction)', p: 294, auteur: 'DyAnne DiSalvo' },
            { t: 'Homes for Families (Social Studies)', p: 316, auteur: 'Angel Gracia' },
            { t: 'Writing: Business Letter', p: 320 },
          ] },
          { titre: 'Unusual Animals', entrees: [
            { t: 'Talk About It', p: 322 },
            { t: 'Max the Amazing Hamster (Vocabulary/Comprehension : Make Judgments)', p: 324 },
            { t: "Wilbur's Boast, from « Charlotte's Web » (Fantasy)", p: 326, auteur: 'E. B. White, ill. Garth Williams' },
            { t: 'Do Animals Have Personalities? (Science)', p: 340, auteur: 'Patricia West' },
            { t: 'Writing: Expository Writing', p: 344 },
          ] },
          { titre: 'Good Citizens (TIME For Kids)', entrees: [
            { t: 'Talk About It', p: 346 },
            { t: 'Pledging Allegiance (Vocabulary/Comprehension : Problem and Solution)', p: 348 },
            // Trois pages coupées sur le sommaire transmis : mêmes écarts que
            // les autres thèmes TIME For Kids. À vérifier sur le livre.
            { t: 'An American Hero Flies Again (Nonfiction Article)', p: 350 },
            { t: 'Who Is Uncle Sam? (Social Studies)', p: 354 },
            { t: 'Writing: Fictional Narrative', p: 356 },
          ] },
          { titre: 'Working Together', entrees: [
            { t: 'Talk About It', p: 358 },
            { t: "Dogs for the Deaf (Vocabulary/Comprehension : Author's Purpose)", p: 360 },
            { t: 'Mother to Tigers (Biography)', p: 362, auteur: 'George Ella Lyon, ill. Peter Catalanotto' },
            { t: 'The Lion and the Mouse (Fable)', p: 380, auteur: 'raconté par Max McGee' },
            { t: 'Writing: Expository Writing', p: 382 },
          ] },
          { titre: 'Raising Butterflies', entrees: [
            { t: 'Talk About It', p: 384 },
            { t: 'Save Our Butterflies (Vocabulary/Comprehension : Draw Conclusions)', p: 386 },
            { t: 'Home-Grown Butterflies, from « Ranger Rick » (Nonfiction Article)', p: 388, auteur: 'Deborah Churchman' },
            { t: 'Monarch Butterfly (Poetry)', p: 400, auteur: 'Marilyn Singer' },
            { t: 'The Caterpillar (Poetry)', p: 401, auteur: 'Christina Rossetti' },
            { t: 'Writing: Expository Writing', p: 402 },
          ] },
        ],
        test: { titre: 'Test Strategy: On My Own', entrees: [
          { t: 'A Change in Plans (Informational Nonfiction)', p: 404 },
        ] },
      },
    ],
  },
]

// Une section d'écran par thème, plus une par Test Strategy, dans l'ordre du
// livre. L'unité imprimée est rappelée par `rubrique`.
let rang = 0
const unites = VOLUMES.flatMap(v =>
  v.unites.flatMap(u =>
    [...u.themes, u.test].map(section => ({
      numero: ++rang,
      titre: section.titre,
      rubrique: `Unit ${u.unite} — ${u.titre} · volume ${v.volume}`,
      lecons: section.entrees.map(e => ({
        numero: v.volume * 1000 + e.p,
        titre: e.t,
        page: e.p,
        tome: v.volume,
        ...(e.auteur ? { auteur: e.auteur } : {}),
      })),
    }))
  )
)

export default {
  cle: 'english-ce1',
  groupe: 'CE1-CE2',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Grade 3',

  numerote: false,
  // Les sections de l'écran sont des thèmes ; « Unit » désigne dans ce livre le
  // grand découpage, rappelé sous chaque titre.
  libelleUnite: 'Thème',

  unites,
}

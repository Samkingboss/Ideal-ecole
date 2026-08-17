// Programme officiel d'English CP1 — « Treasures », volumes 1 à 6
// (Macmillan / McGraw-Hill).
//
// Ce manuel est le plus profond des cinq : trois niveaux, comme Boscher, mais
// avec beaucoup plus d'entrées. Chaque volume porte une unité ; chaque unité
// compte cinq thèmes ; chaque thème compte cinq entrées, toujours dans le même
// ordre — Talk About It, Words to Know, la lecture principale, la lecture
// associée, l'atelier d'écriture. Chaque unité se referme sur une Test
// Strategy, qui n'appartient à aucun thème : elle forme donc sa propre section.
//
// Les thèmes deviennent les unités de l'écran (36 sections en tout, 30 thèmes
// et 6 test strategies) ; le volume dont ils relèvent est porté par `rubrique`.
// C'est le thème que l'enseignante prépare, pas le volume : il fallait qu'il
// soit l'unité de navigation.
//
// L'identifiant ne peut pas être la page seule, contrairement aux autres
// manuels : les volumes 1 à 4 commencent tous à la page 6, et le volume 5 à la
// page 8. Une même page existe donc six fois. On identifie une entrée par
// `volume * 1000 + page` — 1006 pour la page 6 du volume 1, 6158 pour la page
// 158 du volume 6. Ce nombre ne s'affiche jamais : `numerote: false` fait
// désigner les entrées par leur titre et leur page imprimée.
//
// Les volumes 5 et 6 partagent une même reliure : la pagination du volume 6
// continue celle du volume 5 (8–154 puis 158–316). C'est bien ce qu'imprime le
// sommaire, ce n'est pas une erreur de transcription.
//
// Les glossaires de fin de volume ne figurent pas dans le programme : ce sont
// des pages de référence, pas des séances.

// ─── Source, telle qu'imprimée au sommaire ───────────────────────────────────
//
// Écrite à plat pour rester relisible en face du livre. Les identifiants et la
// structure de l'écran en sont dérivés plus bas : rien à calculer à la main.

const VOLUMES = [
  {
    volume: 1, titre: 'All About Us',
    themes: [
      { titre: 'We Are Special', entrees: [
        { t: 'Talk About It', p: 6 },
        { t: 'Can Pat Jump? (Words to Know)', p: 8 },
        { t: 'Pam and Sam (Fantasy)', p: 14, auteur: 'Nancy Tafuri' },
        { t: 'Our Best Days (Social Studies)', p: 28 },
        { t: 'Writing: Personal Narrative', p: 34 },
      ] },
      { titre: 'Ready, Set, Move!', entrees: [
        { t: 'Talk About It', p: 36 },
        { t: 'Yes, I Can! (Words to Know)', p: 38 },
        { t: 'I Can! Can You? (Rhyming Story)', p: 44, auteur: 'Cathy Roper, ill. Lorinda Bryan Cauley' },
        { t: 'Run! Jump! Swim! (Science)', p: 58 },
        { t: 'Writing: Personal Narrative', p: 64 },
      ] },
      { titre: 'Growing Up', entrees: [
        { t: 'Talk About It', p: 66 },
        { t: 'I Am a Big Kid (Words to Know)', p: 68 },
        { t: 'How You Grew (Nonfiction Article)', p: 70 },
        { t: 'Birds Get Big (Social Studies)', p: 78 },
        { t: 'Writing: Descriptive', p: 80 },
      ] },
      { titre: 'Pets', entrees: [
        { t: 'Talk About It', p: 82 },
        { t: 'Come Down, Brad! (Words to Know)', p: 84 },
        { t: 'Pet Tricks (Realistic Fiction)', p: 90, auteur: 'Ed Reyes, ill. Joe Cepeda' },
        { t: 'What Pets Need (Science)', p: 106 },
        { t: 'Writing: Descriptive', p: 110 },
      ] },
      { titre: 'Teamwork', entrees: [
        { t: 'Talk About It', p: 112 },
        { t: 'Help for Hank (Words to Know)', p: 114 },
        { t: 'Soccer (Nonfiction)', p: 120, auteur: 'Patrick Lee, photographies de Ken Cavanagh' },
        { t: 'Guess What! (Poetry)', p: 136, auteur: 'Michael Strickland' },
        { t: 'Writing: Persuasive', p: 138 },
      ] },
    ],
    test: { titre: 'Test Strategy: Right There', entrees: [
      { t: 'Jill and Nat (Realistic Fiction)', p: 140 },
    ] },
  },

  {
    volume: 2, titre: 'Outside My Door',
    themes: [
      { titre: 'Animal Families', entrees: [
        { t: 'Talk About It', p: 6 },
        { t: 'One Frog, Two Frogs (Words to Know)', p: 8 },
        { t: 'Animal Moms and Dads (Nonfiction)', p: 14, auteur: 'Jose Ramos' },
        { t: 'Over in the Meadow (Poetry)', p: 30 },
        { t: 'Writing: Report', p: 36 },
      ] },
      { titre: 'Helping Out', entrees: [
        { t: 'Talk About It', p: 38 },
        { t: 'Who Will Help? (Words to Know)', p: 40 },
        { t: 'Little Red Hen (Folk Tale)', p: 46, auteur: 'raconté par Cynthia Rothman, ill. David Diaz' },
        { t: 'From Wheat to Bread (Science)', p: 62 },
        { t: 'Writing: How-To', p: 68 },
      ] },
      { titre: 'Where Animals Live', entrees: [
        { t: 'Talk About It', p: 70 },
        { t: 'Ants Go In and Out (Words to Know)', p: 72 },
        { t: 'A Prairie Dog Home (Nonfiction Article)', p: 74 },
        { t: 'A Koala Home (Science)', p: 82 },
        { t: 'Writing: Report', p: 84 },
      ] },
      { titre: 'Sing and Dance!', entrees: [
        { t: 'Talk About It', p: 86 },
        { t: 'A Fun Show (Words to Know)', p: 88 },
        { t: "The Fun Kids' Band (Realistic Fiction)", p: 94, auteur: 'Anne Miranda, ill. Lynne Cravath' },
        { t: 'Shake a Rattle! (Performing Arts)', p: 112 },
        { t: 'Writing: Story', p: 116 },
      ] },
      { titre: "Let's Laugh", entrees: [
        { t: 'Talk About It', p: 118 },
        { t: 'Glen Is Late! (Words to Know)', p: 120 },
        { t: 'On My Way to School (Main Selection)', p: 126, auteur: 'Wong Herbert Yee' },
        { t: 'Take a Riddle Ride (Language Arts)', p: 144 },
        { t: 'Writing: Rhyme', p: 148 },
      ] },
    ],
    test: { titre: 'Test Strategy: Right There', entrees: [
      { t: 'Lost! (Realistic Fiction)', p: 150 },
    ] },
  },

  {
    volume: 3, titre: "Let's Connect!",
    themes: [
      { titre: 'Being Friends', entrees: [
        { t: 'Talk About It', p: 6 },
        { t: 'A Good Game for All (Words to Know)', p: 8 },
        { t: "Kate's Game (Fantasy)", p: 14, auteur: 'Janie Bynum' },
        { t: 'When You Mail a Letter (Social Studies)', p: 32 },
        { t: 'Writing: Personal Narrative', p: 38 },
      ] },
      { titre: 'Kids Around the World', entrees: [
        { t: 'Talk About It', p: 40 },
        { t: 'When Kids Play (Words to Know)', p: 42 },
        { t: 'Kids Can Help (Nonfiction)', p: 48, auteur: 'Minda Novek' },
        { t: 'Poems by Kids (Social Studies)', p: 66 },
        { t: 'Writing: Personal Narrative', p: 70 },
      ] },
      { titre: 'Me and My Shadow', entrees: [
        { t: 'Talk About It', p: 72 },
        { t: 'Light Game (Words to Know)', p: 74 },
        { t: 'Short Shadows, Long Shadows (Nonfiction Article)', p: 76 },
        { t: 'The Sun (Science)', p: 84 },
        { t: 'Writing: Descriptive', p: 86 },
      ] },
      { titre: 'Our Families', entrees: [
        { t: 'Talk About It', p: 88 },
        { t: 'A Funny Dog for Ike (Words to Know)', p: 90 },
        { t: 'Smile, Mike! (Play)', p: 96, auteur: 'Aida Marcuse, ill. G. Brian Karas' },
        { t: 'Family Fun (Social Studies)', p: 114 },
        { t: 'Writing: Descriptive', p: 118 },
      ] },
      { titre: 'Family Time', entrees: [
        { t: 'Talk About It', p: 120 },
        { t: 'What I Like About Spring (Words to Know)', p: 122 },
        { t: 'Gram and Me (Main Selection)', p: 128, auteur: 'Miriam Cohen, ill. Floyd Cooper' },
        { t: 'Celebrate Chinese New Year (Social Studies)', p: 148 },
        { t: 'Writing: Story', p: 152 },
      ] },
    ],
    test: { titre: 'Test Strategy: Think and Search', entrees: [
      { t: "Let's Go! (Play)", p: 154 },
    ] },
  },

  {
    volume: 4, titre: 'Nature Watch',
    themes: [
      { titre: 'Birds', entrees: [
        { t: 'Talk About It', p: 6 },
        { t: 'Floating Home (Words to Know)', p: 8 },
        { t: 'Pelican Was Hungry (Informational Story)', p: 10, auteur: 'Jim Arnosky' },
        { t: 'Seagull (Poetry)', p: 28 },
        { t: 'Writing: Persuasive', p: 30 },
      ] },
      { titre: 'Recycling', entrees: [
        { t: 'Talk About It', p: 32 },
        { t: 'Old Stuff, New Stuff, Used Stuff (Words to Know)', p: 34 },
        { t: 'June Robot Cleans Up (Fantasy)', p: 36, auteur: 'Mary Anderson, ill. Michael Garland' },
        { t: 'A Bottle Takes a Trip (Social Studies)', p: 56 },
        { t: 'Writing: Persuasive', p: 62 },
      ] },
      { titre: "What's the Weather?", entrees: [
        { t: 'Talk About It', p: 64 },
        { t: 'Warm and Cold Days (Words to Know)', p: 66 },
        { t: 'Stormy Weather (Nonfiction Article)', p: 68 },
        { t: 'Dangerous Storms (Science)', p: 76 },
        { t: 'Writing: Report', p: 78 },
      ] },
      { titre: 'What Scientists Do', entrees: [
        { t: 'Talk About It', p: 80 },
        { t: 'Be Curious (Words to Know)', p: 82 },
        { t: 'Meet Ben Franklin (Biography)', p: 84, auteur: 'Philip Dray, ill. John Kanzler' },
        { t: 'A Close Look (Science)', p: 104 },
        { t: 'Writing: Report', p: 108 },
      ] },
      { titre: 'Favorite Stories', entrees: [
        { t: 'Talk About It', p: 110 },
        { t: 'Have You Heard This Silly Tale? (Words to Know)', p: 112 },
        { t: 'Little Rabbit (Folk Tale)', p: 114, auteur: 'Gerald McDermott' },
        { t: 'Henny Penny (Social Studies)', p: 134 },
        { t: 'Writing: Story', p: 138 },
      ] },
    ],
    test: { titre: 'Test Strategy: Think and Search', entrees: [
      { t: 'How to Make a Paper Chain (How-To)', p: 140 },
    ] },
  },

  {
    volume: 5, titre: 'Adventures All Around',
    themes: [
      { titre: 'Express Yourself', entrees: [
        { t: 'Talk About It', p: 8 },
        { t: 'We Love Joan (Words to Know)', p: 10 },
        { t: 'Olivia (Fantasy)', p: 12, auteur: 'Ian Falconer' },
        { t: 'Cats in Art (Fine Arts)', p: 38 },
        { t: 'Writing: Invitation', p: 42 },
      ] },
      { titre: 'Watch It Go', entrees: [
        { t: 'Talk About It', p: 44 },
        { t: 'See the Ball Fly! (Words to Know)', p: 46 },
        { t: 'The Kite, extrait de Days with Frog and Toad (Fantasy)', p: 48, auteur: 'Arnold Lobel' },
        { t: 'Toys That Fly (Science)', p: 64 },
        { t: 'Writing: Personal Narrative', p: 68 },
      ] },
      { titre: 'Inventions', entrees: [
        { t: 'Talk About It', p: 70 },
        { t: 'Invent It! (Words to Know)', p: 72 },
        { t: "Kids' Inventions (Nonfiction Article)", p: 74 },
        { t: 'Helping Drivers See (Social Studies)', p: 82 },
        { t: 'Writing: How-To', p: 84 },
      ] },
      { titre: 'I Can Do It', entrees: [
        { t: 'Talk About It', p: 86 },
        { t: 'Nothing Stops Cory (Words to Know)', p: 88 },
        { t: 'Whistle for Willie (Realistic Fiction)', p: 90, auteur: 'Ezra Jack Keats' },
        { t: 'A Winning Swimmer (Social Studies)', p: 120 },
        { t: 'Writing: How-To', p: 126 },
      ] },
      { titre: 'How Does It Grow?', entrees: [
        { t: 'Talk About It', p: 128 },
        { t: 'Beautiful Plants (Words to Know)', p: 130 },
        { t: 'A Fruit Is a Suitcase for Seeds (Nonfiction)', p: 132, auteur: 'Jean Richards, ill. Anca Hariton' },
        { t: 'Flowers at Night (Poetry)', p: 150, auteur: 'Aileen Fisher' },
        { t: 'Writing: Descriptive', p: 152 },
      ] },
    ],
    test: { titre: 'Test Strategy: Author and Me', entrees: [
      { t: 'All About Giraffes (Nonfiction)', p: 154 },
    ] },
  },

  {
    volume: 6, titre: "Let's Discover!",
    themes: [
      { titre: 'Bugs, Bugs, Bugs!', entrees: [
        { t: 'Talk About It', p: 158 },
        { t: 'Where Has Freddy Gone Now? (Words to Know)', p: 160 },
        { t: 'Dot and Jabber and the Big Bug Mystery (Mystery)', p: 162, auteur: 'Ellen Stoll Walsh' },
        { t: 'The World of Insects (Science)', p: 190 },
        { t: 'Writing: Personal Narrative', p: 194 },
      ] },
      { titre: 'Exploring Space', entrees: [
        { t: 'Talk About It', p: 196 },
        { t: 'A Good Trip into Space (Words to Know)', p: 198 },
        { t: 'Blue Jay Finds a Way (Fantasy)', p: 200, auteur: 'Fran Manushkin, ill. Barry Rockwell' },
        { t: 'Meet Ellen Ochoa (Science)', p: 218 },
        { t: 'Writing: Personal Narrative', p: 224 },
      ] },
      { titre: 'At Work', entrees: [
        { t: 'Talk About It', p: 226 },
        { t: 'A Job For You (Words to Know)', p: 228 },
        { t: 'Cool Jobs (Nonfiction Article)', p: 230 },
        { t: 'Jobs at School (Social Studies)', p: 238 },
        { t: 'Writing: Report', p: 240 },
      ] },
      { titre: 'Watching Animals Grow', entrees: [
        { t: 'Talk About It', p: 242 },
        { t: 'A Bear Cub (Words to Know)', p: 244 },
        { t: 'A Tiger Cub Grows Up (Nonfiction)', p: 246, auteur: 'Joan Hewett, photographies de Richard Hewett' },
        { t: 'The Tiger (Poetry)', p: 272, auteur: 'Douglas Florian' },
        { t: 'Writing: Report', p: 274 },
      ] },
      { titre: "Let's Build", entrees: [
        { t: 'Talk About It', p: 276 },
        { t: 'The Town That Grew (Words to Know)', p: 278 },
        { t: 'Sand Castle (Realistic Fiction)', p: 280, auteur: 'Brenda Shannon Yee, ill. Thea Kliros' },
        { t: 'Build with Sand and Ice (Social Studies)', p: 306 },
        { t: 'Writing: Story', p: 310 },
      ] },
    ],
    test: { titre: 'Test Strategy: Author and Me', entrees: [
      { t: 'First a Caterpillar… Then a Butterfly (Nonfiction)', p: 312 },
    ] },
  },
]

// ─── Construction des sections de l'écran ────────────────────────────────────
//
// Une section par thème, plus une par Test Strategy, numérotées dans l'ordre du
// livre. L'identifiant d'une entrée mêle le volume et la page pour rester
// unique d'un bout à l'autre de la collection.

let rang = 0
const unites = VOLUMES.flatMap(v =>
  [...v.themes, v.test].map(section => ({
    numero: ++rang,
    titre: section.titre,
    rubrique: `Volume ${v.volume} — ${v.titre}`,
    lecons: section.entrees.map(e => ({
      numero: v.volume * 1000 + e.p,
      titre: e.t,
      page: e.p,
      tome: v.volume,
      ...(e.auteur ? { auteur: e.auteur } : {}),
    })),
  }))
)

export default {
  cle: 'english-cp1',
  groupe: 'CP1',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Grade 1 (volumes 1 à 6)',

  // Le livre ne numérote pas ses leçons : l'écran les désigne par leur titre et
  // leur page. L'identifiant interne ne s'affiche jamais.
  numerote: false,

  // Les sections de l'écran sont des thèmes. Les appeler « unités » entrerait
  // en collision avec les « Units » du livre, qui sont les six volumes.
  libelleUnite: 'Thème',

  unites,
}

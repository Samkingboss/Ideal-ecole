// Programme officiel d'English CM — « Treasures », Grade 4
// (Macmillan / McGraw-Hill).
//
// Quatrième niveau de la collection déjà transcrite pour le CP1, le CP2 et le
// CE1, et même architecture : six unités, cinq thèmes par unité, cinq entrées
// par thème — Talk About It, la page de vocabulaire et compréhension, la
// lecture principale, la lecture associée, l'atelier d'écriture — et une Test
// Strategy qui referme chaque unité sans appartenir à aucun thème.
//
// Les deux niveaux du CM sont jumelés : ce manuel sert au CM1 comme au CM2, et
// il est rattaché au groupe CM1-CM2 tel qu'il figure à l'emploi du temps.
//
// ── Un seul volume, contrairement aux niveaux précédents ────────────────────
// Le CP2 tenait en deux volumes et le CP1 en six, chacun rejouant les mêmes
// numéros de page ; il fallait mêler le volume à la page pour distinguer les
// séances. Ici la pagination court d'un bout à l'autre, de la page 16 à la
// page 760 : la page suffit à désigner une entrée, et aucun tome n'est à
// mentionner.
//
// ── Le découpage des unités ne se devine pas ────────────────────────────────
// Au CE1, les bandeaux d'unité du sommaire tombaient en travers des pages et
// il avait fallu déduire les frontières de la régularité du livre. Ici chaque
// unité tient sur une double page entière : Unit 1 pages 16 à 140, Unit 2 de
// 144 à 256, Unit 3 de 260 à 388, Unit 4 de 392 à 510, Unit 5 de 514 à 634,
// Unit 6 de 638 à 760. Rien à déduire.
//
// Le découpage confirme au passage la règle lue au CE1 : le thème TIME For
// Kids occupe la troisième place de chaque unité, et la Test Strategy la
// referme. Six unités sur six, ici comme là-bas.
//
// Le glossaire de fin d'ouvrage ne figure pas au programme : page de
// référence, pas une séance.

const UNITES = [
  {
    unite: 1, titre: 'Challenges',
    themes: [
      { titre: 'School Contests', entrees: [
        { t: 'Talk About It', p: 16 },
        { t: 'The Talent Contest (Vocabulary/Comprehension : Character and Plot)', p: 18 },
        { t: 'Miss Alaineus (Realistic Fiction)', p: 20, auteur: 'écrit et illustré par Debra Frasier' },
        { t: 'The National Spelling Bee (Language Arts)', p: 42, auteur: 'Nicole Lee' },
        { t: 'Writing: Personal Narrative', p: 46 },
      ] },
      { titre: 'American Legends', entrees: [
        { t: 'Talk About It', p: 48 },
        { t: "Grandma's Tales (Vocabulary/Comprehension : Plot and Setting)", p: 50 },
        { t: 'Davy Crockett Saves the World (Tall Tale)', p: 52, auteur: 'écrit et illustré par Rosalyn Schanzer' },
        { t: 'The Tales Are Getting Taller (Social Studies)', p: 72, auteur: 'Kyle Seulen' },
        { t: 'Writing: Personal Narrative', p: 76 },
      ] },
      { titre: 'Trees for Life (TIME For Kids)', entrees: [
        { t: 'Talk About It', p: 78 },
        { t: 'TREE-RIFIC! (Vocabulary/Comprehension)', p: 80 },
        { t: 'Forests of the World (Nonfiction Article)', p: 82 },
        { t: 'The Science of Wildfires (Science)', p: 86 },
        { t: 'Writing: Extended Response to Literature', p: 88 },
      ] },
      { titre: 'Exploring Space', entrees: [
        { t: 'Talk About It', p: 90 },
        { t: 'Jobs in Space (Vocabulary/Comprehension : Summarize)', p: 92 },
        { t: 'Ultimate Field Trip 5: Blasting Off to Space Academy (Nonfiction)', p: 94, auteur: 'Susan E. Goodman, photos de Michael J. Doolittle' },
        { t: "I'm Building a Rocket (Poetry)", p: 108, auteur: 'Kenn Nesbitt' },
        { t: 'Writing: Personal Narrative', p: 110 },
      ] },
      { titre: 'Rescue Dogs', entrees: [
        { t: 'Talk About It', p: 112 },
        { t: "It's a Dog's Life (Vocabulary/Comprehension : Cause and Effect)", p: 114 },
        { t: 'Pipiolo and the Roof Dogs (Fantasy)', p: 116, auteur: 'Brian Meunier, ill. Perky Edgerton' },
        { t: 'Doggone Work (Science)', p: 134, auteur: 'Lori Marquez' },
        { t: 'Writing: Personal Narrative', p: 138 },
      ] },
    ],
    test: { titre: 'Test Strategy: Think and Search', entrees: [
      { t: 'The Year of the Two Winters (Drama)', p: 140 },
    ] },
  },
  {
    unite: 2, titre: 'Discoveries',
    themes: [
      { titre: 'People Helping Animals', entrees: [
        { t: 'Talk About It', p: 144 },
        { t: 'A Real Survivor (Vocabulary/Comprehension : Make Inferences)', p: 146 },
        { t: 'Shiloh (Realistic Fiction)', p: 148, auteur: 'Phyllis Reynolds Naylor, ill. Joel Spector' },
        { t: 'Love at First Sight (Social Studies)', p: 164, auteur: 'Amy Yin' },
        { t: 'Writing: Persuasive Writing', p: 168 },
      ] },
      { titre: 'Slithery Snakes!', entrees: [
        { t: 'Talk About It', p: 170 },
        { t: 'Poisonous Snakes (Vocabulary/Comprehension : Main Idea and Details)', p: 172 },
        { t: 'Rattlers! (Nonfiction Article)', p: 174, auteur: 'Ellen Lambeth' },
        { t: 'How Poison Came into the World (Language Arts)', p: 188, auteur: 'raconté par Paul Sirls' },
        { t: 'Writing: Persuasive Writing', p: 190 },
      ] },
      { titre: 'Remembering the Past (TIME For Kids)', entrees: [
        { t: 'Talk About It', p: 192 },
        { t: 'Toward Freedom (Vocabulary/Comprehension)', p: 194 },
        { t: 'Maya Lin, Architect of Memory (Nonfiction Article)', p: 196 },
        { t: 'A Salute to Servicewomen (Social Studies)', p: 200 },
        { t: 'Writing: Personal Narrative', p: 202 },
      ] },
      { titre: 'The Caribbean Islands', entrees: [
        { t: 'Talk About It', p: 204 },
        { t: 'Johanna in Jamaica (Vocabulary/Comprehension : Problem and Solution)', p: 206 },
        { t: 'The Night of San Juan (Fiction)', p: 208, auteur: '« Salsa Stories » de Lulu Delacre, ill. Edel Rodriguez' },
        { t: 'Islands of the Caribbean (Social Studies)', p: 222, auteur: 'Kaneesha Smith' },
        { t: 'Writing: Persuasive Writing', p: 226 },
      ] },
      { titre: 'Cowboys and Cowgirls', entrees: [
        { t: 'Talk About It', p: 228 },
        { t: 'The Life of a Cowboy (Vocabulary/Comprehension : Make Inferences)', p: 230 },
        { t: 'Black Cowboy Wild Horses (Biography)', p: 232, auteur: 'Julius Lester, ill. Jerry Pinkney' },
        { t: 'Home on the Range (Poetry)', p: 252, auteur: 'John A. Lomax, musique de Daniel Kelley' },
        { t: 'Writing: Persuasive Writing', p: 254 },
      ] },
    ],
    test: { titre: 'Test Strategy: Author and Me', entrees: [
      { t: 'The Story of Radio (Social Studies)', p: 256 },
    ] },
  },
  {
    unite: 3, titre: 'Turning Points',
    themes: [
      { titre: 'The American Revolution', entrees: [
        { t: 'Talk About It', p: 260 },
        { t: 'Letters from the Revolution (Vocabulary/Comprehension : Draw Conclusions)', p: 262 },
        { t: 'Sleds on Boston Common (Historical Fiction)', p: 264, auteur: 'Louise Borden, ill. Robert Andrew Parker' },
        { t: "Excerpt from Paul Revere's Ride (Poetry)", p: 284, auteur: 'Henry Wadsworth Longfellow' },
        { t: 'Writing: Fictional Narrative', p: 288 },
      ] },
      { titre: 'The Right to Vote', entrees: [
        { t: 'Talk About It', p: 290 },
        { t: 'Your Vote, Your Voice (Vocabulary/Comprehension : Fact and Opinion)', p: 292 },
        { t: 'When Esther Morris Headed West (Biography)', p: 294, auteur: 'Connie Nordhielm Wooldridge, ill. Jacqueline Rogers' },
        { t: 'Suffrage for Women (Social Studies)', p: 308, auteur: 'Maria Chan' },
        { t: 'Writing: Poem', p: 312 },
      ] },
      { titre: 'Protecting the Environment (TIME For Kids)', entrees: [
        { t: 'Talk About It', p: 314 },
        { t: 'Environmental Dangers (Vocabulary/Comprehension)', p: 316 },
        { t: 'Beyond the Horizon (Nonfiction Article)', p: 318 },
        { t: 'Keeping the Wilderness Wild (Science)', p: 322 },
        { t: 'Writing: Persuasive Writing', p: 324 },
      ] },
      { titre: 'Desert Habitats', entrees: [
        { t: 'Talk About It', p: 326 },
        { t: 'The Best Place to Be (Vocabulary/Comprehension : Compare and Contrast)', p: 328 },
        { t: "My Great-Grandmother's Gourd (Realistic Fiction)", p: 330, auteur: 'Cristina Kessler, ill. Walter Lyon Krudop' },
        { t: 'More Than Sand (Science)', p: 350, auteur: 'Haritha Gupta' },
        { t: 'Writing: Fictional Narrative', p: 354 },
      ] },
      { titre: 'Into the Future', entrees: [
        { t: 'Talk About It', p: 356 },
        { t: "Who Says Robots Can't Think? (Vocabulary/Comprehension : Draw Conclusions)", p: 358 },
        { t: 'Zathura (Science Fiction)', p: 360, auteur: 'écrit et illustré par Chris Van Allsburg' },
        { t: 'Robots Today & Tomorrow (Science)', p: 384, auteur: 'William Brackman' },
        { t: 'Writing: Fictional Narrative', p: 386 },
      ] },
    ],
    test: { titre: 'Test Strategy: Author and Me', entrees: [
      { t: 'Everybody Can Serve (Social Studies)', p: 388 },
    ] },
  },
  {
    unite: 4, titre: 'Experiences',
    themes: [
      { titre: 'Civil Rights', entrees: [
        { t: 'Talk About It', p: 392 },
        { t: 'Lunch Counter Encounter (Vocabulary/Comprehension : Character and Setting)', p: 394 },
        { t: "Goin' Someplace Special (Historical Fiction)", p: 396, auteur: 'Patricia C. McKissack, ill. Jerry Pinkney' },
        { t: 'Through My Eyes (Social Studies)', p: 414, auteur: 'Ruby Bridges' },
        { t: 'Writing: Expository Writing', p: 418 },
      ] },
      { titre: 'Animal Defenses', entrees: [
        { t: 'Talk About It', p: 420 },
        { t: "Nosey and the Porcupine (Vocabulary/Comprehension : Author's Purpose)", p: 422 },
        { t: 'Carlos and the Skunk (Realistic Fiction)', p: 424, auteur: 'Jan Romero Stevens, ill. Jeanne Arnold' },
        { t: 'Animal Self-Defense (Science)', p: 442, auteur: 'Elle Wainwright' },
        { t: 'Writing: Expository Writing', p: 446 },
      ] },
      { titre: 'Democracy (TIME For Kids)', entrees: [
        { t: 'Talk About It', p: 448 },
        { t: 'Party Animals (Vocabulary/Comprehension)', p: 450 },
        { t: 'Getting Out the Vote (Nonfiction Article)', p: 452 },
        { t: 'Welcome to Russia (Social Studies)', p: 456 },
        { t: 'Writing: Fictional Narrative', p: 458 },
      ] },
      { titre: 'Extreme Weather', entrees: [
        { t: 'Talk About It', p: 460 },
        { t: 'The Extreme Costs of Extreme Weather (Vocabulary/Comprehension : Description)', p: 462 },
        { t: 'Hurricanes (Informational Nonfiction)', p: 464, auteur: 'Seymour Simon' },
        { t: 'Suspense (Poetry)', p: 478, auteur: 'Pat Mora' },
        { t: 'Writing: Expository Writing', p: 480 },
      ] },
      { titre: 'Trickster Tales', entrees: [
        { t: 'Talk About It', p: 482 },
        { t: "Anansi and Common Sense (Vocabulary/Comprehension : Author's Purpose)", p: 484 },
        { t: 'The Catch of the Day, A Trickster Play (Play)', p: 486, auteur: 'Angela Shelf Medearis, ill. Wendy Born Hollander' },
        { t: 'The Fox and the Crow (Language Arts)', p: 506, auteur: 'raconté par Mei Kirimoto' },
        { t: 'Writing: Expository Writing', p: 508 },
      ] },
    ],
    test: { titre: 'Test Strategy: Right There', entrees: [
      { t: 'Thomas Alva Edison (Science)', p: 510 },
    ] },
  },
  {
    unite: 5, titre: 'Achievements',
    themes: [
      { titre: 'North Pole, South Pole', entrees: [
        { t: 'Talk About It', p: 514 },
        { t: 'Ice and More Ice (Vocabulary/Comprehension : Problem and Solution)', p: 516 },
        { t: 'Spirit of Endurance (Nonfiction)', p: 518, auteur: 'Jennifer Armstrong' },
        { t: 'The Bottom of the World (Social Studies)', p: 536, auteur: 'Mary Ann Williams' },
        { t: 'Writing: Descriptive Writing', p: 540 },
      ] },
      { titre: 'Fantastic Foods', entrees: [
        { t: 'Talk About It', p: 542 },
        { t: 'Juanita and the Cornstalk (Vocabulary/Comprehension : Theme)', p: 544 },
        { t: 'Weslandia (Fantasy)', p: 546, auteur: 'Paul Fleischman, ill. Kevin Hawkes' },
        { t: 'Blue Potatoes and Square Watermelons (Science)', p: 562, auteur: 'Omar Naid' },
        { t: 'Writing: Descriptive Writing', p: 564 },
      ] },
      { titre: 'Learning From Nature (TIME For Kids)', entrees: [
        { t: 'Talk About It', p: 566 },
        { t: 'The Healing Power of Plants (Vocabulary/Comprehension)', p: 568 },
        { t: 'A Historic Journey (Nonfiction Article)', p: 570 },
        { t: 'Designed by Nature (Science)', p: 574 },
        { t: 'Writing: Persuasive Essay', p: 576 },
      ] },
      { titre: 'Talking in Codes', entrees: [
        { t: 'Talk About It', p: 578 },
        { t: "Rita, The Storyteller (Vocabulary/Comprehension : Author's Perspective)", p: 580 },
        { t: 'The Unbreakable Code (Historical Fiction)', p: 582, auteur: 'Sara Hoagland Hunter, ill. Julia Miner' },
        { t: 'Navajo Code Talkers: Five Cinquains (Poetry)', p: 600, auteur: 'Mary Willie' },
        { t: 'Writing: Descriptive Writing', p: 602 },
      ] },
      { titre: 'Whales', entrees: [
        { t: 'Talk About It', p: 604 },
        { t: 'A Song for Makaio (Vocabulary/Comprehension : Summarize)', p: 606 },
        { t: 'The Gri Gri Tree (Realistic Fiction)', p: 608, auteur: 'Lynn Joseph, ill. Marla Baggetta' },
        { t: 'The Largest Creature on Earth (Science)', p: 628, auteur: 'Yolanda Robertson' },
        { t: 'Writing: Descriptive Poem', p: 632 },
      ] },
    ],
    test: { titre: 'Test Strategy: Author and Me', entrees: [
      { t: 'The Work of Giants (Social Studies)', p: 634 },
    ] },
  },
  {
    unite: 6, titre: 'Great Ideas',
    themes: [
      { titre: 'Fairy Tales', entrees: [
        { t: 'Talk About It', p: 638 },
        { t: 'A Real Princess (Vocabulary/Comprehension : Sequence)', p: 640 },
        { t: 'The Golden Mare, the Firebird, and the Magic Ring (Fairy Tale)', p: 642, auteur: 'écrit et illustré par Ruth Sanderson' },
        { t: 'A Tale Told Around the World (Social Studies)', p: 662, auteur: 'Lateesha Gray' },
        { t: 'Writing: Explanatory Writing', p: 666 },
      ] },
      { titre: 'Camping Out', entrees: [
        { t: 'Talk About It', p: 668 },
        { t: 'The Best Fourth of July (Vocabulary/Comprehension : Make Judgments)', p: 670 },
        { t: 'Skunk Scout (Realistic Fiction)', p: 672, auteur: 'Laurence Yep, ill. Winson Trang' },
        { t: 'Our National Parks (Science)', p: 692, auteur: 'Tanya Sumanga' },
        { t: 'Writing: Explanatory Writing', p: 696 },
      ] },
      { titre: 'Improving Lives (TIME For Kids)', entrees: [
        { t: 'Talk About It', p: 698 },
        { t: 'The New Gym (Vocabulary/Comprehension)', p: 700 },
        { t: 'A Dream Comes True (Nonfiction Article)', p: 702 },
        { t: 'Profile of a Paralympian (Social Studies)', p: 706 },
        { t: 'Writing: Persuasive Editorial', p: 708 },
      ] },
      { titre: 'Balloon Flight', entrees: [
        { t: 'Talk About It', p: 710 },
        { t: 'The Science of Hot-Air Balloons (Vocabulary/Comprehension : Make Generalizations)', p: 712 },
        { t: 'Up in the Air: The Story of Balloon Flight (Nonfiction)', p: 714, auteur: 'Patricia Lauber' },
        { t: 'Hot-Air Balloon Haiku (Poetry)', p: 732, auteur: 'Rita Bristol' },
        { t: 'Writing: Explanatory Writing', p: 734 },
      ] },
      { titre: 'Scientists at Work', entrees: [
        { t: 'Talk About It', p: 736 },
        { t: 'Dr. Priscilla C. Grew, Geologist (Vocabulary/Comprehension : Sequence)', p: 738 },
        { t: 'Hidden Worlds (Nonfiction)', p: 740, auteur: 'Stephen Kramer, photos de Dennis Kunkel' },
        { t: 'Mountain of Fire: A Native American Myth (Language Arts)', p: 754, auteur: 'raconté par Grace Armstrong' },
        { t: 'Writing: Explanatory Writing', p: 758 },
      ] },
    ],
    test: { titre: 'Test Strategy: Author and Me', entrees: [
      { t: 'National Parks: Our National Treasures (Social Studies)', p: 760 },
    ] },
  },
]

// Une section d'écran par thème, plus une par Test Strategy, dans l'ordre du
// livre. L'unité imprimée est rappelée par `rubrique`.
let rang = 0
const unites = UNITES.flatMap(u =>
  [...u.themes, u.test].map(section => ({
    numero: ++rang,
    titre: section.titre,
    rubrique: `Unit ${u.unite} — ${u.titre}`,
    lecons: section.entrees.map(e => ({
      numero: e.p,
      titre: e.t,
      page: e.p,
      ...(e.auteur ? { auteur: e.auteur } : {}),
    })),
  }))
)

export default {
  cle: 'english-cm',
  groupe: 'CM1-CM2',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Grade 4',

  numerote: false,
  // Les sections de l'écran sont des thèmes ; « Unit » désigne dans ce livre le
  // grand découpage, rappelé sous chaque titre.
  libelleUnite: 'Thème',

  unites,
}

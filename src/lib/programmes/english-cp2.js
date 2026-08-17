// Programme officiel d'English CP2 — « Treasures », Grade 2
// (Macmillan / McGraw-Hill).
//
// Même collection que le CP1, structure identique : six unités, cinq thèmes
// par unité, cinq entrées par thème — Talk About It, Words to Know, la lecture
// principale, la lecture associée, l'atelier d'écriture — et une Test Strategy
// qui referme chaque unité sans appartenir à aucun thème.
//
// Une différence avec le CP1, et elle compte pour l'identification : les six
// unités tiennent ici en **deux volumes** et non six. Les unités 1 à 3 se
// suivent de la page 10 à la page 448, les unités 4 à 6 de la page 11 à la
// page 452. Une même page existe donc deux fois dans la collection, et
// l'identifiant mêle le volume à la page — 1010 pour la page 10 du premier
// volume, 2011 pour la page 11 du second. Ce nombre ne s'affiche jamais.
//
// Un thème fait exception à la règle des cinq entrées : « Creating Stories »
// en compte six, le livre y plaçant deux poèmes. On transcrit ce qui est
// imprimé.
//
// Les glossaires de fin de volume ne figurent pas au programme : pages de
// référence, pas des séances.
//
// À la date d'écriture, aucun enseignant n'est affecté à English CP2
// (12 séquences par semaine, soit 6 h). Ce programme ne s'affichera donc dans
// aucun compte tant que l'affectation n'est pas faite.

const VOLUMES = [
  {
    volume: 1,
    unites: [
      {
        unite: 1, titre: 'Relationships',
        themes: [
          { titre: 'School Days', entrees: [
            { t: 'Talk About It', p: 10 },
            { t: 'School Is Starting (Vocabulary/Comprehension)', p: 12 },
            { t: "David's New Friends (Realistic Fiction)", p: 14, auteur: 'Pat Mora, ill. Ed Martinez' },
            { t: "Who's Who at School? (Social Studies)", p: 32, auteur: 'Gail Riley' },
            { t: 'Writing: Personal Narrative', p: 36 },
          ] },
          { titre: 'Making Friends', entrees: [
            { t: 'Talk About It', p: 38 },
            { t: 'Making Muffins and a Friend (Vocabulary/Comprehension)', p: 40 },
            { t: 'Mr. Putter & Tabby Pour the Tea (Fiction)', p: 42, auteur: 'Cynthia Rylant, ill. Arthur Howard' },
            { t: 'Rules of Friendship (Social Studies)', p: 66 },
            { t: 'Writing: Personal Narrative', p: 68 },
          ] },
          { titre: 'Firefighters at Work', entrees: [
            { t: 'Talk About It', p: 70 },
            { t: 'Firehouse Friendships (Vocabulary Selection)', p: 72 },
            { t: 'Fighting the Fire (Nonfiction Article)', p: 74 },
            { t: 'Different Ways to Put Out a Fire (Science)', p: 78 },
            { t: 'Writing: Personal Narrative', p: 80 },
          ] },
          { titre: 'Being Yourself', entrees: [
            { t: 'Talk About It', p: 82 },
            { t: 'A Special Camp (Vocabulary/Comprehension)', p: 84 },
            { t: 'Meet Rosina (Photo Essay)', p: 86, auteur: 'George Ancona' },
            { t: '« You — Tú » (Poetry)', p: 108, auteur: 'Charlotte Pomerantz' },
            { t: 'Writing: Personal Narrative', p: 110 },
          ] },
          { titre: 'Coming to America', entrees: [
            { t: 'Talk About It', p: 112 },
            { t: 'My New Home (Vocabulary/Comprehension)', p: 114 },
            { t: 'My Name Is Yoon (Realistic Fiction)', p: 116, auteur: 'Helen Recorvits, ill. Gabi Swiatkowska' },
            { t: 'New Americans (Social Studies)', p: 144, auteur: 'Ken Lee' },
            { t: 'Writing: Journal Entry', p: 148 },
          ] },
        ],
        test: { titre: 'Test Strategy: Think and Search', entrees: [
          { t: 'Animal Parents and Their Babies (Informational Text)', p: 150 },
        ] },
      },
      {
        unite: 2, titre: 'Growth and Change',
        themes: [
          { titre: 'Plants Alive!', entrees: [
            { t: 'Talk About It', p: 154 },
            { t: 'Plant Power! (Vocabulary/Comprehension)', p: 156 },
            { t: 'The Tiny Seed (Informational Story)', p: 158, auteur: 'Eric Carle' },
            { t: 'Plant Parts (Science)', p: 184 },
            { t: 'Writing: How-To', p: 186 },
          ] },
          { titre: 'Animal Rescue', entrees: [
            { t: 'Talk About It', p: 188 },
            { t: 'A Whale Is Saved! (Vocabulary/Comprehension)', p: 190 },
            { t: 'A Harbor Seal Pup Grows Up (Nonfiction)', p: 192, auteur: 'Joan Hewett, photographies de Richard Hewett' },
            { t: '« The Puppy » (Poetry)', p: 214 },
            { t: 'Writing: How-To', p: 216 },
          ] },
          { titre: 'A Hospital Visit', entrees: [
            { t: 'Talk About It', p: 218 },
            { t: 'A Ride to Help (Vocabulary Selection)', p: 220 },
            { t: 'A Trip to the Emergency Room (Nonfiction Article)', p: 222 },
            { t: 'A Visit to the Dentist (Social Studies)', p: 226 },
            { t: 'Writing: Personal Narrative', p: 228 },
          ] },
          { titre: 'How Animals Grow', entrees: [
            { t: 'Talk About It', p: 230 },
            { t: 'Leo Grows Up (Vocabulary/Comprehension)', p: 232 },
            { t: 'Farfallina and Marcel (Fantasy)', p: 234, auteur: 'Holly Keller' },
            { t: 'Butterflies (Science)', p: 258 },
            { t: 'Writing: Letter', p: 262 },
          ] },
          { titre: 'Staying Fit', entrees: [
            { t: 'Talk About It', p: 264 },
            { t: 'Brian Gets Fit on the Field (Vocabulary/Comprehension)', p: 266 },
            { t: "There's Nothing Like Baseball (Realistic Fiction)", p: 268, auteur: 'Angela Johnson, ill. Eric Velasquez' },
            { t: 'Students Stay Fit at School (Health)', p: 286, auteur: 'Ashley Marks' },
            { t: 'Writing: Explanation', p: 290 },
          ] },
        ],
        test: { titre: 'Test Strategy: Author and Me', entrees: [
          { t: 'Go Fly a Kite! (Informational Text)', p: 292 },
        ] },
      },
      {
        unite: 3, titre: 'Better Together',
        themes: [
          { titre: 'Telling Stories', entrees: [
            { t: 'Talk About It', p: 296 },
            { t: 'The Story of the Giant Carrot (Vocabulary/Comprehension)', p: 298 },
            { t: 'Head, Body, Legs: A Story from Liberia (Folk Tale)', p: 300, auteur: 'raconté par Won-Ldy Paye et Margaret H. Lippert, ill. Julie Paschkis' },
            { t: 'Telling Tales (Language Arts)', p: 328 },
            { t: 'Writing: Persuasive Poster', p: 330 },
          ] },
          { titre: 'Safety First', entrees: [
            { t: 'Talk About It', p: 332 },
            { t: 'Safety at School (Vocabulary/Comprehension)', p: 334 },
            { t: 'Officer Buckle and Gloria (Fiction)', p: 336, auteur: 'Peggy Rathmann' },
            { t: 'Fire Safety (Health)', p: 362 },
            { t: 'Writing: Persuasive Speech', p: 366 },
          ] },
          { titre: 'Creatures Old and Older', entrees: [
            { t: 'Talk About It', p: 368 },
            { t: 'A Very Old Fish (Vocabulary Selection)', p: 370 },
            { t: 'Meet the Super Croc (Nonfiction Article)', p: 372 },
            { t: 'Some Strange Teeth (Science)', p: 376 },
            { t: 'Writing: Personal Narrative', p: 378 },
          ] },
          { titre: 'Curtain Up!', entrees: [
            { t: 'Talk About It', p: 380 },
            { t: 'A Little Symphony (Vocabulary/Comprehension)', p: 382 },
            { t: 'The Alvin Ailey Kids: Dancing As a Team (Nonfiction)', p: 384, auteur: 'Sharon Dennis Wyeth' },
            { t: "« You'll Sing a Song and I'll Sing a Song » (Performing Arts)", p: 404, auteur: 'Ella Jenkins' },
            { t: 'Writing: Persuasive Advertisement', p: 406 },
          ] },
          { titre: 'On the Farm', entrees: [
            { t: 'Talk About It', p: 408 },
            { t: 'Iggy Pig Saves the Day (Vocabulary/Comprehension)', p: 410 },
            { t: 'Click, Clack, Moo: Cows That Type (Fantasy)', p: 412, auteur: 'Doreen Cronin, ill. Betsy Lewin' },
            { t: 'Farming Corn (Social Studies)', p: 438 },
            { t: 'Writing: Letter to the Editor', p: 442 },
          ] },
        ],
        test: { titre: 'Test Strategy: Right There', entrees: [
          { t: 'Make a Piñata (Functional)', p: 444 },
        ] },
      },
    ],
  },

  {
    volume: 2,
    unites: [
      {
        unite: 4, titre: 'Land, Sea, Sky',
        themes: [
          { titre: 'Animal Needs', entrees: [
            { t: 'Talk About It', p: 11 },
            { t: 'Animals Need to Eat (Vocabulary/Comprehension)', p: 12 },
            { t: 'Splish! Splash! Animal Baths (Photo Essay)', p: 15, auteur: 'April Pulley Sayre' },
            { t: 'Ant and Grasshopper (Science)', p: 38 },
            { t: 'Writing: Summary', p: 40 },
          ] },
          { titre: 'Animal Survival', entrees: [
            { t: 'Talk About It', p: 42 },
            { t: 'Bill Helps Geese Survive (Vocabulary/Comprehension)', p: 44 },
            { t: "Goose's Story (Realistic Fiction)", p: 46, auteur: 'Cari Best, ill. Holly Meade' },
            { t: 'Baby Owl Rescue Is a « Hooting » Success! (Science)', p: 74, auteur: 'Bertie Benson' },
            { t: 'Writing: News Story', p: 78 },
          ] },
          { titre: 'Helping Planet Earth', entrees: [
            { t: 'Talk About It', p: 80 },
            { t: 'Prairie Problem (Vocabulary Selection)', p: 82 },
            { t: 'A Way to Help Planet Earth (Nonfiction Article)', p: 84 },
            { t: 'Water Troubles (Social Studies)', p: 88 },
            { t: 'Writing: Persuasive', p: 90 },
          ] },
          { titre: 'Wild Weather', entrees: [
            { t: 'Talk About It', p: 92 },
            { t: 'Wild Weather Hits Florida (Vocabulary/Comprehension)', p: 94 },
            { t: 'Super Storms (Nonfiction)', p: 96, auteur: 'Seymour Simon' },
            { t: '« It Fell in the City » (Poetry)', p: 120, auteur: 'Eve Merriam' },
            { t: 'Writing: Comparison/Contrast Paragraph', p: 122 },
          ] },
          { titre: 'Habitats and Homes', entrees: [
            { t: 'Talk About It', p: 124 },
            { t: 'My Home in Alaska (Vocabulary/Comprehension)', p: 126 },
            { t: 'Nutik, the Wolf Pup (Fiction)', p: 128, auteur: 'Jean Craighead George, ill. Ted Rand' },
            { t: 'Wolves (Science)', p: 150 },
            { t: 'Writing: Book Report', p: 154 },
          ] },
        ],
        test: { titre: 'Test Strategy: Author and Me', entrees: [
          { t: 'The Story of the Umbrella (Informational/Poem)', p: 156 },
        ] },
      },
      {
        unite: 5, titre: 'Discoveries',
        themes: [
          { titre: 'Life in the Desert', entrees: [
            { t: 'Talk About It', p: 160 },
            { t: 'The Coatis of the Sonora Desert (Vocabulary/Comprehension)', p: 162 },
            { t: "Dig Wait Listen: A Desert Toad's Tale (Informational Story)", p: 164, auteur: 'April Pulley Sayre, ill. Barbara Bash' },
            { t: 'The Sonoran Desert (Science)', p: 188 },
            { t: 'Writing: Dialogue', p: 192 },
          ] },
          { titre: 'Play Time!', entrees: [
            { t: 'Talk About It', p: 194 },
            { t: 'Why Sun and Moon Live in the Sky (Vocabulary/Comprehension)', p: 196 },
            { t: 'Pushing Up the Sky (Play)', p: 198, auteur: 'Joseph Bruchac, ill. Stefano Vitale' },
            { t: 'Getting to Know Joseph Bruchac (Performing Arts)', p: 214 },
            { t: 'Writing: Play', p: 216 },
          ] },
          { titre: 'Exploration', entrees: [
            { t: 'Talk About It', p: 218 },
            { t: 'Continents and Oceans (Vocabulary Selection)', p: 220 },
            { t: 'Columbus Explores New Lands (Nonfiction Article)', p: 222 },
            { t: 'The Roof of the World (Social Studies)', p: 226 },
            { t: 'Writing: Extended Response', p: 228 },
          ] },
          { titre: 'In the Garden', entrees: [
            { t: 'Talk About It', p: 230 },
            { t: 'City Garden (Vocabulary/Comprehension)', p: 232 },
            { t: 'The Ugly Vegetables (Realistic Fiction)', p: 234, auteur: 'Grace Lin' },
            { t: 'Soups from Around the Globe (Science)', p: 258 },
            { t: 'Writing: Story', p: 262 },
          ] },
          { titre: 'Our Moon', entrees: [
            { t: 'Talk About It', p: 264 },
            { t: 'Discover the Moon (Vocabulary/Comprehension)', p: 266 },
            { t: 'The Moon (Nonfiction)', p: 268, auteur: 'Seymour Simon' },
            { t: '« Night Comes » (Poetry)', p: 290 },
            { t: 'Writing: Description', p: 292 },
          ] },
        ],
        test: { titre: 'Test Strategy: Think and Search', entrees: [
          { t: 'A Birthday Treat (Play)', p: 294 },
        ] },
      },
      {
        unite: 6, titre: 'Expressions',
        themes: [
          { titre: 'Count on a Celebration', entrees: [
            { t: 'Talk About It', p: 298 },
            { t: "Bobo's Celebration (Vocabulary/Comprehension)", p: 300 },
            { t: 'Mice and Beans (Fantasy)', p: 302, auteur: 'Pam Muñoz Ryan, ill. Joe Cepeda' },
            { t: "Rosa María's Rice and Beans (Math)", p: 334 },
            { t: 'Writing: Descriptive Flyer', p: 338 },
          ] },
          // Ce thème compte six entrées : le livre y place deux poèmes.
          { titre: 'Creating Stories', entrees: [
            { t: 'Talk About It', p: 340 },
            { t: 'Making Stories Happen (Vocabulary/Comprehension)', p: 342 },
            { t: 'Stirring Up Memories (Autobiography)', p: 344, auteur: 'Pam Muñoz Ryan' },
            { t: '« Brush Dance » (Poetry)', p: 362, auteur: 'Robin Bernard' },
            { t: '« Crayons » (Poetry)', p: 363, auteur: 'Marchette Chute' },
            { t: 'Writing: Poem', p: 364 },
          ] },
          { titre: 'Worlds of Art', entrees: [
            { t: 'Talk About It', p: 366 },
            { t: 'Frozen Art (Vocabulary Selection)', p: 368 },
            { t: 'Music of the Stone Age (Nonfiction Article)', p: 370 },
            { t: 'The Art of Recycling (Science)', p: 374 },
            { t: 'Writing: Personal Narrative', p: 376 },
          ] },
          { titre: 'Inventions Then and Now', entrees: [
            { t: 'Talk About It', p: 378 },
            { t: 'Kid Inventors Then and Now (Vocabulary/Comprehension)', p: 380 },
            { t: 'African-American Inventors (Biography)', p: 382, auteur: 'Jim Haskins, ill. Eric Velasquez' },
            { t: 'Inventors Time Line (Social Studies)', p: 404 },
            { t: 'Writing: Biography', p: 406 },
          ] },
          { titre: 'Other People, Other Places', entrees: [
            { t: 'Talk About It', p: 408 },
            { t: 'E-mails from Other Places (Vocabulary/Comprehension)', p: 410 },
            { t: "Babu's Song (Realistic Fiction)", p: 412, auteur: 'Stephanie Stuve-Bodeen, ill. Aaron Boyd' },
            { t: 'Where in the World Is Tanzania? (Social Studies)', p: 442 },
            { t: 'Writing: Journal Entry', p: 446 },
          ] },
        ],
        test: { titre: 'Test Strategy: Author and Me', entrees: [
          { t: 'The Mother of the Baby Backpack (Biography)', p: 448 },
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
      rubrique: `Unit ${u.unite} — ${u.titre}`,
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
  cle: 'english-cp2',
  groupe: 'CP2',
  matiere: 'English',
  langue: 'en',
  titre: 'Treasures — Grade 2',

  numerote: false,
  // Les sections de l'écran sont des thèmes ; « Unit » désigne dans ce livre
  // le grand découpage, rappelé sous chaque titre.
  libelleUnite: 'Thème',

  unites,
}

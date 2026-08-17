// Programme officiel de Français — « Livre unique de français » CE2,
// collection Le Flamboyant.
//
// ── Pourquoi le CE2 dans une classe de CE1 ──────────────────────────────────
// Les deux niveaux sont jumelés. Le directeur a arrêté le 17 août 2026 : tous
// les manuels du CE1 servent aux deux niveaux, sauf le français, pour lequel
// c'est le livre du CE2 qui est retenu. C'est donc ce sommaire-ci qui fait foi
// pour la matière Français du groupe CE1-CE2.
//
// ── Une leçon, tous les domaines ────────────────────────────────────────────
// Le livre est unique au sens propre : une même leçon travaille le texte, la
// grammaire, la conjugaison et l'orthographe. Elle ne se découpe pas en
// séances par domaine — c'est un tout, étalé sur huit pages.
//
// Le programme le reflète : une entrée par leçon, et non une par colonne. Les
// domaines de la leçon sont portés par `domaines`, que l'écran Programme et la
// fiche de préparation affichent sous l'intitulé. L'enseignant prépare la
// leçon 3 une fois, en ayant sous les yeux tout ce qu'elle doit couvrir.
//
// ── État de la transcription ────────────────────────────────────────────────
// Les sept colonnes sont transcrites pour les trente leçons. Les pages 5, 6 et
// 7 du sommaire ont été photographiées de face ; seule la page 4 — le texte,
// la grammaire et la conjugaison des leçons 1 à 15 — vient encore d'une photo
// prise de biais.
//
// Cette réserve n'est pas théorique. La première lecture de la page 5, faite
// sur une photo de biais, avait interverti les leçons 7 et 11 (« ou / où » et
// « des pluriels particuliers ») et donné une mauvaise orthographe d'usage à
// la leçon 10. La photo droite l'a montré et les trois lignes sont corrigées.
// Les mêmes erreurs peuvent donc s'être glissées dans la grammaire et la
// conjugaison des leçons 1 à 15 : une photo droite de la page 4 les lèverait.
//
// La leçon 15 et la leçon 16 portent toutes deux « consonnes muettes » en
// orthographe d'usage. Vérifié sur les deux photos nettes : le livre étale un
// point sur deux leçons de suite — « le féminin des adjectifs » aux leçons 16
// et 17, « des mots invariables » aux leçons 26 et 27, « Pour exprimer la
// succession » aux leçons 25 et 26. Ce n'est pas un décalage de lecture.
//
// Une leçon de révision ne porte pas de point de langue, mais elle peut porter
// une poésie : « Le rhinocéros » à la leçon 6, « Voyages » et « Devinez-moi »
// à la leçon 24.
//
// Le sommaire ne pagine que la leçon, pas ses domaines. Chaque entrée porte
// donc l'étendue de sa leçon, déduite du début de la suivante.
//
// Le tableau de conjugaison des pages 254-255 n'est pas au programme : c'est
// une page de référence, pas une séance.

// n = numéro · p = page d'ouverture · texte = titre du texte ·
// g = grammaire · c = conjugaison · og = orthographe grammaticale ·
// ou = orthographe d'usage · d = « Je sais dire / Je sais faire » ·
// poesie = poésie · lectures = récits longs d'une leçon de révision
const LECONS = [
  { n: 1, p: 8, texte: 'Le jour de la rentrée',
    g: 'le texte, la phrase',
    c: 'passé, présent, futur',
    og: 'ce / se',
    ou: "l'alphabet",
    d: "L'intonation" },
  { n: 2, p: 16, texte: 'Une écolière japonaise',
    g: 'la phrase déclarative : affirmative, négative',
    c: "l'infinitif",
    og: 'on / ont, son / sont',
    ou: 'le dictionnaire',
    d: "Pour questionner, pour s'exclamer",
    poesie: "L'affaire se complique" },
  { n: 3, p: 24, texte: 'À la forge',
    g: 'la phrase : interrogative, exclamative',
    c: "être et avoir au présent de l'indicatif",
    og: 'mots invariables interrogatifs et exclamatifs',
    ou: 'le son [s]',
    d: 'Pour exprimer son désaccord' },
  { n: 4, p: 32, texte: 'Une terrible maladie',
    g: 'la phrase simple et ses groupes',
    c: "chanter et finir au présent de l'indicatif",
    og: 'a / à, et / est',
    ou: 'les familles de mots',
    d: "Pour exprimer l'étonnement" },
  { n: 5, p: 40, texte: 'En taxi-brousse',
    g: 'accord sujet / verbe',
    c: "venir, faire, aller au présent de l'indicatif",
    og: 'pluriel des noms en -au, -eau ; pluriel des noms en -al',
    ou: 'famille de mots : préfixe, suffixe',
    d: 'Pour interdire, pour donner un ordre',
    poesie: 'Le caméléon' },
  { n: 6, p: 48, revision: true, texte: 'Une grande timide',
    lectures: ['Malal (1) — p. 54'],
    poesie: 'Le rhinocéros' },
  { n: 7, p: 56, texte: 'La petite cuisinière',
    g: 'accord sujet / verbe',
    c: 'être et avoir au futur',
    og: 'ou / où',
    ou: 'quelques mots invariables',
    d: 'Pour exprimer la quantité' },
  { n: 8, p: 64, texte: 'Une patience bien récompensée',
    g: 'le nom',
    c: 'chanter et finir au futur',
    og: 'le comparatif',
    ou: 'les accents sur le e',
    d: 'Pour exprimer la comparaison : similitude, différence',
    poesie: 'Le coq' },
  { n: 9, p: 72, texte: 'Une journée aux champs',
    g: 'le nom commun, le nom propre',
    c: 'venir, faire, aller au futur',
    og: 'le superlatif',
    ou: 'les noms et adjectifs de nationalité',
    d: 'Pour exprimer la comparaison : le superlatif' },
  { n: 10, p: 80, texte: 'La nouvelle maison',
    g: 'le nom : le genre, le nombre',
    c: 'avoir au passé composé',
    og: 'le pluriel des noms terminés par -s, -x, -z',
    ou: "les noms masculins en -ail, -eil, -euil s'écrivent -ille au féminin",
    d: 'Pour exprimer le refus',
    poesie: 'Attention travaux' },
  { n: 11, p: 88, texte: 'La dinde de Noël',
    g: "un déterminant : l'article",
    c: 'être au passé composé',
    og: 'des pluriels particuliers',
    ou: 'les guillemets, les tirets',
    d: 'Le dialogue',
    poesie: 'Photo de famille' },
  { n: 12, p: 96, revision: true, texte: 'Trains et locomotives',
    lectures: ['Malal (2) — p. 103'] },
  { n: 13, p: 106, texte: "La classe mène l'enquête",
    g: 'déterminants : les adjectifs possessifs',
    c: 'formation du passé composé : le participe passé',
    og: 'le genre et le nombre des adjectifs possessifs',
    ou: 'quelques mots invariables',
    d: 'Style direct, style indirect' },
  { n: 14, p: 114, texte: 'La patate douce',
    g: 'déterminants : les adjectifs démonstratifs',
    c: "l'impératif : rôle et formation",
    og: 'le genre et le nombre des adjectifs démonstratifs',
    ou: 'les noms terminés par -et, -aie',
    d: 'Pour exprimer le but' },
  { n: 15, p: 122, texte: 'Le tracteur',
    g: "l'adjectif qualificatif",
    c: "être, avoir, faire, venir, aller à l'impératif",
    og: "le genre et le nombre de l'adjectif qualificatif",
    ou: 'consonnes muettes',
    d: 'Pour exprimer la cause',
    poesie: 'La cigale et la fourmi' },
  { n: 16, p: 130, texte: "C'est la saison sèche",
    g: "l'accord de l'adjectif qualificatif en genre et en nombre",
    c: "l'imparfait : un temps du passé",
    og: 'le féminin des adjectifs',
    ou: 'consonnes muettes',
    d: 'Pour exprimer la conséquence',
    poesie: "L'arc-en-ciel" },
  { n: 17, p: 138, texte: 'Le Ramadan',
    g: 'le complément du nom',
    c: "l'imparfait des verbes du 1ᵉʳ groupe",
    og: 'le féminin des adjectifs',
    ou: 'les noms féminins en [é], [té], [tié]',
    d: 'Pour donner un conseil' },
  { n: 18, p: 146, revision: true, texte: "Qu'est-ce qu'un arbre ?",
    lectures: ['Malal (3) — p. 150'] },
  { n: 19, p: 152, texte: 'Le marché de nuit',
    g: 'les pronoms personnels sujets',
    c: "l'imparfait des verbes du 2ᵉ groupe",
    og: 'les verbes en -cer',
    ou: 'le son [g]',
    d: 'Pour présenter des excuses',
    poesie: 'Ponctuation' },
  { n: 20, p: 160, texte: 'Chez monsieur Houdrouze',
    g: 'les constituants du GV : le verbe et son complément',
    c: "être, avoir, aller à l'imparfait",
    og: "l'imparfait des verbes en -ger",
    ou: 'le son [k]',
    d: 'Pour remercier' },
  { n: 21, p: 168, texte: 'La maison du léopard',
    g: 'le complément du verbe : un GN',
    c: "faire et venir à l'imparfait",
    og: 'la / là',
    ou: 'm devant m, b, p',
    d: 'Pour donner son avis',
    poesie: "L'éléphant" },
  { n: 22, p: 176, texte: "Bumba et le troupeau d'éléphants",
    g: 'les pronoms personnels compléments',
    c: 'voir au présent et au futur',
    og: "c'est / s'est, c'était / s'était",
    ou: 'le son [f]',
    d: 'Pour se plaindre',
    poesie: "L'ordinateur et l'éléphant" },
  { n: 23, p: 184, texte: 'Le cinéma',
    g: 'un complément du verbe : le COD',
    c: "voir au passé composé et à l'imparfait",
    og: 'leur / leurs',
    ou: 'les mots terminés par le son [é]',
    d: 'Pour protester',
    poesie: 'Toujours et jamais' },
  { n: 24, p: 192, revision: true, texte: 'Les Dogons, peuple du Mali',
    lectures: ["Je t'écris du bout du monde (1) — p. 199"],
    poesie: 'Voyages · Devinez-moi' },
  { n: 25, p: 202, texte: 'Chasse au harpon',
    g: 'un complément du verbe : le COI',
    c: 'pouvoir, vouloir au présent et au futur',
    og: 'tout, tous, toute, toutes',
    ou: 'les noms terminés par le son [i]',
    d: 'Pour exprimer la succession' },
  { n: 26, p: 210, texte: 'Une partie de pêche',
    g: 'le complément de circonstance',
    c: "pouvoir, vouloir à l'imparfait et au passé composé",
    og: 'la conjugaison des verbes en -yer',
    ou: 'des mots invariables',
    d: 'Pour exprimer la succession',
    poesie: 'Poisson' },
  { n: 27, p: 218, texte: 'Le mandat (1)',
    g: 'le complément circonstanciel de lieu',
    c: "savoir au présent, au futur, à l'imparfait et au passé composé",
    og: 'mais / mes',
    ou: 'des mots invariables',
    d: 'Pour opposer deux idées, deux actions',
    poesie: 'Le facteur' },
  { n: 28, p: 226, texte: 'Le mandat (2)',
    g: 'le complément circonstanciel de temps',
    c: 'dire et écrire au présent et au futur',
    og: 'pluriel des adjectifs en -al',
    ou: 'le son [z]',
    d: 'Pour dire comment faire' },
  { n: 29, p: 234, texte: "Voyage au pays de l'abondance",
    g: 'le complément circonstanciel de manière',
    c: "dire et écrire à l'imparfait et au passé composé",
    og: 'le pluriel des noms en -eau, -au, -ou, -eu',
    ou: 'les noms terminés par le son [eur]',
    d: 'Pour exprimer un souhait' },
  { n: 30, p: 242, revision: true, texte: "Voyage au pays de l'abondance",
    lectures: ["Je t'écris du bout du monde (2) — p. 250"] },
]

// Une leçon court jusqu'à ce que la suivante commence. La dernière transcrite
// n'a pas de fin connue : le sommaire s'arrête là pour l'instant.
const finDe = i => (LECONS[i + 1] ? LECONS[i + 1].p - 1 : null)

const DOMAINES = [
  ['g',      'Grammaire'],
  ['c',      'Conjugaison'],
  ['og',     'Orthographe grammaticale'],
  ['ou',     "Orthographe d'usage"],
  ['d',      'Je sais dire, je sais faire'],
  ['poesie', 'Poésie'],
]

export default {
  cle: 'francais-ce2',
  groupe: 'CE1-CE2',
  matiere: 'Français',
  langue: 'fr',
  titre: 'Livre unique de français CE2 — Le Flamboyant',

  // Le livre numérote ses leçons, mais ce numéro est déjà dans l'intitulé :
  // le répéter donnerait « Leçon 3 — À la forge · leçon 3 ».
  numerote: false,

  lecons: LECONS.map((l, i) => {
    const fin = finDe(i)
    return {
      numero: l.n,
      titre: `Leçon ${l.n} — ${l.texte}`,
      page: l.p,
      ...(fin ? { pageFin: fin } : {}),
      ...(l.revision ? { bilan: true } : {}),
      // Tout ce que la leçon doit couvrir, dans l'ordre du livre. Le texte
      // vient en tête : c'est lui qui porte la séance.
      domaines: [
        { nom: 'Texte', contenu: l.texte },
        ...(l.lectures || []).map(t => ({ nom: 'Lecture suivie', contenu: t })),
        // Une révision ne porte pas de point de langue, mais elle peut porter
        // une poésie : la leçon 24 en donne deux.
        ...DOMAINES.filter(([champ]) => l[champ]).map(([champ, nom]) => ({ nom, contenu: l[champ] })),
      ],
    }
  }),
}

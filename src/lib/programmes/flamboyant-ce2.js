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
// ── Ce qui manque encore ────────────────────────────────────────────────────
// Seules les leçons 1 à 15 sont transcrites : le sommaire transmis s'arrête
// aux pages 4 et 5 du livre. Les leçons 16 à 30 suivront dès que les pages 6
// et 7 seront photographiées.
//
// Deux colonnes ne sont pas reprises, faute de pouvoir les aligner sûrement
// sur leurs lignes : « Je sais dire / Je sais faire » (douze intitulés pour
// treize leçons) et « Poésie » (sept pour quinze). Des lignes du tableau sont
// vides et la photo, prise de biais, ne dit pas lesquelles. Mettre un poème en
// face de la mauvaise leçon serait pire que de ne rien mettre : une photo
// droite de ces deux colonnes suffira à les ajouter.
//
// Le sommaire ne pagine que la leçon, pas ses domaines. Chaque entrée porte
// donc l'étendue de sa leçon, déduite du début de la suivante — la table
// avance de huit pages en huit pages, et de dix après une révision.

// n = numéro · p = page d'ouverture · texte = titre du texte ·
// g = grammaire · c = conjugaison · og = orthographe grammaticale ·
// ou = orthographe d'usage · lectures = récits longs d'une leçon de révision
const LECONS = [
  { n: 1, p: 8, texte: 'Le jour de la rentrée',
    g: 'le texte, la phrase',
    c: 'passé, présent, futur',
    og: 'ce / se',
    ou: "l'alphabet" },
  { n: 2, p: 16, texte: 'Une écolière japonaise',
    g: 'la phrase déclarative : affirmative, négative',
    c: "l'infinitif",
    og: 'on / ont, son / sont',
    ou: 'le dictionnaire' },
  { n: 3, p: 24, texte: 'À la forge',
    g: 'la phrase : interrogative, exclamative',
    c: "être et avoir au présent de l'indicatif",
    og: 'mots invariables interrogatifs et exclamatifs',
    ou: 'le son [s]' },
  { n: 4, p: 32, texte: 'Une terrible maladie',
    g: 'la phrase simple et ses groupes',
    c: "chanter et finir au présent de l'indicatif",
    og: 'a / à, et / est',
    ou: 'les familles de mots' },
  { n: 5, p: 40, texte: 'En taxi-brousse',
    g: 'accord sujet / verbe',
    c: "venir, faire, aller au présent de l'indicatif",
    og: 'pluriel des noms en -au, -eau ; pluriel des noms en -al',
    ou: 'famille de mots : préfixe, suffixe' },
  { n: 6, p: 48, revision: true, texte: 'Une grande timide',
    lectures: ['Malal (1) — p. 54'] },
  { n: 7, p: 56, texte: 'La petite cuisinière',
    g: 'accord sujet / verbe',
    c: 'être et avoir au futur',
    og: 'des pluriels particuliers',
    ou: 'les guillemets, les tirets' },
  { n: 8, p: 64, texte: 'Une patience bien récompensée',
    g: 'le nom',
    c: 'chanter et finir au futur',
    og: 'le comparatif',
    ou: 'les accents sur le e' },
  { n: 9, p: 72, texte: 'Une journée aux champs',
    g: 'le nom commun, le nom propre',
    c: 'venir, faire, aller au futur',
    og: 'le superlatif',
    ou: 'les noms et adjectifs de nationalité' },
  { n: 10, p: 80, texte: 'La nouvelle maison',
    g: 'le nom : le genre, le nombre',
    c: 'avoir au passé composé',
    og: 'le pluriel des noms terminés par -s, -x, -z',
    ou: 'quelques mots invariables' },
  { n: 11, p: 88, texte: 'La dinde de Noël',
    g: "un déterminant : l'article",
    c: 'être au passé composé',
    og: 'ou / où',
    ou: "les noms masculins en -ail, -eil, -euil s'écrivent -ille au féminin" },
  { n: 12, p: 96, revision: true, texte: 'Trains et locomotives',
    lectures: ['Malal (2) — p. 103'] },
  { n: 13, p: 106, texte: "La classe mène l'enquête",
    g: 'déterminants : les adjectifs possessifs',
    c: 'formation du passé composé : le participe passé',
    og: 'le genre et le nombre des adjectifs possessifs',
    ou: 'quelques mots invariables' },
  { n: 14, p: 114, texte: 'La patate douce',
    g: 'déterminants : les adjectifs démonstratifs',
    c: "l'impératif : rôle et formation",
    og: 'le genre et le nombre des adjectifs démonstratifs',
    ou: 'les noms terminés par -et, -aie' },
  { n: 15, p: 122, texte: 'Le tracteur',
    g: "l'adjectif qualificatif",
    c: "être, avoir, faire, venir, aller à l'impératif",
    og: "le genre et le nombre de l'adjectif qualificatif",
    ou: 'consonnes muettes' },
]

// Une leçon court jusqu'à ce que la suivante commence. La dernière transcrite
// n'a pas de fin connue : le sommaire s'arrête là pour l'instant.
const finDe = i => (LECONS[i + 1] ? LECONS[i + 1].p - 1 : null)

const DOMAINES = [
  ['g',  'Grammaire'],
  ['c',  'Conjugaison'],
  ['og', 'Orthographe grammaticale'],
  ['ou', "Orthographe d'usage"],
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
        ...DOMAINES.filter(([champ]) => l[champ]).map(([champ, nom]) => ({ nom, contenu: l[champ] })),
      ],
    }
  }),
}

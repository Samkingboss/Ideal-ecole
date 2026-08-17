// Programme officiel de Mathematics CE1 (cours en anglais) — « Singapore
// Math », cahiers 3A et 3B.
//
// À ne pas confondre avec le manuel de Maths du même niveau : le CE1 travaille
// les mathématiques dans les deux langues, avec deux ouvrages distincts — « La
// méthode de Singapour » en français, ces cahiers-ci en anglais. Deux matières
// à l'emploi du temps, donc deux manuels séparés, chacun avec son avancement.
//
// ── Une granularité imposée par le sommaire ─────────────────────────────────
// Ce sommaire ne descend pas à la leçon : il s'arrête aux unités. Une unité
// couvre huit à douze pages — « Unit 5: Multiplying Numbers by 6, 7, 8, and 9 »
// tient de la page 59 à la page 70 — et représente donc plusieurs séances, là
// où une entrée des autres manuels en vaut une ou deux.
//
// Conséquence à connaître : l'avancement se lit ici en unités, plus
// grossièrement qu'ailleurs, et un enseignant préparera souvent la même entrée
// plusieurs fois de suite. C'est ce que le livre donne ; le jour où les titres
// d'exercices de chaque unité seront transmis, ils viendront s'y insérer sans
// rien changer d'autre.
//
// Pour que l'étendue d'une unité reste visible malgré tout, chaque entrée
// porte sa page de fin, déduite du début de la section suivante : une section
// court jusqu'à ce que la suivante commence. La dernière entrée du cahier 3A
// n'en a pas — on ignore ce qui la suit dans son propre cahier.
//
// ── Deux cahiers, une seule pagination ──────────────────────────────────────
// Le 3A va de la page 5 à la page 120, le 3B reprend à la page 121 : les pages
// ne se répètent pas d'un cahier à l'autre, contrairement aux fichiers de
// Singapour en français. Le cahier est tout de même porté par `tome`, pour que
// l'enseignant sache lequel prendre sans avoir à retenir où passe la coupure.
//
// Ne sont pas au programme, parce que ce ne sont pas des séances :
// l'introduction à la méthode (3A p. 5), les Learning Outcomes (3A p. 15,
// 3B p. 121) et les Formula Sheets (3A p. 16, 3B p. 122), qui s'adressent à
// l'enseignant, et le corrigé (Solutions, 3B p. 229).

const SECTIONS = [
  // ── Cahier 3A ─────────────────────────────────────────────────────────────
  { tome: '3A', t: 'Unit 1 — Numbers 1–10,000',                        p: 19,  fin: 26 },
  { tome: '3A', t: 'Unit 2 — Adding Numbers up to 10,000',             p: 27,  fin: 34 },
  { tome: '3A', t: 'Review 1',                                          p: 35,  fin: 38, bilan: true },
  { tome: '3A', t: 'Unit 3 — Subtracting Numbers up to 10,000',        p: 39,  fin: 44 },
  { tome: '3A', t: 'Unit 4 — Problem Solving (Adding and Subtracting)', p: 45,  fin: 52 },
  { tome: '3A', t: 'Review 2',                                          p: 53,  fin: 58, bilan: true },
  { tome: '3A', t: 'Unit 5 — Multiplying Numbers by 6, 7, 8, and 9',   p: 59,  fin: 70 },
  { tome: '3A', t: 'Unit 6 — Multiplying Numbers',                      p: 71,  fin: 76 },
  { tome: '3A', t: 'Review 3',                                          p: 77,  fin: 82, bilan: true },
  { tome: '3A', t: 'Unit 7 — Dividing Numbers',                         p: 83,  fin: 90 },
  { tome: '3A', t: 'Unit 8 — Problem Solving (Multiplying and Dividing)', p: 91, fin: 102 },
  { tome: '3A', t: 'Unit 9 — Mental Calculations',                      p: 103, fin: 106 },
  { tome: '3A', t: 'Review 4',                                          p: 107, fin: 111, bilan: true },
  { tome: '3A', t: 'Mid-Review',                                        p: 112, fin: 117, bilan: true },
  { tome: '3A', t: 'Challenge Questions',                               p: 118 },

  // ── Cahier 3B ─────────────────────────────────────────────────────────────
  { tome: '3B', t: 'Unit 10 — Money',                                   p: 125, fin: 134 },
  { tome: '3B', t: 'Unit 11 — Length, Mass, and Volume',                p: 135, fin: 142 },
  { tome: '3B', t: 'Unit 12 — Problem Solving (Length, Mass, and Volume)', p: 143, fin: 149 },
  { tome: '3B', t: 'Review 5',                                          p: 150, fin: 154, bilan: true },
  { tome: '3B', t: 'Unit 13 — Bar Graphs',                              p: 155, fin: 163 },
  { tome: '3B', t: 'Unit 14 — Fractions',                               p: 164, fin: 172 },
  { tome: '3B', t: 'Unit 15 — Time',                                    p: 173, fin: 181 },
  { tome: '3B', t: 'Review 6',                                          p: 182, fin: 186, bilan: true },
  { tome: '3B', t: 'Unit 16 — Angles',                                  p: 187, fin: 195 },
  { tome: '3B', t: 'Unit 17 — Perpendicular and Parallel Lines',        p: 196, fin: 204 },
  { tome: '3B', t: 'Unit 18 — Area and Perimeter',                      p: 205, fin: 212 },
  { tome: '3B', t: 'Review 7',                                          p: 213, fin: 219, bilan: true },
  { tome: '3B', t: 'Final Review',                                      p: 220, fin: 226, bilan: true },
  { tome: '3B', t: 'Challenge Questions',                               p: 227, fin: 228 },
]

export default {
  cle: 'mathematics-ce1',
  groupe: 'CE1-CE2',
  matiere: 'Mathematics',
  langue: 'en',
  titre: 'Singapore Math — 3A et 3B',

  // Le livre ne numérote pas ses sections d'une façon continue : les unités
  // vont de 1 à 18 mais les Review s'intercalent sans numéro d'unité.
  // L'identifiant est donc la page, comme dans les autres livres non numérotés.
  numerote: false,

  // Ces deux tomes s'appellent des cahiers, pas des volumes.
  libelleTome: 'cahier',

  // Progression continue : le livre n'a pas de découpage au-dessus de l'unité,
  // et ses unités sont déjà les entrées de l'écran.
  lecons: SECTIONS.map(s => ({
    numero: s.p,
    tome: s.tome,
    titre: s.t,
    page: s.p,
    ...(s.fin ? { pageFin: s.fin } : {}),
    ...(s.bilan ? { bilan: true } : {}),
  })),
}

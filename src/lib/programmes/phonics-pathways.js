// Programme de décodage — « Phonics Pathways » (Dolores G. Hiskes).
//
// Ce manuel accompagne Treasures dans les heures d'anglais : Treasures porte la
// lecture suivie, Phonics Pathways le décodage. Il sert au CP1 comme au CP2 —
// c'est une progression graduée, pas un programme d'année, et deux niveaux
// peuvent y avancer chacun à son rythme. D'où deux manuels distincts bâtis sur
// le même sommaire, un par groupe : leurs avancements ne doivent pas se mêler.
//
// L'identifiant d'une entrée est son rang, et non sa page : le livre place
// deux entrées différentes à la page 211, « -ce, -ge with Suffixes » et
// « -able, -ible ». La page reste affichée, elle ne sert simplement pas à
// désigner l'entrée.
//
// Ne figurent pas au programme, parce qu'elles ne se préparent pas comme des
// séances : l'introduction et le mode d'emploi (p. v, x, xii), qui s'adressent
// à l'enseignant, et l'appendice de référence (p. 225 à 232) — index des
// règles, tableaux d'orthographe, pyramide, exercices de coordination
// visuelle et motrice.

const SECTIONS = [
  { titre: 'Basics', entrees: [
    { t: 'Short-Vowel Sounds', p: 1 },
    { t: 'Two-Letter Blends (Eyerobics)', p: 7 },
    { t: 'Three-Letter Words', p: 27 },
  ] },
  { titre: 'Pyramid', entrees: [{ t: 'Pyramid', p: 39 }] },
  { titre: '« K = C, K, -CK »', entrees: [{ t: '« K = C, K, -CK »', p: 40 }] },
  { titre: 'Introduction to Endings (short-vowel words)', entrees: [
    { t: 'Two-Consonant Endings', p: 45 },
    { t: '« Y » Suffix', p: 57 },
    { t: 'Twin-Consonant Endings', p: 61 },
  ] },
  { titre: 'Consonant Digraph Endings', entrees: [
    { t: 'Consonant Digraph Endings', p: 62 },
    { t: '« -sh »', p: 63 },
    { t: '« -th »', p: 64 },
    { t: '« -ch, -tch »', p: 66 },
    { t: '« -ng » (-ing, -ang, -ung, -ong)', p: 70 },
    { t: '« -nk » (-ink, -ank, -unk)', p: 73 },
  ] },
  { titre: 'Simple Long-Vowel Sounds', entrees: [{ t: 'Simple Long-Vowel Sounds', p: 75 }] },
  { titre: 'Suffixes', entrees: [
    { t: 'Short-Vowel Words', p: 94 },
    { t: 'Long-Vowel Words', p: 98 },
    { t: 'Suffix Spelling Chart', p: 99 },
  ] },
  { titre: 'Multisyllable Words', entrees: [
    { t: 'Multisyllable Words', p: 101 },
    { t: '« K = -IC, -ICK »', p: 102 },
    { t: 'Plural, Possessive, and « X »', p: 104 },
  ] },
  { titre: 'Consonant Digraph Beginnings', entrees: [
    { t: 'Consonant Digraph Beginnings — sh-, ch-, wh-, th-, qu-', p: 107 },
  ] },
  { titre: 'Two-Consonant Beginnings', entrees: [
    { t: 'bl-, fl-, pl-, cl-, gl-, sl-', p: 117 },
    { t: 'Fun and Games', p: 122 },
    { t: 'sm-, sn-, st-, sp-, sc-, sk-', p: 123 },
    { t: 'br-, cr-, dr-, fr-, gr-, pr-, tr-', p: 128 },
  ] },
  { titre: '« R » Modified Vowels', entrees: [
    { t: '« Är = ar »', p: 133 },
    { t: '« Ôr = or, ar, oor, ore, our, oar »', p: 134 },
    { t: '« Ʉr = er, ir, ur, or, ear »', p: 137 },
  ] },
  { titre: 'Long-Vowel Digraphs', entrees: [
    { t: 'Long-Vowel Digraphs', p: 143 },
    { t: '« Ā = ai, ay »', p: 144 },
    { t: '« Ē = ie, i » et « -y pluriel = -ies » (ee, ea : p. 84 et 85)', p: 147 },
    { t: '« Ī = ie, uy, ui, y »', p: 149 },
    { t: '« Ō = oa, oe, ow »', p: 151 },
    { t: '« Ū = (oo) = oo, ew, ue, ui, ou, o » et « yoo = ew »', p: 153 },
    { t: '« S = C » (ce, ci, cy)', p: 157 },
    { t: '« Ē = EI »', p: 158 },
  ] },
  { titre: 'Vowel Diphthongs', entrees: [
    { t: '« Oi = oi, oy »', p: 160 },
    { t: '« Ou = ou, ow »', p: 162 },
  ] },
  { titre: 'Sons et suffixes particuliers', entrees: [
    { t: '« J = GE, GI, GY, -DGE »', p: 165 },
    { t: '« -Y, -IE » plus suffixes', p: 168 },
    { t: '« -F = -VES »', p: 169 },
  ] },
  { titre: 'New Vowel Sounds', entrees: [
    { t: '« Ọo = oo » (aussi « ould, u »)', p: 171 },
    { t: '« Ô = aw, au » (aussi « al, all, o »)', p: 174 },
  ] },
  { titre: 'Three-Consonant Beginnings', entrees: [{ t: 'Three-Consonant Beginnings', p: 178 }] },
  { titre: 'Short-Vowel Spelling Patterns', entrees: [
    { t: '« Ĕ = ea, ai »', p: 181 },
    { t: '« Ĭ = ui, y »', p: 182 },
    { t: '« Ŏ = a »', p: 183 },
    { t: '« Ŭ = o, ou, oo, a »', p: 184 },
    { t: '« Ŭ = ə » (schwa)', p: 185 },
  ] },
  { titre: 'Contractions', entrees: [{ t: 'Contractions', p: 188 }] },
  { titre: 'Silent Letters', entrees: [
    { t: '« -le »', p: 190 },
    { t: '« k, w, l, b, t, h »', p: 192 },
    { t: '« gh » (Ī = igh ; ô = ough, augh ; ō = ough)', p: 195 },
  ] },
  { titre: 'Long « A » Spelling Patterns', entrees: [
    { t: '« Ā = ei, eigh, ey, ea »', p: 198 },
  ] },
  { titre: 'Consonnes à sons multiples', entrees: [
    { t: '« Z, ZH, SH = S » ; « F = PH, GH » ; « K = CH »', p: 201 },
  ] },
  { titre: 'Another « R » Modified Vowel Sound', entrees: [
    { t: '« Âr = -are, -air, -ear, -ere, -eir »', p: 206 },
  ] },
  { titre: 'A Spelling Grab Bag', entrees: [
    { t: 'Homonyms, Homophones', p: 208 },
    { t: 'Homographs', p: 209 },
    { t: 'Multisyllable Words with Suffixes', p: 210 },
    { t: '« -ce, -ge » with Suffixes', p: 211 },
    { t: '« -able, -ible »', p: 211 },
  ] },
  { titre: 'Prefixes', entrees: [
    { t: 'pre-, sub-, re-, auto-, un-, dis-, inter-, super-', p: 212 },
  ] },
  { titre: 'More Suffixes', entrees: [
    { t: '-tion, -sion, -able, -ness, -ful, -less, -ment', p: 215 },
  ] },
  { titre: 'Mots composés et synthèse', entrees: [
    { t: 'Compound Words', p: 218 },
    { t: '« Building Blocks »', p: 219, bilan: true },
  ] },
]

// Le même sommaire sert deux groupes. On fabrique un manuel par groupe plutôt
// que d'en partager un seul : chacun porte sa clé, donc son avancement.
const construire = groupe => {
  let rang = 0
  return {
    cle: `phonics-${groupe.toLowerCase()}`,
    groupe,
    matiere: 'English',
    langue: 'en',
    titre: 'Phonics Pathways',
    numerote: false,
    libelleUnite: 'Section',
    unites: SECTIONS.map((s, i) => ({
      numero: i + 1,
      titre: s.titre,
      rubrique: 'Décodage et orthographe',
      lecons: s.entrees.map(e => ({ numero: ++rang, titre: e.t, page: e.p, ...(e.bilan ? { bilan: true } : {}) })),
    })),
  }
}

export const phonicsCP1 = construire('CP1')
export const phonicsCP2 = construire('CP2')

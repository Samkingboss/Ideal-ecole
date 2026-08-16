// Programme officiel de Science CP2 — « Science : A Closer Look »
// (Macmillan / McGraw-Hill, édition Ohio).
//
// Trois grands domaines — Life Sciences, Earth and Space Sciences, Physical
// Sciences — découpés en six chapitres. Chaque chapitre suit toujours la même
// marche : deux ou trois leçons, chacune suivie d'un encart de méthode
// (Inquiry Skill Builder, Reading in Science, Writing/Math in Science, ou Be a
// Scientist), puis une lecture de révision et une évaluation de fin de
// chapitre. Certaines unités se referment sur une lecture littéraire.
//
// Les chapitres deviennent les unités de l'écran ; le domaine dont ils
// relèvent est porté par `rubrique`.
//
// Ce que le livre appelle « Ohio: A Closer Look » — deux pages de sites
// régionaux américains ouvrant chaque domaine — n'est pas repris : ces pages
// parlent de l'Ohio à des élèves de Bamako. Le directeur tranchera s'il veut
// les traiter quand même ; elles sont notées ici plutôt que passées sous
// silence : p. 20, p. 130 et p. 204.
//
// L'index « Activities and Investigations » du début de l'ouvrage n'est pas
// transcrit comme des entrées de programme : il renvoie aux mêmes pages que
// les leçons. Une Explore Activity de la page 27 se déroule pendant la leçon
// des pages 26 à 33 — en faire une entrée séparée compterait deux fois la même
// séance et fausserait l'avancement. Elles sont rattachées à leur chapitre
// dans `activites`, pour rester sous la main.

const VIE     = 'Life Sciences'
const TERRE   = 'Earth and Space Sciences'
const PHYSIQUE = 'Physical Sciences'

export default {
  cle: 'science-cp2',
  groupe: 'CP2',
  matiere: 'Science',
  langue: 'en',
  titre: 'Science: A Closer Look',

  // Le livre ne numérote pas ses entrées : l'écran les désigne par leur page.
  numerote: false,
  libelleUnite: 'Chapitre',

  unites: [
    {
      numero: 1,
      titre: 'Chapter 1 — Plants',
      rubrique: VIE,
      activites: [
        'Explore : What do leaves need? (p. 27)',
        'Explore : What are the parts of a seed? (p. 35)',
        'Explore : How do roots grow? (p. 45)',
        'Quick Lab : Plants and Water (p. 30)',
        'Quick Lab : Seed Protection (p. 38)',
        'Quick Lab : Plants and Light (p. 48)',
      ],
      lecons: [
        { numero: 26, titre: 'Lesson 1 — What Living Things Need', page: 26 },
        { numero: 32, titre: 'Inquiry Skill Builder', page: 32 },
        { numero: 34, titre: 'Lesson 2 — Plants Make New Plants', page: 34 },
        { numero: 42, titre: 'Writing in Science · Math in Science', page: 42 },
        { numero: 44, titre: 'Lesson 3 — How Plants Are Alike and Different', page: 44 },
        { numero: 50, titre: 'Reading in Science', page: 50 },
        { numero: 52, titre: 'I Read to Review : Peach Tree', page: 52 },
        { numero: 56, titre: 'Chapter 1 Review and Standards Practice', page: 56, bilan: true },
      ],
    },
    {
      numero: 2,
      titre: 'Chapter 2 — Animals',
      rubrique: VIE,
      activites: [
        'Explore : How can we put animals into groups? (p. 61)',
        'Explore : How are babies and adults alike and different? (p. 69)',
        'Explore : How does the color of an animal keep it safe? (p. 77)',
        'Quick Lab : Make an Animal Model (p. 65)',
        'Quick Lab : Act Out an Animal Life Cycle (p. 71)',
        'Quick Lab : Animal Eyes (p. 81)',
      ],
      lecons: [
        { numero: 60, titre: 'Lesson 1 — Animal Groups', page: 60 },
        { numero: 66, titre: 'Inquiry Skill Builder', page: 66 },
        { numero: 68, titre: 'Lesson 2 — Animals Grow and Change', page: 68 },
        { numero: 74, titre: 'Reading in Science', page: 74 },
        { numero: 76, titre: 'Lesson 3 — Staying Alive', page: 76 },
        { numero: 82, titre: 'Writing in Science · Math in Science', page: 82 },
        { numero: 84, titre: 'I Read to Review : So Many Animals!', page: 84 },
        { numero: 88, titre: 'Chapter 2 Review and Standards Practice', page: 88, bilan: true },
      ],
    },
    {
      numero: 3,
      titre: 'Chapter 3 — Looking at Habitats',
      rubrique: VIE,
      activites: [
        'Explore : Where do animals live? (p. 93)',
        'Explore : What do animals eat? (p. 101)',
        'Explore : What happens when habitats change? (p. 109)',
        'Quick Lab : Plant and Animal Habitats (p. 97)',
        'Quick Lab : Food Chain Fun (p. 103)',
        'Quick Lab : Habitat Comic Strip (p. 114)',
      ],
      lecons: [
        { numero: 92, titre: 'Lesson 1 — Places to Live', page: 92 },
        { numero: 98, titre: 'Inquiry Skill Builder', page: 98 },
        { numero: 100, titre: 'Lesson 2 — Food Chains and Food Webs', page: 100 },
        { numero: 106, titre: 'Writing in Science · Math in Science', page: 106 },
        { numero: 108, titre: 'Lesson 3 — Habitats Change', page: 108 },
        { numero: 118, titre: 'Be a Scientist', page: 118 },
        { numero: 120, titre: 'I Read to Review : Changing Habitats', page: 120 },
        { numero: 124, titre: 'Chapter 3 Review and Standards Practice', page: 124, bilan: true },
        { numero: 126, titre: 'Unit Literature : The Seed', page: 126 },
      ],
    },
    {
      numero: 4,
      titre: 'Chapter 4 — Earth in Space',
      rubrique: TERRE,
      activites: [
        "Explore : Why can't we see the Sun at night? (p. 137)",
        'Explore : What clothes do people wear in each season? (p. 145)',
        'Explore : How do we see the Moon at night? (p. 153)',
        'Quick Lab : Moon Flip Book (p. 140)',
        'Quick Lab : Seasons (p. 147)',
        'Quick Lab : Stars (p. 158)',
      ],
      lecons: [
        { numero: 136, titre: 'Lesson 1 — Day and Night', page: 136 },
        { numero: 142, titre: 'Inquiry Skill Builder', page: 142 },
        { numero: 144, titre: 'Lesson 2 — Why Seasons Happen', page: 144 },
        { numero: 150, titre: 'Writing in Science · Math in Science', page: 150 },
        { numero: 152, titre: 'Lesson 3 — The Moon and Stars', page: 152 },
        { numero: 160, titre: 'Be a Scientist', page: 160 },
        { numero: 162, titre: 'I Read to Review : Our Moving Earth', page: 162 },
        { numero: 166, titre: 'Chapter 4 Review and Standards Practice', page: 166, bilan: true },
      ],
    },
    {
      numero: 5,
      titre: 'Chapter 5 — Observing Weather',
      rubrique: TERRE,
      activites: [
        'Explore : How does the weather change each day? (p. 171)',
        'Explore : Where did the water go? (p. 179)',
        'Explore : How can clouds help predict the weather? (p. 187)',
        'Quick Lab : Make a Wind Sock (p. 174)',
        'Quick Lab : Model the Water Cycle (p. 182)',
        'Quick Lab : Make a Thunder Model (p. 190)',
      ],
      lecons: [
        { numero: 170, titre: 'Lesson 1 — Weather', page: 170 },
        { numero: 176, titre: 'Writing in Science · Math in Science', page: 176 },
        { numero: 178, titre: 'Lesson 2 — The Water Cycle', page: 178 },
        { numero: 184, titre: 'Inquiry Skill Builder', page: 184 },
        { numero: 186, titre: 'Lesson 3 — Changes in Weather', page: 186 },
        { numero: 192, titre: 'Reading in Science', page: 192 },
        { numero: 194, titre: "I Read to Review : Earth's Water Cycle", page: 194 },
        { numero: 198, titre: 'Chapter 5 Review and Standards Practice', page: 198, bilan: true },
        { numero: 200, titre: 'Unit Literature : Sun Flakes', page: 200 },
      ],
    },
    {
      numero: 6,
      titre: 'Chapter 6 — Energy',
      rubrique: PHYSIQUE,
      activites: [
        'Explore : How is sound made? (p. 211)',
        'Explore : What does light pass through? (p. 221)',
        'Quick Lab : Tuning Fork Ripples (p. 213)',
        'Quick Lab : Prism Rainbow (p. 224)',
      ],
      lecons: [
        { numero: 210, titre: 'Lesson 1 — Sound', page: 210 },
        { numero: 218, titre: 'Writing in Science · Math in Science', page: 218 },
        { numero: 220, titre: 'Lesson 2 — Light', page: 220 },
        { numero: 226, titre: 'Be a Scientist', page: 226 },
        { numero: 228, titre: 'I Read to Review : Energy Poem', page: 228 },
        { numero: 232, titre: 'Chapter 6 Review and Standards Practice', page: 232, bilan: true },
        { numero: 234, titre: 'Unit Literature : Popcorn Hop', page: 234 },
        { numero: 236, titre: 'Careers in Science', page: 236 },
      ],
    },
  ],
}

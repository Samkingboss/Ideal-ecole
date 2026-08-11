// Découpage officiel de la journée du primaire IDEAL
// (« Emploi du temps Primaire Ideal » v1.0, § 1.2)
//
// La journée n'est pas un bloc continu de 8h à 16h : elle compte douze
// séquences de 30 minutes séparées par deux récréations et un déjeuner.
// Compter les minutes manquées à la pendule fausse tout — un élève arrivé à
// 10h15 arrive pendant la récréation et n'a manqué que les quatre premières
// séquences, soit 120 minutes de cours et non 135.

export const DUREE_SEQUENCE = 30

// S1..S12, heure de début en minutes depuis minuit.
export const SEQUENCES = [
  { n: 1,  debut: 8 * 60,          bloc: 1 },  // 08h00
  { n: 2,  debut: 8 * 60 + 30,     bloc: 1 },  // 08h30
  { n: 3,  debut: 9 * 60,          bloc: 1 },  // 09h00
  { n: 4,  debut: 9 * 60 + 30,     bloc: 1 },  // 09h30
  // récréation 10h00 – 10h30
  { n: 5,  debut: 10 * 60 + 30,    bloc: 1 },  // 10h30
  { n: 6,  debut: 11 * 60,         bloc: 1 },  // 11h00
  { n: 7,  debut: 11 * 60 + 30,    bloc: 2 },  // 11h30
  // déjeuner 12h00 – 13h00
  { n: 8,  debut: 13 * 60,         bloc: 2 },  // 13h00
  { n: 9,  debut: 13 * 60 + 30,    bloc: 2 },  // 13h30
  { n: 10, debut: 14 * 60,         bloc: 2 },  // 14h00
  { n: 11, debut: 14 * 60 + 30,    bloc: 2 },  // 14h30
  // récréation 15h00 – 15h30
  { n: 12, debut: 15 * 60 + 30,    bloc: 2 },  // 15h30
]

/** Minutes d'enseignement d'une journée complète : 12 × 30 = 360. */
export const MINUTES_JOUR = SEQUENCES.length * DUREE_SEQUENCE

// L'école compte six classes, mais l'enseignement est organisé en quatre
// groupes : CE1 et CE2 sont jumelées, CM1 et CM2 aussi, et chaque paire suit
// la même grille. On rattache donc chaque classe à son groupe plutôt que de
// recopier l'emploi du temps deux fois.
const GROUPES = {
  'cp1': 'CP1',
  'cp2': 'CP2',
  'ce1': 'CE1-CE2', 'ce2': 'CE1-CE2', 'ce1-ce2': 'CE1-CE2',
  'cm1': 'CM1-CM2', 'cm2': 'CM1-CM2', 'cm1-cm2': 'CM1-CM2',
}

/** Groupe pédagogique d'une classe, ou null si elle n'a pas de grille
 *  (Petite et Grande Section : le document ne couvre que le primaire). */
export function groupeDeClasse(nomClasse) {
  const n = String(nomClasse || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '').trim()
  return GROUPES[n] || null
}

export const finSequence = s => s.debut + DUREE_SEQUENCE

/** "08:45" ou "8h45" → minutes depuis minuit. */
export function heureEnMinutes(h) {
  if (!h) return null
  const m = String(h).match(/(\d{1,2})\s*[:hH]\s*(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Séquences auxquelles l'élève a réellement assisté, d'après son heure
 * d'arrivée et son heure de départ. Une séquence n'est comptée comme suivie
 * que si elle a été suivie en entier : arriver au milieu d'une leçon de 30
 * minutes, ce n'est pas l'avoir eue.
 */
export function sequencesSuivies(heureArrivee, heureDepart) {
  const a = heureEnMinutes(heureArrivee)
  const d = heureEnMinutes(heureDepart)
  const debut = a == null ? SEQUENCES[0].debut : a
  const fin = d == null ? finSequence(SEQUENCES[SEQUENCES.length - 1]) : d
  return SEQUENCES.filter(s => s.debut >= debut && finSequence(s) <= fin)
}

/** Séquences manquées, l'inverse des précédentes. */
export function sequencesManquees(heureArrivee, heureDepart) {
  const suivies = new Set(sequencesSuivies(heureArrivee, heureDepart).map(s => s.n))
  return SEQUENCES.filter(s => !suivies.has(s.n))
}

/**
 * En semaine paire, les deux blocs sont permutés (§ 1.3) : ce qui est
 * enseigné en S1 l'est en S7, et réciproquement. La grille n'est stockée que
 * pour les semaines impaires ; on la relit décalée.
 */
export const numeroSemaine = (date) => {
  const d = new Date(date + 'T00:00:00')
  const debutAnnee = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - debutAnnee) / 86400000) + debutAnnee.getDay() + 1) / 7)
}

export const semainePaire = date => numeroSemaine(date) % 2 === 0

/** Séquence à consulter dans la grille (stockée en semaine impaire). */
export function sequenceDansGrille(sequence, date) {
  if (!semainePaire(date)) return sequence
  return sequence <= 6 ? sequence + 6 : sequence - 6
}

/**
 * Taux de participation d'un élève sur une journée, et détail des matières
 * manquées si la grille de la classe est fournie.
 *
 * `grille` : lignes { jour, sequence, matiere } de la classe.
 */
export function participationDuJour({ presence, grille = [], date, jour }) {
  if (!presence || presence.statut === 'absent') {
    const manquees = SEQUENCES
    return {
      minutesSuivies: 0,
      minutesManquees: MINUTES_JOUR,
      taux: 0,
      matieresManquees: matieresDe(manquees, grille, date, jour),
    }
  }
  const suivies = sequencesSuivies(presence.heure_arrivee, presence.heure_depart)
  const manquees = sequencesManquees(presence.heure_arrivee, presence.heure_depart)
  return {
    minutesSuivies: suivies.length * DUREE_SEQUENCE,
    minutesManquees: manquees.length * DUREE_SEQUENCE,
    taux: Math.round((suivies.length / SEQUENCES.length) * 100),
    matieresManquees: matieresDe(manquees, grille, date, jour),
  }
}

/** Matières correspondant à des séquences manquées, avec le temps perdu. */
function matieresDe(sequences, grille, date, jour) {
  if (!grille.length) return []
  const compte = {}
  sequences.forEach(s => {
    const cible = sequenceDansGrille(s.n, date)
    const ligne = grille.find(g => g.jour === jour && g.sequence === cible)
    if (!ligne) return
    compte[ligne.matiere] = (compte[ligne.matiere] || 0) + DUREE_SEQUENCE
  })
  return Object.entries(compte)
    .map(([matiere, minutes]) => ({ matiere, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

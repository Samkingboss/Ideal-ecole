// Répertoire des manuels et outils de lecture de l'avancement.
//
// Un manuel est repéré par le couple (groupe, matière) de l'emploi du temps —
// exactement les deux valeurs que porte déjà une préparation. Aucun identifiant
// nouveau à saisir : une matière a son manuel, ou elle n'en a pas, et dans ce
// second cas la préparation reste libre comme avant.
//
// Ajouter un manuel = déposer un fichier à côté de celui-ci et l'inscrire dans
// MANUELS. Rien d'autre à toucher.

import mathsCP1 from './maths-cp1'

export const MANUELS = [mathsCP1]

// Le libellé de matière vient de l'emploi du temps, saisi à la main : on
// compare sans accents ni casse, et en ignorant les espaces de bord (la table
// `matieres` contient déjà « Mathématiques » avec une espace finale).
const norm = s =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export const manuelPour = (groupe, matiere) =>
  MANUELS.find(m => norm(m.groupe) === norm(groupe) && norm(m.matiere) === norm(matiere)) || null

export const manuelParCle = cle => MANUELS.find(m => m.cle === cle) || null

// ─── Lecture d'un manuel ─────────────────────────────────────────────────────

// Liste à plat, dans l'ordre du livre. C'est cet ordre qui fait foi : la leçon
// suivante est la suivante du manuel, pas une date au calendrier.
export const leconsDe = manuel =>
  (manuel?.unites || []).flatMap(u =>
    u.lecons.map(l => ({ ...l, unite: u.numero, uniteTitre: u.titre }))
  )

export const leconParNumero = (manuel, numero) =>
  leconsDe(manuel).find(l => l.numero === Number(numero)) || null

// Rang d'une leçon dans le manuel (1 = la première). Sert à mesurer
// l'avancement sans supposer que les numéros du livre se suivent.
export const rangDe = (manuel, numero) => {
  const i = leconsDe(manuel).findIndex(l => l.numero === Number(numero))
  return i < 0 ? null : i + 1
}

// Prochaine leçon à traiter, connaissant celles déjà couvertes.
// On repart du rang le plus avancé, pas du nombre de leçons faites : un
// enseignant qui revient en arrière sur une notion ne doit pas voir le
// programme se décaler d'autant.
export const prochaineLecon = (manuel, numerosFaits = []) => {
  const lecons = leconsDe(manuel)
  const rangs = numerosFaits.map(n => rangDe(manuel, n)).filter(Boolean)
  const dernier = rangs.length ? Math.max(...rangs) : 0
  return lecons[dernier] || null
}

// Libellé court pour une fiche ou un rapport :
// « U3 · L19 — Additionnons sur la bande numérique (p. 40) ».
export const libelleLecon = l =>
  l ? `U${l.unite} · L${l.numero} — ${l.titre} (p. ${l.page})` : ''

// ─── Avancement lu dans les préparations ─────────────────────────────────────

// `preparations.contenu.programme` porte { cle, lecon } depuis la fiche de
// préparation. On ne retient que les lignes du bon manuel : une même classe
// peut avoir plusieurs manuels (Maths et Mathematics).
//
// Une leçon étalée sur plusieurs séquences produit autant de lignes qu'elle
// occupe de demi-heures ; on compte donc les leçons distinctes, pas les lignes.
export const avancement = (manuel, preparations = []) => {
  const lecons = leconsDe(manuel)
  const seances = {}   // numéro de leçon -> [dates]

  preparations.forEach(p => {
    const ref = p?.contenu?.programme
    if (!ref || ref.cle !== manuel.cle) return
    const n = Number(ref.lecon)
    if (!leconParNumero(manuel, n)) return
    ;(seances[n] = seances[n] || []).push(p.date_cours)
  })

  const faits = Object.keys(seances).map(Number)
  const rangMax = faits.length ? Math.max(...faits.map(n => rangDe(manuel, n))) : 0

  return {
    seances,                                  // leçon -> dates de séquences préparées
    faits,                                    // numéros de leçons abordées
    nbFaits: faits.length,
    total: lecons.length,
    pourcentage: lecons.length ? Math.round((faits.length / lecons.length) * 100) : 0,
    rangMax,                                  // position atteinte dans le livre
    courante: rangMax ? lecons[rangMax - 1] : null,
    prochaine: prochaineLecon(manuel, faits),
  }
}

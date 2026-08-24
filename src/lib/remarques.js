// Les remarques de la direction, attachées à l'endroit qu'elles concernent.
//
// ── Le problème qu'elles résolvent ─────────────────────────────────────────
//
// Le premier retour réel de la direction disait : « Au niveau de la découverte
// étant donné que c'est la première lettre… ». La remarque concernait la
// rubrique Découverte, mais elle s'affichait comme un commentaire général sur
// toute la fiche. L'enseignante devait deviner où corriger.
//
// Une remarque appartient à une rubrique. C'est tout l'objet de ce fichier.
//
// ── Où elles sont stockées ─────────────────────────────────────────────────
//
// Dans `preparations.historique_statuts`, comme tout le reste. Aucune table
// nouvelle, aucune colonne nouvelle.
//
// Ce choix n'est pas une économie : c'est le seul qui donne gratuitement tout
// ce que la fonctionnalité exige. L'historique est déjà horodaté, signé,
// append-only, et il survit à l'enregistrement de l'enseignante — vérifié :
// son UPDATE n'écrit ni `status` ni `historique_statuts`. Une remarque ne peut
// donc pas disparaître parce qu'elle a modifié la rubrique.
//
// Une entrée de remarque :
//
//   { action: 'commentaire', section: 'decouverte', commentaire: '…',
//     le, par, par_nom, par_fonction, statut: null }
//
// `statut: null` : une remarque n'est pas une décision. Elle n'avance pas la
// préparation ; c'est « demander une correction » qui le fait.
//
// ── La clé de rubrique ─────────────────────────────────────────────────────
//
// Jamais la position, jamais l'ordre d'affichage, jamais le libellé — un
// libellé se retraduit, une position se réordonne, et la remarque suivrait le
// mauvais champ. La clé est l'identifiant métier du champ, celui qui sert déjà
// à stocker son contenu dans `contenu`.

import { RUBRIQUES, ETAPES } from '../pages/FichePreparation'

// ── Vocabulaire ────────────────────────────────────────────────────────────

/** La leçon du manuel visée par la fiche. */
export const SECTION_PROGRAMME = 'programme'

/** Une étape du déroulement, dans une séquence donnée. */
export const cleEtape = (indexSequence, idEtape) => `sequence.${indexSequence}.${idEtape}`

/** Une remarque générale ne porte pas de section. */
export const SECTION_GENERALE = null

/**
 * Toutes les sections commentables d'une fiche, dans l'ordre où elles
 * apparaissent à l'écran. Construite depuis `RUBRIQUES` et `ETAPES` : ajouter
 * une rubrique au formulaire la rend commentable sans toucher à ce fichier.
 */
export const sectionsDe = (contenu) => {
  const nb = Math.max(1, Number(contenu?.nb_sequences) || 1)
  const sections = [
    { cle: SECTION_PROGRAMME, label: 'Leçon du manuel' },
    ...RUBRIQUES.map(r => ({ cle: r.id, label: r.label })),
  ]
  for (let i = 0; i < nb; i++) {
    for (const e of ETAPES) {
      sections.push({
        cle: cleEtape(i + 1, e.id),
        label: nb > 1 ? `${e.label} — séquence ${i + 1}` : e.label,
      })
    }
  }
  return sections
}

/** Le libellé d'une clé, pour l'afficher hors de son contexte. */
export const libelleSection = (cle, contenu) => {
  if (!cle) return 'Remarque générale'
  const s = sectionsDe(contenu).find(x => x.cle === cle)
  return s ? s.label : cle
}

// ── Lecture ────────────────────────────────────────────────────────────────

const estRemarque = e => e && e.action === 'commentaire'

/**
 * Les remarques d'une préparation, dans l'ordre chronologique.
 *
 * Chacune reçoit son état, déduit de la chronologie et non stocké : une
 * remarque est « traitée » dès que l'enseignante a redéposé APRÈS elle. Rien
 * à maintenir, rien à désynchroniser.
 */
export const remarquesDe = (historique) => {
  const entrees = Array.isArray(historique) ? historique : []
  // Les redépôts postérieurs à une remarque la rendent traitée.
  const redepots = entrees
    .filter(e => e && (e.action === 'depot' || e.action === 'modification'))
    .map(e => e.le)
    .filter(Boolean)

  return entrees.filter(estRemarque).map(e => ({
    section: e.section || SECTION_GENERALE,
    texte: e.commentaire || '',
    le: e.le || null,
    par: e.par || null,
    parNom: e.par_nom || null,
    parFonction: e.par_fonction || null,
    traitee: Boolean(e.le && redepots.some(d => d > e.le)),
  }))
}

/**
 * Les remarques groupées par section, prêtes à s'afficher sous leur rubrique.
 * `Map` et non objet : `null` est une clé valide, et c'est celle des remarques
 * générales.
 */
export const remarquesParSection = (historique) => {
  const carte = new Map()
  for (const r of remarquesDe(historique)) {
    const liste = carte.get(r.section) || []
    liste.push(r)
    carte.set(r.section, liste)
  }
  return carte
}

/**
 * Les remarques générales — celles qui portent sur toute la préparation.
 *
 * Elles comprennent les commentaires sans section, ET les commentaires portés
 * par les entrées `correction_demandee` d'avant l'existence des sections. Ces
 * anciens retours restent lisibles tels quels.
 *
 * On ne devine JAMAIS la section d'une ancienne remarque à partir de son
 * texte : « Au niveau de la découverte… » ressemble à une remarque de
 * Découverte, mais une ressemblance n'est pas une donnée.
 */
export const remarquesGenerales = (historique) => {
  const entrees = Array.isArray(historique) ? historique : []
  const heritees = entrees
    .filter(e => e && e.action === 'correction_demandee' && e.commentaire)
    .map(e => ({
      section: SECTION_GENERALE,
      texte: e.commentaire,
      le: e.le || null,
      par: e.par || null,
      parNom: e.par_nom || null,
      parFonction: e.par_fonction || null,
      traitee: false,
      heritee: true,
    }))
  const posees = remarquesDe(historique).filter(r => r.section === SECTION_GENERALE)
  return [...heritees, ...posees].sort((a, b) => String(a.le).localeCompare(String(b.le)))
}

/** Combien de corrections restent à traiter, sections seulement. */
export const nbCorrectionsOuvertes = (historique) =>
  remarquesDe(historique).filter(r => r.section !== SECTION_GENERALE && !r.traitee).length

// ── Écriture ───────────────────────────────────────────────────────────────

/**
 * Une nouvelle entrée de remarque, à ajouter à l'historique.
 * N'écrit rien : rend l'entrée, l'appelant la persiste avec le reste.
 */
export const entreeRemarque = ({ section, texte, utilisateur, fonction }) => ({
  statut: null,
  action: 'commentaire',
  section: section || null,
  commentaire: String(texte || '').trim(),
  le: new Date().toISOString(),
  par: utilisateur?.id || null,
  par_nom: utilisateur ? `${utilisateur.prenom || ''} ${utilisateur.nom || ''}`.trim() : null,
  par_fonction: fonction || null,
})

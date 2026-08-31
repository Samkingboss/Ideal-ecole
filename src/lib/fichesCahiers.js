import { dateEnLettres } from './certificatTexte.js'

const texte = valeur => String(valeur ?? '').trim()

// ── Date en toutes lettres ─────────────────────────────────────────────────
//
// « 2026-08-25 » n'est pas une date pour un parent. On réutilise
// `dateEnLettres` du module certificat — « 25 août 2026 » — et l'on y ajoute
// le jour de la semaine.
//
// Le jour se calcule en UTC, jamais par `new Date('2026-08-25')` : cette
// forme est le 24 août à l'ouest de Greenwich, et la fiche daterait la leçon
// de la veille. Le dépôt s'en est déjà défendu ailleurs.
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export const dateJourEnLettres = iso => {
  const enLettres = dateEnLettres(iso)
  if (!enLettres) return ''
  const [a, m, j] = texte(iso).slice(0, 10).split('-').map(Number)
  const jour = JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]
  return jour ? `${jour} ${enLettres}` : enLettres
}

// ── Langue de la leçon ─────────────────────────────────────────────────────
//
// Elle n'est ni devinée, ni déduite d'un nom de matière écrit à la main :
// CHAQUE MANUEL DU DÉPÔT DÉCLARE DÉJÀ SA LANGUE — `langue: 'fr'` pour Lecture
// CP1, `langue: 'en'` pour Science CP1. Vingt et un manuels sur vingt et un.
//
// On cherche d'abord le manuel du couple (groupe, matière), exactement comme
// l'écran de préparation. À défaut — une matière libre, sans manuel pour ce
// niveau — on retient la langue déclarée pour la même matière à un autre
// niveau. Sans manuel du tout, on ne sait pas, et l'on rend `null` plutôt
// qu'un français par défaut : c'est l'appelant qui décide de son repli.
// La liste des manuels est PASSÉE, pas importée : `src/lib/programmes` charge
// vingt-deux fichiers et n'est lisible que par le bundler. Ce module-ci doit
// rester exécutable tel quel — une garde l'importe déjà. La fonction devient
// pure, donc vérifiable, et la donnée reste là où elle vit.
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export const langueDeLecon = (groupe, matiere, manuels = []) => {
  const liste = Array.isArray(manuels) ? manuels : []
  const direct = liste.find(m => m?.langue
    && norm(m.groupe) === norm(groupe) && norm(m.matiere) === norm(matiere))
  if (direct) return direct.langue
  const ailleurs = liste.find(m => m?.langue && norm(m.matiere) === norm(matiere))
  return ailleurs ? ailleurs.langue : null
}

export const estPreparationExploitable = statut => statut === 'validee'

export const estClasseMaternelle = nom => {
  const n = texte(nom).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return /(^|\b)(ps|gs|petite section|grande section|maternelle)(\b|$)/.test(n)
}

export const elevesActifsUniques = eleves => {
  const vus = new Set()
  return (Array.isArray(eleves) ? eleves : []).filter(e => {
    const id = texte(e?.id)
    if (!id || e?.actif !== true || vus.has(id)) return false
    vus.add(id)
    return true
  })
}

// Les étapes du déroulement, SAUF la clôture : celle-ci porte l'essentiel et
// a sa propre rubrique. L'y laisser aussi l'imprimerait deux fois.
const activitesDe = contenu => (contenu?.sequences || [])
  .flatMap(sequence => Object.entries(sequence?.etapes || {})
    .filter(([id]) => id !== 'cloture')
    .map(([, etape]) => texte(etape?.texte)))
  .filter(Boolean)

// ── Ce que l'enfant doit retenir ───────────────────────────────────────────
//
// RIEN N'EST GÉNÉRÉ. Le texte sort de la préparation, mot pour mot.
//
// L'étape « Clôture » du formulaire porte, dans son aide à l'enseignant :
// « Ce qu'on retient, vérification rapide. » C'est la phrase que l'enseignant
// écrit en pensant à ce qui doit rester. C'est donc elle, et rien d'autre.
//
// Une leçon peut compter plusieurs séquences de trente minutes : on garde
// toutes les clôtures renseignées, sans doublon, dans l'ordre du déroulement.
//
// À défaut de clôture, l'objectif de la notion — « Ce que l'élève saura faire
// à la fin ». À défaut des deux, la rubrique ne s'affiche pas : mieux vaut
// une fiche sans cette zone qu'une phrase inventée.
export const essentielARetenir = contenu => {
  const clotures = (contenu?.sequences || [])
    .map(sequence => texte(sequence?.etapes?.cloture?.texte))
    .filter(Boolean)
  const uniques = [...new Set(clotures)]
  if (uniques.length) return uniques.join(' · ')
  return texte(contenu?.objectif)
}

export function donneesPedagogiques(preparation) {
  const contenu = preparation?.contenu || {}
  const programme = contenu.programme || {}
  return {
    matiere: texte(preparation?.matiere),
    date: texte(preparation?.date_cours),
    objectif: texte(contenu.objectif),
    activites: activitesDe(contenu),
    trace: texte(contenu.trace),
    evaluation: texte(contenu.evaluation),
    essentiel: essentielARetenir(contenu),
    progression: [texte(programme.unite), texte(programme.titre)].filter(Boolean).join(' — '),
  }
}

export function genererFichesCahiers({ preparation, eleves, classeNom, enseignant, observations = {}, presences = {}, note = '', manuels = [], groupe = '' }) {
  if (!estPreparationExploitable(preparation?.status)) return []
  const pedagogie = donneesPedagogiques(preparation)
  const maternelle = estClasseMaternelle(classeNom)
  return elevesActifsUniques(eleves).map(eleve => {
    const presence = presences[eleve.id]
    const absent = presence?.statut === 'absent'
    return {
      id: texte(eleve.id),
      prenom: texte(eleve.prenom) || texte(eleve.nom) || 'Élève',
      nom: texte(eleve.nom),
      classe: texte(classeNom),
      enseignant: texte(enseignant),
      dateLisible: dateJourEnLettres(preparation?.date_cours),
      // 'fr' | 'en'. Sans manuel déclaré, on retient le français : la fiche
      // est un document de l'école, rédigée en français, et c'est le repli le
      // moins surprenant. Ce choix est ICI, visible, pas dissous dans le rendu.
      langue: langueDeLecon(groupe || classeNom, preparation?.matiere, manuels) || 'fr',
      template: maternelle ? 'maternelle' : 'primaire',
      absent,
      introduction: absent
        ? 'Cette fiche présente les apprentissages travaillés en classe aujourd’hui.'
        : `Aujourd’hui, ${texte(eleve.prenom) || 'votre enfant'} a appris :`,
      ...pedagogie,
      observation: texte(observations[eleve.id]),
      note: texte(note),
    }
  })
}

export const paginerFiches = (fiches, parPage = 1) => {
  const taille = Math.max(1, Number(parPage) || 1)
  const pages = []
  for (let i = 0; i < fiches.length; i += taille) pages.push(fiches.slice(i, i + taille))
  return pages
}

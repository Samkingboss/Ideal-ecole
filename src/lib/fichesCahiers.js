const texte = valeur => String(valeur ?? '').trim()

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

const activitesDe = contenu => (contenu?.sequences || [])
  .flatMap(sequence => Object.values(sequence?.etapes || {}))
  .map(etape => texte(etape?.texte))
  .filter(Boolean)

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
    progression: [texte(programme.unite), texte(programme.titre)].filter(Boolean).join(' — '),
  }
}

export function genererFichesCahiers({ preparation, eleves, classeNom, enseignant, observations = {}, presences = {}, note = '' }) {
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

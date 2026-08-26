// La rédaction du certificat de scolarité.
//
// ── Pourquoi ce n'est pas dans le composant ────────────────────────────────
//
// Le certificat posait ses informations dans une grille d'étiquettes —
// « Matricule », « Né(e) le », « Classe fréquentée » — puis les reprenait
// dans une phrase vague. Un document institutionnel s'énonce ; il ne se
// remplit pas comme un formulaire.
//
// Et une rédaction se teste : un champ manquant ne doit jamais produire
// « né le 15 avril 2018 à null », ni une phrase amputée. C'était le cas —
// `lieu_naissance` vide écrivait littéralement « à null » sur un document
// officiel.
//
// La règle tient en une ligne : ON N'ÉCRIT QUE CE QU'ON SAIT. Chaque
// proposition est ajoutée si et seulement si sa donnée existe, et la phrase
// reste grammaticale dans tous les cas.

const propre = (v) => {
  const t = String(v ?? '').trim()
  // « null » et « undefined » arrivent bel et bien jusqu'ici quand une
  // interpolation a eu lieu en amont. On les refuse comme des vides.
  if (!t || t === 'null' || t === 'undefined') return null
  return t
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « 15 avril 2018 ». Rend null si la date est absente ou illisible. */
export const dateEnLettres = (iso) => {
  const t = propre(iso)
  if (!t) return null
  const [a, m, j] = t.slice(0, 10).split('-').map(Number)
  if (!a || !m || !j || m < 1 || m > 12) return null
  return `${j} ${MOIS[m - 1]} ${a}`
}

// ── Accord ─────────────────────────────────────────────────────────────────
//
// Le sexe est lu dans la fiche, jamais déduit du prénom : deux personnes du
// même prénom peuvent ne pas partager la même civilité, et un prénom n'est
// pas une donnée d'état civil.
//
// Quand il n'est pas renseigné, on ne met pas « né(e) » : une parenthèse
// dans un acte administratif signale que l'établissement ne sait pas. On
// reformule pour que la phrase n'ait pas à s'accorder du tout.
const accord = (sexe) => {
  const s = String(sexe ?? '').trim().toUpperCase()
  if (s === 'F' || s === 'FEMININ' || s === 'FÉMININ') return 'f'
  if (s === 'M' || s === 'MASCULIN') return 'm'
  return null
}

/**
 * Le corps du certificat, en trois paragraphes.
 *
 * Rend `{ entete, corps, formule }` — trois chaînes prêtes à poser, aucune
 * ne contenant de champ vide.
 */
export const texteCertificat = ({ eleve = {}, directeur = {}, anneeScolaire, ecole }) => {
  const nom = [propre(eleve.prenom), propre(eleve.nom)].filter(Boolean).join(' ') || null
  const matricule = propre(eleve.matricule)
  const classe = propre(eleve.classe_nom) || propre(eleve.classe)
  const naissance = dateEnLettres(eleve.date_naissance)
  const lieu = propre(eleve.lieu_naissance)
  const annee = propre(anneeScolaire)
  const g = accord(eleve.sexe)

  // ── Paragraphe 1 : qui certifie ─────────────────────────────────────────
  const civilite = propre(directeur.civilite)
  const signataire = propre(directeur.nom)
  const qualite = propre(directeur.fonction) || 'Directeur'
  const etablissement = propre(ecole) || 'École Internationale Bilingue IDEAL'
  const entete = 'Je soussigné'
    + (signataire ? `, ${[civilite, signataire].filter(Boolean).join(' ')}` : '')
    + `, agissant en qualité de ${qualite} de l’${etablissement},`
    + ' certifie par la présente que :'

  // ── Paragraphe 2 : l'élève, en une phrase ───────────────────────────────
  const morceaux = []
  if (nom) morceaux.push(nom)

  if (naissance) {
    const ou = lieu ? ` à ${lieu}` : ''
    // Sans le sexe, on évite l'accord plutôt que d'écrire « né(e) ».
    morceaux.push(g === 'f' ? `née le ${naissance}${ou}`
                : g === 'm' ? `né le ${naissance}${ou}`
                : `dont la naissance est enregistrée au ${naissance}${ou}`)
  }
  if (matricule) morceaux.push(`portant le matricule ${matricule}`)

  // Les appositions se ferment par une virgule avant le verbe : « X, née le
  // …, portant le matricule …, est inscrite ». Sans elle la phrase se lit
  // « portant le matricule 26-27 A002 est inscrite », qui n'est pas français.
  const sujet = morceaux.length
    ? morceaux.join(', ') + (morceaux.length > 1 ? ',' : '')
    : 'l’élève désigné ci-dessous'
  const inscrit = g === 'f' ? 'est régulièrement inscrite'
                : g === 'm' ? 'est régulièrement inscrit'
                : 'suit régulièrement la scolarité'
  const auSein = g ? 'au sein de notre établissement' : 'de notre établissement'

  let corps = `${sujet} ${inscrit} ${auSein}`
  if (annee) corps += ` au titre de l’année scolaire ${annee}`
  if (classe) corps += ` et fréquente la classe de ${classe}`
  corps += '.'

  // ── Paragraphe 3 : la formule consacrée ─────────────────────────────────
  // « lui » est épicène : le pronom ne varie pas, contrairement au participe.
  const formule = 'Le présent certificat lui est délivré pour servir et valoir ce que de droit.'

  return { entete, corps, formule }
}

/** « Fait à Bamako, le 26 août 2026 ». */
export const lieuEtDate = (ville, iso) => {
  const d = dateEnLettres(iso) || dateEnLettres(new Date().toISOString())
  return `Fait à ${propre(ville) || 'Bamako'}, le ${d}`
}

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

import { NOM_ECOLE } from './ecole.js'

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

// ── Filiation et responsables légaux ───────────────────────────────────────
//
// LE LIEN NE SE DÉDUIT PAS DE LA POSITION. `inscriptions` porte
// `responsable1_id` et `responsable2_id`, mais rien ne dit que le premier est
// le père : le formulaire demande explicitement `lien_parente`, dont les
// valeurs sont « pere », « mere » ou « tuteur ». Deux mères, un tuteur seul,
// un père en second : tout cela existe. Écrire « Fils de M. [responsable1] »
// serait une invention.
//
// La civilité suit le LIEN DÉCLARÉ, jamais le prénom : un prénom n'est pas
// une donnée d'état civil. Pour un tuteur, dont le lien ne dit pas la
// civilité, on n'en met aucune et on parle de « représentant légal » —
// « tuteur » et « tutrice » s'accordent, « représentant légal » se lit comme
// une fonction.

const LIENS = {
  pere: { civilite: 'M.',  filiation: 'père', qualite: 'père' },
  mere: { civilite: 'Mme', filiation: 'mère', qualite: 'mère' },
}

const normaliserLien = (v) => {
  const t = String(v ?? '').trim().toLowerCase()
  if (t.startsWith('per') || t.startsWith('pèr')) return 'pere'
  if (t.startsWith('mer') || t.startsWith('mèr')) return 'mere'
  if (t.startsWith('tut')) return 'tuteur'
  return null
}

/** « M. Moussa DIARRA », ou « Moussa DIARRA » quand la civilité est inconnue. */
export const nomAvecCivilite = (r) => {
  const nom = [propre(r?.prenom), propre(r?.nom)].filter(Boolean).join(' ')
  if (!nom) return null
  const lien = LIENS[normaliserLien(r?.lien_parente)]
  return lien ? `${lien.civilite} ${nom}` : nom
}

/**
 * La phrase de filiation, ou `null`.
 *
 * Un seul parent connu : on le nomme et on ne suppose pas l'autre. Aucun
 * parent : la phrase disparaît entièrement — un certificat qui écrirait
 * « Fils de » sans parents serait pire qu'un certificat qui n'en parle pas.
 */
export const phraseFiliation = (responsables, sexe) => {
  const liste = Array.isArray(responsables) ? responsables : []
  const pere = liste.find(r => normaliserLien(r?.lien_parente) === 'pere')
  const mere = liste.find(r => normaliserLien(r?.lien_parente) === 'mere')
  const nomPere = nomAvecCivilite(pere)
  const nomMere = nomAvecCivilite(mere)
  if (!nomPere && !nomMere) return null

  const g = accord(sexe)
  const mot = g === 'f' ? 'Fille' : g === 'm' ? 'Fils' : 'Enfant'
  const parents = nomPere && nomMere ? `${nomPere} et de ${nomMere}` : (nomPere || nomMere)
  return `${mot} de ${parents}.`
}

/**
 * La phrase des responsables légaux, ou `null`.
 *
 * Elle est DISTINCTE de la filiation : un père peut ne pas être le
 * responsable légal déclaré, et un tuteur n'est pas un parent.
 */
export const phraseResponsables = (responsables) => {
  const liste = (Array.isArray(responsables) ? responsables : [])
    .filter(r => propre(r?.nom) || propre(r?.prenom))
  if (!liste.length) return null

  if (liste.length === 1) {
    const r = liste[0]
    const lien = LIENS[normaliserLien(r?.lien_parente)]
    const nom = nomAvecCivilite(r)
    // Le lien connu enrichit la phrase ; il n'est jamais supposé.
    if (lien) {
      const possessif = lien.qualite === 'mère' ? 'Sa' : 'Son'
      const accordQualite = lien.qualite === 'mère' ? 'responsable légale' : 'responsable légal'
      return `${possessif} ${lien.qualite}, ${nom}, est enregistré${lien.qualite === 'mère' ? 'e' : ''} comme ${accordQualite}.`
    }
    return `Son représentant légal est ${nom}.`
  }

  const noms = liste.map(nomAvecCivilite).filter(Boolean)
  if (!noms.length) return null
  const dernier = noms.pop()
  return `Ses représentants légaux sont ${[noms.join(', '), dernier].filter(Boolean).join(' et ')}.`
}

/**
 * Le corps du certificat, en trois paragraphes.
 *
 * Rend `{ entete, corps, formule }` — trois chaînes prêtes à poser, aucune
 * ne contenant de champ vide.
 */
export const texteCertificat = ({ eleve = {}, responsables = [], directeur = {}, anneeScolaire, ecole, motif = null }) => {
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
  const etablissement = propre(ecole) || NOM_ECOLE
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
                : 'poursuit régulièrement sa scolarité'
  const auSein = 'au sein de notre établissement'

  let corps = `${sujet} ${inscrit} ${auSein}`
  if (annee) corps += ` au titre de l’année scolaire ${annee}`
  // « y suit effectivement les enseignements » : c'est ce qu'un certificat de
  // scolarité atteste, et non la seule inscription administrative.
  // Le verbe de la proposition dépend du premier : « est inscrit … et y suit »
  // se lit bien, « poursuit … et y suit » répète le verbe.
  if (classe) corps += g
    ? ` et y suit effectivement les enseignements de la classe de ${classe}`
    : `, en classe de ${classe}`
  corps += '.'

  // ── Paragraphes 3 et 4 : filiation, puis responsables ───────────────────
  //
  // Deux phrases distinctes, et jamais confondues : un père peut ne pas être
  // le responsable légal déclaré, et un tuteur n'est pas un parent.
  const filiation = phraseFiliation(responsables, eleve.sexe)
  let legaux = phraseResponsables(responsables)

  // Quand les responsables légaux SONT exactement les parents qu'on vient de
  // nommer, une seconde phrase répéterait les mêmes noms mot pour mot. On
  // replie l'information sur la filiation plutôt que de la redire.
  const parents = (Array.isArray(responsables) ? responsables : [])
    .filter(r => ['pere', 'mere'].includes(normaliserLien(r?.lien_parente)))
  const tous = (Array.isArray(responsables) ? responsables : [])
    .filter(r => propre(r?.nom) || propre(r?.prenom))
  const memesPersonnes = filiation && parents.length === tous.length && tous.length > 0
  let filiationFinale = filiation
  if (memesPersonnes) {
    const suffixe = tous.length > 1
      ? ', tous deux enregistrés comme ses responsables légaux.'
      : (normaliserLien(tous[0]?.lien_parente) === 'mere'
          ? ', enregistrée comme sa responsable légale.'
          : ', enregistré comme son responsable légal.')
    filiationFinale = filiation.replace(/\.$/, '') + suffixe
    legaux = null
  }

  // ── Paragraphe 5 : la formule consacrée, UNE seule fois ─────────────────
  //
  // Le motif de délivrance faisait l'objet d'une seconde phrase qui répétait
  // la première. Il s'insère ici, ou disparaît.
  const pourquoi = propre(motif)
  const formule = pourquoi
    ? `Le présent certificat lui est délivré en vue de ${pourquoi.toLowerCase()}, pour servir et valoir ce que de droit.`
    : 'Le présent certificat lui est délivré pour servir et valoir ce que de droit.'

  return { entete, corps, filiation: filiationFinale, legaux, formule }
}

/** « Fait à Bamako, le 26 août 2026 ». */
export const lieuEtDate = (ville, iso) => {
  const d = dateEnLettres(iso) || dateEnLettres(new Date().toISOString())
  return `Fait à ${propre(ville) || 'Bamako'}, le ${d}`
}

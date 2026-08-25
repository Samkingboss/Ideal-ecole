// Ce qui entre dans un document, et ce qui n'y entre pas.
//
// ── Le défaut d'origine ────────────────────────────────────────────────────
//
// `ProfApp.jsx` passait `devoirsList={devoirs}` au cahier imprimable : TOUS
// les devoirs chargés pour la classe, sans exception. Un enseignant qui
// voulait imprimer les deux devoirs du jour obtenait vingt-cinq pages, et le
// parent recevait sur WhatsApp la liste de tout le trimestre.
//
// Le correctif n'est pas un filtre posé dans le composant d'impression : il
// est ici, en fonctions pures, pour que l'écran et les gardes jugent avec la
// même règle. Un filtre écrit dans le rendu ne se teste pas.
//
// ── Il n'existe AUCUNE colonne d'archive ───────────────────────────────────
//
// La table `devoirs` ne porte ni `archive`, ni `statut`, ni `actif`. Inventer
// la colonne demanderait une migration ; la déduire de la date n'en demande
// aucune et dit la même chose : un devoir dont la remise est passée depuis
// longtemps n'est plus un devoir courant.
//
// La frontière est donc une DURÉE, pas un drapeau. Elle est nommée, unique,
// et c'est le seul endroit où la changer.

// Un devoir rendu il y a moins de deux semaines reste « en retard » : il se
// réclame encore. Au-delà, il est archivé — consultable, jamais imprimé par
// défaut.
export const JOURS_AVANT_ARCHIVAGE = 14

// ── Dates ──────────────────────────────────────────────────────────────────
//
// `date_rendu` est une date de calendrier scolaire, pas un instant : « 26/08 »
// est le 26 août partout, quel que soit le fuseau du téléphone. On la compare
// donc en texte ISO, jamais par des objets Date — `new Date('2026-08-26')`
// bascule au 25 août à l'ouest de Greenwich.
export const aujourdHuiISO = (maintenant = new Date()) => {
  const a = maintenant.getFullYear()
  const m = String(maintenant.getMonth() + 1).padStart(2, '0')
  const j = String(maintenant.getDate()).padStart(2, '0')
  return `${a}-${m}-${j}`
}

const enJours = (isoA, isoB) => {
  const [aa, am, aj] = String(isoA).split('-').map(Number)
  const [ba, bm, bj] = String(isoB).split('-').map(Number)
  if (!aa || !ba) return null
  return Math.round((Date.UTC(aa, am - 1, aj) - Date.UTC(ba, bm - 1, bj)) / 86400000)
}

// ── Classement ─────────────────────────────────────────────────────────────

export const RUBRIQUES = ['enRetard', 'aujourdhui', 'aVenir', 'archives', 'sansDate']

/**
 * Range un devoir dans une seule rubrique. `date_rendu` est la référence :
 * c'est la date que l'élève et le parent ont en tête.
 *
 * Un devoir sans date de remise ne va PAS dans les archives — on ne sait pas
 * s'il est passé. Il a sa propre rubrique et reste visible.
 */
export const rubriqueDevoir = (devoir, aujourdhui = aujourdHuiISO()) => {
  const rendu = devoir?.date_rendu || devoir?.dateRendu || null
  if (!rendu) return 'sansDate'
  const ecart = enJours(rendu, aujourdhui)
  if (ecart === null) return 'sansDate'
  if (ecart > 0) return 'aVenir'
  if (ecart === 0) return 'aujourdhui'
  if (-ecart <= JOURS_AVANT_ARCHIVAGE) return 'enRetard'
  return 'archives'
}

/** Un devoir archivé reste consultable ; il n'entre jamais dans un document
 *  sans que quelqu'un l'ait explicitement demandé. */
export const estArchive = (devoir, aujourdhui = aujourdHuiISO()) =>
  rubriqueDevoir(devoir, aujourdhui) === 'archives'

/**
 * Les devoirs courants — ce que l'écran propose par défaut, et ce que le
 * parent reçoit. Tout sauf les archives.
 */
export const devoirsActifs = (devoirs, aujourdhui = aujourdHuiISO()) =>
  (devoirs || []).filter(d => !estArchive(d, aujourdhui))

/** Le classement complet, pour l'affichage par rubriques. */
export const classerDevoirs = (devoirs, aujourdhui = aujourdHuiISO()) => {
  const r = { enRetard: [], aujourdhui: [], aVenir: [], archives: [], sansDate: [] }
  for (const d of devoirs || []) r[rubriqueDevoir(d, aujourdhui)].push(d)
  return r
}

// ── Sélection ──────────────────────────────────────────────────────────────
//
// La sélection est une liste d'IDENTIFIANTS, jamais une liste d'objets : elle
// survit à un rechargement de la liste, et deux écrans ne peuvent pas en
// détenir deux copies divergentes.

/**
 * Les devoirs à mettre dans le document. Règle unique, et volontairement
 * stricte :
 *
 *   - une sélection explicite est respectée À LA LETTRE, archives comprises —
 *     l'enseignant qui coche un ancien devoir sait ce qu'il fait ;
 *   - une sélection VIDE ne veut pas dire « tout » : elle veut dire « rien ».
 *
 * C'est ce second point qui empêche les vingt-cinq pages. Un appelant qui
 * oublie de passer la sélection obtient un document vide — visible tout de
 * suite — au lieu de l'historique complet, qui ne se voit qu'à l'impression.
 */
export const devoirsSelectionnes = (devoirs, idsSelectionnes) => {
  const ids = new Set((idsSelectionnes || []).map(String))
  if (ids.size === 0) return []
  return (devoirs || []).filter(d => ids.has(String(d?.id)))
}

/** Les identifiants proposés par les raccourcis de sélection. */
export const selectionRaccourci = (devoirs, quoi, aujourdhui = aujourdHuiISO()) => {
  const c = classerDevoirs(devoirs, aujourdhui)
  const ids = liste => liste.map(d => String(d.id))
  switch (quoi) {
    case 'aujourdhui': return ids(c.aujourdhui)
    // « Cette semaine » : ce qui se rend dans les sept jours, plus ce qui est
    // dû aujourd'hui. Le retard n'en fait pas partie — il se rattrape, il ne
    // se distribue pas.
    case 'semaine': return ids([...c.aujourdhui, ...c.aVenir.filter(d => {
      const e = enJours(d.date_rendu || d.dateRendu, aujourdhui)
      return e !== null && e <= 7
    })])
    case 'actifs': return ids([...c.enRetard, ...c.aujourdhui, ...c.aVenir, ...c.sansDate])
    case 'rien': return []
    default: return []
  }
}

// ── Garde de cohérence ─────────────────────────────────────────────────────
//
// Le contrôle que réclamait la consigne : si le document contient plus de
// devoirs que la sélection, quelque chose l'a élargi en chemin. On ne corrige
// pas silencieusement — on refuse et on dit combien.
export const ecartDeSelection = (devoirsDuDocument, idsSelectionnes) => {
  const attendus = new Set((idsSelectionnes || []).map(String))
  const obtenus = (devoirsDuDocument || []).map(d => String(d?.id))
  const enTrop = obtenus.filter(id => !attendus.has(id))
  return enTrop.length === 0 ? null
    : `${enTrop.length} devoir(s) hors sélection dans le document`
}

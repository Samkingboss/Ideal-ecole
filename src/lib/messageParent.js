// Le message au parent — court, et distinct du cahier de l'élève.
//
// ── Ce que le parent recevait ──────────────────────────────────────────────
//
// La même liste que le document imprimé, c'est-à-dire tout l'historique de la
// classe : type, matière, objectif complet, barème, pour chaque devoir depuis
// la rentrée. Sur un téléphone, un mur de texte que personne ne lit.
//
// ── Ce que le message doit être ────────────────────────────────────────────
//
// Un parent a besoin de trois choses, et de rien d'autre : QUOI, POUR QUAND,
// COMBIEN DE FEUILLES. L'objectif pédagogique, le barème et l'énoncé sont
// sur la fiche que l'enfant rapporte — les répéter ici allonge sans informer.
//
// Le document élève et ce message ne se ressemblent donc pas, et c'est voulu.

import { lireDevoir, regrouperPages } from './devoirs.js'

export const dateCourte = (iso) => {
  if (!iso) return null
  const d = new Date(String(iso) + 'T00:00:00')
  if (isNaN(d)) return String(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Une ligne par devoir. Pas de puce à rallonge : la matière en gras, la date,
 * le nombre de feuilles.
 *
 * `regrouperPages` évite au parent de recevoir trois fois le même devoir :
 * l'ancienne plateforme créait une ligne PAR PHOTO, et un devoir de trois
 * pages s'annonçait trois fois.
 */
export const lignesDevoirs = (devoirs) =>
  regrouperPages((devoirs || []).map(lireDevoir)).map(({ tete: d, pages }) => ({
    matiere: d.matiere || 'Devoir',
    titre: d.type || null,
    consigne: courte(d.objectif),
    dateRendu: dateCourte(d.dateRendu),
    pages,
    apercu: d.piecesJointes[0]?.url || null,
  }))

// Une consigne de trois lignes ne tient pas dans un aperçu. On coupe au mot,
// jamais au milieu d'un mot, et on ne coupe pas ce qui tient déjà.
const LONGUEUR_CONSIGNE = 90
export const courte = (texte) => {
  const t = String(texte || '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (t.length <= LONGUEUR_CONSIGNE) return t
  const coupe = t.slice(0, LONGUEUR_CONSIGNE)
  const espace = coupe.lastIndexOf(' ')
  return (espace > 40 ? coupe.slice(0, espace) : coupe).trimEnd() + '…'
}

/**
 * Le texte WhatsApp. Court par construction : rien n'y entre qui ne soit dans
 * `devoirs`, et `devoirs` est la sélection de l'enseignant.
 */
export const texteWhatsApp = ({ devoirs, nomEleve, classe, signature, ecole }) => {
  const lignes = lignesDevoirs(devoirs)
  if (!lignes.length) return null

  const entete = lignes.length > 1
    ? `📚 Votre enfant a ${lignes.length} devoirs de maison`
    : '📚 Votre enfant a un devoir de maison'

  const corps = lignes.map(l => {
    const morceaux = [`*${l.matiere}*`]
    if (l.consigne) morceaux.push(l.consigne)
    if (l.dateRendu) morceaux.push(`À rendre le ${l.dateRendu}`)
    if (l.pages) morceaux.push(`${l.pages} page${l.pages > 1 ? 's' : ''} jointe${l.pages > 1 ? 's' : ''}`)
    return morceaux.join('\n')
  }).join('\n\n')

  const qui = [nomEleve, classe].filter(Boolean).join(' · ')
  return [
    entete,
    qui ? `${qui}\n` : '',
    corps,
    '\nMerci de l’accompagner dans son travail.',
    [signature, ecole].filter(Boolean).join('\n'),
  ].filter(Boolean).join('\n')
}

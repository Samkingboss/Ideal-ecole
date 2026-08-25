// Gardes sur le message envoyé au parent.
//
// Le parent recevait la même liste que le document imprimé : tout l'historique
// de la classe, type, objectif complet et barème pour chaque devoir depuis la
// rentrée. Sur un téléphone, un mur de texte que personne ne lit.
//
// Trois questions, et rien d'autre : QUOI, POUR QUAND, COMBIEN DE FEUILLES.

import { readFileSync, existsSync } from 'node:fs'
import { texteWhatsApp, lignesDevoirs, courte, dateCourte } from '../../src/lib/messageParent.js'
import { regrouperPages, lireDevoir } from '../../src/lib/devoirs.js'
import { devoirsSelectionnes, estArchive } from '../../src/lib/devoirsSelection.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

const H = '2026-08-25'
const dev = (id, matiere, objectif, rendu, nbFiches, extra = {}) => ({
  id, matiere, description: objectif, date_rendu: rendu,
  contenu: { type: 'Devoir de Maison', bareme: 'noté sur 20', enonce: 'Exercices 1 à 4 page 12', ...extra },
  fichiers: Array.from({ length: nbFiches }, (_, k) => ({ url: `https://x/${id}-${k}.jpg` })),
})

console.log(`\n${G}── DEVOIRS · le message au parent                 [INV-FLUX]${F}`)

// ── G8 · le message ne contient que la sélection ──────────────────────────
{
  const tous = [
    dev('d1', 'Lecture', 'Lire la page 12', '2026-08-26', 2),
    dev('d2', 'Mathématiques', 'Poser les additions', '2026-08-28', 1),
    dev('vieux1', 'Sciences', 'Ancien devoir', '2026-06-01', 3),
    dev('vieux2', 'Histoire', 'Encore plus ancien', '2026-04-02', 1),
  ]
  const t = texteWhatsApp({ devoirs: devoirsSelectionnes(tous, ['d1', 'd2']),
    nomEleve: 'Akotsi A.', classe: 'CP1' })

  verifier('G8 les archives ne sont pas dans le message',
    !/Sciences|Histoire|Ancien devoir/.test(t), t.length + ' caractères')
  verifier('G8 les deux devoirs choisis y sont',
    /Lecture/.test(t) && /Mathématiques/.test(t))
  verifier('G8 les anciens sont bien des archives',
    estArchive(tous[2], H) && estArchive(tous[3], H))

  // AUTO-TEST : sans sélection — le défaut — tout y serait.
  const sansFiltre = texteWhatsApp({ devoirs: tous, nomEleve: 'x', classe: 'y' })
  verifier('G8 auto-test · sans sélection, les archives reviennent',
    /Sciences/.test(sansFiltre) && /Histoire/.test(sansFiltre))
}

// ── COURT · ce qui n'a pas sa place dans un message ───────────────────────
{
  const t = texteWhatsApp({ devoirs: [dev('d1', 'Lecture', 'Lire la page 12', '2026-08-26', 2)],
    nomEleve: 'Akotsi A.', classe: 'CP1' })
  verifier('COURT le barème reste sur la fiche', !/noté sur 20|Barème/i.test(t))
  verifier('COURT l’énoncé reste sur la fiche', !/Exercices 1 à 4/.test(t))
  verifier('COURT commence par la phrase attendue',
    t.startsWith('📚 Votre enfant a un devoir de maison'), t.split('\n')[0])
  verifier('COURT porte la date de remise', /À rendre le mercredi 26 août/.test(t))
  verifier('COURT annonce le nombre de feuilles', /2 pages jointes/.test(t))

  const pluriel = texteWhatsApp({ devoirs: [dev('a','Lecture','x','2026-08-26',1), dev('b','Calcul','y','2026-08-27',1)],
    nomEleve: 'A', classe: 'CP1' })
  verifier('COURT deux devoirs → « 2 devoirs de maison »',
    pluriel.startsWith('📚 Votre enfant a 2 devoirs de maison'))
  const uneSeule = texteWhatsApp({ devoirs: [dev('u1','Lecture','Lire','2026-08-26',1)], nomEleve: 'A', classe: 'CP1' })
  verifier('COURT une seule feuille → singulier',
    /1 page jointe/.test(uneSeule) && !/1 pages/.test(uneSeule))
}

// ── PAGES · le compte annoncé est le compte réel ──────────────────────────
//
// `regrouperPages` posait `pages: 1` EN DUR sur tout devoir non regroupable
// — ce qu'est tout devoir créé par le portail, dont le format range déjà N
// pages dans une seule ligne. Le parent lisait « 1 page jointe » pour un
// devoir de cinq fiches.
{
  const cinq = dev('p5', 'Lecture', 'Lire', '2026-08-26', 5)
  const t = texteWhatsApp({ devoirs: [cinq], nomEleve: 'A', classe: 'CP1' })
  verifier('PAGES cinq fiches → « 5 pages jointes »', /5 pages jointes/.test(t),
    (t.match(/\d+ pages? jointes?/) || ['—'])[0])

  const l = lignesDevoirs([cinq])
  verifier('PAGES la ligne porte le bon compte', l[0].pages === 5, String(l[0].pages))
  verifier('PAGES aucune pièce → rien d’annoncé',
    !/page/.test(texteWhatsApp({ devoirs: [dev('p0','Lecture','Lire','2026-08-26',0)], nomEleve:'A', classe:'CP1' })))

  // AUTO-TEST : le défaut consistait à ignorer piecesJointes.
  const dl = lireDevoir(cinq)
  verifier('PAGES auto-test · la lecture voit bien cinq pièces', dl.piecesJointes.length === 5)
  verifier('PAGES auto-test · regrouperPages les compte', regrouperPages([dl])[0].pages === 5)

  // Un devoir historique éclaté en trois lignes ne s'annonce qu'une fois.
  const page = (id, url) => ({ ...lireDevoir({ id, matiere: 'Lecture', description: 'Lire la page 12',
    date_donne: '2026-08-20', date_rendu: '2026-08-26',
    contenu: { teacher: 'Mme X', type: 'Devoir de Maison' }, fichiers: [{ url }] }) })
  const eclate = regrouperPages([page('l1', 'a.jpg'), page('l2', 'b.jpg'), page('l3', 'c.jpg')])
  verifier('PAGES trois lignes historiques → un seul devoir, 3 pages',
    eclate.length === 1 && eclate[0].pages === 3, `${eclate.length} groupe(s), ${eclate[0]?.pages} pages`)
}

// ── CONSIGNE · coupée au mot, jamais au milieu ────────────────────────────
{
  const longue = 'Poser et effectuer les additions en colonnes sans retenue puis vérifier chaque résultat avec la règle apprise en classe'
  const c = courte(longue)
  verifier('CONSIGNE une longue consigne est écourtée', c.length < longue.length && c.endsWith('…'), `${c.length} car.`)
  verifier('CONSIGNE la coupe tombe sur un espace', !/\S…$/.test(c) || / [^ ]*…$/.test(c) === false || !c.slice(0, -1).endsWith(' '))
  verifier('CONSIGNE une courte consigne n’est pas touchée', courte('Lire la page 12') === 'Lire la page 12')
  verifier('CONSIGNE vide → rien, pas une chaîne « undefined »', courte('') === null && courte(null) === null)
  verifier('DATE une date illisible ne devient pas « Invalid Date »',
    dateCourte('pas-une-date') === 'pas-une-date' && dateCourte(null) === null)
}

// ── CÂBLAGE · l'écran passe bien par cette bibliothèque ───────────────────
{
  const src = lire('src/pages/DevoirsDocument.jsx')
  verifier('CÂBLAGE le document appelle texteWhatsApp', /messagePour = e => texteWhatsApp\(/.test(src))
  verifier('CÂBLAGE l’ancien message à rallonge a disparu',
    !/Chers parents, voici les devoirs de votre enfant/.test(src))
}

console.log(echecs === 0
  ? `\n  ${V}Message parent : court, et sans archives${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

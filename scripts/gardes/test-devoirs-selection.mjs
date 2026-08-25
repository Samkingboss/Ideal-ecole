// Gardes sur ce qui ENTRE dans un document de devoirs.
//
// Le défaut d'origine : `ProfApp.jsx` passait `devoirsList={devoirs}` au
// cahier imprimable — toute la table de la classe. Deux devoirs à distribuer
// sortaient en vingt-cinq pages, et le parent recevait sur WhatsApp la liste
// de tout le trimestre.
//
// Ces gardes ne relisent pas l'intention du code : elles font tourner les
// fonctions de décision sur des jeux construits, et elles vérifient que le
// composant les APPELLE réellement.

import { readFileSync, existsSync } from 'node:fs'
import { viseEleve, lireDevoir, contenuCanonique } from '../../src/lib/devoirs.js'
import {
  rubriqueDevoir, estArchive, devoirsActifs, classerDevoirs,
  devoirsSelectionnes, selectionRaccourci, ecartDeSelection,
  JOURS_AVANT_ARCHIVAGE, aujourdHuiISO,
} from '../../src/lib/devoirsSelection.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

// Un jeu figé : aucune garde ne doit dépendre du jour où on la lance.
const H = '2026-08-25'
const d = (id, rendu, extra = {}) => ({ id, date_rendu: rendu, ...extra })
const JEU = [
  d('today',    '2026-08-25'),
  d('demain',   '2026-08-26'),
  d('semaine',  '2026-08-30'),
  d('mois',     '2026-10-01'),
  d('retard',   '2026-08-20'),
  d('archive1', '2026-06-01'),
  d('archive2', '2026-05-04'),
  d('archive3', '2026-04-02'),
  d('archive4', '2026-03-11'),
  d('archive5', '2026-02-09'),
  d('sansdate', null),
]

console.log(`\n${G}── DEVOIRS · ce qui entre dans un document        [INV-METIER]${F}`)

// ── G1 · le document ne contient QUE la sélection ─────────────────────────
{
  const doc = devoirsSelectionnes(JEU, ['today', 'demain'])
  verifier('G1 sélection de 2 → 2 devoirs', doc.length === 2 && doc.every(x => ['today','demain'].includes(x.id)))

  // Le point qui empêche les vingt-cinq pages : une sélection VIDE ne veut
  // pas dire « tout ». Un appelant qui oublie la sélection obtient un
  // document vide — qui se voit — au lieu de l'historique, qui ne se voit
  // qu'au moment de distribuer les feuilles.
  verifier('G1 sélection vide → document vide, jamais tout',
    devoirsSelectionnes(JEU, []).length === 0, `(table de ${JEU.length})`)
  verifier('G1 sélection nulle → document vide',
    devoirsSelectionnes(JEU, null).length === 0)
  verifier('G1 identifiant inconnu ignoré',
    devoirsSelectionnes(JEU, ['today', 'fantome']).length === 1)

  // AUTO-TEST : le juge d'écart doit voir un document élargi en chemin.
  verifier('G1 auto-test · écart détecté', ecartDeSelection(JEU, ['today']) !== null)
  verifier('G1 auto-test · aucun écart quand conforme',
    ecartDeSelection(devoirsSelectionnes(JEU, ['today','demain']), ['today','demain']) === null)
}

// ── G2 · les archives sortent par défaut ──────────────────────────────────
{
  const actifs = devoirsActifs(JEU, H)
  const archives = JEU.filter(x => estArchive(x, H))
  verifier('G2 5 archives écartées des actifs',
    archives.length === 5 && actifs.length === JEU.length - 5, `${actifs.length} actifs`)
  verifier('G2 aucun archivé parmi les actifs',
    actifs.every(x => !estArchive(x, H)))
  verifier('G2 « Tout sélectionner » ne prend pas les archives',
    selectionRaccourci(JEU, 'actifs', H).every(id => !id.startsWith('archive')))

  // Un devoir sans date n'est PAS une archive : on ignore s'il est passé.
  verifier('G2 devoir sans date ≠ archive', estArchive(d('x', null), H) === false)

  // La frontière est une durée nommée, pas un nombre semé dans le code.
  const limite = new Date(Date.UTC(2026, 7, 25) - JOURS_AVANT_ARCHIVAGE * 86400000)
  const iso = limite.toISOString().slice(0, 10)
  verifier(`G2 frontière à ${JOURS_AVANT_ARCHIVAGE} jours, pile`,
    rubriqueDevoir(d('l', iso), H) === 'enRetard', iso)
  const veille = new Date(Date.UTC(2026, 7, 25) - (JOURS_AVANT_ARCHIVAGE + 1) * 86400000).toISOString().slice(0, 10)
  verifier('G2 un jour plus tôt : archivé',
    rubriqueDevoir(d('l', veille), H) === 'archives', veille)

  // AUTO-TEST : la garde doit savoir dire « ça fuit ».
  const fauxActifs = JEU   // le défaut : on passe tout
  verifier('G2 auto-test · voit une liste non filtrée',
    fauxActifs.some(x => estArchive(x, H)) === true)
}

// ── G10 · le volume reste celui qu'on a demandé ───────────────────────────
//
// « 25 pages par accident » vient d'un seul endroit : le nombre de devoirs
// mis dans le document. Tant qu'il est borné par la sélection, la pagination
// l'est aussi.
{
  const doc = devoirsSelectionnes(JEU, selectionRaccourci(JEU, 'aujourdhui', H))
  verifier('G10 raccourci « aujourd’hui » → 1 devoir', doc.length === 1, doc.map(x=>x.id).join(','))
  const sem = devoirsSelectionnes(JEU, selectionRaccourci(JEU, 'semaine', H))
  verifier('G10 raccourci « cette semaine » → 3 devoirs, pas le mois prochain',
    sem.length === 3 && !sem.some(x => x.id === 'mois'), sem.map(x=>x.id).join(','))
  verifier('G10 « effacer » → 0', selectionRaccourci(JEU, 'rien', H).length === 0)
}

// ── G1b · le composant appelle bien la sélection ──────────────────────────
//
// Les fonctions ci-dessus peuvent être parfaites et n'être appelées par
// personne. On vérifie donc le CÂBLAGE, à l'endroit exact du défaut.
{
  const src = lire('src/pages/ProfApp.jsx')
  verifier('G1b le document reçoit la sélection, pas la table',
    /devoirsList=\{devoirsSelectionnes\(devoirs, selectionDevoirs\)\}/.test(src))
  verifier('G1b le défaut d’origine a disparu',
    !/devoirsList=\{devoirs\}/.test(src))
  verifier('G1b le bouton se désactive sans sélection',
    /disabled=\{selectionDevoirs\.length === 0\}/.test(src))

  // AUTO-TEST : les trois motifs doivent savoir dire non.
  const defaut = 'devoirsList={devoirs}\n disabled={devoirs.length === 0}'
  verifier('G1b auto-test · reconnaît le défaut réintroduit',
    /devoirsList=\{devoirs\}/.test(defaut) === true
    && /devoirsList=\{devoirsSelectionnes\(devoirs, selectionDevoirs\)\}/.test(defaut) === false)
}

// ── Fuseau ────────────────────────────────────────────────────────────────
//
// `new Date('2026-08-26')` est le 25 août à l'ouest de Greenwich. Une date de
// calendrier scolaire n'a pas de fuseau : elle se compare en texte.
{
  const src = lire('src/lib/devoirsSelection.js')
  verifier('DATE aucune conversion par objet Date sur date_rendu',
    !/new Date\([^)]*date_rendu/.test(src))
  verifier('DATE aujourdHuiISO rend bien 10 caractères',
    /^\d{4}-\d{2}-\d{2}$/.test(aujourdHuiISO(new Date(2026, 0, 5))))
  verifier('DATE aujourdHuiISO ne décale pas d’un jour',
    aujourdHuiISO(new Date(2026, 0, 5)) === '2026-01-05', aujourdHuiISO(new Date(2026, 0, 5)))
}

// ── G11 · un devoir ciblé désigne le bon enfant ───────────────────────────
//
// Défaut mesuré : `DevoirsDocument` lisait `contenu.destinataire_mode` sur le
// brut. Les cinq devoirs historiques de la base n'ont pas cette clé — leur
// ciblage vit dans `contenu.destinataires`. `undefined !== 'choix'` étant
// vrai, ils passaient tous pour « toute la classe » : un devoir visant deux
// enfants sortait trois fiches, dont une pour un enfant non concerné.
{
  // La forme réelle relevée en base, à l'octet près.
  const historique = { id: 'h1', contenu: { destinataires: { mode: 'choix', eleves: [
    { cle: 'el:869861b6-4ccd-41de-a8aa-834db4214f60' },
    { cle: 'el:ccc0ae76-1fe7-42da-9000-ccf278528ed5' },
    { cle: 'ins:IDEAL-2027-008' },
  ] } } }
  const vise = viseEleve(historique, '869861b6-4ccd-41de-a8aa-834db4214f60')
  const pasVise = viseEleve(historique, '00000000-0000-0000-0000-000000000000')
  verifier('G11 devoir historique : l’enfant ciblé est visé', vise === true)
  verifier('G11 devoir historique : l’enfant NON ciblé ne l’est pas', pasVise === false)

  // AUTO-TEST : la lecture brute — le défaut — doit donner la mauvaise réponse.
  const lectureBrute = (d) => (d.contenu || {}).destinataire_mode !== 'choix'
  verifier('G11 auto-test · la lecture brute se trompe bien',
    lectureBrute(historique) === true, 'elle dirait « toute la classe »')

  // Le candidat, joignable par matricule une fois devenu élève.
  verifier('G11 candidat visé par son matricule',
    viseEleve(historique, 'autre-uuid', 'IDEAL-2027-008') === true)
  verifier('G11 un autre matricule n’est pas visé',
    viseEleve(historique, 'autre-uuid', 'IDEAL-2027-099') === false)

  // Le composant délègue-t-il vraiment ? Une copie locale rediverge.
  const src = lire('src/pages/DevoirsDocument.jsx')
  verifier('G11 le document délègue à viseEleve',
    /const vise = \(devoir, eleve\) => viseEleve\(/.test(src))
  verifier('G11 aucune lecture brute de destinataire_mode ne subsiste',
    !/ciblage\.destinataire_mode/.test(src))
}

// ── G11b · une modification n’efface pas un candidat ──────────────────────
//
// `contenuCanonique` n'écrivait pas les candidats. Rouvrir un devoir
// historique pour corriger sa date et l'enregistrer effaçait définitivement
// `ins:IDEAL-2027-008` de son ciblage — quatre devoirs en base concernés.
{
  const depart = { id: 'h2', contenu: { destinataires: { mode: 'choix', eleves: [
    { cle: 'el:869861b6-4ccd-41de-a8aa-834db4214f60' },
    { cle: 'ins:IDEAL-2027-008' },
  ] } } }
  const lu = lireDevoir(depart)
  // L'aller-retour complet : lecture → formulaire → écriture → relecture.
  const reecrit = { id: 'h2', contenu: contenuCanonique({
    destinataireMode: lu.destinataireMode,
    eleveIds: lu.eleveIds,
    candidatMatricules: lu.candidatMatricules,
  }) }
  const relu = lireDevoir(reecrit)
  verifier('G11b le candidat survit à l’aller-retour',
    relu.candidatMatricules.includes('IDEAL-2027-008'),
    JSON.stringify(relu.candidatMatricules))
  verifier('G11b l’élève survit aussi',
    relu.eleveIds.includes('869861b6-4ccd-41de-a8aa-834db4214f60'))

  // AUTO-TEST : sans transporter le champ — le défaut — le candidat disparaît.
  const sansTransport = lireDevoir({ id: 'h2', contenu: contenuCanonique({
    destinataireMode: lu.destinataireMode, eleveIds: lu.eleveIds,
  }) })
  verifier('G11b auto-test · sans transport, le candidat est perdu',
    sansTransport.candidatMatricules.length === 0)
}

console.log(echecs === 0
  ? `\n  ${V}Sélection des devoirs : conforme${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

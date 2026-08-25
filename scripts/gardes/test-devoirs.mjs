// Gardes de propriété sur les devoirs de maison.
//
// ── Le risque principal ────────────────────────────────────────────────────
//
// Deux encodages de destinataires coexistent en base :
//
//   historique  contenu.destinataires = { mode, eleves: [{ cle: 'el:<uuid>', nom }] }
//   portail     contenu.destinataire_mode + contenu.eleve_ids = ['<uuid>']
//
// Une conversion qui se tromperait n'effacerait pas des données : elle
// ÉLARGIRAIT un devoir. Trois élèves deviendraient trente. Personne ne le
// verrait, et l'erreur serait invisible jusqu'au jour de la remise.
//
// C'est pour cela que la lecture teste `mode` AVANT `eleve_ids`, jamais
// l'inverse, et que ces gardes couvrent les six cas du cahier des charges.

import { lireDevoir, viseEleve, contenuCanonique, refusDeSaisie, CHAMPS_DEVOIR, regrouperPages }
  from '../../src/lib/devoirs.js'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'

const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const sansCommentaires = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}

// Fabriques des deux familles, au plus près du réel.
const historique = (destinataires, extra = {}) => ({
  id: 'h', classe_id: 'c1', groupe: 'CP1', matiere: 'Mathematics',
  description: null, date_rendu: null, fichiers: null, fichier_url: null,
  contenu: { subject: 'Mathematics', grade: 'CP1', type: 'Devoir de Maison',
             content: 'énoncé', objectives: 'objectif', bareme: 'Ex 1: 10',
             period: '1', dueDate: '2026-08-25', teacher: "Juliette N'GONE",
             images: [], destinataires, ...extra },
})
const portail = (mode, ids, extra = {}) => ({
  id: 'p', user_id: 'u1', classe_id: 'c1', groupe: 'CP1', matiere: 'Lecture',
  description: 'objectif', date_rendu: '2026-08-25',
  fichiers: [{ url: 'https://x/1.png', nom: 'ex.png' }],
  contenu: { destinataire_mode: mode, eleve_ids: ids, ...extra },
})

// ── D0 · les sources existent et ne sont pas vides ───────────────────────
//
// `lire()` rend '' quand le fichier manque, et un motif absent d'une chaîne
// vide est un motif satisfait. Renommer un écran suffisait donc à faire
// passer les gardes qui le surveillent. On refuse de commencer sur du vide.
{
  const SOURCES = [
    'src/lib/devoirs.js', 'src/lib/devoirsSelection.js',
    'src/pages/ProfApp.jsx', 'src/pages/DevoirsDocument.jsx',
  ]
  const absentes = SOURCES.filter(f => { try { return statSync(f).size < 200 } catch { return true } })
  if (absentes.length) {
    console.log(`\n  ${R}ABANDON · source introuvable ou vide : ${absentes.join(', ')}${F}\n`)
    process.exit(1)
  }
}

console.log(`\n${G}── DEVOIRS · un ciblage ne s'élargit jamais ──${F}`)

// ── D1 · classe entière, les deux familles ────────────────────────────────
{
  const h = lireDevoir(historique({ mode: 'classe' }))
  const p = lireDevoir(portail('classe', []))
  verifier('D1 · « toute la classe » se lit dans les deux familles',
    h.destinataireMode === 'classe' && h.eleveIds.length === 0 &&
    p.destinataireMode === 'classe' && p.eleveIds.length === 0)
}

// ── D2 · un seul élève ────────────────────────────────────────────────────
{
  const h = lireDevoir(historique({ mode: 'choix', eleves: [{ cle: 'el:u-1', nom: 'Alex SANVI' }] }))
  const p = lireDevoir(portail('choix', ['u-1']))
  verifier('D2 · un élève ciblé reste un élève ciblé',
    h.destinataireMode === 'choix' && h.eleveIds.length === 1 && h.eleveIds[0] === 'u-1' &&
    p.destinataireMode === 'choix' && p.eleveIds.length === 1,
    `— historique:${h.eleveIds.length} portail:${p.eleveIds.length}`)
}

// ── D3 · trois élèves ─────────────────────────────────────────────────────
{
  const h = lireDevoir(historique({ mode: 'choix', eleves:
    [{ cle: 'el:a', nom: 'A' }, { cle: 'el:b', nom: 'B' }, { cle: 'el:c', nom: 'C' }] }))
  const p = lireDevoir(portail('choix', ['a', 'b', 'c']))
  verifier('D3 · trois élèves restent trois, jamais la classe',
    h.eleveIds.length === 3 && p.eleveIds.length === 3 &&
    h.destinataireMode === 'choix' && p.destinataireMode === 'choix',
    `— ${h.eleveIds.join(',')} | ${p.eleveIds.join(',')}`)
}

// ── D4 · le cas qui doit ABSOLUMENT échouer si on se trompe ───────────────
//
// Un devoir ciblé dont la liste serait perdue ne doit JAMAIS retomber sur
// « toute la classe ». Mieux vaut un devoir sans destinataire, qui se voit,
// qu'un devoir élargi, qui ne se voit pas.
{
  const perdu = lireDevoir(historique({ mode: 'choix', eleves: [] }))
  verifier('D4 · un ciblage vidé ne devient pas « toute la classe »',
    perdu.destinataireMode === 'choix' && perdu.eleveIds.length === 0,
    `— mode:${perdu.destinataireMode} ids:${perdu.eleveIds.length}`)
}

// ── D5 · le préfixe `el:` est retiré sans perdre la distinction ───────────
{
  const h = lireDevoir(historique({ mode: 'choix', eleves:
    [{ cle: 'el:uuid-1', nom: 'Élève inscrit' }, { cle: 'ins:26-27 A004', nom: 'Candidat' }] }))
  // Un matricule ne correspondra jamais à un `eleves.id` : les mélanger ferait
  // disparaître le candidat du ciblage sans que rien ne le signale.
  verifier('D5 · élève et candidat ne se confondent pas',
    h.eleveIds.length === 1 && h.eleveIds[0] === 'uuid-1' &&
    h.candidatMatricules.length === 1 && h.candidatMatricules[0] === '26-27 A004' &&
    h.eleveNoms.length === 2,
    `— élèves:${h.eleveIds.join(',')} candidats:${h.candidatMatricules.join(',')}`)
}

// ── D6 · `viseEleve` répond juste dans les deux familles ──────────────────
{
  const h = historique({ mode: 'choix', eleves: [{ cle: 'el:x', nom: 'X' }] })
  const p = portail('choix', ['x'])
  const classe = historique({ mode: 'classe' })
  const candidat = historique({ mode: 'choix', eleves: [{ cle: 'ins:26-27 A004', nom: 'Candidat' }] })
  verifier('D6 · « ce devoir concerne-t-il cet élève ? »',
    viseEleve(h, 'x') && !viseEleve(h, 'y') &&
    viseEleve(p, 'x') && !viseEleve(p, 'y') &&
    viseEleve(classe, 'n’importe qui') &&
    // le candidat n'est reconnu que par son matricule, jamais par hasard
    viseEleve(candidat, 'autre-id', '26-27 A004') && !viseEleve(candidat, 'autre-id'))
}

// ── D7 · aucune richesse historique perdue à la lecture ───────────────────
{
  const d = lireDevoir(historique({ mode: 'classe' }))
  const manquants = ['type', 'periode', 'enonce', 'bareme', 'objectif', 'matiere', 'dateRendu']
    .filter(k => !d[k])
  verifier('D7 · type, période, énoncé, barème et objectif survivent',
    manquants.length === 0, manquants.length ? `— perdus : ${manquants.join(', ')}` : '')
}

// ── D8 · la forme canonique représente tout sans doublon ──────────────────
{
  const c = contenuCanonique({
    type: 'Évaluation', periode: '2', enonce: 'é', bareme: 'b',
    destinataireMode: 'choix', eleveIds: ['a', 'b'],
  })
  // Ce qui vit en colonne ne doit pas être recopié dans `contenu`.
  const doublons = ['subject', 'grade', 'objectives', 'dueDate', 'teacher', 'images', 'date']
    .filter(k => k in c)
  verifier('D8 · la forme canonique ne duplique aucune colonne',
    doublons.length === 0 && c.type === 'Évaluation' && c.periode === '2' &&
    c.eleve_ids.length === 2,
    doublons.length ? `— dupliqués : ${doublons.join(', ')}` : '')
}

// ── D9 · « toute la classe » n'emporte jamais de liste résiduelle ─────────
{
  const c = contenuCanonique({ destinataireMode: 'classe', eleveIds: ['a', 'b', 'c'] })
  verifier('D9 · passer en « toute la classe » vide la liste ciblée',
    c.destinataire_mode === 'classe' && c.eleve_ids.length === 0,
    `— ids conservés : ${c.eleve_ids.length}`)
}

// ── D10 · les refus de saisie sont ceux du métier ─────────────────────────
{
  const base = { matiere: 'Lecture', objectif: 'o', dateRendu: '2026-09-01', classeId: 'c1',
                 destinataireMode: 'classe', eleveIds: [] }
  const cas = [
    ['complet', base, null],
    ['sans matière', { ...base, matiere: '' }, /matière/i],
    ['sans objectif', { ...base, objectif: '  ' }, /objectif/i],
    ['sans date de remise', { ...base, dateRendu: '' }, /remise/i],
    ['ciblé sans élève', { ...base, destinataireMode: 'choix', eleveIds: [] }, /élève/i],
  ]
  const fautifs = cas.filter(([, saisie, attendu]) => {
    const r = refusDeSaisie(saisie)
    return attendu ? !(r && attendu.test(r)) : r !== null
  }).map(([nom]) => nom)
  verifier('D10 · chaque saisie incomplète est refusée pour la bonne raison',
    fautifs.length === 0, fautifs.length ? `— ${fautifs.join(', ')}` : `— ${cas.length} cas`)
}

// ── D11 · les colonnes chargées sont explicites ───────────────────────────
//
// « pas d'étoile et au moins dix colonnes » se satisfaisait de
// 'a,b,c,d,e,f,g,h,i,j,k,l,m,n'. La garde ne connaissait aucun nom réel : on
// pouvait charger n'importe quoi. La liste est donc nominative, et un ajout
// délibéré se déclare ici en même temps que dans la bibliothèque.
{
  const ATTENDUES = [
    'id', 'user_id', 'classe_id', 'groupe', 'matiere', 'titre',
    'description', 'date_donne', 'date_rendu', 'contenu',
    'fichiers', 'fichier_url', 'fichier_nom', 'created_at',
  ]
  const obtenues = CHAMPS_DEVOIR.split(',').map(c => c.trim())
  const manquantes = ATTENDUES.filter(c => !obtenues.includes(c))
  const enTrop = obtenues.filter(c => !ATTENDUES.includes(c))
  verifier('D11 · les colonnes chargées sont exactement celles attendues',
    !CHAMPS_DEVOIR.includes('*') && manquantes.length === 0 && enTrop.length === 0,
    manquantes.length || enTrop.length
      ? `— manquantes:${manquantes.join('|') || 'aucune'} en trop:${enTrop.join('|') || 'aucune'}`
      : `— ${obtenues.length} colonnes`)
}

// ══════════════════════════════════════════════════════════════════════════
// PORTE 7 · L'IDENTITÉ DE L'AUTEUR
// ══════════════════════════════════════════════════════════════════════════
//
// Treize devoirs sur quatorze n'ont pas de `user_id` : seulement un nom en
// clair. Ces attributions restent telles quelles. Ce qui doit changer, c'est
// l'avenir : tout devoir créé désormais porte un auteur vérifié par le
// serveur.

// ── D12 · l'auteur d'un nouveau devoir vient du serveur ───────────────────
{
  const prof = sansCommentaires(lire('src/pages/ProfApp.jsx'))
  const dem = /auteurAuthentifie\(\s*supabase\s*\)/.test(prof)
  // Le refus doit être bloquant. Un `if` sans `throw` laisserait passer un
  // devoir sans auteur — exactement la dette qu'on refuse de reconduire.
  const bloque = /if\s*\(!auteur\.id\)\s*throw/.test(prof)
  const pasDuStockageLocal = !/user_id:\s*user\.id/.test(prof)
  verifier('D12 · l’auteur d’un nouveau devoir est confirmé par le serveur',
    dem && bloque && pasDuStockageLocal,
    `— demandé:${dem ? 'oui' : 'NON'} bloquant:${bloque ? 'oui' : 'NON'}`
    + ` hors localStorage:${pasDuStockageLocal ? 'oui' : 'NON'}`)
}

// ── D13 · la modification ne réécrit jamais l'auteur ──────────────────────
//
// Corriger la date d'un devoir ne fait pas de vous son auteur. Sans cette
// règle, retoucher un devoir historique lui inventerait un compte.
{
  const prof = sansCommentaires(lire('src/pages/ProfApp.jsx'))
  const ligne = prof.match(/const ligne = \{([\s\S]*?)\n      \}/)?.[1] || ''
  const auteurHorsLigne = !/user_id/.test(ligne)
  const auteurSurInsertSeul = /\.insert\(\{\s*\.\.\.ligne,\s*user_id:\s*auteurId/.test(prof)
  verifier('D13 · la modification ne réécrit pas l’auteur',
    auteurHorsLigne && auteurSurInsertSeul,
    `— hors du corps commun:${auteurHorsLigne ? 'oui' : 'NON'}`
    + ` posé à la création seule:${auteurSurInsertSeul ? 'oui' : 'NON'}`)
}

// ── D14 · aucune attribution rétroactive à partir d'un nom ────────────────
//
// Deux personnes peuvent porter le même nom, et un nom se saisit à la main.
// Rapprocher `contenu.teacher` d'un compte serait une présomption écrite en
// base — bien pire qu'une attribution absente.
//
// Les deux versions précédentes de cette garde lisaient UNE ligne du source.
// Toutes deux se laissaient contourner en ajoutant, juste à côté, une clé
// dérivée du nom. On n'inspecte donc plus le texte : on fait tourner la
// fonction et on regarde TOUT ce qu'elle rend.
{
  const NOM = 'Ornella Dembélé'
  const sortie = lireDevoir({ id: 'x', user_id: null, contenu: { teacher: NOM } })
  const auteurNul = sortie.auteurId === null
  const nomConserve = sortie.auteurNomHistorique === NOM
  const origineDite = sortie.origine === 'historique'

  // Le point qui manquait : AUCUNE autre clé ne doit porter un identifiant
  // fabriqué à partir du nom. On balaie la sortie entière.
  const suspectes = Object.entries(sortie)
    .filter(([cle, v]) => cle !== 'auteurNomHistorique' && cle !== 'brut'
      && typeof v === 'string' && v.length > 0
      && (v === NOM || /^compte|deduit|devine/i.test(v)))
    .map(([cle]) => cle)

  // Et l'attribution doit rester nulle même quand un compte du même nom
  // existe : c'est exactement la tentation.
  const avecCompte = lireDevoir({ id: 'y', user_id: null,
    contenu: { teacher: NOM, teacher_id: 'compte-du-meme-nom' } })

  verifier('D14 · aucun compte déduit d’un nom historique',
    auteurNul && nomConserve && origineDite && suspectes.length === 0
    && avecCompte.auteurId === null,
    `— auteurId:${String(sortie.auteurId)} origine:${sortie.origine}`
    + (suspectes.length ? ` CLÉS SUSPECTES:${suspectes.join('|')}` : '')
    + ` malgré un compte homonyme:${avecCompte.auteurId === null ? 'toujours nul' : 'ATTRIBUÉ'}`)
}

// ── D15 · le regroupement multi-pages ne touche jamais la base ────────────
//
// L'ancienne garde cherchait la chaîne `lignes: [d]` — présente DEUX fois
// dans la fonction. La retirer d'un des deux endroits laissait le grep
// satisfait par l'autre, et les lignes d'origine n'étaient plus conservées.
// On fait donc tourner la fonction et on compte.
{
  const hist = (id, url) => ({
    id, matiere: 'Lecture', objectif: 'Lire la page 12', dateDonne: '2026-08-20',
    dateRendu: '2026-08-26', type: 'Devoir de Maison', destinataireMode: 'classe',
    eleveIds: [], candidatMatricules: [], origine: 'historique',
    piecesJointes: [{ url, nom: null }],
  })
  // DEUX chemins existent dans la fonction, et le premier essai de cette
  // garde n'en exerçait qu'un : la branche « regroupé ». `lignes: [d]` est
  // écrit à deux endroits — celui du groupe neuf, et celui du devoir qu'on
  // n'a pas su regrouper. Vider le second passait inaperçu.
  const groupes = regrouperPages([hist('a', 'p1.jpg'), hist('b', 'p2.jpg')])
  const g = groupes[0]

  // Chemin 2 : un devoir non regroupable — objectif vide — doit lui aussi
  // garder sa ligne d'origine.
  const seul = regrouperPages([{ ...hist('c', 'p3.jpg'), objectif: '' }])
  const cheminNonRegroupe = seul.length === 1
    && Array.isArray(seul[0].lignes) && seul[0].lignes.length === 1
    && seul[0].lignes[0].id === 'c'

  const lignesConservees = groupes.every(x => Array.isArray(x.lignes) && x.lignes.length > 0)
    && cheminNonRegroupe
  const toutesLesLignes = groupes.reduce((n, x) => n + x.lignes.length, 0) === 2
  const identifiantsIntacts = g && g.lignes.map(l => l.id).sort().join(',') === 'a,b'

  // Aucune écriture : on ne cherche pas le mot « supabase », on vérifie que
  // la fonction est pure — mêmes entrées, mêmes sorties, entrées non mutées.
  const entree = [hist('c', 'p3.jpg')]
  const avant = JSON.stringify(entree)
  regrouperPages(entree); regrouperPages(entree)
  const nonMutant = JSON.stringify(entree) === avant

  verifier('D15 · le regroupement est de restitution, pas de migration',
    lignesConservees && toutesLesLignes && identifiantsIntacts && nonMutant,
    `— lignes conservées:${lignesConservees ? 'oui' : 'NON'}`
    + ` chemin non regroupé:${cheminNonRegroupe ? 'oui' : 'NON'}`
    + ` identifiants:${identifiantsIntacts ? 'intacts' : 'PERDUS'}`
    + ` entrée non mutée:${nonMutant ? 'oui' : 'NON'}`)
}

// ── D16 · le regroupement exige des critères sûrs ─────────────────────────
//
// Dans le doute, on affiche séparément : un devoir montré deux fois est une
// gêne, deux devoirs présentés comme un seul est une erreur.
//
// L'ancienne garde vérifiait que quatre motifs figuraient dans le texte de la
// clé. Les laisser en place et poser `return 'MEME-CLE'` juste avant la
// laissait verte — et deux devoirs sans rapport devenaient un seul.
{
  const base = {
    matiere: 'Lecture', objectif: 'Lire la page 12', dateDonne: '2026-08-20',
    dateRendu: '2026-08-26', type: 'Devoir de Maison', destinataireMode: 'classe',
    eleveIds: [], candidatMatricules: [], origine: 'historique', piecesJointes: [],
  }
  const un = n => regrouperPages(n).length

  const identiques = un([{ ...base, id: 'a' }, { ...base, id: 'b' }]) === 1
  // Chaque critère, isolément, doit suffire à séparer.
  const separe = {
    matiere:  un([{ ...base, id: 'a' }, { ...base, id: 'b', matiere: 'Calcul' }]) === 2,
    objectif: un([{ ...base, id: 'a' }, { ...base, id: 'b', objectif: 'Autre chose' }]) === 2,
    dateDonne: un([{ ...base, id: 'a' }, { ...base, id: 'b', dateDonne: '2026-08-21' }]) === 2,
    dateRendu: un([{ ...base, id: 'a' }, { ...base, id: 'b', dateRendu: '2026-08-27' }]) === 2,
    type:     un([{ ...base, id: 'a' }, { ...base, id: 'b', type: 'Révision' }]) === 2,
    ciblage:  un([{ ...base, id: 'a' }, { ...base, id: 'b', destinataireMode: 'choix', eleveIds: ['e1'] }]) === 2,
  }
  // Un objectif vide ne dit rien : deux devoirs de la même matière le même
  // jour seraient regroupés à tort.
  const objectifVide = un([{ ...base, id: 'a', objectif: '' }, { ...base, id: 'b', objectif: '' }]) === 2
  // Deux devoirs du portail ne sont jamais regroupés : leur format range déjà
  // N pages dans une seule ligne.
  const portail = un([{ ...base, id: 'a', origine: 'portail' }, { ...base, id: 'b', origine: 'portail' }]) === 2

  const rates = Object.entries(separe).filter(([, ok]) => !ok).map(([k]) => k)
  verifier('D16 · regroupement uniquement sur des critères sûrs',
    identiques && rates.length === 0 && objectifVide && portail,
    rates.length ? `— critères ignorés: ${rates.join(', ')}`
      : `— identiques regroupés:${identiques ? 'oui' : 'NON'}`
        + ` objectif vide séparé:${objectifVide ? 'oui' : 'NON'}`
        + ` portail jamais regroupé:${portail ? 'oui' : 'NON'}`)
}

// ── D17 · une pièce jointe n'est jamais comptée deux fois ─────────────────
//
// Mesuré : la plateforme historique écrivait le même fichier dans `fichiers`
// ET dans `contenu.images`. Un devoir de deux pages en annonçait quatre au
// parent.
//
// L'ancienne garde cherchait `vues.has(p.url)`. Laisser la chaîne dans du
// code mort suffisait à la satisfaire — et le comptage double revenait.
{
  const url = 'https://x/exercice.jpg'
  const doubleEcriture = lireDevoir({
    id: 'z', fichiers: [{ url, nom: 'exercice.jpg' }], contenu: { images: [url] },
  })
  const deuxPages = lireDevoir({
    id: 'z2',
    fichiers: [{ url: 'https://x/p1.jpg' }, { url: 'https://x/p2.jpg' }],
    contenu: { images: ['https://x/p1.jpg', 'https://x/p2.jpg'] },
  })
  verifier('D17 · les pièces jointes sont dédoublonnées sur l’URL',
    doubleEcriture.piecesJointes.length === 1 && deuxPages.piecesJointes.length === 2,
    `— une pièce écrite deux fois → ${doubleEcriture.piecesJointes.length}`
    + ` · deux pages → ${deuxPages.piecesJointes.length}`)
}

// ── D18 · la bascule tient, et le retour arrière reste disponible ─────────
//
// Deux conditions opposées, et les deux comptent : plus aucun compte ne doit
// être conduit vers l'ancienne plateforme, ET celle-ci doit rester en ligne.
// Supprimer le dossier en même temps que le lien retirerait le filet le jour
// où un défaut apparaîtrait en production.
{
  // Trois évasions ont fait tomber la version précédente :
  //   — un lien posé dans un CINQUIÈME écran, hors de la liste en dur ;
  //   — les quatre écrans renommés, `lire()` rendant '' en silence ;
  //   — le filet présent mais VIDE, `existsSync` s'en contentant.
  // On balaie donc tout le dossier, et on pèse les fichiers.
  const tousLesEcrans = readdirSync('src/pages').filter(f => f.endsWith('.jsx'))
  const liens = tousLesEcrans.filter(f =>
    /href\s*=\s*["'`][^"'`]*pedago-archive/.test(lire(`src/pages/${f}`)))

  const pese = f => { try { return statSync(f).size } catch { return 0 } }
  const tailles = { index: pese('public/pedago-archive/index.html'),
                    app:   pese('public/pedago-archive/app.js') }
  const filetEnPlace = tailles.index > 500 && tailles.app > 500

  verifier('D18 · bascule faite, retour arrière conservé',
    liens.length === 0 && filetEnPlace && tousLesEcrans.length >= 4,
    `— ${tousLesEcrans.length} écrans balayés`
    + ` · liens restants:${liens.length ? liens.join(', ') : 'aucun'}`
    + ` · ancien module:${filetEnPlace ? `${tailles.index}+${tailles.app} o` : 'ABSENT OU VIDE'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

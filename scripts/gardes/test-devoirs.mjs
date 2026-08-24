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
import { readFileSync, existsSync } from 'node:fs'

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
{
  verifier('D11 · aucune colonne chargée par `*`',
    !CHAMPS_DEVOIR.includes('*') && CHAMPS_DEVOIR.split(',').length >= 10,
    `— ${CHAMPS_DEVOIR.split(',').length} colonnes`)
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
// La règle est exacte plutôt qu'approchée : `auteurId` ne peut venir QUE de
// la colonne. Un premier motif, qui cherchait un nom suivi d'une recherche de
// compte, laissait passer la forme inverse — `COMPTES.find(u => u.nom ===
// c.teacher)` — et ne savait donc pas échouer.
{
  const lib = lire('src/lib/devoirs.js')
  const ligneAuteur = (lib.match(/^\s*auteurId:\s*(.+?),\s*$/m) || [])[1] || ''
  const ligneOrigine = (lib.match(/^\s*origine:\s*(.+?),\s*$/m) || [])[1] || ''
  const seulementLaColonne = /^ligne\?\.user_id \|\| null$/.test(ligneAuteur.trim())
  const origineSurLaColonne = /ligne\?\.user_id\s*\?/.test(ligneOrigine)
  const nomConserve = /auteurNomHistorique:\s*c\.teacher/.test(lib)
  verifier('D14 · aucun compte déduit d’un nom historique',
    seulementLaColonne && origineSurLaColonne && nomConserve,
    `— auteurId:(${ligneAuteur.trim() || 'ABSENT'})`
    + ` nom conservé:${nomConserve ? 'oui' : 'NON'}`)
}

// ── D15 · le regroupement multi-pages ne touche jamais la base ────────────
{
  const lib = lire('src/lib/devoirs.js')
  const bloc = lib.match(/export const regrouperPages[\s\S]*?\n}/)?.[0] || ''
  const sansEcriture = bloc.length > 0
    && !/(update|delete|insert|upsert|from\('devoirs'\)|supabase)/i.test(bloc)
  const gardeLesLignes = /lignes:\s*\[d\]/.test(bloc) && /lignes\.push\(d\)/.test(bloc)
  verifier('D15 · le regroupement est de restitution, pas de migration',
    sansEcriture && gardeLesLignes,
    `— sans écriture:${sansEcriture ? 'oui' : 'NON'} lignes conservées:${gardeLesLignes ? 'oui' : 'NON'}`)
}

// ── D16 · le regroupement exige des critères sûrs ─────────────────────────
//
// Dans le doute, on affiche séparément : un devoir montré deux fois est une
// gêne, deux devoirs présentés comme un seul est une erreur.
{
  const lib = lire('src/lib/devoirs.js')
  const cle = lib.match(/const cleRegroupement[\s\S]*?\n}/)?.[0] || ''
  const historiqueSeul = /origine\s*!==\s*'historique'/.test(cle)
  const refuseObjectifVide = /if\s*\(!objectif\)\s*return null/.test(cle)
  const refuseSansDate = /if\s*\(!d\.matiere\s*\|\|\s*!d\.dateDonne\)\s*return null/.test(cle)
  const ciblageDansLaCle = /eleveIds/.test(cle) && /candidatMatricules/.test(cle)
  verifier('D16 · regroupement uniquement sur des critères sûrs',
    historiqueSeul && refuseObjectifVide && refuseSansDate && ciblageDansLaCle,
    `— historique seul:${historiqueSeul ? 'oui' : 'NON'}`
    + ` objectif exigé:${refuseObjectifVide ? 'oui' : 'NON'}`
    + ` date exigée:${refuseSansDate ? 'oui' : 'NON'}`
    + ` ciblage:${ciblageDansLaCle ? 'oui' : 'NON'}`)
}

// ── D17 · une pièce jointe n'est jamais comptée deux fois ─────────────────
//
// Mesuré : la plateforme historique écrivait le même fichier dans `fichiers`
// ET dans `contenu.images`. Un devoir de deux pages en annonçait quatre au
// parent.
{
  const lib = lire('src/lib/devoirs.js')
  const bloc = lib.match(/const piecesJointes[\s\S]*?\n  \}/)?.[0] || ''
  const dedoublonne = /vues\.has\(p\.url\)/.test(bloc) && /vues\.add\(p\.url\)/.test(bloc)
  verifier('D17 · les pièces jointes sont dédoublonnées sur l’URL',
    dedoublonne, dedoublonne ? '' : '— comptage double')
}

// ── D18 · la bascule tient, et le retour arrière reste disponible ─────────
//
// Deux conditions opposées, et les deux comptent : plus aucun compte ne doit
// être conduit vers l'ancienne plateforme, ET celle-ci doit rester en ligne.
// Supprimer le dossier en même temps que le lien retirerait le filet le jour
// où un défaut apparaîtrait en production.
{
  const ecrans = ['src/pages/ProfApp.jsx', 'src/pages/DirecteurApp.jsx',
                  'src/pages/MaternelleApp.jsx', 'src/pages/SurveillantApp.jsx']
  const liens = ecrans.filter(f => /href\s*=\s*["'`][^"'`]*pedago-archive/.test(lire(f)))
  const filetEnPlace = existsSync('public/pedago-archive/index.html')
                    && existsSync('public/pedago-archive/app.js')
  verifier('D18 · bascule faite, retour arrière conservé',
    liens.length === 0 && filetEnPlace,
    `— liens restants:${liens.length ? liens.join(', ') : 'aucun'}`
    + ` ancien module:${filetEnPlace ? 'en ligne' : 'SUPPRIMÉ'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

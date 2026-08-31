// Gardes : rattacher un devoir à un cours préparé — sans jamais l'imposer.
//
// ── Ce qui est en jeu ────────────────────────────────────────────────────
//
// Le rattachement est une AIDE. Un devoir libre doit rester un devoir entier :
// pas de champ obligatoire, pas de matière imposée par le cours choisi, et les
// quatorze devoirs déjà en base — qui ne portent pas cette clé — continuent de
// s'ouvrir, de s'éditer et de s'imprimer comme avant.
//
// Et le cahier imprimé est GELÉ : ces gardes vérifient qu'il n'a rien appris
// de ce lien.
import { readFileSync, existsSync } from 'node:fs'
import { intituleCours, coursDisponibles, coursDeReference, estCoursPrepare, SANS_COURS, LIBELLE_SANS_COURS }
  from '../../src/lib/coursAssocie.js'
import { contenuCanonique, lireDevoir, refusDeSaisie } from '../../src/lib/devoirs.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const prof = lire('src/pages/ProfApp.jsx')

console.log(`\n${G}── COURS ASSOCIÉ · une aide, jamais une contrainte   [INV-FLUX]${F}`)

const PREPS = [
  { id: 'p1',  user_id: 'u1', groupe: 'CP1', matiere: 'Écriture', date_cours: '2026-10-26', sequence: 1, status: 'validee', contenu: { programme: { titre: 'i et u' } } },
  { id: 'p1b', user_id: 'u1', groupe: 'CP1', matiere: 'Écriture', date_cours: '2026-10-26', sequence: 2, status: 'validee', contenu: { programme: { titre: 'i et u' } } },
  { id: 'p2',  user_id: 'u1', groupe: 'CP1', matiere: 'Lecture',  date_cours: '2026-10-20', sequence: 1, status: 'deposee', contenu: { objectif: 'voyelles a et i' } },
  { id: 'p3',  user_id: 'u1', groupe: 'CP1', matiere: 'Maths',    date_cours: '2026-10-27', sequence: 1, status: 'validee', contenu: { programme: { titre: 'addition jusqu’à 20' } } },
  { id: 'x1',  user_id: 'AUTRE', groupe: 'CP1', matiere: 'Écriture', date_cours: '2026-10-28', sequence: 1, status: 'validee', contenu: { programme: { titre: 'préparation d’un collègue' } } },
  { id: 'y1',  user_id: 'u1', groupe: 'CE1', matiere: 'Écriture', date_cours: '2026-10-28', sequence: 1, status: 'validee', contenu: { programme: { titre: 'autre classe' } } },
]
const SAISIE = { matiere: 'Maths', objectif: 'Additionner', dateRendu: '2026-11-02', classeId: 'c1', destinataireMode: 'classe' }

// ── C1 · le lien s'enregistre et se relit ────────────────────────────────
{
  const c = contenuCanonique({ ...SAISIE, preparationId: 'p3' })
  const relu = lireDevoir({ contenu: c })
  verifier('C1 · le lien est enregistré puis relu à l’identique',
    c.preparation_id === 'p3' && relu.preparationId === 'p3', `— ${c.preparation_id} → ${relu.preparationId}`)
}

// ── C2 · l'intitulé vient de la préparation, jamais d'une copie ──────────
{
  const c = contenuCanonique({ ...SAISIE, preparationId: 'p3' })
  const stockeUnLibelle = JSON.stringify(c).includes('addition')
  const affiche = coursDeReference(PREPS, 'p3')
  verifier('C2 · l’intitulé se lit sur la préparation, il n’est pas recopié',
    !stockeUnLibelle && affiche?.intitule === 'Maths — addition jusqu’à 20',
    `— stocké:${stockeUnLibelle ? 'COPIE' : 'identifiant seul'} · lu « ${affiche?.intitule} »`)
}

// ── C3/C4 · le devoir libre reste entier ─────────────────────────────────
{
  const c = contenuCanonique(SAISIE)
  const relu = lireDevoir({ contenu: c })
  const refus = refusDeSaisie(SAISIE)
  verifier('C3/C4 · devoir libre : aucun lien, aucun refus',
    c.preparation_id === null && relu.preparationId === null && refus === null,
    `— lien:${c.preparation_id} · refus:${refus === null ? 'aucun' : refus}`)
}

// ── C5 · jamais la préparation d'un autre enseignant ─────────────────────
{
  const liste = coursDisponibles(PREPS, { userId: 'u1', groupe: 'CP1', matiere: 'Maths' })
  const fuite = liste.some(c => c.intitule.includes('collègue'))
  // Et sans identifiant d'enseignant, on ne propose RIEN : un appelant qui
  // oublie de le passer ne doit pas obtenir la salle des profs entière.
  const sansUtilisateur = coursDisponibles(PREPS, { groupe: 'CP1' }).length
  verifier('C5 · aucune préparation d’un autre enseignant',
    !fuite && sansUtilisateur === 0, `— fuite:${fuite ? 'OUI' : 'non'} · sans userId : ${sansUtilisateur} entrée(s)`)
}

// ── C6 · matière du devoir en tête, puis du plus récent au plus ancien ───
{
  const liste = coursDisponibles(PREPS, { userId: 'u1', groupe: 'CP1', matiere: 'Maths' })
  const ordre = liste.map(c => c.intitule)
  const statutVisible = liste.find(c => c.id === 'p2')?.statut === 'deposee'
  verifier('C6 · matière d’abord, récents ensuite, statut conservé',
    ordre[0] === 'Maths — addition jusqu’à 20'
      && ordre[1] === 'Écriture — i et u'
      && ordre[2] === 'Lecture — voyelles a et i'
      && statutVisible,
    `— ${ordre.join(' | ')}`)
}

// ── C7 · changer la matière ne casse rien ────────────────────────────────
//
// Un enseignant qui a fait Écriture peut donner un devoir libre de Maths. Le
// cours choisi ne doit JAMAIS réécrire la matière du devoir.
{
  const c = contenuCanonique({ ...SAISIE, matiere: 'Maths', preparationId: 'p1' })
  const relu = lireDevoir({ matiere: 'Maths', contenu: c })
  const sansCours = coursDisponibles(PREPS, { userId: 'u1', groupe: 'CP1', matiere: 'Matière inconnue' })
  verifier('C7 · le cours n’impose pas sa matière au devoir',
    relu.matiere === 'Maths' && relu.preparationId === 'p1' && sansCours.length === 3,
    `— matière ${relu.matiere} · cours ${relu.preparationId} · liste ${sansCours.length}`)
  // Le formulaire ne doit contenir aucune écriture de la matière au moment du
  // choix du cours.
  const bloc = (prof.match(/onChange=\{e => setNewDevoir\(\{ \.\.\.newDevoir, preparation_id: e\.target\.value \}\)\}/) || [])[0]
  verifier('C7b · choisir un cours ne touche qu’au champ du cours', !!bloc)
}

// ── C8 · aucune donnée de cours inventée ─────────────────────────────────
{
  const vide = intituleCours({ id: 'z', matiere: '', contenu: {} })
  const sansTitre = intituleCours({ id: 'z', matiere: 'Éveil', contenu: {} })
  const rejete = !estCoursPrepare({ id: 'z', matiere: '', contenu: {} })
  verifier('C8 · rien n’est fabriqué quand la préparation est muette',
    vide === '' && sansTitre === 'Éveil' && rejete,
    `— vide « ${vide} » · matière seule « ${sansTitre} »`)
}

// ── C9 · une entrée par leçon, pas par séquence ──────────────────────────
{
  const liste = coursDisponibles(PREPS, { userId: 'u1', groupe: 'CP1' })
  const ecritures = liste.filter(c => c.intitule.startsWith('Écriture'))
  verifier('C9 · deux séquences d’une même leçon ne font qu’une entrée',
    ecritures.length === 1 && liste.length === 3, `— ${ecritures.length} pour Écriture, ${liste.length} au total`)
}

// ── C10 · les devoirs déjà en base continuent de fonctionner ─────────────
{
  // Forme historique : ni `preparation_id`, ni même `destinataire_mode`.
  const ancien = { id: 'd0', matiere: 'Lecture', description: 'Lire p.12',
    contenu: { destinataires: { mode: 'choix', eleves: [{ cle: 'el:abc', nom: 'Awa' }] }, content: 'Exercice 3' } }
  const relu = lireDevoir(ancien)
  verifier('C10 · un devoir historique s’ouvre sans lien et sans perte',
    relu.preparationId === null && relu.matiere === 'Lecture'
      && relu.enonce === 'Exercice 3' && relu.eleveIds.length === 1,
    `— lien:${relu.preparationId} · destinataires:${relu.eleveIds.length}`)
}

// ── F1 · l'option « devoir libre » existe et vaut le vide ────────────────
{
  const optionPresente = prof.includes('LIBELLE_SANS_COURS') && prof.includes('value={SANS_COURS}')
  verifier('F1 · l’option « devoir libre » est proposée',
    optionPresente && SANS_COURS === '' && /sans cours associé/i.test(LIBELLE_SANS_COURS))
}

// ── F2 · une lecture refusée n'est pas « aucun cours » ───────────────────
{
  const distingue = /setCoursPrepares\(error \? null : \(Array\.isArray\(data\) \? data : \[\]\)\)/.test(prof)
    && /coursPrepares === null \?/.test(prof)
  verifier('F2 · un refus de lecture est dit, pas rendu comme une liste vide', distingue)
}

// ── GEL · le cahier imprimé n'a rien appris de ce lien ───────────────────
{
  const geles = ['src/pages/DevoirsDocument.jsx', 'src/pages/DocumentPrintStudio.jsx']
  const contamines = geles.filter(f => /preparationId|preparation_id|coursAssocie|Cours associé/i.test(lire(f)))
  verifier('GEL · ni le document ni le moteur ne connaissent le cours associé',
    contamines.length === 0, contamines.length ? `— ${contamines.join(', ')}` : '— 2 fichiers gelés vérifiés')
}

// ── SQL · aucune migration ───────────────────────────────────────────────
{
  // `contenu` est une colonne JSON qui porte déjà des clés libres —
  // `candidat_matricules` y vit depuis une mission antérieure. La liste des
  // colonnes lues ne doit pas avoir bougé.
  const colonnes = lire('src/lib/devoirs.js').match(/export const CHAMPS_DEVOIR = \[([\s\S]*?)\]/)?.[1] || ''
  verifier('SQL · aucune colonne nouvelle sur la table devoirs',
    !/preparation_id/.test(colonnes) && /'contenu'/.test(colonnes))
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

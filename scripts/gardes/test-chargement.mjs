// ═══════════════════════════════════════════════════════════════════════
// TEST — une panne ne doit jamais se lire comme une valeur métier
// ═══════════════════════════════════════════════════════════════════════
//
// Reproduit le bug « 0 élèves / 0 enseignants / 0 classes » : un refus RLS
// ou une coupure réseau que l'ancien code convertissait en liste vide, puis
// en zéro affiché.
//
//   node scripts/gardes/test-chargement.mjs
//
// Sortie 0 si tout passe, 1 sinon.

import { resultat, agreger, messageLisible, indicateur } from '../../src/lib/chargement.js'

let ok = 0, ko = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', N = '\x1b[0m'

const t = (libelle, obtenu, attendu) => {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu)
  process.stdout.write(`  ${bon ? V + '✓' : R + '✗'}${N} ${libelle}`)
  if (!bon) process.stdout.write(`${R}  attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}${N}`)
  process.stdout.write('\n')
  bon ? ok++ : ko++
}

// Les réponses telles que PostgREST les renvoie réellement.
const refusRls = { data: null, error: { code: '42501', message: 'permission denied for table eleves' } }
const panneReseau = { data: null, error: { message: 'TypeError: Failed to fetch' } }
const sessionExpiree = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } }
const videLegitime = { data: [], error: null }
const douzeEleves = { data: Array.from({ length: 12 }, (_, i) => ({ id: i })), error: null }

console.log(`\n${G}── LE BUG REPRODUIT — ce que faisait l'ancien code ──${N}`)

// C'était littéralement `results[1].data || []`, puis `.length` affiché.
const ancienCode = (r) => (r.data || []).length
t("refus RLS → l'ancien code affichait un zéro", ancienCode(refusRls), 0)
t("panne réseau → idem",                          ancienCode(panneReseau), 0)
t('vide légitime → zéro lui aussi',               ancienCode(videLegitime), 0)
console.log(`  ${G}Les trois cas donnaient 0 : indiscernables.${N}`)

console.log(`\n${G}── APRÈS CORRECTIF — trois états distincts ──${N}`)

t('refus RLS → état « erreur »',        resultat(refusRls).etat,      'erreur')
t('panne réseau → état « erreur »',     resultat(panneReseau).etat,   'erreur')
t('session expirée → état « erreur »',  resultat(sessionExpiree).etat,'erreur')
t('vide légitime → état « vide »',      resultat(videLegitime).etat,  'vide')
t('12 élèves → état « ok »',            resultat(douzeEleves).etat,   'ok')
t('12 élèves → 12 lignes',              resultat(douzeEleves).donnees.length, 12)

console.log(`\n${G}── L'INDICATEUR NE MENT PLUS ──${N}`)

t("erreur → null, l'écran affichera « — »", indicateur('erreur', 0), null)
t('chargement → null aussi',                indicateur('chargement', 0), null)
t('vrai zéro → zéro, il est légitime',      indicateur('vide', 0), 0)
t('douze → douze',                          indicateur('ok', 12), 12)

console.log(`\n${G}── MESSAGES : lisibles, sans divulguer la structure ──${N}`)

t('refus RLS parle de droits',       messageLisible(refusRls.error).includes('droits'), true)
t('panne réseau parle de connexion', messageLisible(panneReseau.error).includes('connexion'), true)
t('session expirée invite à se reconnecter', messageLisible(sessionExpiree.error).includes('Reconnectez'), true)
t("aucun message ne divulgue un nom de table",
  ['eleves', 'users', 'inscriptions', 'permission denied for table']
    .some(x => messageLisible(refusRls.error).includes(x)), false)

console.log(`\n${G}── SIGNALER PAR BLOC, JAMAIS PAR PAGE ──${N}`)

// Le cas réel : douze requêtes, une seule échoue.
const douzeRequetes = {
  personnel: douzeEleves, eleves: refusRls, classes: douzeEleves,
  periodes: videLegitime, evenements: douzeEleves, documents: videLegitime,
  parametres: douzeEleves, preparations: douzeEleves, checkpoints: douzeEleves,
  affectations: douzeEleves, discipline: douzeEleves, inscriptions: douzeEleves,
}
const bilan = agreger(douzeRequetes)
t('une requête en échec est détectée',        bilan.aDesEchecs, true)
t('elle est nommée',                          bilan.blocsEnEchec, ['eleves'])
t('les onze autres ne sont pas perdues',      bilan.nbEchecs, 1)

const toutVaBien = agreger({ a: douzeEleves, b: videLegitime })
t('aucun échec quand tout aboutit',           toutVaBien.aDesEchecs, false)
t('un résultat vide n\'est pas un échec',     toutVaBien.nbEchecs, 0)

console.log()
if (ko === 0) {
  console.log(`  ${V}${ok} test(s) au vert.${N}\n`)
  process.exit(0)
} else {
  console.log(`  ${R}${ok} au vert, ${ko} EN ÉCHEC.${N}\n`)
  process.exit(1)
}

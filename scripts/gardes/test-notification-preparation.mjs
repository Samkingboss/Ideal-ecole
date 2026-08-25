// Gardes sur la notification de la direction lors d'un dépôt ou d'une
// resoumission de préparation.
//
// ── Ce qu'elles empêchent de revenir ───────────────────────────────────────
//
// La resoumission d'une préparation corrigée échouait en 42501 : le client
// écrivait la notification directement dans `app_state`, et une session
// authentifiée n'a pas ce droit. La correction facile — accorder l'écriture
// de `app_state` à `authenticated` — aurait été bien pire que le bug :
// l'écriture y REMPLACE la liste entière. Toute enseignante aurait pu écrire
// n'importe quelle notification vers n'importe qui, et EFFACER la boîte du
// directeur.
//
// Ces gardes vérifient que la correction est restée étroite : le client ne
// choisit que la préparation, le serveur décide de tout le reste.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const sansCommentaires = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*(\/\/|--)/.test(l)).join('\n')

console.log(`\n${G}── NOTIFICATION DES PRÉPARATIONS · surface étroite   [INV-SEC]${F}`)

const fiche = sansCommentaires(lire('src/pages/FichePreparation.jsx'))
const notifs = sansCommentaires(lire('src/lib/notifications.js'))
const sql = lire('sql/notification_preparations.sql')
const sqlCode = sansCommentaires(sql)

// ── P1 · la fiche ne passe plus par la table ouverte ───────────────────────
{
  const parLaTable = /pushNotification\s*\(/.test(fiche)
  const parLaSurface = /notifierPreparation\s*\(/.test(fiche)
  verifier('P1 · la fiche notifie par la surface serveur, pas par la table',
    !parLaTable && parLaSurface,
    parLaTable ? '— pushNotification est revenu' : (parLaSurface ? '' : '— aucune notification'))
}

// ── P2 · le client ne transmet QUE la préparation ──────────────────────────
//
// C'est la garde centrale. Si un jour un titre, un destinataire ou un type
// repassait par le client, la surface cesserait d'être étroite.
{
  const appel = notifs.match(/rpc\(\s*'notifier_preparation'\s*,\s*\{([^}]*)\}/s)?.[1] || ''
  const cles = [...appel.matchAll(/([a-z_]+)\s*:/g)].map(m => m[1])
  const seulement = cles.length === 1 && cles[0] === 'p_preparation_id'
  verifier('P2 · le client ne transmet que l’identifiant de la préparation',
    seulement, `— paramètres: ${cles.join(', ') || 'AUCUN'}`)
}

// ── P3 · aucun droit d’écriture n’a été ouvert sur app_state ───────────────
{
  const elargit = /(grant\s+[^;]*\b(insert|update|all)\b[^;]*\bon\b[^;]*app_state)/i.test(sqlCode)
             || /create\s+policy[^;]*\bon\b[^;]*app_state/i.test(sqlCode)
  verifier('P3 · le script n’élargit aucun droit sur app_state',
    sql.length > 0 && !elargit,
    sql.length === 0 ? '— script absent' : (elargit ? '— DROIT ÉLARGI' : ''))
}

// ── P4 · le serveur vérifie que la préparation appartient à l’appelante ────
//
// Sans ce refus, la surface étroite ne vaudrait pas mieux qu’un INSERT
// général : il suffirait de connaître l’identifiant d’une préparation.
{
  const lecteurJeton = /auth_user_id\s*=\s*auth\.uid\(\)/.test(sqlCode)
  const refus = /v_prep\.user_id\s*<>\s*v_moi\.id/.test(sqlCode)
           && /42501/.test(sqlCode)
  // La signature elle-même, et non le corps : `p_cibles => v_cles` dans le
  // corps est un argument que le SERVEUR passe à une autre fonction, pas une
  // valeur reçue du client. Confondre les deux ferait échouer la garde sur du
  // code correct — et, pire, la ferait passer sur du code qui ne l'est pas.
  const signature = (sqlCode.match(
    /create\s+or\s+replace\s+function\s+public\.notifier_preparation\s*\(([^)]*)\)/i
  ) || [])[1] || ''
  const parametres = signature.split(',').map(x => x.trim()).filter(Boolean)
  const clientNeChoisitPas = parametres.length === 1
    && /^p_preparation_id\s+uuid$/i.test(parametres[0])
  verifier('P4 · propriété vérifiée côté serveur, refus explicite',
    lecteurJeton && refus && clientNeChoisitPas,
    `— jeton:${lecteurJeton ? 'lu' : 'NON'} refus:${refus ? 'oui' : 'NON'}`
    + ` signature:(${parametres.join(', ') || 'VIDE'})`)
}

// ── P5 · l’identifiant de notification est déterministe ────────────────────
//
// L’idempotence repose entièrement là-dessus. Un identifiant tiré de l’heure
// ou du hasard rendrait chaque double clic visible comme un doublon.
{
  const ligne = sqlCode.match(/v_id\s*:=\s*([^;]+);/)?.[1] || ''
  const deterministe = /p_preparation_id/.test(ligne) && /v_cycles/.test(ligne)
  const sansHasard = !/now\(\)|random\(|clock_timestamp|gen_random/i.test(ligne)
  const cycleCompte = /count\(\*\)[\s\S]{0,200}correction_demandee/.test(sqlCode)
  verifier('P5 · identifiant de notification déterministe',
    deterministe && sansHasard && cycleCompte,
    `— préparation+cycle:${deterministe ? 'oui' : 'NON'} sans hasard:${sansHasard ? 'oui' : 'NON'}`
    + ` cycle compté:${cycleCompte ? 'oui' : 'NON'}`)
}

// ── P6 · resoumission et premier dépôt portent des libellés distincts ──────
{
  // Le client peut parfaitement adapter SES propres libellés d'écran — c'est
  // le titre lu par la direction qui ne doit pas venir de lui.
  const deuxTitres = /Nouvelle préparation soumise/.test(sql)
                  && /corrigée et resoumise/i.test(sql)
  const choixServeur = /v_titre\s*:=\s*case\s+when\s+v_retour/i.test(sqlCode)
  const titreCheZLeClient = /titre\s*:\s*[`'"][^`'"]*(préparation|Préparation)/.test(fiche)
  verifier('P6 · la direction distingue un retour après correction',
    deuxTitres && choixServeur && !titreCheZLeClient,
    `— libellés:${deuxTitres ? 'deux' : 'UN SEUL'}`
    + ` choix:${choixServeur ? 'serveur' : 'NON TRANCHÉ'}`
    + ` titre chez le client:${titreCheZLeClient ? 'OUI' : 'non'}`)
}

// ── P7 · deux appels simultanés ne peuvent pas s’écraser ───────────────────
{
  const verrou = /pg_advisory_xact_lock/.test(sqlCode)
  const sortieSiDeja = /n->>'id'\s*=\s*v_id[\s\S]{0,120}continue/.test(sqlCode)
  verifier('P7 · concurrence et renvoi ne créent pas de doublon',
    verrou && sortieSiDeja,
    `— verrou:${verrou ? 'oui' : 'NON'} sortie si déjà notifiée:${sortieSiDeja ? 'oui' : 'NON'}`)
}

// ── P8 · anon ne peut pas notifier la direction ────────────────────────────
//
// Sonde réelle contre la production, en lecture d'échec : on tente l'appel
// avec la clé publique et l'on exige un refus. Une réponse 200 signifierait
// que n'importe quel visiteur peut écrire dans la boîte du directeur.
{
  const cle = (lire('public/inscription.html').match(/SUPABASE_KEY = '([^']+)'/) || [])[1]
  const revoque = /revoke\s+all\s+on\s+function\s+public\.notifier_preparation[^;]*anon/i.test(sqlCode)
                && !/grant\s+execute[^;]*notifier_preparation[^;]*anon/i.test(sqlCode)
  if (!cle) {
    verifier('P8 · anon ne peut pas notifier la direction', false, '— clé introuvable')
  } else {
    const r = await fetch('https://jircuneixzwsmtktxrkh.supabase.co/rest/v1/rpc/notifier_preparation', {
      method: 'POST',
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_preparation_id: '00000000-0000-0000-0000-000000000000' }),
    }).catch(() => null)
    const refuse = !r || r.status !== 200
    verifier('P8 · anon ne peut pas notifier la direction',
      refuse && revoque,
      `— réponse:${r ? r.status : 'réseau'} révocation écrite:${revoque ? 'oui' : 'NON'}`)
  }
}

// ── P9 · `cree` est toujours un booléen ────────────────────────────────────
//
// Mesuré à l'étape 3 : au second appel, `cree` valait `null` et non `false`.
// `array_length(t, 1)` rend NULL sur un tableau VIDE — la comparaison
// devenait NULL, et le client qui teste `cree === false` ne voyait rien.
//
// L'idempotence fonctionnait ; c'est le CONTRAT qui était faux. Une valeur
// qui n'est ni vraie ni fausse oblige chaque appelant à se souvenir du piège.
{
  const bloc = sqlCode.match(/create or replace function public\.notifier_preparation[\s\S]*?\$function\$;/)?.[0] || ''
  const surTableau = /array_length\s*\(\s*v_(ecrites|deja)/.test(bloc)
  const cree = (bloc.match(/'cree',\s*([^,\n]+)/) || [])[1] || ''
  const booleen = /cardinality\(|coalesce\(\s*array_length/.test(cree)
  verifier('P9 · `cree` est toujours un booléen, jamais null',
    bloc.length > 0 && !surTableau && booleen,
    `— cree=(${cree.trim() || 'ABSENT'})`
    + ` array_length sur tableau:${surTableau ? 'PRÉSENT' : 'aucun'}`)
}

console.log(echecs === 0
  ? `\n  ${V}9 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

// Gardes permanentes sur `app_state`.
//
// ── La propriété visée ─────────────────────────────────────────────────────
//
//   `app_state` n'est jamais écrite directement depuis le navigateur.
//   Le navigateur exprime une INTENTION MÉTIER.
//   Le serveur décide si elle est autorisée.
//
// ── Pourquoi ───────────────────────────────────────────────────────────────
//
// Mesuré depuis la clé publique : la lecture de `app_state` répond 200 et
// l'écriture 201. Quiconque détient cette clé — elle est dans le navigateur de
// tout visiteur — peut forger une notification, remplacer une boîte entière ou
// la vider. L'écriture y est un REMPLACEMENT de liste, pas un ajout.
//
// La fermeture ne peut pas être brutale : dix-sept écritures légitimes en
// dépendent encore, dont une sur une page publique par nature (le formulaire
// d'inscription prévient la direction sans que personne soit connecté). Ces
// gardes tiennent la ligne pendant la migration : la dette ne remonte pas, et
// aucun contournement ne s'installe.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ecrituresAppState } from './compter-ecritures-app-state.mjs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── APP_STATE · le navigateur n'écrit pas l'état   [INV-FLUX-02]${F}`)

// ── A1 · la dette d'écritures directes ne remonte jamais ──────────────────
//
// Le plafond vit dans `.ideal-etat.json` et n'est abaissé que par le cliquet.
// Cette garde le relit pour que l'échec soit lisible ici aussi, avec le
// détail de ce qui dépasse.
{
  const etat = JSON.parse(lire('.ideal-etat.json') || '{}')
  const plafond = (etat.plafonds || {}).app_state_ecritures ?? 999
  const trouvees = ecrituresAppState()
  verifier('A1 · aucune nouvelle écriture directe dans app_state',
    trouvees.length <= plafond,
    `— ${trouvees.length} écriture(s), plafond ${plafond}`
    + (trouvees.length > plafond
        ? ` · en trop: ${trouvees.slice(plafond).map(e => `${e.fichier}:${e.ligne}`).join(', ')}`
        : ''))
}

// ── A2 · aucun élargissement de l'écriture sur app_state ──────────────────
//
// Le diagnostic a montré que le levier n'est PAS le privilège : `anon`,
// `authenticated` et `service_role` ont exactement les mêmes GRANT. Ce sont
// les POLITIQUES qui décident, et les trois existantes visent `{anon}` seul.
//
// Une première version de cette garde ne surveillait que les GRANT à `anon`.
// Elle aurait laissé passer une politique d'écriture pour `authenticated` —
// précisément ce que la direction a interdit — et n'aurait donc pas su
// échouer sur le cas le plus probable.
{
  const sql = []
  const parcourir = d => { if (!existsSync(d)) return
    for (const e of readdirSync(d)) { const p = join(d, e)
      if (statSync(p).isDirectory()) parcourir(p)
      else if (e.endsWith('.sql')) sql.push(p) } }
  parcourir('sql')
  const ECRITURE = '(insert|update|delete|all)'
  const fautifs = []
  for (const f of sql) {
    const src = lire(f).split('\n').filter(l => !/^\s*--/.test(l)).join('\n')
    // Les instructions, une par une : un `;` sépare, et l'on ne veut pas
    // qu'un `grant` inoffensif d'un bout du fichier se marie au mot
    // `app_state` d'un autre bout.
    for (const inst of src.split(';')) {
      if (!/\bapp_state\b/i.test(inst)) continue
      const grantEcriture = new RegExp(`grant\\s+[^;]*\\b${ECRITURE}\\b[^;]*\\bon\\b[^;]*\\bapp_state\\b`, 'is')
      const politique = /create\s+policy/i.test(inst) && new RegExp(`\\b(for\\s+${ECRITURE}|to\\s+(anon|authenticated|public))`, 'is').test(inst)
      if (grantEcriture.test(inst) || politique) fautifs.push(`${f} · ${inst.trim().split('\n')[0].slice(0, 46)}`)
    }
  }
  verifier('A2 · aucun script n’élargit l’écriture sur app_state',
    fautifs.length === 0, fautifs.length ? `\n      ${fautifs.join('\n      ')}` : '— ni GRANT ni politique')
}

// ── A3 · une surface métier ne retombe jamais sur l'écriture générique ────
//
// C'est la garde contre le contournement silencieux : une RPC refusée, et le
// client réécrit `app_state` « en attendant ». Le workflow repartirait, la
// faille resterait, et plus personne ne saurait qu'elle est là.
{
  const notifs = lire('src/lib/notifications.js')
  const bloc = notifs.match(/export async function notifierPreparation[\s\S]*?\n}/)?.[0] || ''
  const sansRepli = bloc.length > 0 && !/app_state/.test(bloc)
  const passeParLaRpc = /rpc\(\s*'notifier_preparation'/.test(bloc)
  const fiche = lire('src/pages/FichePreparation.jsx')
  const ficheSansEcriture = !/pushNotification/.test(fiche) && !/app_state/.test(fiche)
  verifier('A3 · aucune surface métier ne retombe sur app_state',
    sansRepli && passeParLaRpc && ficheSansEcriture,
    `— surface:${passeParLaRpc ? 'RPC' : 'ABSENTE'}`
    + ` repli:${sansRepli ? 'aucun' : 'PRÉSENT'}`
    + ` fiche:${ficheSansEcriture ? 'propre' : 'ÉCRIT ENCORE'}`)
}

// ── A4 · un échec de notification n'ouvre aucun droit ─────────────────────
//
// La préparation reste enregistrée, le message est honnête, et rien n'est
// tenté d'autre. Une sauvegarde annulée parce que la cloche n'a pas sonné
// serait une régression bien pire que le bug d'origine.
{
  const fiche = lire('src/pages/FichePreparation.jsx')
  const bloc = fiche.match(/const envoi = await notifierPreparation[\s\S]{0,1400}/)?.[0] || ''
  const messageHonnete = /enregistrée\. En revanche la direction n\\?'a pas été prévenue/.test(bloc)
  const pasDeRollback = !/(delete\(\)|rollback|annuler.*enregistrement)/i.test(bloc)
  const pasDeSecondeTentative = !/(app_state|pushNotification|retry|réessay)/i.test(bloc)
  verifier('A4 · un échec de notification n’ouvre aucun droit',
    messageHonnete && pasDeRollback && pasDeSecondeTentative,
    `— message:${messageHonnete ? 'honnête' : 'MUET'}`
    + ` sauvegarde:${pasDeRollback ? 'conservée' : 'ANNULÉE'}`
    + ` contournement:${pasDeSecondeTentative ? 'aucun' : 'PRÉSENT'}`)
}

// ── A5 · l'inventaire de migration reste à jour ─────────────────────
//
// Chaque écriture directe restante doit être couverte par le document de
// fermeture. Une écriture qu'aucun document ne mentionne est une écriture que
// personne ne migrera.
//
// L'index est le FICHIER et le total, pas le numéro de ligne : une première
// version pointait `fichier:ligne`, et la moindre correction ailleurs dans le
// fichier faisait rougir la garde sans qu'aucune écriture ait bougé. Une
// garde qui crie pour rien finit par être ignorée.
{
  const doc = lire('docs/constitution/fermeture-app-state.md')
  const trouvees = ecrituresAppState()
  const fichiers = [...new Set(trouvees.map(e => e.fichier))]
  const absents = fichiers.filter(f => !doc.includes(f))
  // Le total annoncé par le plan doit être celui que l'on mesure.
  const annonce = Number((doc.match(/Inventaire des (\d+) écritures/) || [])[1] || -1)
  verifier('A5 · chaque écriture restante figure au plan de fermeture',
    doc.length > 0 && absents.length === 0 && annonce === trouvees.length,
    doc.length === 0 ? '— document absent'
      : (absents.length ? `— fichiers absents: ${absents.join(', ')}`
         : `— ${fichiers.length} fichier(s), ${trouvees.length} écriture(s), plan annonce ${annonce}`))
}

// ── A6 · une écriture nomme son espace et lit son résultat ────────────
//
// Deux défauts de la même famille, tous deux vérifiés en base :
//
//   `app` est NOT NULL et fait partie de la clé primaire. L'omettre donne
//   400 · 23502. `CuisiniereApp.savePointage` l'omettait : la table ne
//   contenait pas UN SEUL pointage. La cuisinière cochait ses repas et tout
//   disparaissait au rechargement.
//
//   Le client Supabase ne lève pas d'exception, il rend `{ error }`. Un
//   `try/catch` autour d'un `upsert` n'attrape donc rien : le `console.error`
//   ne s'exécutait pas, et `setSaved(true)` annonçait un succès qui n'avait
//   pas eu lieu.
//
// Une écriture perdue en silence est pire qu'une écriture refusée : personne
// ne sait qu'il faut recommencer.
{
  const manquent = []
  for (const e of ecrituresAppState()) {
    const lignes = lire(e.fichier).split('\n')
    const fenetre = lignes.slice(e.ligne - 1, e.ligne + 14).join('\n')
    if (!/(^|[\s({,])app\s*:/m.test(fenetre))
      manquent.push(`${e.fichier}:${e.ligne} sans app`)
    const suite = lignes.slice(Math.max(0, e.ligne - 4), e.ligne + 22).join('\n')
    const litLeResultat = /(const|let)\s*\{[^}]*\berror\b/.test(suite)
    if (!litLeResultat) manquent.push(`${e.fichier}:${e.ligne} sans lecture du résultat`)
  }
  verifier('A6 · chaque écriture nomme son espace et lit son résultat',
    manquent.length === 0,
    manquent.length ? `— ${manquent.join(' · ')}` : '— toutes conformes')
}
console.log(echecs === 0
  ? `\n  ${V}6 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

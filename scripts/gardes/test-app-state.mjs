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

// ── A2 · aucun nouveau droit d'écriture accordé à anon ────────────────────
//
// La fermeture viendra ; d'ici là, aucun script ne doit ÉLARGIR ce qui est
// déjà trop large.
{
  const sql = []
  const parcourir = d => { if (!existsSync(d)) return
    for (const e of readdirSync(d)) { const p = join(d, e)
      if (statSync(p).isDirectory()) parcourir(p)
      else if (e.endsWith('.sql')) sql.push(p) } }
  parcourir('sql')
  const fautifs = sql.filter(f => {
    const src = lire(f).split('\n').filter(l => !/^\s*--/.test(l)).join('\n')
    return /grant\s+[^;]*\b(insert|update|delete|all)\b[^;]*\bon\b[^;]*\bapp_state\b[^;]*\banon\b/is.test(src)
        || /create\s+policy[^;]*\bon\b[^;]*\bapp_state\b[^;]*\bto\b[^;]*\banon\b[^;]*(insert|update|delete|all)/is.test(src)
  })
  verifier('A2 · aucun script n’élargit l’écriture d’anon sur app_state',
    fautifs.length === 0, fautifs.length ? `— ${fautifs.join(', ')}` : '')
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

// ── A5 · l'inventaire de migration reste à jour ───────────────────────────
//
// Chaque écriture directe restante doit être nommée dans le document de
// fermeture, avec son workflow et sa surface de remplacement. Une écriture
// qu'aucun document ne mentionne est une écriture que personne ne migrera.
{
  const doc = lire('docs/constitution/fermeture-app-state.md')
  const trouvees = ecrituresAppState()
  const manquantes = trouvees.filter(e => !doc.includes(`${e.fichier}:${e.ligne}`))
  verifier('A5 · chaque écriture restante figure au plan de fermeture',
    doc.length > 0 && manquantes.length === 0,
    doc.length === 0 ? '— document absent'
      : (manquantes.length ? `— absentes: ${manquantes.map(e => `${e.fichier}:${e.ligne}`).join(', ')}`
                           : `— ${trouvees.length}/${trouvees.length} inventoriées`))
}

console.log(echecs === 0
  ? `\n  ${V}5 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

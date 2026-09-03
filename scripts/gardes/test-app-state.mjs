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
  // ── Ce que cette garde protège désormais ────────────────────────────
  //
  // La règle « aucune politique d'écriture, quelle qu'elle soit » appartenait
  // à la phase où `app_state` n'était écrite que par des chemins anonymes.
  // Cette phase est close : la direction a arbitré que le personnel CONNECTÉ
  // doit pouvoir écrire, sous prédicat `ideal_role() is not null`. Maintenir
  // l'ancienne règle interdirait la migration décidée — et une garde qui
  // interdit ce qui a été décidé finit par être contournée, pas respectée.
  //
  // Ce qui reste interdit, et qui est le vrai danger :
  //   · toute écriture accordée à `anon` ou à `public` ;
  //   · une politique d'écriture pour `authenticated` SANS prédicat — un
  //     `with check (true)` rendrait le rôle aussi large que `anon`.
  const ECRITURE = '(insert|update|delete|all)'
  const fautifs = []
  for (const f of sql) {
    // Les commentaires de FIN DE LIGNE comptaient aussi. Un `drop policy … ;
    // -- UPDATE {anon} using (true)` laissait le mot `anon` migrer, après
    // découpage sur `;`, dans l'instruction SUIVANTE — qui se retrouvait
    // accusée d'ouvrir l'écriture à `anon` alors qu'elle vise
    // `authenticated`. On retire les deux formes.
    const src = lire(f)
      .replace(/--[^\n]*/g, '')
      .split('\n').join('\n')

    // Seule exception, nommée et étroite : un fichier de rollback qui porte
    // l'avertissement explicite de réouverture. Son objet EST de rouvrir, et
    // il le dit à qui l'ouvre. Un `grant` à `anon` glissé ailleurs reste
    // fautif — c'est ce que cette exception ne couvre pas.
    const estRollbackAssume = /_rollback\.sql$/.test(f)
      && /CE ROLLBACK RÉOUVRE APP_STATE À ANON/.test(lire(f))

    // Les instructions, une par une : un `;` sépare, et l'on ne veut pas
    // qu'un `grant` inoffensif d'un bout du fichier se marie au mot
    // `app_state` d'un autre bout.
    for (const inst of src.split(';')) {
      if (!/\bapp_state\b/i.test(inst)) continue

      // `public` désigne ici un RÔLE, pas le schéma. Sans la garde `(?!\s*\.)`,
      // le qualifiant `public.ideal_role()` d'un prédicat parfaitement sain
      // faisait passer la politique pour une ouverture à tous.
      const viseAnon = /\b(to|from)\s+[^;]*\b(anon|public)\b(?!\s*\.)/is.test(inst)
      const estGrant = /\bgrant\b/i.test(inst)
      const estPolitique = /create\s+policy/i.test(inst)
      const porteEcriture = new RegExp(`\\b${ECRITURE}\\b`, 'is').test(inst)

      // 1 · écriture ouverte à anon ou public, par grant ou par politique
      if ((estGrant || estPolitique) && porteEcriture && viseAnon && !estRollbackAssume) {
        fautifs.push(`${f} · ouvre l'écriture à anon/public · ${inst.trim().split('\n')[0].slice(0, 40)}`)
        continue
      }

      // 2 · politique d'écriture pour authenticated sans prédicat réel
      if (estPolitique && new RegExp(`\\bfor\\s+${ECRITURE}\\b`, 'is').test(inst)) {
        const sansPredicat = /with\s+check\s*\(\s*true\s*\)/is.test(inst)
          || /using\s*\(\s*true\s*\)/is.test(inst)
        if (sansPredicat && !estRollbackAssume) {
          fautifs.push(`${f} · politique d'écriture sans prédicat · ${inst.trim().split('\n')[0].slice(0, 40)}`)
        }
      }
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
    // Trois façons LÉGITIMES de nommer l'espace, toutes équivalentes en base :
    // `app: 'rh'`, la forme abrégée `{ app, key: cle }` quand la variable
    // porte déjà le nom, et le filtre `.eq('app', app)` d'une mise à jour
    // ciblée. N'en reconnaître qu'une faisait rougir le module central qui
    // les emploie toutes.
    const nommeSonEspace = /(^|[\s({,])app\s*:/m.test(fenetre)
      || /[({,]\s*app\s*[,}]/m.test(fenetre)
      || /\.eq\(\s*'app'/m.test(fenetre)
    if (!nommeSonEspace) manquent.push(`${e.fichier}:${e.ligne} sans app`)
    const suite = lignes.slice(Math.max(0, e.ligne - 4), e.ligne + 22).join('\n')
    const litLeResultat = /(const|let)\s*\{[^}]*\berror\b/.test(suite)
    if (!litLeResultat) manquent.push(`${e.fichier}:${e.ligne} sans lecture du résultat`)
  }
  verifier('A6 · chaque écriture nomme son espace et lit son résultat',
    manquent.length === 0,
    manquent.length ? `— ${manquent.join(' · ')}` : '— toutes conformes')
}
// ── A7 · aucune politique ne teste un composite pour « existe » ──────────
//
// `ideal_profil()` rend une LIGNE de `users`. En SQL, `composite IS NOT NULL`
// n'est vrai que si AUCUN champ n'est nul — une personne dont le téléphone
// est vide fait donc échouer le prédicat, et la politique refuse alors qu'elle
// existe et qu'elle est active.
//
// J'ai écrit cinq politiques sur cette base, dont celle qui devait rendre la
// cloche lisible à la direction. `ideal_role()` rend un `text` : `IS NOT NULL`
// y a son sens ordinaire.
{
  const sql = []
  const parcourir = d => { if (!existsSync(d)) return
    for (const e of readdirSync(d)) { const p = join(d, e)
      if (statSync(p).isDirectory()) parcourir(p)
      else if (e.endsWith('.sql')) sql.push(p) } }
  parcourir('sql')
  const fautifs = []
  for (const f of sql) {
    const src = lire(f)
    for (const inst of src.split(';')) {
      // Le bloc de retour arrière est commenté : on l'ignore.
      const actif = inst.split('\n').filter(l => !/^\s*--/.test(l)).join('\n')
      if (!/create policy|alter policy/i.test(actif)) continue
      // Une définition remplacée par un script ultérieur est de l'histoire,
      // pas l'état courant. Elle porte la marque, et on ne la compte pas.
      if (/SUPERSÉDÉ PAR/.test(inst)) continue
      if (/ideal_profil\(\)\s*is\s+not\s+null/i.test(actif)) {
        fautifs.push(`${f} · ${(actif.match(/(create|alter) policy\s+(\w+)/i) || [])[2] || '?'}`)
      }
    }
  }
  verifier('A7 · aucune politique ne teste un composite pour « existe »',
    fautifs.length === 0,
    fautifs.length ? `\n      ${fautifs.join('\n      ')}` : '— prédicats scalaires')
}

console.log(echecs === 0
  ? `\n  ${V}7 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

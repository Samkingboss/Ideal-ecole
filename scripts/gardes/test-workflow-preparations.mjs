// Gardes sur le workflow des préparations : identité, heure, notification.
//
// Les trois anomalies qu'elles empêchent de revenir ont été reproduites sur un
// cas réel — la préparation d'Ornella MOGADZI, CP2 · Français, cours du
// 24/08/2026 à 15:30, déposée le 25/08/2026 à 17:34.
//
//   « Enseignant non renseigné »  alors que les VINGT-QUATRE préparations
//                                 portent un `user_id`
//   heure ambiguë                 l'écran ne montrait que l'heure du COURS,
//                                 lue comme l'heure de dépôt
//   notification absente          elle était pourtant écrite en base
//
// Ce ne sont pas trois bugs : c'est un workflow où chaque maillon perdait une
// information que le précédent avait pourtant transmise.

import { readFileSync, existsSync } from 'node:fs'
import { dateDeCours, heureDeCours, momentDeDepot, FUSEAU_ECOLE } from '../../src/lib/tempsPreparation.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const directeur = lire('src/pages/DirecteurApp.jsx')

console.log(`\n${G}── PRÉPARATIONS · identité, heure, notification   [INV-FLUX]${F}`)

// ── G-ID · l'auteur ne dépend pas d'une jointure imbriquée ────────────────
//
// Une ressource imbriquée revient NULL dès que le lecteur ne peut pas lire la
// table jointe — et l'écran affichait « Enseignant non renseigné » pour une
// préparation dont `user_id` était renseigné.
{
  const bloc = directeur.match(/const auteur = [\s\S]{0,900}?'Enseignant non renseigné'/)?.[0] || ''
  const resoutSurLaListe = /\(profs \|\| \[\]\)\.find\(u => u\.id === prepDetail\.user_id\)/.test(bloc)
  // « non renseigné » ne doit être dit QUE lorsqu'il n'y a réellement pas
  // d'auteur — pas quand le profil n'a pas pu être lu.
  // Le commentaire entre le test et la valeur allongeait la distance : on
  // vérifie la STRUCTURE — un `user_id` présent mène à « profil non chargé »,
  // son absence seule mène à « non renseigné ».
  const distingueLesDeux = /profil non chargé/.test(bloc)
                        && /prepDetail\.user_id[\s\S]{0,400}\?\s*'Enseignant — profil non chargé'/.test(bloc)
                        && /:\s*'Enseignant non renseigné'/.test(bloc)
  verifier('G-ID · l’auteur est résolu, pas déduit d’une jointure',
    resoutSurLaListe && distingueLesDeux,
    `— liste:${resoutSurLaListe ? 'oui' : 'NON'} distingue:${distingueLesDeux ? 'oui' : 'NON'}`)
}

// ── G-TIME · heure du cours et heure de dépôt ne partagent pas un libellé ─
{
  const cours = (directeur.match(/Cours prévu/g) || []).length
  const depot = (directeur.match(/momentDeDepot\(/g) || []).length
  // L'ancien libellé « Cours du … à HH:MM » sans mention du dépôt.
  const ancienLibelle = /Cours du \{/.test(directeur)
  verifier('G-TIME · le cours et le dépôt ont chacun leur libellé',
    cours >= 2 && depot >= 2 && !ancienLibelle,
    `— « Cours prévu »:${cours} · dépôt affiché:${depot}`)
}

// ── G-TIME2 · le fuseau est nommé, et déclaré une seule fois ─────────────
{
  const lib = lire('src/lib/tempsPreparation.js')
  const nomme = /timeZone: FUSEAU_ECOLE/.test(lib)
  // Une seule déclaration dans TOUT le dépôt : preparations.js l'importe.
  const partout = ['src/lib/tempsPreparation.js', 'src/lib/preparations.js']
    .reduce((n, f) => n + (lire(f).match(/^export const FUSEAU_ECOLE\s*=/gm) || []).length, 0)
  const uneSeuleDeclaration = partout === 1
  const pasDeDecalageEnDur = !/\+\s*2\s*\*\s*3600|getTimezoneOffset\(\)/.test(lib)
  verifier('G-TIME2 · fuseau IANA nommé, déclaré une fois',
    nomme && uneSeuleDeclaration && pasDeDecalageEnDur && FUSEAU_ECOLE === 'Africa/Bamako',
    `— ${FUSEAU_ECOLE} · déclarations:${partout}`)
}

// ── G-TIME3 · les deux notions se calculent correctement ─────────────────
//
// Le cas réel, plus une heure exprimée dans un autre fuseau : elle doit être
// convertie une seule fois, vers l'heure de l'école.
{
  const reel = { date_cours: '2026-08-24', heure_cours: '15:30:00',
                 heure_depot: '2026-08-25T17:34:41.29+00:00' }
  const ailleurs = { date_cours: '2026-08-24', heure_cours: '08:00:00',
                     heure_depot: '2026-08-24T19:34:41+02:00' }
  const ok = dateDeCours(reel) === '24/08/2026'
          && heureDeCours(reel) === '15:30'
          && momentDeDepot(reel) === '25/08/2026 à 17:34'
          && momentDeDepot(ailleurs) === '24/08/2026 à 17:34'
          && momentDeDepot({}) === null
  verifier('G-TIME3 · cours et dépôt calculés juste, sans double conversion',
    ok, `— cours ${heureDeCours(reel)} · dépôt ${momentDeDepot(reel)}`)
}

// ── G-NOTIF · la soumission notifie par la surface serveur ───────────────
{
  const fiche = lire('src/pages/FichePreparation.jsx')
  const notifie = /await notifierPreparation\(/.test(fiche)
  const sansEcritureDirecte = !/app_state/.test(fiche) && !/pushNotification/.test(fiche)
  verifier('G-NOTIF · la soumission passe par la surface serveur',
    notifie && sansEcritureDirecte,
    `— appel:${notifie ? 'oui' : 'NON'} écriture directe:${sansEcritureDirecte ? 'aucune' : 'PRÉSENTE'}`)
}

// ── G-PUSH · un échec de Web Push ne fait pas disparaître la cloche ──────
//
// Deux pannes très différentes portaient le même message, et il était faux
// dans un cas sur deux.
{
  const notifs = lire('src/lib/notifications.js')
  const distingue = /etape === 'web-push'/.test(notifs) && /return null/.test(notifs)
  verifier('G-PUSH · un échec de push ne se dit pas « échec »',
    distingue, distingue ? '' : '— les deux pannes seraient confondues')
}

// ── G-FILE · une panne de notification ne rend rien invisible ────────────
//
// Même sans cloche, la direction doit retrouver toute préparation qui attend
// son action. C'est le filet sous la notification.
{
  const prep = lire('src/lib/preparations.js')
  const file = /export const A_CONTROLER = \[[^\]]*'deposee'[^\]]*'en_retard'[^\]]*\]/.test(prep)
  const utilisee = /A_CONTROLER/.test(directeur)
  verifier('G-FILE · la file « à contrôler » existe et est utilisée',
    file && utilisee,
    `— file:${file ? 'oui' : 'NON'} branchée:${utilisee ? 'oui' : 'NON'}`)
}

console.log(echecs === 0
  ? `\n  ${V}7 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

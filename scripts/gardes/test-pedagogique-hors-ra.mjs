// Garde sur une règle métier : LE PÉDAGOGIQUE NE PASSE PAS PAR LE COMPTE
// ADMINISTRATIF.
//
// L'interface du responsable administratif n'a que trois sessions — élèves,
// RH, comptabilité. Elle n'a aucun onglet pédagogique. Il recevait pourtant
// les notifications de dépôt de préparation, qui portent
// `tabTarget: 'pedagogie'` : le message ouvrait chez lui un onglet inexistant,
// et son téléphone sonnait pour chacun.
//
// Trois mécanismes cumulés le produisaient, et il fallait les trois :
//
//   1. `notifier_preparation` écrivait dans les DEUX boîtes ;
//   2. `pushNotification` recopiait d'office vers le RA toute notification
//      adressée au directeur, quel qu'en soit le sujet ;
//   3. le centre de notifications faisait lire `notifs_directeur` au RA en
//      plus de la sienne — si bien que fermer l'écriture n'aurait rien changé.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── PÉDAGOGIQUE · hors du compte administratif     [INV-METIER]${F}`)

// ── PA1 · aucune cible ajoutée d'office ──────────────────────────────────
{
  const src = lire('src/lib/notifications.js')
  verifier('PA1 la duplication aveugle a disparu',
    !/targets\.push\('responsable_administratif'\)/.test(src),
    'elle rattrapait tout ce qu’on ajoutait ailleurs')
  verifier('PA1 aucune cible n’est ajoutée implicitement',
    !/targets\.push\(/.test(src))

  // AUTO-TEST : le motif doit reconnaître la règle d'origine.
  const defaut = "if (targets.includes('directeur')) { targets.push('responsable_administratif') }"
  verifier('PA1 auto-test · la règle d’origine serait vue',
    /targets\.push\('responsable_administratif'\)/.test(defaut) === true)
}

// ── PA2 · qui doit être prévenu se lit à l'envoi ─────────────────────────
{
  const envois = [
    ['src/pages/SurveillantApp.jsx', 'discipline'],
    ['src/pages/DemandesEnseignant.jsx', 'RH'],
  ]
  const muets = envois.filter(([f]) =>
    !/pushNotification\(\['directeur', 'responsable_administratif'\]/.test(lire(f)))
  verifier('PA2 les envois administratifs nomment leurs deux destinataires',
    muets.length === 0, muets.length ? R + muets.map(m => m[1]).join(', ') + F : 'discipline · RH')

  // Aucun envoi ne doit adresser du PÉDAGOGIQUE au compte administratif.
  const ecrans = ['src/pages/ProfApp.jsx', 'src/pages/DirecteurApp.jsx',
                  'src/pages/PreparationIA.jsx', 'src/pages/FichePreparation.jsx']
  const fautifs = ecrans.filter(f => {
    const s = lire(f)
    return /pushNotification\([^)]*responsable_administratif[\s\S]{0,300}tabTarget: 'pedagogie'/.test(s)
  })
  verifier('PA2 aucun envoi pédagogique ne vise l’administratif',
    fautifs.length === 0, fautifs.length ? R + fautifs.join(', ') + F : '')
}

// ── PA3 · chacun lit sa propre boîte ─────────────────────────────────────
//
// LE point décisif. Fermer l'écriture sans fermer ce relais n'aurait rien
// changé : le RA aurait continué de tout voir par `notifs_directeur`.
{
  const src = lire('src/pages/NotificationCenter.jsx')
  verifier('PA3 le relais mutuel des boîtes est retiré',
    !/\['notifs_directeur', 'notifs_responsable_administratif'\]/.test(src),
    'fermer l’écriture seule n’aurait rien changé')
  verifier('PA3 les clés écoutées viennent du rôle du compte',
    /`notifs_\$\{activeRole\}`/.test(src))

  const defaut = "...(isDirector ? ['notifs_directeur', 'notifs_responsable_administratif'] : []),"
  verifier('PA3 auto-test · le relais d’origine serait vu',
    /\['notifs_directeur', 'notifs_responsable_administratif'\]/.test(defaut) === true)
}

// ── PA4 · l'écran administratif reste sans pédagogie ─────────────────────
{
  const src = lire('src/pages/DirecteurApp.jsx')
  const sessions = (src.match(/const activeSession = \[([^\]]*)\]/) || [])[1] || ''
  const liste = sessions.split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean)
  verifier('PA4 la branche administrative n’a que trois sessions',
    liste.length === 3 && !liste.some(x => /pedago|prepa|devoir|progress/i.test(x)),
    liste.join(' '))
}

// ── PA5 · la notification SQL ne vise plus que le directeur ──────────────
{
  const source = lire('sql/notification_preparations.sql')
  const deploi = lire('sql/notification_preparations_cibles.sql')

  const cibles = (source.match(/v_cles\s+text\[\]\s*:=\s*(.+);/) || [])[1] || ''
  verifier('PA5 la source ne cible que le directeur',
    cibles.trim() === "array['directeur']", cibles.trim())
  verifier('PA5 le fichier de déploiement porte la même cible',
    /v_cles\s+text\[\]\s*:=\s*array\['directeur'\];/.test(deploi))

  // Le corps déployé ne doit plus contenir le littéral.
  const d = deploi.indexOf('create or replace function')
  const f = deploi.indexOf('$function$;', d)
  const corps = d >= 0 ? deploi.slice(d, f) : ''
  verifier('PA5 le littéral a disparu du corps de la fonction',
    corps.length > 500 && !corps.includes("'responsable_administratif'"))

  // `v_cles` sert AUSSI le Web Push : le téléphone du RA cesse de sonner.
  verifier('PA5 le Web Push suit la même cible',
    /p_cibles\s*=>\s*v_cles/.test(corps),
    'sinon la cloche se tairait mais le téléphone sonnerait encore')

  // Le contrôle interne ne doit pas se déclencher sur un commentaire : dans
  // un LIKE, « _ » est un joker et « responsable administratif » écrit avec
  // une espace suffisait à le faire crier.
  verifier('PA5 le contrôle cherche littéralement, sans joker',
    /strpos\(p\.prosrc, \$q\$'responsable_administratif'\$q\$\)/.test(deploi)
    && !/prosrc like '%responsable_administratif%'/.test(deploi))

  const rb = lire('sql/notification_preparations_cibles_rollback.sql')
  verifier('PA5 un retour arrière est écrit, et il dit sa limite',
    rb.length > 200 && /NotificationCenter\.jsx/.test(rb),
    'le SQL seul ne rétablirait pas l’ancien comportement')
}

console.log(echecs === 0
  ? `\n  ${V}Pédagogique : hors du compte administratif${F}\n`
  : `\n  ${R}${echecs} écart(s)${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

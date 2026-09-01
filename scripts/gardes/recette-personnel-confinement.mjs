#!/usr/bin/env node
// ============================================================
// RECETTE POST-MIGRATION — confinement de la gestion du personnel
//
// Ne fait PARTIE DE AUCUNE suite ordinaire : elle ne peut être verte
// qu'après exécution de sql/personnel_confinement_direction.sql. Une
// garde rouge en permanence apprend à ignorer le rouge.
//
// NON DESTRUCTIVE : chaque appel porte un argument que la fonction
// refuse avant toute écriture. Aucun compte n'est créé ni désactivé.
// Aucun secret n'est lu, transmis ni journalisé.
//
//   node scripts/gardes/recette-personnel-confinement.mjs
// ============================================================
import { readFileSync } from 'node:fs'

const BASE = 'https://jircuneixzwsmtktxrkh.supabase.co/rest/v1/rpc'
const CLE = (readFileSync('public/inscription.html', 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/) || [])[1]

const appeler = async (nom, corps) => {
  const r = await fetch(`${BASE}/${nom}`, {
    method: 'POST',
    headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  let j = {}
  try { j = JSON.parse(await r.text()) || {} } catch { /* corps non JSON */ }
  return { status: r.status, code: j.code || '' }
}

// Arguments volontairement invalides : refusés par la validation d'entrée.
const SANS_ECRITURE = {
  enregistrer_utilisateur: { p_id: null, p_prenom: '', p_nom: '', p_role: 'professeur',
                             p_langue: null, p_fonction: null, p_code: '', p_plafond: null },
  desactiver_utilisateur: { p_id: '00000000-0000-0000-0000-000000000000' },
  authentifier_par_code: { p_code: '__aucun_code_reel__' },
}

const resultats = []
const controle = (id, libelle, ok, detail) => {
  resultats.push({ id, libelle, ok, detail })
  console.log(`  ${ok ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mÉCHEC\x1b[0m'} ${id}  ${libelle}${detail ? `\n         ${detail}` : ''}`)
}

console.log('\nRECETTE — confinement de la gestion du personnel\n')

// --- R1..R3 : anon refusé sur les trois surfaces --------------------
for (const nom of Object.keys(SANS_ECRITURE)) {
  const { status, code } = await appeler(nom, SANS_ECRITURE[nom])
  controle(`R-${nom}`, `${nom} refusé sans session`,
    code === '42501', `reçu ${status} ${code || '(aucun code)'} — attendu 42501`)
}

// --- R4 : témoin négatif — le capteur sait dire « atteint » ---------
// Sans lui, une panne réseau rendrait toute la recette faussement verte.
const temoin = await appeler('ideal_est', { p_roles: ['directeur'] })
controle('R-temoin', 'le capteur distingue encore ouvert de fermé',
  temoin.status === 200 && temoin.code !== '42501',
  `ideal_est répond ${temoin.status} ${temoin.code || ''} — doit rester atteignable`)

// --- R5 : aucun workflow gelé touché -------------------------------
const GELES = [
  'src/pages/FichePreparation.jsx', 'src/pages/DevoirsDocument.jsx',
  'src/pages/DocumentPrintStudio.jsx', 'src/pages/FichesCahiers.jsx',
  'src/lib/fichesCahiers.js', 'src/lib/devoirsSelection.js',
  'src/lib/coursAssocie.js', 'src/lib/etatPartage.js', 'src/App.jsx',
]
const { execSync } = await import('node:child_process')
const modifies = execSync('git status --porcelain', { encoding: 'utf8' })
  .split('\n').map(l => l.slice(3).trim()).filter(Boolean)
const touches = GELES.filter(f => modifies.includes(f))
controle('R-gel', 'aucun fichier de workflow gelé modifié',
  touches.length === 0, touches.length ? `touchés : ${touches.join(', ')}` : '')

// --- Le volet authentifié : hors de portée de ce script -------------
console.log(`
  ⚠ TROIS CONTRÔLES NE SONT PAS AUTOMATISABLES ICI — ils exigent une
    session réelle, et les codes d'accès ne quittent pas votre machine.

    Collez scripts/gardes/recette-personnel-session.js dans la console du
    navigateur, connecté tour à tour en enseignant, en responsable
    administratif, puis en directeur. Le script y lit le jeton déjà
    présent dans l'onglet et affiche le tableau des refus attendus.
`)

const echecs = resultats.filter(r => !r.ok)
console.log(echecs.length
  ? `\x1b[31m${echecs.length} contrôle(s) en échec.\x1b[0m\n`
  : `\x1b[32mVolet automatisable : ${resultats.length}/${resultats.length}.\x1b[0m Reste les trois contrôles de session ci-dessus.\n`)
process.exit(echecs.length ? 1 : 0)

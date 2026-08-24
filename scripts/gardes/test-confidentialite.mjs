// Gardes de propriété sur la confidentialité des données familiales.
//
// ── La règle qui les gouverne toutes ───────────────────────────────────────
//
//   MATRICULE ≠ SECRET ≠ PREUVE D'IDENTITÉ ≠ AUTORISATION D'ACCÈS
//
// Un matricule est imprimé sur la carte de l'élève, sur ses documents, dans le
// QR, et il reste lisible sur une carte perdue ou photographiée. Il IDENTIFIE
// un dossier. Il n'en AUTORISE jamais la consultation.
//
// Le même raisonnement vaut pour un nom, un prénom, une date de naissance :
// tout ce qui est observable identifie, et rien de ce qui est observable
// n'autorise.
//
// ── Ce que ces gardes empêchent de revenir ─────────────────────────────────
//
// `chercherEtPreremplir()` lisait l'inscription ENTIÈRE et le responsable
// ENTIER à partir d'un nom, avec la clé publiable — celle qui est dans le
// navigateur de tout visiteur. Elle se déclenchait sur le `blur` d'un champ.
// Connaître le prénom d'un enfant suffisait pour obtenir l'adresse du
// domicile, les deux téléphones, le WhatsApp, le courriel, la profession et
// l'employeur de ses parents.
//
// La première correction proposée remplaçait le nom par le matricule. Elle ne
// corrigeait rien : elle déplaçait la faille sur un identifiant lui aussi
// public. C'est ce piège que G2 et G3 ci-dessous surveillent.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(56)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const sansCommentaires = src => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter(l => !/^\s*(\/\/|--)/.test(l)).join('\n')

// Les pages servies sans authentification. Tout ce qu'elles savent faire,
// n'importe quel visiteur sait le faire.
const PAGES_PUBLIQUES = ['public/inscription.html', 'public/fiche.html']

// Les champs qui ne doivent jamais sortir d'une surface publique.
const CHAMPS_INTERDITS = [
  'tel1', 'tel2', 'whatsapp', 'email', 'profession', 'employeur',
  'situation_matrimoniale', 'allergies', 'conditions_medicales', 'traitement',
]

console.log(`\n${G}── CONFIDENTIALITÉ · l'observable identifie, il n'autorise pas ──${F}`)

// ── C1 · aucune page publique ne lit les responsables ──────────────────────
{
  const fautifs = []
  for (const f of PAGES_PUBLIQUES) {
    const src = sansCommentaires(lire(f))
    if (/from\(\s*['"]responsables['"]\s*\)|\/rest\/v1\/responsables/.test(src)) {
      fautifs.push(f.split('/').pop())
    }
  }
  verifier('C1 · aucune page publique ne lit `responsables`', fautifs.length === 0,
    fautifs.length ? `— ${fautifs.join(', ')}` : `— ${PAGES_PUBLIQUES.length} pages`)
}

// ── C2 · aucun pré-remplissage déclenché par un nom ────────────────────────
//
// Le motif exact de la régression : un écouteur qui part chercher un dossier
// dès qu'on quitte un champ d'identité.
{
  const src = sansCommentaires(lire('public/inscription.html'))
  const ecouteurNom = /addEventListener\(\s*['"]blur['"]\s*,\s*(chercherEtPreremplir|prefill|preremplir)/i.test(src)
  const rechercheParNom = /from\(\s*['"]inscriptions['"]\s*\)[\s\S]{0,220}?\.ilike\(\s*['"]nom['"]/.test(src)
  verifier('C2 · aucun pré-remplissage déclenché par un nom',
    !ecouteurNom && !rechercheParNom,
    ecouteurNom ? '— écouteur `blur` présent' : rechercheParNom ? '— recherche `.ilike(nom)`' : '')
}

// ── C3 · aucune fonction publique n'ouvre un dossier sur un identifiant seul ─
//
// Une fonction accordée à `anon` ne peut pas prendre un unique argument
// observable — matricule, nom — et rendre des données familiales.
{
  const sql = lire('sql/phase3_2_surfaces_publiques.sql')
  const accordees = [...sql.matchAll(/grant execute on function public\.([a-z_]+)\(([^)]*)\)\s+to\s+([^;]+);/g)]
    .filter(m => /\banon\b/.test(m[3]))
    .map(m => ({ nom: m[1], args: m[2].split(',').filter(Boolean).length }))
  // Une fonction publique à un seul argument est suspecte par construction :
  // cet argument est forcément observable.
  const unSeulArgument = accordees.filter(f => f.args === 1)
  const rendChampsInterdits = CHAMPS_INTERDITS.filter(c =>
    new RegExp(`returns table[^;]*\\b${c}\\b`, 'i').test(sql) ||
    new RegExp(`'${c}'\\s*,`, 'i').test(sql))
  verifier('C3 · aucune fonction publique ne rend de donnée familiale',
    rendChampsInterdits.length === 0,
    rendChampsInterdits.length ? `— ${rendChampsInterdits.join(', ')}` : `— ${accordees.length} fonction(s) à anon`)
  // Toute fonction accordée à `anon` doit être indispensable à un workflow
  // public réel. `compteurs_inscriptions` ne l'était pas : elle affichait les
  // effectifs de l'école sur une page de vitrine.
  const superflues = accordees.map(f => f.nom)
    .filter(n => n !== 'verifier_carte_scolaire')
  verifier('C9 · la surface publique se limite à la vérification de carte',
    superflues.length === 0,
    superflues.length ? `— aussi exposée(s) : ${superflues.join(', ')}` : '')
  verifier('C4 · la vérification exige matricule ET nom',
    unSeulArgument.every(f => f.nom !== 'verifier_carte_scolaire')
      && /verifier_carte_scolaire\(text,\s*text\)/.test(sql),
    unSeulArgument.length ? `— à un argument : ${unSeulArgument.map(f => f.nom).join(', ')}` : '')
}

// ── C5 · les fonctions retirées ne peuvent pas revenir par le fichier ──────
{
  const sql = lire('sql/phase3_2_surfaces_publiques.sql')
  const recreees = ['prefill_reinscription', 'verifier_doublon_inscription']
    .filter(f => new RegExp(`create (or replace )?function public\\.${f}`).test(sql))
  verifier('C5 · les fonctions jugées dangereuses ne sont pas recréées',
    recreees.length === 0, recreees.length ? `— ${recreees.join(', ')}` : '')
}

// ── C6 · le QR porte matricule ET nom ──────────────────────────────────────
//
// Ce ne sont pas deux facteurs d'authentification : les deux sont imprimés sur
// la même carte, et qui tient la carte tient les deux. Ils empêchent seulement
// l'énumération de matricules séquentiels.
//
// Les matricules sont séquentiels. Un QR qui ne porterait que le matricule
// laisserait extraire le nom et la classe de tous les élèves de l'école.
{
  const fautifs = []
  for (const f of ['src/pages/CartesScolaires.jsx', 'public/inscription.html']) {
    const src = sansCommentaires(lire(f))
    for (const ligne of src.split('\n')) {
      if (!/fiche\.html\?matricule=/.test(ligne)) continue
      // Le lien peut se poursuivre sur la ligne suivante : on regarde la
      // fenêtre autour plutôt que la ligne seule.
      const i = src.indexOf(ligne)
      const fenetre = src.slice(i, i + 320)
      if (!/[&?]nom=/.test(fenetre)) fautifs.push(`${f.split('/').pop()} : ${ligne.trim().slice(0, 44)}`)
    }
  }
  verifier('C6 · tout lien de vérification porte matricule ET nom',
    fautifs.length === 0, fautifs.length ? `\n      ${fautifs.join('\n      ')}` : '')
}

// ── C7 · le formulaire public peut toujours déposer un dossier ─────────────
//
// La confidentialité ne doit pas avoir supprimé la raison d'être de la page.
{
  const src = sansCommentaires(lire('public/inscription.html'))
  // La soumission passe deja par une fonction serveur — `creer_inscription`,
  // en une seule transaction. C'est ce qui permettra de fermer la table en
  // ecriture a `anon` sans supprimer la raison d'etre de la page.
  const peutDeposer = /rpc\(\s*['"]creer_inscription['"]/.test(src)
    || /from\(\s*['"]inscriptions['"]\s*\)[\s\S]{0,160}?\.insert\(/.test(src)
  verifier('C7 · le formulaire public peut toujours déposer un dossier',
    peutDeposer, peutDeposer ? '' : '— plus aucune voie de soumission')
}

// ── C8 · aucun écran ne masque côté client ce que le serveur a livré ───────
//
// Rendre une ligne complète puis n'en afficher qu'une partie n'est pas de la
// sécurité : c'est de la présentation. La donnée est déjà partie.
{
  const fautifs = []
  for (const f of PAGES_PUBLIQUES) {
    const src = sansCommentaires(lire(f))
    if (/\.select\(\s*['"]\*['"]\s*\)/.test(src) &&
        /from\(\s*['"](responsables|inscriptions|eleves|users)['"]\s*\)/.test(src)) {
      fautifs.push(f.split('/').pop())
    }
  }
  verifier('C8 · aucune page publique ne fait `select(*)` sur une table sensible',
    fautifs.length === 0, fautifs.length ? `— ${fautifs.join(', ')}` : '')
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

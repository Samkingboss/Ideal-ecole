// Gardes sur la caisse du Responsable administratif.
//
// Ces gardes ne portent pas sur du code hypothétique : chaque défaut qu'elles
// surveillent a été REPRODUIT dans le navigateur, contre la vraie base, avant
// d'être corrigé.

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
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')

const compta = lire('public/comptabilite.html')
const code = sansCommentaires(compta)
const bloc = (nom) => (code.match(new RegExp(`(async )?function ${nom}\\s*\\([\\s\\S]*?\\n\\}`)) || [''])[0]

console.log(`\n${G}── CAISSE · le reçu ne sort pas avant la preuve   [INV-FIN]${F}`)

// ── Q1 · aucune donnée financière supprimée au chargement ─────────────────
//
// Mesuré : `autoLoad` filtrait `studentsData` sur une SOUS-CHAÎNE du nom
// (« TEST », « OGAKANE »…) et réécrivait l'état nettoyé en base. Un élève et
// son règlement de 200 000 F ont disparu de Supabase au simple rechargement.
// Une famille TESTA ou BATTESTINI aurait été effacée avec tout son historique.
{
  const chargement = bloc('autoLoad')
  const filtreDestructeur = /studentsData\s*=\s*studentsData\.filter/.test(chargement)
  const parLeNom = /(nom|prenom|full)[^\n]{0,80}\.includes\(/.test(chargement)
  verifier('Q1 · aucun élève supprimé au chargement',
    chargement.length > 0 && !filtreDestructeur && !parLeNom,
    chargement.length === 0 ? '— autoLoad introuvable'
      : (filtreDestructeur || parLeNom ? '— SUPPRESSION SILENCIEUSE' : ''))
}

// ── Q2 · le reçu ne sort qu'après confirmation du serveur ─────────────────
//
// Mesuré : `submitPayment` rendait la main en 32 ms — reçu imprimé, WhatsApp
// proposé au parent — alors que la base ne voyait le paiement qu'à 2 827 ms.
// Serveur en refus (403 · 42501) : l'écran affichait 350 000 encaissés, la
// base en avait 200 000, et rien ne le disait.
{
  const p = bloc('submitPayment')
  const attend = /await\s+enregistrerMaintenant\(\)/.test(p)
  const iRetour = p.indexOf('enregistrerMaintenant')
  const iRecu = Math.min(...['printReceipt', 'waSendImage'].map(m => {
    const i = p.indexOf(m); return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }))
  const recuApres = attend && iRecu > iRetour
  const refusDit = /if\s*\(!r\.ok\)[\s\S]{0,600}alert\(/.test(p)
  verifier('Q2 · le reçu ne sort qu’après confirmation du serveur',
    attend && recuApres && refusDit,
    `— attente:${attend ? 'oui' : 'NON'} reçu après:${recuApres ? 'oui' : 'NON'} refus dit:${refusDit ? 'oui' : 'NON'}`)
}

// ── Q3 · un refus défait le paiement en mémoire ──────────────────────────
//
// Sans cela, l'écran continuerait d'afficher de l'argent que la caisse n'a
// pas reçu, et le total encaissé de la journée serait faux.
{
  const p = bloc('submitPayment')
  const defait = /s\.paye\s*-=\s*amt/.test(p) && /s\.history\.pop\(\)/.test(p)
                && /ecritures\.length\s*=\s*ecrituresAvant/.test(p)
  verifier('Q3 · un refus serveur défait le paiement en mémoire',
    defait, defait ? '' : '— l’écran garderait un encaissement fantôme')
}

// ── Q4 · un seul encaissement à la fois ──────────────────────────────────
{
  const p = bloc('submitPayment')
  const verrou = /_encaissementEnCours/.test(p) && /if\s*\(_encaissementEnCours\)\s*return/.test(p)
  const libere = (p.match(/_encaissementEnCours\s*=\s*false/g) || []).length >= 1
  verifier('Q4 · double clic impossible sur l’encaissement',
    verrou && libere,
    `— verrou:${verrou ? 'oui' : 'NON'} libéré:${libere ? 'oui' : 'NON'}`)
}

// ── Q5 · tout paiement porte son auteur et son instant ───────────────────
//
// QUI a encaissé était sans réponse : l'objet écrit était
// { amount, mode, motif, date, receiptId }. `date` est une chaîne française
// non triable — elle reste pour le reçu, `le` porte l'instant réel.
{
  const p = bloc('submitPayment')
  const objet = (p.match(/const __payment = \{[\s\S]*?\};/) || [''])[0]
  const auteur = /par:\s*moi\?\.id/.test(objet) && /par_nom:/.test(objet)
  const instant = /le:\s*d\.toISOString\(\)/.test(objet)
  verifier('Q5 · chaque paiement porte son auteur et son instant',
    auteur && instant,
    `— auteur:${auteur ? 'oui' : 'NON'} instant ISO:${instant ? 'oui' : 'NON'}`)
}

// ── Q6 · un numéro de reçu n'est jamais réémis ───────────────────────────
//
// Il venait de `history.length + 1` : supprimer un paiement faisait réémettre
// un numéro déjà remis à une famille. Deux reçus, un seul numéro.
{
  const p = bloc('submitPayment')
  const surLaLongueur = /receiptId\s*=[^\n]*history\.length/.test(p)
  const surLeRangMax = /rangMax/.test(p) && /rangMax \+ 1/.test(p)
  verifier('Q6 · un numéro de reçu n’est jamais réémis',
    !surLaLongueur && surLeRangMax,
    `— sur la longueur:${surLaLongueur ? 'OUI' : 'non'} sur le rang max:${surLeRangMax ? 'oui' : 'NON'}`)
}

// ── Q7 · l'écriture immédiate rend son résultat ──────────────────────────
{
  const e = bloc('enregistrerMaintenant')
  const litLErreur = /const \{ error \} = await/.test(e)
  // Le chemin d'ERREUR lui-même doit rendre l'échec. Un premier motif se
  // contentait de voir `return { ok: false` quelque part dans la fonction —
  // le `catch` réseau suffisait à le satisfaire, et remplacer le retour
  // d'erreur par un `console.error` ne le faisait pas rougir.
  const rendLeResultat = /if\s*\(error\)\s*return \{ ok: false/.test(e)
                      && /return \{ ok: true \}/.test(e)
  const annuleLeDifferé = /clearTimeout\(_supaDebounce\)/.test(e)
  verifier('Q7 · l’écriture immédiate rend un résultat exploitable',
    e.length > 0 && litLErreur && rendLeResultat && annuleLeDifferé,
    `— lit l’erreur:${litLErreur ? 'oui' : 'NON'} rend:${rendLeResultat ? 'oui' : 'NON'}`
    + ` annule le différé:${annuleLeDifferé ? 'oui' : 'NON'}`)
}

// ── Q8 · le reçu nomme celui qui a encaissé ──────────────────────────────
//
// Relevé des 18 champs du reçu : aucun ne portait l'encaisseur. Une famille
// revenant contester un versement n'avait personne à citer, la direction non
// plus. L'année scolaire manquait également.
{
  const gabarit = /id="r-encaisseur"/.test(compta) && /id="r-annee"/.test(compta)
  const pr = bloc('printReceipt')
  const rempli = /setT\('r-encaisseur'/.test(pr) && /setT\('r-annee'/.test(pr)
  // On ne fabrique pas un encaisseur pour les règlements antérieurs au suivi.
  // Le motif est ancré sur l'AFFECTATION : une première version cherchait
  // `h.par_nom ?` n'importe où dans la fonction, et un encaisseur codé en dur
  // suivi d'un `h.par_nom` inutilisé la satisfaisait encore.
  const pasInvente = /const encaisseur\s*=\s*h\.par_nom\s*\n?\s*\?/.test(pr)
  verifier('Q8 · le reçu nomme l’encaisseur et son année',
    gabarit && rempli && pasInvente,
    `— gabarit:${gabarit ? 'oui' : 'NON'} rempli:${rempli ? 'oui' : 'NON'}`
    + ` sans invention:${pasInvente ? 'oui' : 'NON'}`)
}

// ── Q9 · aucun document officiel ne comble un vide par une invention ─────
//
// La carte scolaire retombait sur « SAMAKÉ Mamadou », né le 15/04/2018,
// groupe sanguin « O+ », téléphone « +223 76 45 89 12 ». Une carte imprimée
// pour un enfant dont la donnée manque portait donc un groupe sanguin FAUX —
// celui qu'on lit en urgence — et le numéro de quelqu'un d'autre.
{
  const inventions = [
    ['groupe sanguin', /groupe_sanguin\s*\|\|\s*['"]\s*[ABO]{1,2}[+-]/],
    ['téléphone',      /(tel1|telephone_parent)[^\n]{0,40}\|\|\s*['"]\+?\d{2,}/],
    ['date de naissance', /date_naissance\s*\|\|\s*['"]\d{2}\/\d{2}\/\d{4}/],
    ['nom',            /\bnom\s*\|\|\s*['"][A-ZÀ-Ü]{3,}['"]/],
    ['matricule',      /matricule\s*\|\|\s*['"]\d{2}-\d{2} [A-Z]\d+/],
  ].filter(([, re]) => re.test(code)).map(([q]) => q)
  verifier('Q9 · aucune donnée personnelle inventée sur un document',
    inventions.length === 0,
    inventions.length ? `— inventés: ${inventions.join(', ')}` : '')
}

console.log(echecs === 0
  ? `\n  ${V}9 garde(s) au vert, aucune en échec.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

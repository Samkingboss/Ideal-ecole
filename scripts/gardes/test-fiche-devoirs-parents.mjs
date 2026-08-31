// Gardes : la fiche de devoirs et l'information aux parents.
//
// Quatre ajustements, et surtout ce qu'ils ne doivent pas emporter :
//
//   · un seul logo sur la page de garde — l'en-tête du moteur le porte déjà ;
//   · la fiche ne s'appelle plus « cahier » : elle se COLLE dans le cahier ;
//   · l'action « informer les parents » cesse d'être un bouton perdu ;
//   · « toute la classe » ouvre les messages UN PAR UN, sans contourner le
//     blocage des fenêtres, et sans jamais mêler deux familles.
//
// Nettoyage des commentaires ligne à ligne : un effacement global de
// `{/* … */}` avait déjà avalé du code et fait conclure « absent » à une garde
// qui n'examinait plus rien.
import { readFileSync, existsSync } from 'node:fs'
import { titreDocumentDevoirs } from '../../src/lib/devoirsSelection.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const sansCommentaires = src => src.split('\n')
  .filter(l => !/^\s*(\/\/|\*|\{\/\*|\/\*)/.test(l))
  .map(l => l.replace(/\{\/\*.*?\*\/\}/g, ' ').replace(/\/\*.*?\*\//g, ' '))
  .join('\n')

const doc = lire('src/pages/DevoirsDocument.jsx')
const code = sansCommentaires(doc)
const studio = sansCommentaires(lire('src/pages/DocumentPrintStudio.jsx'))

console.log(`\n${G}── FICHE DEVOIRS · logo, titre, parents   [INV-UI]${F}`)

// ── L1 · un seul logo sur la feuille ─────────────────────────────────────
{
  const dansLaFiche = (code.match(/logo-ideal\.png/g) || []).length
  const dansLeMoteur = (studio.match(/logo-ideal\.png/g) || []).length
  verifier('L1 · le logo n’est plus qu’à un endroit de la feuille',
    dansLaFiche === 0 && dansLeMoteur === 1,
    `— page de garde:${dansLaFiche} en-tête du moteur:${dansLeMoteur}`)
}

// ── T1 · la fiche ne s'appelle plus « cahier » ───────────────────────────
{
  const reste = /[Cc]ahier de devoirs|CAHIER DE DEVOIRS/.test(code)
  const nouveau = /titreDocumentDevoirs/.test(code)
  const fichier = /nomFichier="Devoirs_de_maison"/.test(code)
  verifier('T1 · plus aucun « cahier de devoirs » visible sur la fiche',
    !reste && nouveau && fichier,
    `— reste:${reste ? 'OUI' : 'non'} titre calculé:${nouveau ? 'oui' : 'NON'} fichier:${fichier ? 'oui' : 'NON'}`)
}

// ── T2 · « du jour » n'est écrit que si les données le disent ────────────
{
  const d = r => ({ date_rendu: r })
  const cas = [
    [[d('2026-11-02')], 'DEVOIRS DE MAISON DU JOUR'],
    [[d('2026-11-02'), d('2026-11-02')], 'DEVOIRS DE MAISON DU JOUR'],
    [[d('2026-11-02'), d('2026-11-05')], 'DEVOIRS DE MAISON'],
    [[d('2026-11-02'), d(null)], 'DEVOIRS DE MAISON'],
    [[d(null)], 'DEVOIRS DE MAISON'],
    [[], 'DEVOIRS DE MAISON'],
  ]
  const faux = cas.filter(([v, attendu]) => titreDocumentDevoirs(v) !== attendu)
  verifier('T2 · « du jour » seulement si une seule échéance, partout',
    faux.length === 0, faux.length ? `— ${faux.map(c => titreDocumentDevoirs(c[0])).join(', ')}` : '— 6 cas')
}

// ── P1 · l'action parents est un vrai bloc, pas un bouton perdu ──────────
{
  const entete = /📲 Informer les parents<\/div>/.test(code)
  const encadre = /border: '2px solid #16a34a'/.test(code)
  const compte = /message\{destinataires\.length > 1 \? 's' : ''\} personnalisé/.test(code)
  verifier('P1 · un bloc d’action encadré, titré, avec son compte',
    entete && encadre && compte,
    `— titre:${entete ? 'oui' : 'NON'} cadre:${encadre ? 'oui' : 'NON'} compte:${compte ? 'oui' : 'NON'}`)
}

// ── P2 · « Toute la classe » existe et ouvre la file ─────────────────────
{
  const bouton = /Toute la classe — préparer les \{destinataires\.length\} messages/.test(code)
  const lance = /onClick=\{\(\) => setFileParents\(0\)\}/.test(code)
  verifier('P2 · « Toute la classe » prépare la file', bouton && lance)
}

// ── P3 · un message à la fois, sans contourner le navigateur ─────────────
//
// Ouvrir vingt onglets d'un coup est bloqué par tous les navigateurs. On ne
// cherche pas à passer outre : chaque message s'ouvre par un CLIC, sur un
// vrai lien — jamais un `window.open` programmé.
{
  // Chercher `window.open` cherchait aussi la PHRASE qui explique qu'on ne
  // l'utilise pas : le nettoyage ligne à ligne ne retire pas les lignes de
  // continuation d'un commentaire JSX. On cherche un APPEL — donc une
  // parenthèse — pas une mention.
  const pasDOuvertureProgrammee = !/window\.open\s*\(/.test(code)
  const vraiLien = /<a href=\{lienWhatsAppEcole\(messagePour\(destinataires\[fileParents\]\)\)\}/.test(code)
  const avance = /onClick=\{\(\) => setFileParents\(fileParents \+ 1\)\}/.test(code)
  const progression = /Message \{fileParents \+ 1\} sur \{destinataires\.length\}/.test(code)
  verifier('P3 · un vrai lien par message, progression affichée',
    pasDOuvertureProgrammee && vraiLien && avance && progression,
    `— window.open:${pasDOuvertureProgrammee ? 'aucun' : 'PRÉSENT'} lien:${vraiLien ? 'oui' : 'NON'}`
    + ` avance:${avance ? 'oui' : 'NON'} progression:${progression ? 'oui' : 'NON'}`)
}

// ── P4 · les envois individuels restent ──────────────────────────────────
{
  const liste = /destinataires\.map\(e => <a key=\{e\.id\} href=\{lienWhatsAppEcole\(messagePour\(e\)\)\}/.test(code)
  const acces = /un enfant en particulier/.test(doc)
  verifier('P4 · le choix d’un enfant en particulier reste possible',
    liste && acces, `— liste:${liste ? 'oui' : 'NON'} accès:${acces ? 'oui' : 'NON'}`)
}

// ── C1 · un message par enfant, jamais un message collectif ──────────────
{
  // Chaque lien est construit pour UN destinataire : `messagePour(e)` ou
  // `messagePour(destinataires[fileParents])`. Aucun ne reçoit la liste.
  const liens = [...code.matchAll(/lienWhatsAppEcole\(([^)]*\))\)/g)].map(m => m[1])
  const collectif = liens.filter(l => !/^messagePour\((e|destinataires\[fileParents\])\)$/.test(l))
  verifier('C1 · chaque lien ne porte qu’un seul enfant',
    liens.length >= 2 && collectif.length === 0,
    collectif.length ? `— ${collectif.join(', ')}` : `— ${liens.length} liens, tous individuels`)
}

// ── C2 · aucun numéro de parent dans un lien ─────────────────────────────
//
// `lienWhatsAppEcole` fige le numéro de l'école. Le variant qui accepte un
// numéro quelconque — `lienWhatsApp` — n'a rien à faire ici : il exposerait
// le numéro d'une famille dans un lien que l'enseignante voit.
{
  const seulementLEcole = !/lienWhatsApp\(/.test(code) && /lienWhatsAppEcole\(/.test(code)
  const pasDeTelephone = !/telephone|whatsapp1|tel1|responsable/i.test(
    (code.match(/const messagePour = e => texteWhatsApp\(\{[\s\S]*?\}\)/) || [''])[0])
  verifier('C2 · les messages passent par le compte de l’école, sans numéro parent',
    seulementLEcole && pasDeTelephone,
    `— école seule:${seulementLEcole ? 'oui' : 'NON'} sans numéro:${pasDeTelephone ? 'oui' : 'NON'}`)
}

// ── GEL · ce que cette mission ne devait pas toucher ─────────────────────
{
  const pagination = /page=\{feuilles\[p\]\.page\} total=\{feuilles\[p\]\.total\}/.test(studio)
  const note = /NOTE<\/div>/.test(code) && /APPRÉCIATION DE L’ENSEIGNANT/.test(code)
  const pieces = /<Bloc key=\{'f'[^>]*sautAvant/.test(code)
  const sansPageVide = !/<Bloc key=\{'d'/.test(code)
  const pdf = /import\('pdfjs-dist'\)/.test(lire('src/lib/pdfEnImages.js'))
  const pied = /Visa du parent/.test(code) && /Devoir donné par/.test(code)
  verifier('GEL · pagination, note, fiches, pied et moteur PDF intacts',
    pagination && note && pieces && sansPageVide && pdf && pied,
    `— pagination:${pagination ? 'oui' : 'NON'} note:${note ? 'oui' : 'NON'} fiches:${pieces ? 'oui' : 'NON'}`
    + ` pied:${pied ? 'oui' : 'NON'} pdfjs:${pdf ? 'oui' : 'NON'}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

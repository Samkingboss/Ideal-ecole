// ════════════════════════════════════════════════════════════════════════
// LE PARCOURS DE CRÉATION D'UN DOSSIER ÉLÈVE DOIT RESTER ATTEIGNABLE.
//
// Le 02/09/2026 à 21h34, la carte « Inscriptions & Dossiers » a cessé de
// mener à `/inscription.html` pour ouvrir le module de validation. Ce
// module ne sait que traiter des dossiers EXISTANTS : plus rien, dans
// toute l'application, ne permettait d'en créer un.
//
// Le formulaire fonctionnait toujours. Il était seulement devenu
// introuvable — et rien ne rougissait, parce qu'aucune garde ne surveillait
// l'existence d'un CHEMIN.
//
// C'est le défaut le plus coûteux du dépôt à ce jour : personne ne pouvait
// plus inscrire un enfant, et rien ne le disait.
// ════════════════════════════════════════════════════════════════════════
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lire = (f) => readFileSync(f, 'utf8')
let echecs = 0
const test = (nom, fn) => { try { fn(); console.log(`✓ ${nom}`) } catch (e) { echecs++; console.log(`✗ ${nom} — ${e.message}`) } }

// Dépouillement ligne par ligne — jamais une passe globale : ce fichier
// PARLE de `/inscription.html` dans ses commentaires.
const sansCommentairesJSX = (texte) => texte
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\{?\/\*)/.test(l))
  .join('\n')

const directeur = sansCommentairesJSX(lire('src/pages/DirecteurApp.jsx'))

test('P1 · l’application offre un chemin vers le formulaire d’inscription', () => {
  const liens = [...directeur.matchAll(/href="\/inscription\.html"/g)]
  assert.ok(liens.length >= 1,
    'AUCUN lien vers /inscription.html : plus personne ne peut créer un dossier élève')
})

test('P2 · ce chemin est une vraie carte, pas une mention perdue', () => {
  // Le lien doit envelopper un bloc cliquable portant un libellé lisible.
  const i = directeur.indexOf('href="/inscription.html"')
  const carte = directeur.slice(i, i + 700)
  assert.match(carte, /cursor: ?'pointer'/, 'le lien n’est pas présenté comme cliquable')
  assert.match(carte, /Nouvelle inscription|Inscriptions/, 'la carte ne porte aucun libellé reconnaissable')
  assert.match(carte, /<\/a>/, 'le lien n’est pas refermé autour d’un bloc')
})

test('P3 · le formulaire existe et sait déposer un dossier', () => {
  const page = sansCommentairesJSX(lire('public/inscription.html'))
  assert.match(page, /\.rpc\(\s*['"][a-z0-9_]*creer_inscription[a-z0-9_]*['"]/,
    'la page d’inscription n’a plus de voie de dépôt vers le serveur')
  // Les huit étapes du dossier.
  assert.match(page, /el-classe-demandee/, 'le champ « classe demandée » a disparu du formulaire')
})

test('P4 · le module de validation ne se substitue pas à la création', () => {
  // Les deux existent, et ils sont distincts : l'un crée, l'autre valide.
  assert.match(directeur, /href="\/administration\/inscriptions"/,
    'le module de suivi des dossiers a disparu')
  const validation = sansCommentairesJSX(lire('src/pages/InscriptionsValidation.jsx'))
  assert.doesNotMatch(validation, /creer_inscription/,
    'le module de validation créerait des dossiers : les deux gestes doivent rester séparés')
})

console.log(echecs === 0
  ? `\n✅ test-parcours-inscription : le chemin de création est atteignable.`
  : `\n❌ test-parcours-inscription : ${echecs} contrôle(s) en échec.`)
process.exit(echecs ? 1 : 0)

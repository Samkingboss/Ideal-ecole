// Gardes : la fiche de leçon du jour.
//
// Titre, date en toutes lettres, typographie selon la langue de la leçon, et
// la zone rouge « ce que l'enfant doit retenir » — dont le contenu ne peut pas
// être inventé.
//
// ── Le gel des devoirs ───────────────────────────────────────────────────
//
// Le module DEVOIRS DE MAISON est validé et gelé. Ces gardes vérifient donc
// aussi qu'aucun fil ne relie la fiche de leçon au cahier de devoirs : ni
// import, ni style partagé. C'est ce qui rend le gel démontrable plutôt que
// promis.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dateJourEnLettres, langueDeLecon, essentielARetenir, genererFichesCahiers }
  from '../../src/lib/fichesCahiers.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
// Ligne à ligne : un effacement global de `{/* … */}` avait déjà avalé du code
// et fait conclure « absent » à une garde qui n'examinait plus rien.
const sansCommentaires = src => src.split('\n')
  .filter(l => !/^\s*(\/\/|\*|\{\/\*|\/\*)/.test(l))
  .map(l => l.replace(/\{\/\*.*?\*\/\}/g, ' ').replace(/\/\*.*?\*\//g, ' '))
  .join('\n')
const ecran = lire('src/pages/FichesCahiers.jsx')

console.log(`\n${G}── FICHE DE LEÇON DU JOUR   [INV-UI, INV-CONT]${F}`)

// ── Le registre réel des manuels, lu sur le disque ───────────────────────
//
// `src/lib/programmes/index.js` charge vingt-deux fichiers et n'est lisible
// que par le bundler. On lit donc les fichiers eux-mêmes : c'est la même
// donnée, et la garde ne dépend d'aucune liste recopiée à la main.
const MANUELS = readdirSync('src/lib/programmes')
  .filter(f => f.endsWith('.js') && f !== 'index.js')
  .flatMap(f => {
    const src = lire(`src/lib/programmes/${f}`)
    return [...src.matchAll(/groupe:\s*'([^']+)',\s*\n\s*matiere:\s*'([^']+)',\s*\n\s*langue:\s*'(fr|en)'/g)]
      .map(m => ({ groupe: m[1], matiere: m[2], langue: m[3], fichier: f }))
  })

verifier('D0 · le registre des manuels est lu sur le disque',
  MANUELS.length >= 15 && MANUELS.some(m => m.langue === 'fr') && MANUELS.some(m => m.langue === 'en'),
  `— ${MANUELS.length} manuels · ${MANUELS.filter(m => m.langue === 'fr').length} fr / ${MANUELS.filter(m => m.langue === 'en').length} en`)

// ── L1/L3 · la langue vient d'une donnée déclarée, pas d'un nom deviné ───
{
  const fr = MANUELS.find(m => m.langue === 'fr')
  const en = MANUELS.find(m => m.langue === 'en')
  const okFr = langueDeLecon(fr.groupe, fr.matiere, MANUELS) === 'fr'
  const okEn = langueDeLecon(en.groupe, en.matiere, MANUELS) === 'en'
  const inconnue = langueDeLecon('CP1', 'Matière sans manuel', MANUELS) === null
  verifier('L1/L3 · la langue se lit sur le manuel de la matière',
    okFr && okEn && inconnue,
    `— ${fr.matiere}/${fr.groupe}:fr · ${en.matiere}/${en.groupe}:en · inconnue:null`)
}

// ── L2 · maternelle : la même règle, pas une exception ───────────────────
{
  const fiche = (classe, matiere) => genererFichesCahiers({
    preparation: { status: 'validee', matiere, date_cours: '2026-10-26', contenu: {} },
    eleves: [{ id: '1', prenom: 'Awa', nom: 'DIALLO', actif: true }],
    classeNom: classe, groupe: classe, manuels: MANUELS,
  })[0]
  const fr = MANUELS.find(m => m.langue === 'fr')
  const mat = fiche('Grande Section', fr.matiere)
  verifier('L2 · maternelle suit la même règle de langue',
    mat.template === 'maternelle' && mat.langue === 'fr', `— ${mat.template} / ${mat.langue}`)
}

// ── §1 · le titre, le MÊME au primaire et en maternelle ──────────────────
//
// Deux noms pour un même document rendaient la pile illisible à la maison
// quand deux enfants d'une famille n'ont pas le même niveau. La lecture se
// fait hors commentaires : le fichier explique l'ancien libellé, il ne le
// porte plus.
{
  const code = sansCommentaires(ecran)
  const inconditionnel = /<h2>FICHE DE LEÇON DU JOUR<\/h2>/.test(code)
  const anciens = ['FICHE D’APPRENTISSAGE', 'MA JOURNÉE D’APPRENTISSAGE'].filter(t => code.includes(t))
  verifier('T1 · « FICHE DE LEÇON DU JOUR », sans distinction de niveau',
    inconditionnel && anciens.length === 0,
    `— inconditionnel:${inconditionnel ? 'oui' : 'NON'}`
    + (anciens.length ? ` · reste ${anciens.join(', ')}` : ' · aucun ancien libellé'))
}

// ── §2 · la date en toutes lettres ───────────────────────────────────────
{
  const cas = [
    ['2026-10-26', 'lundi 26 octobre 2026'],
    ['2026-08-25', 'mardi 25 août 2026'],
    ['2026-01-01', 'jeudi 1 janvier 2026'],
  ]
  const faux = cas.filter(([iso, attendu]) => dateJourEnLettres(iso) !== attendu)
  const vide = dateJourEnLettres('') === '' && dateJourEnLettres(null) === ''
  // Le piège du fuseau : `new Date('2026-08-25')` est le 24 août à l'ouest de
  // Greenwich. La fiche daterait la leçon de la veille.
  const sansFuseau = !/new Date\(\s*(iso|texte\(iso\))/.test(lire('src/lib/fichesCahiers.js'))
  verifier('T2 · date en toutes lettres, sans dérive de fuseau',
    faux.length === 0 && vide && sansFuseau,
    faux.length ? `— ${faux.map(c => dateJourEnLettres(c[0])).join(', ')}` : `— ${dateJourEnLettres('2026-10-26')}`)

  const affichee = /\{fiche\.dateLisible \|\| fiche\.date\}/.test(ecran)
  verifier('T3 · l’écran affiche la date lisible, pas l’ISO', affichee)
}

// ── §4 · la zone rouge, et son contenu non inventé ───────────────────────
{
  // E1 ne vérifiait que la PRÉSENCE du balisage. Une campagne de mutation a
  // montré qu'il suffisait d'écrire `{false && <section …>}` pour rendre la
  // zone morte sans que rien ne rougisse. On exige donc que la section soit
  // conditionnée à la donnée elle-même.
  const zone = /\{fiche\.essentiel && <section className="fiche-cahier__essentiel">/.test(ecran)
  const titre = /Ce que l’enfant doit retenir/.test(ecran)
  const rouge = /\.fiche-cahier__essentiel\{[^}]*#dc2626/.test(ecran)
    && /\.fiche-cahier__essentiel h3\{color:#b91c1c\}/.test(ecran)
  verifier('E1 · la zone essentielle existe et est en rouge',
    zone && titre && rouge, `— zone:${zone ? 'oui' : 'NON'} titre:${titre ? 'oui' : 'NON'} rouge:${rouge ? 'oui' : 'NON'}`)
}

{
  // La source : l'étape « Clôture », dont l'aide du formulaire dit
  // « Ce qu'on retient ». À défaut, l'objectif de la notion.
  const depuisCloture = essentielARetenir({
    sequences: [{ etapes: { decouverte: { texte: 'On observe' }, cloture: { texte: 'Je retiens que 2 + 3 = 5.' } } }],
    objectif: 'Additionner jusqu’à 10',
  })
  const repli = essentielARetenir({ sequences: [{ etapes: { cloture: { texte: '' } } }], objectif: 'Reconnaître la lettre i' })
  const rien = essentielARetenir({})
  verifier('E2 · l’essentiel vient de la clôture, sinon de l’objectif',
    depuisCloture === 'Je retiens que 2 + 3 = 5.' && repli === 'Reconnaître la lettre i' && rien === '',
    `— « ${depuisCloture} » · repli « ${repli} » · vide « ${rien} »`)
}

// ── L6/L7 · rien n'est inventé ───────────────────────────────────────────
//
// Le texte affiché doit se retrouver MOT POUR MOT dans la préparation. Une
// phrase fabriquée — même bien tournée — ne passerait pas.
{
  const contenu = {
    objectif: 'Additionner jusqu’à 10',
    sequences: [{ etapes: { cloture: { texte: 'Je retiens que 2 + 3 = 5.' }, pratique: { texte: 'Ardoises' } } }],
    trace: 'Recopier trois additions.',
  }
  const f = genererFichesCahiers({
    preparation: { status: 'validee', matiere: 'Maths', date_cours: '2026-10-26', contenu },
    eleves: [{ id: '1', prenom: 'Awa', nom: 'DIALLO', actif: true }],
    classeNom: 'CP1', groupe: 'CP1', manuels: MANUELS,
  })[0]
  const source = JSON.stringify(contenu)
  const issuDeLaSource = f.essentiel !== '' && source.includes(f.essentiel)
  // Et le cas qui compte vraiment : une préparation SANS clôture ni objectif.
  // La zone doit rester vide. Une campagne de mutation a montré que sans ce
  // cas, une phrase fabriquée passait ici inaperçue — elle ne se déclenchait
  // que sur une source vide, que ce contrôle n'exerçait pas.
  const nu = genererFichesCahiers({
    preparation: { status: 'validee', matiere: 'Maths', date_cours: '2026-10-26', contenu: {} },
    eleves: [{ id: '1', prenom: 'Awa', nom: 'DIALLO', actif: true }],
    classeNom: 'CP1', groupe: 'CP1', manuels: MANUELS,
  })[0]
  verifier('L6/L7 · l’essentiel se retrouve mot pour mot dans la préparation',
    issuDeLaSource && nu.essentiel === '',
    `— « ${f.essentiel} » · source vide → « ${nu.essentiel} »`)

  // Et il n'est pas répété : la clôture quitte la liste des activités.
  const pasDeDoublon = !f.activites.includes('Je retiens que 2 + 3 = 5.')
  verifier('E3 · la clôture n’est plus répétée dans les activités',
    pasDeDoublon, `— activités : ${JSON.stringify(f.activites)}`)
}

// ── L4/L5 · matière et identité de l'élève ───────────────────────────────
{
  const f = genererFichesCahiers({
    preparation: { status: 'validee', matiere: 'Lecture', date_cours: '2026-10-26', contenu: {} },
    eleves: [{ id: '7', prenom: 'Moussa', nom: 'TRAORÉ', actif: true }],
    classeNom: 'CP1', groupe: 'CP1', manuels: MANUELS,
  })[0]
  verifier('L4/L5 · matière et nom de l’élève conservés',
    f.matiere === 'Lecture' && f.prenom === 'Moussa' && f.nom === 'TRAORÉ',
    `— ${f.matiere} · ${f.prenom} ${f.nom}`)
}

// ── §3 · la typographie suit la langue, et elle seule ────────────────────
{
  const classePosee = /fiche-cahier--\$\{langue\}/.test(ecran)
  const regleFr = /\.fiche-cahier--fr\{font-family:var\(--police-lecon-fr/.test(ecran)
  const regleEn = /\.fiche-cahier--en\{font-family:'DM Sans'/.test(ecran)
  // L'anglais ne doit jamais recevoir la variable française.
  const enPropre = !/\.fiche-cahier--en\{[^}]*--police-lecon-fr/.test(ecran)
  verifier('L3b · une règle par langue, l’anglais n’hérite pas du français',
    classePosee && regleFr && regleEn && enPropre,
    `— classe:${classePosee ? 'oui' : 'NON'} fr:${regleFr ? 'oui' : 'NON'} en:${regleEn ? 'oui' : 'NON'}`)
}

// ── L10 à L13 · le gel des devoirs, démontré ─────────────────────────────
{
  const fichiersDevoirs = ['src/pages/DevoirsDocument.jsx', 'src/pages/DocumentPrintStudio.jsx',
                           'src/lib/devoirs.js', 'src/lib/devoirsSelection.js', 'src/lib/pdfEnImages.js']
  // Aucun fichier de devoirs ne connaît la leçon du jour.
  const contamines = fichiersDevoirs.filter(f =>
    /fichesCahiers|FichesCahiers|police-lecon|fiche-cahier/.test(lire(f)))
  // Et la leçon du jour n'emprunte rien aux devoirs.
  const emprunts = ['DocumentPrintStudio', 'DevoirsDocument', 'lib/devoirs', 'devoirsSelection', 'pdfEnImages']
    .filter(m => new RegExp(`from '[^']*${m}`).test(ecran) || new RegExp(`from '[^']*${m}`).test(lire('src/lib/fichesCahiers.js')))
  verifier('L10 · aucun fil entre la leçon du jour et les devoirs',
    contamines.length === 0 && emprunts.length === 0,
    contamines.length ? `— ${contamines.join(', ')}` : emprunts.length ? `— emprunte ${emprunts.join(', ')}` : '— 5 fichiers gelés vérifiés')
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

// Gardes de propriété sur le comportement réseau du client.
//
// ── Ce que ces gardes protègent ─────────────────────────────────────────────
//
// Mesure du 24 août 2026, compte directeur, connexion rapide, serveur local :
//
//   shell visible                 158 ms
//   requêtes REST au démarrage     62   (dont StrictMode double en dev : ~31 réelles)
//   dernière réponse           11 707 ms
//   requête la plus lente        8 074 ms   (`eleves` avec jointure `classes`)
//   vagues séquentielles            2       (41 requêtes, puis 21)
//
// Douze secondes sur une connexion rapide. Sur le réseau que le personnel
// utilise réellement, le facteur suffit à expliquer les trois minutes
// observées par le promoteur.
//
// La cause n'est pas un serveur lent, c'est l'application qui se bloque
// elle-même : un navigateur ouvre six connexions par origine. La cloche de
// notifications sondait toutes les six secondes SANS vérifier si le sondage
// précédent était revenu. Sur réseau lent, les sondages prennent les six
// places, et les données de la page font la queue derrière eux.

import { readFileSync, existsSync } from 'node:fs'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(54)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}
const lire = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')

console.log(`\n${G}── RÉSEAU CLIENT · l'application ne se bloque pas elle-même ──${F}`)

// ── N1 · aucun sondage périodique sans garde de recouvrement ───────────────
//
// La propriété qui compte : un fichier qui interroge le serveur en boucle doit
// savoir refuser de partir quand le précédent n'est pas revenu.
{
  const fautifs = []
  for (const f of ['src/pages/NotificationCenter.jsx', 'src/lib/notifications.js',
                   'src/pages/DirecteurApp.jsx', 'src/pages/ProfApp.jsx',
                   'src/pages/ConseillerApp.jsx', 'src/pages/SurveillantApp.jsx']) {
    const src = lire(f)
    if (!src) continue
    // Deux façons de sonder en boucle : `setInterval`, ou un `setTimeout` que
    // l'on réarme soi-même. La seconde échappait au motif précédent, si bien
    // que le fichier n'était jamais examiné — la garde passait au vert sans
    // rien avoir regardé. C'est exactement ce qu'une garde ne doit pas faire.
    const sonde = /setInterval\s*\(/.test(src)
      || /\bprogrammer\s*\(\s*\)/.test(src)
      || /CADENCE_(MIN|MAX)/.test(src)
    if (!sonde) continue
    // La garde doit être un REFUS EFFECTIF, pas une variable qui existe :
    // « if (enVol.current) return » et non « enVol.current = true » quelque
    // part dans le fichier. Une garde qui se contente de trouver le mot ne
    // détecte pas son retrait.
    const refuseEffectif =
      /if\s*\(\s*(enVol|inflight|enCours|dejaEnCours)\.current\s*\)\s*return/.test(src)
    if (!refuseEffectif) fautifs.push(f.split('/').pop())
  }
  verifier('N1 · tout sondage refuse de se recouvrir', fautifs.length === 0,
    fautifs.length ? `— ${fautifs.join(', ')}` : '')
}

// ── N2 · la cadence s'allonge quand le réseau peine ────────────────────────
{
  const src = lire('src/pages/NotificationCenter.jsx')
  const plancher = /CADENCE_MIN\s*=\s*(\d+)/.exec(src)
  const plafond = /CADENCE_MAX\s*=\s*(\d+)/.exec(src)
  const adapte = /cadence\.current\s*\*\s*2|Math\.min\(\s*CADENCE_MAX/.test(src)
  verifier('N2 · la cadence recule quand le réseau peine',
    !!plancher && !!plafond && adapte && Number(plafond[1]) > Number(plancher[1]),
    plancher && plafond ? `— ${plancher[1]} ms → ${plafond[1]} ms` : '— bornes absentes')
}

// ── N3 · rien ne part quand l'application est en arrière-plan ──────────────
//
// Le forfait de données est payé par l'enseignant. Un téléphone rangé dans une
// poche ne doit rien demander.
{
  const src = lire('src/pages/NotificationCenter.jsx')
  verifier('N3 · aucun sondage écran éteint',
    /visibilityState\s*!==\s*'visible'|visibilityState\s*===\s*'visible'/.test(src))
}

// ── N4 · le Service Worker n'attend pas le réseau sans limite ──────────────
//
// Stratégie « réseau d'abord » sans délai maximal : sur une connexion qui ne
// répond pas, chaque fichier de l'application attend le temps d'attente par
// défaut du navigateur avant de se rabattre sur le cache. Le cache existe et
// ne sert pas.
{
  const sw = lire('public/sw.js')
  const reseauDabord = /fetch\(req\)/.test(sw)
  // La limite doit être ARMÉE, pas seulement mentionnée : une course entre la
  // requête et un délai, et ce délai effectivement passé à un `setTimeout`.
  const constante = /const\s+DELAI_RESEAU\s*=\s*\d+/.exec(sw)
  const course = /Promise\.race\s*\(\s*\[/.test(sw)
  // `[^)]*` ne franchit pas la parenthese de `r(null)` : on accepte tout
  // caractere jusqu'a la constante.
  const delaiArme = /setTimeout\([\s\S]{0,80}?DELAI_RESEAU\s*\)/.test(sw)
  const avecLimite = !!constante && course && delaiArme
  // Le cache d'abord doit reposer sur un PRÉDICAT d'empreinte réellement
  // appliqué à la requête, pas sur le mot « assets » dans un commentaire.
  const predicat = /aUneEmpreinte\s*=\s*\(?url\)?\s*=>/.test(sw)
  const applique = /if\s*\(\s*aUneEmpreinte\(url\)\s*\)/.test(sw)
  const servi = /caches\.match\(req\)\.then\(\s*\(hit\)\s*=>\s*hit\s*\|\|/.test(sw)
  const immuableEnCache = predicat && applique && servi
  verifier('N4 · le Service Worker borne son attente réseau',
    !reseauDabord || avecLimite,
    reseauDabord && !avecLimite
      ? `— réseau d'abord SANS limite armée (constante:${!!constante} course:${course} délai:${delaiArme})`
      : (constante ? `— borné à ${constante[1] || ''}${/(\d+)/.exec(constante[0])[1]} ms` : ''))
  verifier('N5 · les fichiers versionnés sont servis depuis le cache',
    immuableEnCache,
    immuableEnCache ? '' : `— prédicat:${predicat} appliqué:${applique} servi:${servi}`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

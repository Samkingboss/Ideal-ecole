// Gardes : deux écritures simultanées sur une même liste partagée.
//
// ── Ce qui est mesuré ────────────────────────────────────────────────────
//
// Une fausse base reproduit fidèlement `app_state` : clé primaire (app, key),
// et surtout la sémantique qui compte — un `update` filtré sur `updated_at`
// ne touche AUCUNE ligne si l'horodatage a changé.
//
// La collision est déclenchée par un point d'arrêt, jamais par une minuterie :
// `avantEcriture` s'exécute exactement entre la lecture et l'écriture de
// l'appelant testé. Le scénario est donc reproductible à l'identique, sans
// dépendre du réseau ni de la vitesse de la machine.
//
// ── Le témoin qui compte ─────────────────────────────────────────────────
//
// G1 rejoue l'ANCIEN motif — lire, puis réécrire la liste entière — sur cette
// même collision, et EXIGE qu'il perde une notification. Sans ce témoin, tous
// les autres verts ne prouveraient rien : ils pourraient venir d'un scénario
// où aucune collision n'a lieu.
import { modifierListePartagee, tamponSuivant } from '../../src/lib/etatPartage.js'

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}

// ── La fausse base ───────────────────────────────────────────────────────
function faireBase({ avantEcriture = null, masquerRetour = false, erreurLecture = null } = {}) {
  const lignes = new Map()          // 'app|key' -> { app, key, value, updated_at }
  const cle = (a, k) => `${a}|${k}`
  let crochet = avantEcriture

  const declencher = async () => {
    if (!crochet) return
    const c = crochet; crochet = null      // une seule fois, sinon récursion
    await c()
  }

  const client = {
    from() {
      let filtres = {}
      const b = {
        select() {
          return {
            eq(col, val) { filtres[col] = val; return this },
            async maybeSingle() {
              if (erreurLecture) return { data: null, error: erreurLecture }
              const l = lignes.get(cle(filtres.app, filtres.key))
              return { data: l ? { ...l } : null, error: null }
            },
          }
        },
        async insert(row) {
          await declencher()
          if (lignes.has(cle(row.app, row.key))) {
            return { error: { code: '23505', message: 'duplicate key value' } }
          }
          lignes.set(cle(row.app, row.key), { ...row })
          return { error: null }
        },
        update(patch) {
          const attendu = {}
          const u = {
            eq(col, val) { if (col === 'updated_at') attendu.updated_at = val; else filtres[col] = val; return this },
            is(col, val) { if (col === 'updated_at') attendu.updated_at = val; return this },
            async select() {
              await declencher()
              const l = lignes.get(cle(filtres.app, filtres.key))
              const concorde = l && (attendu.updated_at == null
                ? l.updated_at == null
                : l.updated_at === attendu.updated_at)
              if (!concorde) return { data: [], error: null }
              lignes.set(cle(filtres.app, filtres.key), { ...l, ...patch })
              // `masquerRetour` imite une politique de lecture qui cache la
              // ligne renvoyée : l'écriture a lieu, mais rien n'est retourné.
              return { data: masquerRetour ? [] : [{ key: l.key }], error: null }
            },
          }
          return u
        },
        // L'ANCIEN motif, gardé ici uniquement pour servir de témoin.
        async upsert(row) {
          await declencher()
          lignes.set(cle(row.app, row.key), { ...row })
          return { error: null }
        },
      }
      return b
    },
  }
  return { client, lignes, poser: f => { crochet = f } }
}

// Écriture concurrente « à l'ancienne » : lire, ajouter, réécrire tout.
const ecrireAlAncienne = async (client, app, k, notif) => {
  const { data } = await client.from('app_state').select('value, updated_at')
    .eq('app', app).eq('key', k).maybeSingle()
  const liste = Array.isArray(data?.value) ? data.value : []
  await client.from('app_state').upsert({
    app, key: k, value: [notif, ...liste], updated_at: tamponSuivant(data?.updated_at),
  }, { onConflict: 'app,key' })
}

const APP = 'notifications', CLE = 'notifs_directeur'
const contenu = base => (base.lignes.get(`${APP}|${CLE}`)?.value || []).map(n => n.id)

console.log(`\n${G}── ÉTAT PARTAGÉ · deux écritures simultanées   [INV-FLUX, INV-CONT]${F}`)

// ── G1 · TÉMOIN : l'ancien motif perd bien une écriture ──────────────────
{
  const base = faireBase()
  base.lignes.set(`${APP}|${CLE}`, { app: APP, key: CLE, value: [], updated_at: '2026-08-30T08:00:00.000Z' })
  // B écrit entre la lecture et l'écriture de A.
  base.poser(async () => { await ecrireAlAncienne(base.client, APP, CLE, { id: 'B' }) })
  await ecrireAlAncienne(base.client, APP, CLE, { id: 'A' })
  const restants = contenu(base)
  verifier('G1 · témoin : l’ancien motif perd une notification',
    restants.length === 1 && restants[0] === 'A', `— reste ${JSON.stringify(restants)}`)
}

// ── G2 · la primitive conserve les DEUX écritures ────────────────────────
{
  const base = faireBase()
  base.lignes.set(`${APP}|${CLE}`, { app: APP, key: CLE, value: [], updated_at: '2026-08-30T08:00:00.000Z' })
  base.poser(async () => { await ecrireAlAncienne(base.client, APP, CLE, { id: 'B' }) })
  const r = await modifierListePartagee({
    app: APP, cle: CLE, client: base.client,
    transformer: liste => [{ id: 'A' }, ...liste],
  })
  const restants = contenu(base)
  verifier('G2 · écriture conditionnelle : les deux survivent',
    r.ok && restants.length === 2 && restants.includes('A') && restants.includes('B'),
    `— ${JSON.stringify(restants)} en ${r.essais} tentative(s)`)
}

// ── G3 · la transformation est REJOUÉE sur la liste fraîche ──────────────
//
// Rejouer sur la liste périmée redonnerait le bug sous un autre nom.
{
  const base = faireBase()
  base.lignes.set(`${APP}|${CLE}`, { app: APP, key: CLE, value: [{ id: 'ancien' }], updated_at: '2026-08-30T08:00:00.000Z' })
  base.poser(async () => { await ecrireAlAncienne(base.client, APP, CLE, { id: 'B' }) })
  let vues = []
  await modifierListePartagee({
    app: APP, cle: CLE, client: base.client,
    transformer: liste => { vues.push(liste.map(n => n.id)); return [{ id: 'A' }, ...liste] },
  })
  verifier('G3 · la transformation rejoue sur la liste à jour',
    vues.length === 2 && vues[1].includes('B'), `— tentatives vues ${JSON.stringify(vues)}`)
}

// ── G4 · première écriture : la ligne est créée ──────────────────────────
{
  const base = faireBase()
  const r = await modifierListePartagee({
    app: APP, cle: CLE, client: base.client, transformer: l => [{ id: 'A' }, ...l],
  })
  verifier('G4 · ligne absente : elle est créée', r.ok && contenu(base).join() === 'A')
}

// ── G5 · course à la création : personne n'est perdu ─────────────────────
{
  const base = faireBase()
  base.poser(async () => { await ecrireAlAncienne(base.client, APP, CLE, { id: 'B' }) })
  const r = await modifierListePartagee({
    app: APP, cle: CLE, client: base.client, transformer: l => [{ id: 'A' }, ...l],
  })
  const restants = contenu(base)
  verifier('G5 · course à la création : les deux survivent',
    r.ok && restants.includes('A') && restants.includes('B'), `— ${JSON.stringify(restants)}`)
}

// ── G6 · collision permanente : échec DIT, pas silencieux ────────────────
{
  const base = faireBase()
  base.lignes.set(`${APP}|${CLE}`, { app: APP, key: CLE, value: [], updated_at: '2026-08-30T08:00:00.000Z' })
  // Un adversaire qui réécrit avant CHAQUE tentative.
  const sansCesse = async () => {
    await ecrireAlAncienne(base.client, APP, CLE, { id: 'B' + Math.random() })
    base.poser(sansCesse)
  }
  base.poser(sansCesse)
  const r = await modifierListePartagee({
    app: APP, cle: CLE, client: base.client, tentatives: 3,
    transformer: l => [{ id: 'A' }, ...l],
  })
  verifier('G6 · collision permanente : échec annoncé, pas avalé',
    r.ok === false && r.raison === 'concurrence' && r.essais === 3 && !!r.message,
    `— ${r.raison} après ${r.essais}`)
}

// ── G7 · lecture masquée : on n'écrit pas deux fois ──────────────────────
//
// Si la politique de lecture cache la ligne renvoyée, « zéro ligne touchée »
// ne veut pas dire « quelqu'un est passé avant ». Confondre les deux ferait
// rejouer l'ajout autant de fois qu'il y a de tentatives.
{
  const base = faireBase({ masquerRetour: true })
  base.lignes.set(`${APP}|${CLE}`, { app: APP, key: CLE, value: [], updated_at: '2026-08-30T08:00:00.000Z' })
  const r = await modifierListePartagee({
    app: APP, cle: CLE, client: base.client, transformer: l => [{ id: 'A' }, ...l],
  })
  verifier('G7 · retour masqué : succès reconnu, aucun doublon',
    r.ok && contenu(base).join() === 'A', `— ${JSON.stringify(contenu(base))}`)
}

// ── G8 · une lecture en erreur n'est jamais prise pour une liste vide ────
{
  const base = faireBase({ erreurLecture: { message: 'JWT expired', code: 'PGRST301' } })
  base.lignes.set(`${APP}|${CLE}`, { app: APP, key: CLE, value: [{ id: 'déjà là' }], updated_at: '2026-08-30T08:00:00.000Z' })
  const r = await modifierListePartagee({
    app: APP, cle: CLE, client: base.client, transformer: () => [{ id: 'A' }],
  })
  verifier('G8 · lecture refusée : refus remonté, rien d’écrasé',
    r.ok === false && r.raison === 'lecture' && contenu(base).join() === 'déjà là',
    `— ${r.raison} · ${JSON.stringify(contenu(base))}`)
}

// ── G9 · aucun client : on ne devine pas, on lève ────────────────────────
{
  let leve = false
  try { await modifierListePartagee({ app: APP, cle: CLE, transformer: l => l }) }
  catch { leve = true }
  verifier('G9 · client manquant : erreur immédiate', leve)
}

// ═══════════════════════════════════════════════════════════════════════
// Le motif fautif ne doit pas revenir
// ═══════════════════════════════════════════════════════════════════════
//
// Corriger les six sites ne sert à rien si le septième réintroduit le motif
// la semaine suivante. Ces gardes tiennent la ligne sur le dépôt.
const { readFileSync, existsSync, readdirSync } = await import('node:fs')
const lireF = f => (existsSync(f) ? readFileSync(f, 'utf8') : '')
const fichiersSrc = (d = 'src') => readdirSync(d, { withFileTypes: true }).flatMap(
  e => e.isDirectory() ? fichiersSrc(`${d}/${e.name}`)
    : /\.(jsx?|mjs)$/.test(e.name) ? [`${d}/${e.name}`] : [])

// Lire la valeur puis la réécrire : c'est exactement la fenêtre par laquelle
// une écriture concurrente se perd.
const motifAveugle = (src) => {
  const fautes = []
  const lignes = src.split('\n')
  for (let i = 0; i < lignes.length; i++) {
    if (!/from\(\s*'app_state'\s*\)/.test(lignes[i])) continue
    const fenetre = lignes.slice(i, i + 20).join('\n')
    if (/\.select\(/.test(fenetre) && /from\(\s*'app_state'\s*\)[\s\S]{0,200}?\.upsert\(/.test(fenetre)) {
      fautes.push(i + 1)
    }
  }
  return fautes
}

{
  const coupables = []
  for (const f of fichiersSrc()) {
    if (f === 'src/lib/etatPartage.js') continue     // l'écrivain sanctionné
    const l = motifAveugle(lireF(f))
    if (l.length) coupables.push(`${f}:${l.join(',')}`)
  }
  verifier('S1 · plus aucun « lire puis réécrire » dans src/',
    coupables.length === 0, coupables.length ? `— ${coupables.join(' · ')}` : '')
}

// Auto-test du détecteur : sur un extrait qui PORTE le motif, il doit le voir.
// Sans cela, S1 pourrait être vert parce qu'il ne cherche rien.
{
  const extraitFautif = `
    const { data } = await supabase.from('app_state').select('value')
      .eq('app', 'rh').eq('key', 'x').maybeSingle()
    const liste = data?.value || []
    await supabase.from('app_state').upsert({ app: 'rh', key: 'x', value: [n, ...liste] })
  `
  verifier('S2 · le détecteur de S1 sait voir le motif',
    motifAveugle(extraitFautif).length === 1, `— ${motifAveugle(extraitFautif).length} détection(s)`)
}

// Les écrans qui portaient une perte prouvée passent bien par la primitive.
{
  const attendus = [
    ['src/lib/notifications.js', 'la boîte de notifications'],
    ['src/pages/DemandesEnseignant.jsx', 'le dépôt d’une demande RH'],
    ['src/pages/DirecteurApp.jsx', 'la réponse de la direction'],
    ['src/pages/CuisiniereApp.jsx', 'la fiche de marché'],
  ]
  const muets = attendus.filter(([f]) => !/modifier(Liste|Etat)Partage/.test(lireF(f)))
  verifier('S3 · les écrans à perte prouvée passent par la primitive',
    muets.length === 0, muets.length ? `— ${muets.map(m => m[1]).join(', ')}` : `— ${attendus.length} écrans`)
}

console.log(echecs === 0
  ? `\n  ${V}toutes les gardes au vert.${F}\n`
  : `\n  ${R}${echecs} garde(s) en échec.${F}\n`)
process.exit(echecs === 0 ? 0 : 1)

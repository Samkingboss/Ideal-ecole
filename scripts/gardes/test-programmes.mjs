// Gardes de propriété sur les programmes pédagogiques.
//
// Elles ne comptent rien d'arbitraire : elles vérifient des propriétés qui
// doivent rester vraies quel que soit le nombre de manuels.
//
// P4 est née d'une régression réelle. `SommaireBoscherDocument.jsx` recopiait
// dans son JSX un sommaire qui existait déjà dans `lecture-cp2.js`. Les deux
// copies ont divergé : dix-huit titres s'écartaient, et les quatorze morceaux
// choisis avaient perdu leurs attributions d'auteur — Perrault, Daudet,
// Andersen — dans la seule version que l'enseignant avait en main.
//
// Les programmes sont des données réelles de catégorie B. Un document qui les
// recopie au lieu de les lire finira au même endroit.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOSSIER = 'src/lib/programmes'
const PAGES   = 'src/pages'

let echecs = 0
const verifier = (nom, ok, detail = '') => {
  const vert = '\x1b[0;32m', rouge = '\x1b[0;31m', fin = '\x1b[0m'
  console.log(`  ${nom.padEnd(52)} ${ok ? vert + '✓' : rouge + '✗'}${fin}${detail ? ' ' + detail : ''}`)
  if (!ok) echecs++
}

// ── Chargement ───────────────────────────────────────────────────────────────
// On importe chaque fichier de manuel directement : `index.js` emploie des
// imports sans extension, que Vite résout et que Node refuse.

const fichiers = readdirSync(DOSSIER)
  .filter(f => f.endsWith('.js') && f !== 'index.js' && f !== 'maternelle.js')

const manuels = []
for (const f of fichiers) {
  const mod = await import('../../' + join(DOSSIER, f))
  for (const v of [mod.default, ...Object.values(mod)]) {
    if (v && typeof v === 'object' && v.cle && !manuels.some(m => m.cle === v.cle)) manuels.push(v)
  }
}

const leconsDe = m => (m.unites ? m.unites.flatMap(u => u.lecons || []) : (m.lecons || []))

console.log('\n\x1b[0;90m── PROGRAMMES · une donnée, une source   [INV-CONT-02] ──\x1b[0m')

// P1 · identité complète
{
  const nus = manuels.filter(m => !m.cle || !m.groupe || !m.matiere || !m.titre)
  verifier('P1 · chaque manuel déclare son identité', nus.length === 0,
    nus.length ? `— incomplets : ${nus.map(m => m.cle || '?').join(', ')}` : `— ${manuels.length} manuels`)
}

// P2 · aucune clé en double : `manuelParCle` doit être déterministe
{
  const vues = new Map()
  manuels.forEach(m => vues.set(m.cle, (vues.get(m.cle) || 0) + 1))
  const doubles = [...vues].filter(([, n]) => n > 1).map(([c]) => c)
  verifier('P2 · aucune clé de manuel en double', doubles.length === 0,
    doubles.length ? `— ${doubles.join(', ')}` : '')
}

// P3 · toute leçon est citable : une page et un titre
{
  const boiteuses = []
  manuels.forEach(m => leconsDe(m).forEach(l => {
    if (l.page === undefined || l.page === null || !String(l.titre || '').trim()) {
      boiteuses.push(`${m.cle}#${l.numero ?? '?'}`)
    }
  }))
  const total = manuels.reduce((n, m) => n + leconsDe(m).length, 0)
  verifier('P3 · toute leçon porte une page et un titre', boiteuses.length === 0,
    boiteuses.length ? `— ${boiteuses.slice(0, 5).join(', ')}` : `— ${total} leçons`)
}

// P4 · aucun écran ne recopie un sommaire
//
// Le motif recherché est celui de la régression : des couples page + titre
// écrits en dur, dans un fichier qui ne lit pas `lib/programmes`. Le seuil de
// trois évite de confondre avec une mention isolée dans un commentaire.
{
  const coupables = []
  for (const f of readdirSync(PAGES).filter(f => f.endsWith('.jsx'))) {
    const src = readFileSync(join(PAGES, f), 'utf8')
    if (/from ['"][^'"]*lib\/programmes/.test(src)) continue
    const enDur = (src.match(/['"]?(?:Page|page)\s+\d+['"]?\s*[,:]\s*['"]/g) || []).length
                + (src.match(/\{\s*p:\s*['"]Page \d+['"]/g) || []).length
    if (enDur >= 3) coupables.push(`${f} (${enDur})`)
  }
  verifier('P4 · aucun écran ne recopie un sommaire de manuel', coupables.length === 0,
    coupables.length ? `— ${coupables.join(', ')}` : '')
}

// P5 · le sommaire imprimé lit bien les données
{
  const src = readFileSync(join(PAGES, 'SommaireManuelDocument.jsx'), 'utf8')
  verifier('P5 · le sommaire imprimé lit `lib/programmes`',
    /from ['"]\.\.\/lib\/programmes['"]/.test(src))
}

console.log(echecs === 0
  ? `\n  \x1b[0;32m5 garde(s) au vert, aucune en échec.\x1b[0m\n`
  : `\n  \x1b[0;31m${echecs} garde(s) en échec.\x1b[0m\n`)
process.exit(echecs === 0 ? 0 : 1)

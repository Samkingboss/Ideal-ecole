// Compte les écritures directes dans `app_state`, chaînes multi-lignes
// comprises.
//
// La mesure précédente était `grep "from('app_state')" | grep -E 'insert|upsert'`
// sur une seule ligne : elle en voyait 13 sur 17. Une écriture dont le
// `.upsert(` tombait à la ligne suivante lui était invisible — et il suffisait
// d'un retour à la ligne pour passer sous le cliquet sans le déclencher.
//
// Sortie : le nombre seul, ou le détail avec --detail.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fichiers = []
const parcourir = d => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') parcourir(p) }
    else if (/\.(jsx?|html)$/.test(e)) fichiers.push(p)
  }
}
for (const racine of ['src', 'public']) parcourir(racine)

export const ecrituresAppState = () => {
  const trouvees = []
  for (const f of fichiers) {
    const lignes = readFileSync(f, 'utf8').split('\n')
    lignes.forEach((l, i) => {
      if (!/from\(\s*['"]app_state['"]\s*\)/.test(l)) return
      // La méthode peut tomber jusqu'à trois lignes plus bas dans une chaîne
      // formatée. Au-delà, ce n'est plus la même expression.
      const fenetre = lignes.slice(i, i + 4).join(' ')
      const m = fenetre.match(/\.(upsert|insert|update|delete)\s*\(/)
      if (!m) return
      const app = (fenetre.match(/app:\s*['"]([^'"]+)['"]/)
                || fenetre.match(/app:\s*([A-Za-z_]+)/) || [])[1] || '(non précisé)'
      const cle = (fenetre.match(/key:\s*[`'"]([^`'"$]*)/) || [])[1] || '(dynamique)'
      trouvees.push({ fichier: f, ligne: i + 1, methode: m[1], app, cle })
    })
  }
  return trouvees
}

if (process.argv[1] && process.argv[1].endsWith('compter-ecritures-app-state.mjs')) {
  const t = ecrituresAppState()
  if (process.argv.includes('--detail')) {
    for (const e of t) console.log(
      `${e.fichier}:${e.ligne}\t${e.methode}\tapp=${e.app}\tkey=${e.cle}`)
  } else console.log(t.length)
}

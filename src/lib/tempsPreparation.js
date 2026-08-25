// Le temps d'une préparation — formatage pur, sans dépendance.
//
// Séparé de `preparations.js` parce que celui-ci importe Supabase : une garde
// qui vérifie un calcul d'heure n'a pas à monter un client de base de données.
//
// Le fuseau est nommé, jamais supposé. Un décalage codé en dur se tromperait
// le jour où l'on ouvrirait ailleurs, et surtout il ne dirait pas ce qu'il
// représente. Une seule déclaration dans tout le dépôt : `preparations.js`
// l'importe d'ici.
export const FUSEAU_ECOLE = 'Africa/Bamako'

// ── Le temps d'une préparation ─────────────────────────────────────────────
//
// Deux notions que rien ne doit confondre :
//
//   HEURE DU COURS    `date_cours` + `heure_cours` — quand la leçon a lieu.
//                     Une heure de planning, sans fuseau : « 15:30 » veut
//                     dire quinze heures trente à l'école, un point.
//
//   HEURE DE DÉPÔT    `heure_depot` — quand l'enseignante a soumis. Un
//                     instant absolu, horodaté avec fuseau par la base.
//
// L'écran Direction n'affichait que la première, sous le libellé « Cours du
// … à 15:30 ». Une préparation déposée à 17:34 semblait donc porter une heure
// fausse — alors que les deux valeurs étaient justes, et parlaient de deux
// choses différentes.
//
// Vérifié sur le cas réel : `heure_cours = 15:30:00` et
// `heure_depot = 2026-08-25T17:34:41+00:00`. Aucune des deux n'était erronée.

const DEUX = n => String(n).padStart(2, '0')

/** « 24/08/2026 », depuis une date nue `AAAA-MM-JJ`. Aucune conversion : une
 *  date de planning n'a pas de fuseau, et la reparser en local la décalerait
 *  d'un jour selon le navigateur. */
export const dateDeCours = (prep) => {
  const m = String(prep?.date_cours || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

/** « 15:30 », depuis `heure_cours`. Une heure de planning : on la tronque,
 *  on ne la convertit pas. */
export const heureDeCours = (prep) => {
  const m = String(prep?.heure_cours || '').match(/^(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : null
}

/** L'instant du dépôt, rendu à l'heure de l'école. Celui-là EST un instant
 *  absolu : il se convertit, explicitement, vers le fuseau de l'école — et
 *  non vers celui du navigateur, qui varierait d'un appareil à l'autre. */
export const momentDeDepot = (prep) => {
  const brut = prep?.heure_depot
  if (!brut) return null
  const d = new Date(brut)
  if (Number.isNaN(d.getTime())) return null
  try {
    const f = new Intl.DateTimeFormat('fr-FR', {
      timeZone: FUSEAU_ECOLE, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)
    const v = t => f.find(x => x.type === t)?.value
    return `${v('day')}/${v('month')}/${v('year')} à ${v('hour')}:${v('minute')}`
  } catch {
    // Un environnement sans base de fuseaux : on rend l'UTC en le disant,
    // plutôt qu'une heure locale muette dont personne ne saurait l'origine.
    return `${DEUX(d.getUTCDate())}/${DEUX(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
         + ` à ${DEUX(d.getUTCHours())}:${DEUX(d.getUTCMinutes())} UTC`
  }
}

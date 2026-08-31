// Rattacher un devoir à un cours réellement préparé.
//
// ── Ce qui existe déjà, et qu'on ne duplique pas ──────────────────────────
//
// Une préparation porte `user_id`, `groupe`, `matiere`, `date_cours`,
// `sequence`, `status` et un `contenu` où vivent l'objectif et le repère de
// programme. L'intitulé d'un cours n'a donc pas à être ressaisi : il se LIT
// sur la préparation. Le devoir n'enregistre qu'un identifiant.
//
// ── Le rattachement est une aide, jamais une contrainte ───────────────────
//
// Un enseignant peut avoir fait Écriture et donner un devoir libre de
// Mathématiques. La matière du devoir n'est donc JAMAIS déduite du cours
// choisi, et la liste ne se limite pas à la matière du devoir : elle la met
// en tête, et montre le reste en dessous.

const texte = valeur => String(valeur ?? '').trim()
const norm = s => texte(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// La valeur du choix « aucun cours ». Une chaîne vide, comme toute option
// neutre d'un `<select>` : rien à convertir, rien à confondre avec un
// identifiant.
export const SANS_COURS = ''

export const LIBELLE_SANS_COURS = 'Devoir libre / sans cours associé'

/**
 * L'intitulé lisible d'un cours, tiré de la préparation elle-même.
 *
 * « Écriture — i et u » : la matière, puis le repère de programme du manuel.
 * Sans repère, l'objectif de la notion. Sans objectif, la matière seule. Rien
 * n'est fabriqué : à défaut de tout, on rend une chaîne vide et l'appelant
 * n'affiche pas d'entrée.
 */
export const intituleCours = (preparation) => {
  const matiere = texte(preparation?.matiere)
  const contenu = preparation?.contenu || {}
  const titre = texte(contenu?.programme?.titre) || texte(contenu?.objectif)
  return [matiere, titre].filter(Boolean).join(' — ')
}

/** Une préparation est-elle exploitable comme cours de référence ? */
export const estCoursPrepare = (preparation) =>
  !!texte(preparation?.id) && !!intituleCours(preparation)

/**
 * Les cours proposables à cet enseignant, pour cette classe.
 *
 * Trois règles, et elles seules :
 *
 *   · JAMAIS la préparation d'un autre enseignant — le filtre sur `user_id`
 *     est la première opération, pas la dernière ;
 *   · une entrée par LEÇON, pas par séquence : une leçon de deux heures est
 *     enregistrée en quatre lignes de trente minutes, même date, même matière,
 *     même groupe. Les proposer toutes ferait quatre fois le même choix ;
 *   · la matière du devoir remonte en tête, sans exclure les autres.
 *
 * L'ordre : matière correspondante d'abord, puis du plus récent au plus ancien.
 */
export const coursDisponibles = (preparations, { userId, groupe, matiere } = {}) => {
  const miennes = (Array.isArray(preparations) ? preparations : [])
    .filter(p => p && texte(p.user_id) && texte(p.user_id) === texte(userId))
    .filter(p => !texte(groupe) || norm(p.groupe) === norm(groupe))
    .filter(estCoursPrepare)

  // Déduplication par leçon. À séquences multiples, on garde la première —
  // celle qui ouvre la leçon.
  const parLecon = new Map()
  for (const p of [...miennes].sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))) {
    const cle = `${texte(p.date_cours)}|${norm(p.matiere)}|${norm(p.groupe)}`
    if (!parLecon.has(cle)) parLecon.set(cle, p)
  }

  return [...parLecon.values()]
    .map(p => ({
      id: texte(p.id),
      intitule: intituleCours(p),
      matiere: texte(p.matiere),
      groupe: texte(p.groupe),
      date: texte(p.date_cours),
      statut: texte(p.status),
      // Sert au classement ET à l'affichage : l'enseignant voit d'un coup
      // d'œil ce qui relève de la matière de son devoir.
      memeMatiere: !!texte(matiere) && norm(p.matiere) === norm(matiere),
    }))
    .sort((a, b) => (Number(b.memeMatiere) - Number(a.memeMatiere))
      || b.date.localeCompare(a.date))
}

/**
 * Le cours attaché à un devoir, retrouvé dans la liste des préparations.
 *
 * Rend `null` quand rien n'est attaché, et aussi quand la préparation n'est
 * plus lisible — supprimée, ou hors du périmètre de celui qui regarde. Un
 * devoir dont le cours a disparu reste un devoir valide : il perd sa ligne de
 * référence, il ne devient pas invalide.
 */
export const coursDeReference = (preparations, preparationId) => {
  const id = texte(preparationId)
  if (!id) return null
  const p = (Array.isArray(preparations) ? preparations : []).find(x => texte(x?.id) === id)
  return p && estCoursPrepare(p) ? { id, intitule: intituleCours(p), matiere: texte(p.matiere), date: texte(p.date_cours) } : null
}

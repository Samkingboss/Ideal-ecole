// Qui signe, et à quel titre.
//
// RÈGLE IDEAL : sur tout document, message, fiche, devoir ou rapport émis par
// un membre du personnel, le nom ne suffit pas. La fonction professionnelle
// pertinente l'accompagne.
//
// « Pertinente » est le mot qui porte tout le travail. Une personne peut avoir
// plusieurs responsabilités : le directeur qui enseigne les mathématiques
// signe « Directeur » un courrier de direction, et « Enseignant de
// Mathématiques » un devoir de mathématiques. La fonction affichée dépend donc
// du CONTEXTE du document, jamais d'un texte ressaisi à la main dans chaque
// écran.
//
// ── D'où vient l'information ──────────────────────────────────────────────
//
//   users.role       le rôle principal, source de vérité serveur
//   users.fonction   la précision quand elle existe (« maitresse-fr-mat »)
//   la matière       fournie par le document lui-même — un devoir sait la sienne
//
// ── Ce qui manque, et qu'il faut savoir ───────────────────────────────────
//
// `users` ne porte NI `sexe` NI `civilite` : vérifié en production, les quatre
// noms de colonne plausibles renvoient 400. On ne peut donc pas écrire
// « Enseignante » de façon fiable pour tout le monde.
//
// Deux sources de genre existent malgré tout :
//   - `fonction` l'encode pour la maternelle — « maitresse- », « assistante- » ;
//   - rien d'autre.
//
// À défaut, la forme épicène traditionnelle est employée — « Professeur de
// Français » reste correct pour une femme dans l'usage administratif. Le jour
// où `users` portera une civilité, `genreDe()` la lira et la table FEMININ
// s'appliquera partout, sans toucher aux appelants.

// ── Noms de fonction, par rôle ───────────────────────────────────────────────
//
// Nomenclature du V2.1 §3. La forme masculine sert d'épicène par défaut.

const MASCULIN = {
  directeur:                'Directeur',
  responsable_administratif:'Responsable administratif',
  conseiller_vie_scolaire:  'Conseiller de vie scolaire',
  surveillant:              'Surveillant',
  professeur:               'Enseignant',
  cuisiniere:               'Responsable de la cantine',
}

const FEMININ = {
  directeur:                'Directrice',
  responsable_administratif:'Responsable administrative',
  conseiller_vie_scolaire:  'Conseillère de vie scolaire',
  surveillant:              'Surveillante',
  professeur:               'Enseignante',
  cuisiniere:               'Responsable de la cantine',
}

// Fonctions de maternelle : le libellé est déjà porté par `users.fonction`,
// sous la forme « maitresse-fr-mat » ou « assistante-en-ps ».
const MATERNELLE = {
  maitresse:  { m: 'Maître de maternelle',      f: 'Maîtresse de maternelle' },
  assistante: { m: 'Assistant de maternelle',   f: 'Assistante de maternelle' },
}

// ── Genre ────────────────────────────────────────────────────────────────────
//
// `'f'`, `'m'`, ou `null` quand rien ne permet de trancher — auquel cas la
// forme épicène s'applique. Ne jamais deviner à partir du prénom : un prénom
// ne dit pas le genre de la personne, et se tromper est pire que de rester
// neutre.
export const genreDe = (personne) => {
  const sexe = String(personne?.sexe || personne?.civilite || '').trim().toLowerCase()
  if (sexe.startsWith('f') || sexe === 'mme' || sexe === 'madame') return 'f'
  if (sexe.startsWith('m') && sexe !== 'mme') return 'm'

  const fonction = String(personne?.fonction || '').toLowerCase()
  if (fonction.startsWith('maitresse-') || fonction.startsWith('assistante-')) return 'f'
  if (fonction.startsWith('maitre-') || fonction.startsWith('assistant-')) return 'm'

  return null
}

// ── La fonction pertinente ───────────────────────────────────────────────────
//
// `contexte.matiere` — la matière du document, quand il en a une.
// `contexte.role`    — pour forcer un rôle sur un document de direction émis
//                      par quelqu'un qui enseigne aussi.
//
// Renvoie une chaîne, jamais `null` : un document doit pouvoir signer.
export const fonctionProfessionnelle = (personne, contexte = {}) => {
  if (!personne) return ''
  const genre = genreDe(personne)
  const table = genre === 'f' ? FEMININ : MASCULIN

  const fonction = String(personne.fonction || '').toLowerCase()
  const role = String(contexte.role || personne.role || '').toLowerCase()

  // 1 · Maternelle : `fonction` est plus précis que `role`.
  const prefixe = fonction.split('-')[0]
  if (MATERNELLE[prefixe]) {
    const mat = MATERNELLE[prefixe]
    return genre === 'm' ? mat.m : mat.f
  }

  const base = table[role] || 'Membre du personnel'

  // 2 · Un enseignant se nomme par sa matière quand le document en a une.
  //     C'est ce qui permet au directeur qui enseigne de signer « Enseignant
  //     de Mathématiques » un devoir, et « Directeur » un courrier.
  const matiere = String(contexte.matiere || '').trim()
  if (matiere && (role === 'professeur' || contexte.role === 'professeur')) {
    return `${base} de ${matiere}`
  }

  return base
}

// ── Nom d'usage ──────────────────────────────────────────────────────────────
//
// « Ornella MOGADZI » : prénom en casse normale, nom en capitales, comme sur
// les documents officiels de l'école.
export const nomProfessionnel = (personne) => {
  if (!personne) return ''
  const prenom = String(personne.prenom || '').trim()
  const nom    = String(personne.nom || '').trim().toUpperCase()
  return [prenom, nom].filter(Boolean).join(' ')
}

// ── Les deux lignes, prêtes à signer ─────────────────────────────────────────
//
// `{ nom, fonction }`. Les appelants affichent l'un au-dessus de l'autre ; le
// format reste à eux, la source reste ici.
export const signature = (personne, contexte = {}) => ({
  nom: nomProfessionnel(personne),
  fonction: fonctionProfessionnelle(personne, contexte),
})

// Version d'une seule ligne, pour un message ou une notification où deux
// lignes ne tiennent pas.
export const signatureLigne = (personne, contexte = {}) => {
  const s = signature(personne, contexte)
  return s.fonction ? `${s.nom} — ${s.fonction}` : s.nom
}

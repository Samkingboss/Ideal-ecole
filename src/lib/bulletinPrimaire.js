const noteValide = note => {
  const valeur = Number(note?.note)
  const bareme = Number(note?.bareme)
  return Number.isFinite(valeur) && Number.isFinite(bareme)
    && bareme > 0 && valeur >= 0 && valeur <= bareme
}

export const moyenneModalite = notes => {
  const valides = (Array.isArray(notes) ? notes : []).filter(noteValide)
  if (!valides.length) return null
  return valides.reduce((total, note) => total + (Number(note.note) / Number(note.bareme)) * 20, 0) / valides.length
}

export const moyenneMatiere = matiere => {
  const ecrit = moyenneModalite(matiere?.notes?.ecrit)
  const oral = moyenneModalite(matiere?.notes?.oral)
  const disponibles = [ecrit, oral].filter(Number.isFinite)
  return disponibles.length ? disponibles.reduce((a, b) => a + b, 0) / disponibles.length : null
}

export const moyenneEnsemble = matieres => {
  const notes = Object.values(matieres || {}).map(moyenneMatiere).filter(Number.isFinite)
  return notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null
}

export const notesInvalides = matiere => [
  ...(matiere?.notes?.ecrit || []),
  ...(matiere?.notes?.oral || []),
].filter(note => !noteValide(note))

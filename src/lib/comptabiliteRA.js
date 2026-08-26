export const fcfa = value => `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} FCFA`

export const classeLabel = classe => ({
  ps: 'PS - Petite Section', gs: 'GS - Grande Section', cp1: 'CP1', cp2: 'CP2',
  ce1: 'CE1', ce2: 'CE2', cm1: 'CM1', cm2: 'CM2',
})[classe] || classe || 'Classe non renseignée'

export const normalizeEtatComptable = raw => {
  const etat = raw && typeof raw === 'object' ? raw : {}
  return {
    ...etat,
    students: Array.isArray(etat.students) ? etat.students.map(student => ({
      ...student,
      history: Array.isArray(student.history) ? student.history : [],
      reductions: Array.isArray(student.reductions) ? student.reductions : [],
      famille: student.famille || String(student.nom || '').toUpperCase(),
      telephone: student.telephone || '',
    })) : [],
    charges: Array.isArray(etat.charges) ? etat.charges : [],
    ecritures: Array.isArray(etat.ecritures) ? etat.ecritures : [],
    planComptable: Array.isArray(etat.planComptable) ? etat.planComptable : [],
    effectifs: etat.effectifs || {},
  }
}

export const paiementsActifs = student => (student.history || []).filter(p => !p.cancelled)
export const totalPaye = student => paiementsActifs(student).reduce((sum, p) => sum + Number(p.amount || 0), 0)
const TARIFS = {
  maternelle: { inscription: 55000, fournitures: 50000, cotisation: 45000, scolarite: 625000, cantine: 243000 },
  primaire: { inscription: 60000, fournitures: 70000, cotisation: 45000, scolarite: 750000, cantine: 305000 },
}
export const totalDu = student => {
  const explicite = Number(student.totalAnnuel || student.total || student.montantTotal || 0)
  if (explicite > 0) return explicite
  const tarif = TARIFS[['ps', 'gs'].includes(student.classe) ? 'maternelle' : 'primaire']
  let total = tarif.inscription + tarif.fournitures + tarif.cotisation + tarif.scolarite
  if (student.cantine) total += tarif.cantine
  ;(student.reductions || []).filter(r => r.actif !== false).forEach(reduction => {
    const montant = Number(reduction.montant || reduction.amount || 0)
    total -= reduction.type === 'pourcentage' ? total * montant / 100 : montant
  })
  return Math.max(0, Math.round(total))
}
export const resteDu = student => Math.max(0, totalDu(student) - totalPaye(student))

export const syntheseComptable = etat => {
  const students = etat.students || []
  const paiements = students.flatMap(student => paiementsActifs(student))
  const aujourdHui = new Date().toLocaleDateString('fr-FR')
  return {
    eleves: students.length,
    operations: paiements.length,
    encaisse: paiements.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    encaisseJour: paiements.filter(p => String(p.date || '').includes(aujourdHui))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    impayes: students.reduce((sum, student) => sum + resteDu(student), 0),
    charges: (etat.charges || []).reduce((sum, charge) => sum + Number(charge.montant || 0), 0),
  }
}

export const filtrerEleves = (students, recherche, classe = 'toutes', impayesSeulement = false) => {
  const q = String(recherche || '').trim().toLocaleLowerCase('fr')
  return (students || []).filter(student => {
    const texte = `${student.nom || ''} ${student.prenom || ''} ${student.matricule || ''} ${classeLabel(student.classe)}`.toLocaleLowerCase('fr')
    return (!q || texte.includes(q))
      && (classe === 'toutes' || student.classe === classe)
      && (!impayesSeulement || resteDu(student) > 0)
  })
}

export const creerEcriturePaiement = (student, payment) => {
  const banque = /wave|orange|virement|banque/i.test(payment.mode || '')
  return {
    id: Date.now(), date: new Date().toISOString().slice(0, 10), journal: banque ? 'BAN' : 'CAI',
    piece: payment.receiptId,
    libelle: `Encaissement ${payment.motif || 'Scolarité'} — ${student.nom || ''} ${student.prenom || ''}`.trim(),
    compteDebit: banque ? '521' : '571', compteCredit: '7062', montant: Number(payment.amount || 0),
    tiers: `${student.nom || ''} ${student.prenom || ''}`.trim(), justificatifs: [],
    source: `student-${student.id}-${payment.receiptId}`,
  }
}

export const prochainRecu = student => {
  const max = (student.history || []).reduce((rang, payment) => {
    const match = String(payment.receiptId || '').match(/(\d+)$/)
    return Math.max(rang, match ? Number(match[1]) : 0)
  }, 0)
  return `REC-${new Date().getFullYear()}-${String(max + 1).padStart(4, '0')}`
}

const telecharger = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const downloadJson = etat => telecharger(
  new Blob([JSON.stringify({ ...etat, _meta: { app: 'IDEAL Comptabilité', exportedAt: new Date().toISOString() } }, null, 2)], { type: 'application/json' }),
  `ideal-comptabilite-${new Date().toISOString().slice(0, 10)}.json`,
)

export const downloadCsv = (filename, rows) => {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
  telecharger(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), filename)
}

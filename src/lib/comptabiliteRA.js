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

export const EFFECTIFS_PREVISIONNELS = { ps:13, gs:20, cp1:22, cp2:18, ce1:7, ce2:4, cm1:3, cm2:3 }
export const SALAIRES_PREVISIONNELS = [
  ['Directeur',400000], ['Responsable administratif',150000], ['Conseillère de vie scolaire',75000],
  ['Surveillant(e)',75000], ['Ménagères (× 3)',150000], ['Gardien',30000],
  ['Maîtresse Français (Maternelle)',125000], ['Maîtresse Anglais (Maternelle)',125000],
  ['Assistante Français (Maternelle)',75000], ['Assistante Anglais (Maternelle)',75000],
  ['Maître Français (CP1-CP2)',125000], ['Maître Anglais (CP1-CP2)',125000],
  ['Maître Français (CE1-CE2)',125000], ['Maître Anglais (CE1-CE2)',125000],
  ['Maître Français (CM1-CM2)',125000], ['Maître Anglais (CM1-CM2)',125000],
  ['Rémunération Associé',250000], ['Rémunération Directeur',100000],
].map(([poste,mensuel], index) => ({ id:`poste-${index + 1}`, poste, mensuel }))

const moisPrevision = ['Oct.','Nov.','Déc.','Jan.','Fév.','Mars','Avr.','Mai','Juin']
export const previsionFinanciere = etat => {
  const effectifsSauves = { ...EFFECTIFS_PREVISIONNELS, ...(etat.effectifs || {}) }
  const totalSauve = Object.values(effectifsSauves).reduce((s,n) => s + Number(n || 0), 0)
  const effectifs = totalSauve === 90 ? effectifsSauves : { ...EFFECTIFS_PREVISIONNELS }
  const totalEleves = Object.values(effectifs).reduce((s,n) => s + Number(n || 0), 0)
  const tauxRecouvrement = Number(etat.tauxRed ?? etat.tauxRecouvrement ?? 93) / 100
  const tauxCantine = Number(etat.tauxCantine ?? 90) / 100
  let recettesScolarite = 0; let recettesCantine = 0
  Object.entries(effectifs).forEach(([classe,effectif]) => {
    const tarif = TARIFS[['ps','gs'].includes(classe) ? 'maternelle' : 'primaire']
    recettesScolarite += (tarif.inscription + tarif.fournitures + tarif.cotisation + tarif.scolarite) * Number(effectif || 0) * tauxRecouvrement
    recettesCantine += tarif.cantine * Number(effectif || 0) * tauxCantine
  })
  const recettes = recettesScolarite + recettesCantine
  const charges = (etat.charges || []).reduce((s,c) => s + Number(c.montant || 0), 0)
    + (etat.cantineCharges || []).reduce((s,c) => s + Number(c.montant || Number(c.base || 0) * Number(c.multi || 1)), 0)
  const repartitionEntrees = [.39,.055,.035,.17,.055,.07,.105,.07,.05]
  const repartitionSorties = [.18,.075,.07,.105,.075,.105,.085,.075,.24]
  let cumule = 0
  const mensuel = moisPrevision.map((mois,index) => {
    const entrees = recettes * repartitionEntrees[index]
    const sorties = charges * repartitionSorties[index]
    const solde = entrees - sorties; cumule += solde
    return { mois, entrees, sorties, solde, cumule }
  })
  return { effectifs, totalEleves, tauxRecouvrement, tauxCantine, recettesScolarite, recettesCantine, recettes, charges, resultat:recettes-charges, mensuel }
}

export const situationCaisse = etat => {
  const ecritures = etat.ecritures || []
  const mouvementCompte = prefixe => ecritures.reduce((solde,e) => {
    const montant = Number(e.montant || 0)
    return solde + (String(e.compteDebit || '').startsWith(prefixe) ? montant : 0) - (String(e.compteCredit || '').startsWith(prefixe) ? montant : 0)
  }, 0)
  const caisse = mouvementCompte('57')
  const banque = mouvementCompte('52')
  const impayes = (etat.students || []).reduce((s,student) => s + resteDu(student), 0)
  const chargesAnnuelles = (etat.charges || []).reduce((s,c) => s + Number(c.montant || 0), 0)
  const chargesMensuelles = chargesAnnuelles / 12
  const liquidites = caisse + banque
  return { caisse, banque, liquidites, impayes, chargesMensuelles,
    urgenceRecouvrement:Math.min(impayes, Math.max(0, chargesMensuelles-liquidites)),
    couverture:chargesMensuelles > 0 ? liquidites / chargesMensuelles : 0 }
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

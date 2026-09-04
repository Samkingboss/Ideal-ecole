export const fcfa = value => `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} FCFA`

export const classeLabel = classe => ({
  ps: 'PS - Petite Section', gs: 'GS - Grande Section', cp1: 'CP1', cp2: 'CP2',
  ce1: 'CE1', ce2: 'CE2', cm1: 'CM1', cm2: 'CM2',
})[classe] || classe || 'Classe non renseignée'

const normaliserNomClasse = valeur => String(valeur || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\s+bilingue\s*$/i, '').replace(/[^a-z0-9]/g, '')

export const cleClassePrevisionnelle = valeur => {
  const normalisee = normaliserNomClasse(valeur)
  const aliases = {
    ps: 'ps', petitesection: 'ps',
    gs: 'gs', grandesection: 'gs',
    cp1: 'cp1', cp2: 'cp2', ce1: 'ce1', ce2: 'ce2', cm1: 'cm1', cm2: 'cm2',
  }
  return aliases[normalisee] || null
}

export const comparerEffectifs = (etat, effectifsPrevus = {}) => {
  const reels = (etat?.students || []).filter(student => !student.dateDepart).reduce((acc, student) => {
    const cle = cleClassePrevisionnelle(student.classe)
    if (cle) acc[cle] = (acc[cle] || 0) + 1
    return acc
  }, {})
  const lignes = Object.entries(effectifsPrevus).map(([classe, prevu]) => {
    const reel = Number(reels[classe] || 0)
    const objectif = Number(prevu || 0)
    return { classe, prevu: objectif, reel, ecart: reel - objectif }
  })
  return {
    lignes,
    prevu: lignes.reduce((s, ligne) => s + ligne.prevu, 0),
    reel: lignes.reduce((s, ligne) => s + ligne.reel, 0),
  }
}

export const trouverClasseCanonique = (libelle, classes = []) => {
  const cible = normaliserNomClasse(libelle)
  return (classes || []).find(classe => normaliserNomClasse(classe?.nom) === cible) || null
}

export const synchroniserEleves = (etat, inscriptions = [], classes = []) => {
  const courant = normalizeEtatComptable(etat)
  const validees = inscriptions.filter(inscription => inscription.statut === 'validee' && inscription.matricule)
  let modifies = 0
  const existants = courant.students.map(student => {
    const inscription = validees.find(i => String(i.id) === String(student.sourceInscription))
      || validees.find(i => i.matricule === student.matricule)
    if (!inscription) return student
    const classe = trouverClasseCanonique(inscription.classe_demandee, classes)
    if (!classe) return student
    const identiteCanonique = {
      matricule: inscription.matricule,
      nom: inscription.nom,
      prenom: inscription.prenom,
      classe: classe.nom,
      classe_id: classe.id,
      cantine: Boolean(inscription.cantine),
      annee_scolaire: inscription.annee_scolaire || null,
      sourceInscription: inscription.id,
    }
    const change = Object.entries(identiteCanonique).some(([cle, valeur]) => student[cle] !== valeur)
    if (!change) return student
    modifies++
    // L'inscription est la source de vérité administrative. Tout ce qui est
    // financier (history, réductions, plan, famille, départ…) reste porté par
    // la fiche comptable existante et n'est jamais reconstruit ici.
    return { ...student, ...identiteCanonique }
  })
  const sources = new Set(existants.map(student => student.sourceInscription).filter(Boolean).map(String))
  const matricules = new Set(existants.map(student => student.matricule).filter(Boolean))
  const nouveaux = inscriptions.filter(inscription => {
    if (inscription.statut !== 'validee' || !inscription.matricule || matricules.has(inscription.matricule) || sources.has(String(inscription.id))) return false
    return Boolean(trouverClasseCanonique(inscription.classe_demandee, classes))
  }).map(inscription => {
    const classe = trouverClasseCanonique(inscription.classe_demandee, classes)
    return {
      id:`inscription-${inscription.id}`, matricule:inscription.matricule, nom:inscription.nom, prenom:inscription.prenom,
      classe:classe.nom, classe_id:classe.id, cantine:Boolean(inscription.cantine),
      annee_scolaire:inscription.annee_scolaire || null, telephone:'', famille:String(inscription.nom || '').toUpperCase(),
      plan:'trimestre', paye:0, history:[], reductions:[], dateDepart:null, motifDepart:'', sourceInscription:inscription.id,
    }
  })
  const suivant = nouveaux.length || modifies
    ? { ...courant, students:[...existants, ...nouveaux] }
    : courant
  return { suivant, nombre:nouveaux.length, modifies }
}

export const salairesDepuisPostes = postes => (Array.isArray(postes) ? postes : []).map(poste => ({
  id: poste.id, poste: poste.label || poste.poste || '', mensuel: Number(poste.mensuel || 0),
}))

export const protegerMutationSalariale = (courant, suivant, role) => {
  if (role !== 'responsable_administratif') return suivant
  const chargeSalariale = (courant.charges || []).find(charge => charge.id === 'salaires')
  return {
    ...suivant,
    salaires: courant.salaires,
    paies: courant.paies,
    charges: (suivant.charges || []).map(charge => charge.id === 'salaires' && chargeSalariale ? chargeSalariale : charge),
  }
}

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
export const TARIFS = {
  maternelle: { inscription: 55000, fournitures: 50000, cotisation: 45000, scolarite: 625000, cantine: 243000 },
  primaire: { inscription: 60000, fournitures: 70000, cotisation: 45000, scolarite: 750000, cantine: 305000 },
}

export const categorieTarifaire = classe => ['ps', 'gs'].includes(cleClassePrevisionnelle(classe))
  ? 'maternelle'
  : 'primaire'

export const tarifPourClasse = classe => TARIFS[categorieTarifaire(classe)]

export const EFFECTIFS_PREVISIONNELS = { ps:13, gs:20, cp1:22, cp2:18, ce1:7, ce2:4, cm1:3, cm2:3 }
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
    const tarif = tarifPourClasse(classe)
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
  const tarif = tarifPourClasse(student.classe)
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

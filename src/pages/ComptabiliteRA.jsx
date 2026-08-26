import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  classeLabel, creerEcriturePaiement, downloadCsv, downloadJson, fcfa, filtrerEleves,
  normalizeEtatComptable, prochainRecu, resteDu, syntheseComptable, totalPaye,
} from '../lib/comptabiliteRA'
import './ComptabiliteRA.css'

const ONGLETS = [
  ['dashboard', "📊 Vue d'ensemble"], ['eleves', '💵 Élèves & encaissements'],
  ['recouvrement', '📲 Recouvrement'], ['charges', '📋 Charges'],
  ['tresorerie', '📅 Trésorerie'], ['compta', '📒 SYSCOHADA'],
]

const Journal = ({ etat, enregistrer }) => {
  const [vue, setVue] = useState('journaux')
  const [journal, setJournal] = useState('CAI')
  const [recherche, setRecherche] = useState('')
  const [nouvelle, setNouvelle] = useState(false)
  const [ecriture, setEcriture] = useState({ date: new Date().toISOString().slice(0, 10), journal: 'CAI', piece: '', libelle: '', compteDebit: '', compteCredit: '', montant: '', tiers: '', justificatifs: [] })
  const lignes = (etat.ecritures || []).filter(ecriture =>
    ecriture.journal === journal
    && `${ecriture.libelle || ''} ${ecriture.piece || ''} ${ecriture.compteDebit || ''} ${ecriture.compteCredit || ''}`
      .toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')))
  const exporter = () => downloadCsv(`journal-${journal}.csv`, [
    ['Date', 'Pièce', 'Libellé', 'Débit', 'Crédit', 'Montant'],
    ...lignes.map(e => [e.date, e.piece, e.libelle, e.compteDebit, e.compteCredit, e.montant]),
  ])
  const sauvegarder = async event => {
    event.preventDefault()
    const ligne = { ...ecriture, id: Date.now(), montant: Math.round(Number(ecriture.montant)) }
    if (!ligne.libelle || !ligne.compteDebit || !ligne.compteCredit || ligne.montant <= 0) return
    const ok = await enregistrer({ ...etat, ecritures: [...etat.ecritures, ligne] }, 'Écriture enregistrée.')
    if (ok) {
      setNouvelle(false)
      setEcriture({ date: new Date().toISOString().slice(0, 10), journal: 'CAI', piece: '', libelle: '', compteDebit: '', compteCredit: '', montant: '', tiers: '', justificatifs: [] })
    }
  }
  const joindre = event => {
    const file = event.target.files?.[0]
    if (!file || file.size > 500 * 1024) return
    const reader = new FileReader()
    reader.onload = () => setEcriture(courante => ({ ...courante, justificatifs: [...courante.justificatifs, { nom:file.name, type:file.type, dataUrl:reader.result }] }))
    reader.readAsDataURL(file)
  }
  const balance = Object.values((etat.ecritures || []).reduce((acc, ligne) => {
    const montant = Number(ligne.montant || 0)
    for (const [compte, debit, credit] of [[ligne.compteDebit, montant, 0], [ligne.compteCredit, 0, montant]]) {
      if (!compte) continue
      acc[compte] ||= { compte, debit:0, credit:0 }
      acc[compte].debit += debit; acc[compte].credit += credit
    }
    return acc
  }, {})).sort((a,b) => String(a.compte).localeCompare(String(b.compte)))
  return <div className="compta-ra__panel">
    <div className="compta-ra__subtabs">
      {[['journaux','Journaux'],['grandlivre','Grand livre'],['balance','Balance'],['plan','Plan comptable']].map(([id,label]) => <button key={id} className="compta-ra__button" aria-pressed={vue === id} onClick={() => setVue(id)}>{label}</button>)}
    </div>
    {vue === 'journaux' && <>
    <div className="compta-ra__filters">
      <select className="compta-ra__input" value={journal} onChange={e => setJournal(e.target.value)}>
        <option value="CAI">Journal de caisse</option><option value="BAN">Journal de banque</option><option value="OD">Opérations diverses</option>
      </select>
      <input className="compta-ra__input" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher une écriture…" />
      <button className="compta-ra__button compta-ra__button--primary" onClick={() => setNouvelle(true)}>+ Nouvelle écriture</button>
    </div>
    <div className="compta-ra__table-wrap"><table className="compta-ra__table"><thead><tr>
      <th>Date</th><th>Pièce</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th className="compta-ra__right">Montant</th>
    </tr></thead><tbody>{lignes.map((e, index) => <tr key={e.id || index}>
      <td data-label="Date">{e.date || '—'}</td><td data-label="Pièce">{e.piece || '—'}</td>
      <td data-label="Libellé">{e.libelle || '—'}</td><td data-label="Débit">{e.compteDebit || '—'}</td>
      <td data-label="Crédit">{e.compteCredit || '—'}</td><td data-label="Montant" className="compta-ra__right">{fcfa(e.montant)}</td>
    </tr>)}</tbody></table>{lignes.length === 0 && <div className="compta-ra__empty">Aucune écriture dans ce journal.</div>}</div>
    <div className="compta-ra__dialog-actions"><button className="compta-ra__button" onClick={exporter}>⬇ Export CSV</button></div></>}
    {vue === 'grandlivre' && <div className="compta-ra__table-wrap"><table className="compta-ra__table"><thead><tr><th>Compte</th><th>Date</th><th>Libellé</th><th>Pièce</th><th className="compta-ra__right">Mouvement</th></tr></thead><tbody>
      {balance.flatMap(solde => (etat.ecritures || []).filter(e => e.compteDebit === solde.compte || e.compteCredit === solde.compte).map((e,index) => <tr key={`${solde.compte}-${e.id || index}`}><td data-label="Compte">{solde.compte}</td><td data-label="Date">{e.date}</td><td data-label="Libellé">{e.libelle}</td><td data-label="Pièce">{e.piece || '—'}</td><td data-label="Mouvement" className="compta-ra__right">{e.compteDebit === solde.compte ? 'D ' : 'C '}{fcfa(e.montant)}</td></tr>))}
    </tbody></table></div>}
    {vue === 'balance' && <div className="compta-ra__table-wrap"><table className="compta-ra__table"><thead><tr><th>Compte</th><th className="compta-ra__right">Débit</th><th className="compta-ra__right">Crédit</th><th className="compta-ra__right">Solde</th></tr></thead><tbody>
      {balance.map(ligne => <tr key={ligne.compte}><td data-label="Compte">{ligne.compte}</td><td data-label="Débit" className="compta-ra__right">{fcfa(ligne.debit)}</td><td data-label="Crédit" className="compta-ra__right">{fcfa(ligne.credit)}</td><td data-label="Solde" className="compta-ra__right">{fcfa(ligne.debit-ligne.credit)}</td></tr>)}
    </tbody></table></div>}
    {vue === 'plan' && <><div className="compta-ra__filters"><input className="compta-ra__input" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un compte…" /></div><div className="compta-ra__table-wrap"><table className="compta-ra__table"><thead><tr><th>Numéro</th><th>Libellé</th><th>Classe</th><th>Sens</th></tr></thead><tbody>
      {(etat.planComptable || []).filter(c => `${c.num} ${c.libelle}`.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr'))).map(c => <tr key={c.num}><td data-label="Numéro">{c.num}</td><td data-label="Libellé">{c.libelle}</td><td data-label="Classe">{c.classe}</td><td data-label="Sens">{c.sens}</td></tr>)}
    </tbody></table></div></>}
    {nouvelle && <div className="compta-ra__modal" onMouseDown={event => event.target === event.currentTarget && setNouvelle(false)}><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Nouvelle écriture</h2><form className="compta-ra__form" onSubmit={sauvegarder}>
      <label>Date<input className="compta-ra__input" type="date" value={ecriture.date} onChange={e => setEcriture({...ecriture,date:e.target.value})}/></label>
      <label>Journal<select className="compta-ra__input" value={ecriture.journal} onChange={e => setEcriture({...ecriture,journal:e.target.value})}><option value="CAI">Caisse</option><option value="BAN">Banque</option><option value="OD">Opérations diverses</option></select></label>
      <label>Pièce<input className="compta-ra__input" value={ecriture.piece} onChange={e => setEcriture({...ecriture,piece:e.target.value})}/></label>
      <label>Libellé<input className="compta-ra__input" required value={ecriture.libelle} onChange={e => setEcriture({...ecriture,libelle:e.target.value})}/></label>
      <div className="compta-ra__grid"><label>Compte débité<input className="compta-ra__input" required value={ecriture.compteDebit} onChange={e => setEcriture({...ecriture,compteDebit:e.target.value})}/></label><label>Compte crédité<input className="compta-ra__input" required value={ecriture.compteCredit} onChange={e => setEcriture({...ecriture,compteCredit:e.target.value})}/></label></div>
      <label>Montant<input className="compta-ra__input" type="number" min="1" required value={ecriture.montant} onChange={e => setEcriture({...ecriture,montant:e.target.value})}/></label>
      <label>Tiers<input className="compta-ra__input" value={ecriture.tiers} onChange={e => setEcriture({...ecriture,tiers:e.target.value})}/></label>
      <label>Justificatif (500 Ko maximum)<input className="compta-ra__input" type="file" accept="image/*,application/pdf" onChange={joindre}/></label>
      {ecriture.justificatifs.map((j,i) => <div key={`${j.nom}-${i}`}>📎 {j.nom}</div>)}
      <div className="compta-ra__dialog-actions"><button type="button" className="compta-ra__button" onClick={() => setNouvelle(false)}>Annuler</button><button className="compta-ra__button compta-ra__button--primary">Enregistrer</button></div>
    </form></div></div>}
  </div>
}

export default function ComptabiliteRA({ supabase, user }) {
  const [onglet, setOnglet] = useState('dashboard')
  const [etat, setEtat] = useState(() => normalizeEtatComptable())
  const [version, setVersion] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [recherche, setRecherche] = useState('')
  const [classe, setClasse] = useState('toutes')
  const [modal, setModal] = useState(null)
  const [paiement, setPaiement] = useState({ montant: '', mode: 'Espèces', motif: 'Scolarité' })
  const [reduction, setReduction] = useState({ libelle: '', montant: '', type: 'montant' })
  const [depart, setDepart] = useState({ date: new Date().toISOString().slice(0, 10), motif: '' })
  const [famille, setFamille] = useState({ cle: '', montants: {} })
  const [nouvelEleve, setNouvelEleve] = useState({ matricule:'', nom:'', prenom:'', classe:'cp1', cantine:false, plan:'trimestre', famille:'' })
  const importRef = useRef(null)

  const charger = useCallback(async () => {
    setChargement(true); setErreur('')
    const { data, error } = await supabase.from('financement_params').select('state_json,updated_at').eq('id', 'main').maybeSingle()
    if (error || !data) setErreur(error?.message || 'État comptable introuvable.')
    else { setEtat(normalizeEtatComptable(data.state_json)); setVersion(data.updated_at) }
    setChargement(false)
  }, [supabase])

  useEffect(() => {
    const initialisation = window.setTimeout(charger, 0)
    return () => window.clearTimeout(initialisation)
  }, [charger])

  const sauverEtat = async (suivant, versionLue = version) => {
    const updatedAt = new Date().toISOString()
    let requete = supabase.from('financement_params').update({ state_json: suivant, updated_at: updatedAt }).eq('id', 'main')
    if (versionLue) requete = requete.eq('updated_at', versionLue)
    const { data, error } = await requete.select('updated_at')
    if (error) return { ok: false, message: error.message }
    if (!data?.length) return { ok: false, message: 'La comptabilité a changé sur un autre appareil. Rechargez avant de recommencer.' }
    setEtat(suivant); setVersion(data[0].updated_at); return { ok: true }
  }

  const encaisser = async event => {
    event.preventDefault()
    const student = modal?.student
    const montant = Math.round(Number(paiement.montant))
    if (!student?.matricule || montant <= 0) { setErreur('Le matricule et un montant positif sont obligatoires.'); return }
    setErreur(''); setMessage('')
    const receiptId = prochainRecu(student)
    const date = new Date().toLocaleString('fr-FR')
    const { data, error } = await supabase.rpc('enregistrer_paiement', {
      p_matricule: student.matricule, p_montant: montant, p_mode: paiement.mode,
      p_motif: paiement.motif, p_recu: receiptId, p_date_lisible: date,
    })
    if (error || !data?.ok) { setErreur(error?.message || 'Paiement non confirmé par le serveur. Aucun reçu n’a été produit.'); return }

    const payment = { amount: montant, mode: paiement.mode, motif: paiement.motif, receiptId, date,
      le: new Date().toISOString(), par: user?.id, par_nom: `${user?.prenom || ''} ${user?.nom || ''}`.trim(), par_role: user?.role }
    const frais = await supabase.from('financement_params').select('state_json,updated_at').eq('id', 'main').maybeSingle()
    if (frais.error || !frais.data) { setErreur('Paiement confirmé, mais le reçu ne peut pas être affiché avant rechargement.'); return }
    const suivant = normalizeEtatComptable(frais.data.state_json)
    if (!(suivant.ecritures || []).some(e => e.source === `student-${student.id}-${receiptId}`)) {
      suivant.ecritures = [...suivant.ecritures, creerEcriturePaiement(student, payment)]
      const sauvegarde = await sauverEtat(suivant, frais.data.updated_at)
      if (!sauvegarde.ok) { setErreur(`Paiement confirmé. Écriture comptable à contrôler : ${sauvegarde.message}`); return }
    } else { setEtat(suivant); setVersion(frais.data.updated_at) }
    setModal({ type: 'recu', student, payment }); setPaiement({ montant: '', mode: 'Espèces', motif: 'Scolarité' })
    setMessage(`Paiement ${receiptId} confirmé par le serveur.`)
  }

  const modifierCharge = (index, value) => setEtat(courant => ({ ...courant,
    charges: courant.charges.map((charge, i) => i === index ? { ...charge, montant: Number(value) || 0 } : charge),
  }))
  const enregistrerCharges = async () => {
    const r = await sauverEtat(etat)
    if (r.ok) setMessage('Charges enregistrées.'); else setErreur(r.message)
  }
  const enregistrer = async (suivant, confirmation) => {
    const r = await sauverEtat(normalizeEtatComptable(suivant))
    if (r.ok) { setMessage(confirmation); setErreur(''); return true }
    setErreur(r.message); return false
  }
  const remplacerEleve = (student, changements) => ({ ...etat, students: etat.students.map(s => s.id === student.id ? { ...s, ...changements } : s) })
  const ajouterReduction = async event => {
    event.preventDefault()
    const montant = Number(reduction.montant)
    if (!modal?.student || montant <= 0) return
    const reductions = [...(modal.student.reductions || []), { id:Date.now(), libelle:reduction.libelle || 'Réduction', montant, type:reduction.type, actif:true }]
    if (await enregistrer(remplacerEleve(modal.student, { reductions }), 'Réduction enregistrée.')) {
      setModal(null); setReduction({ libelle:'', montant:'', type:'montant' })
    }
  }
  const enregistrerDepart = async event => {
    event.preventDefault()
    if (!modal?.student || !depart.date || !depart.motif) return
    if (await enregistrer(remplacerEleve(modal.student, { dateDepart:depart.date, motifDepart:depart.motif }), 'Départ enregistré.')) setModal(null)
  }
  const reactiver = async student => {
    if (!window.confirm(`Réactiver ${student.prenom || ''} ${student.nom || ''} ?`)) return
    await enregistrer(remplacerEleve(student, { dateDepart:null, motifDepart:'' }), 'Élève réactivé.')
  }
  const importerInscriptions = async () => {
    setErreur(''); setMessage('')
    const { data, error } = await supabase.from('inscriptions').select('id,matricule,nom,prenom,classe_demandee,cantine,statut,annee_scolaire')
    if (error) { setErreur(error.message); return }
    const existants = new Set(etat.students.map(s => s.matricule).filter(Boolean))
    const codeClasse = libelle => {
      const texte = String(libelle || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return ['ps','gs','cp1','cp2','ce1','ce2','cm1','cm2'].find(code => texte.includes(code)) || null
    }
    const nouveaux = (data || []).filter(i => i.matricule && !existants.has(i.matricule)).map(i => ({ ...i, classe:codeClasse(i.classe_demandee) })).filter(i => i.classe).map(i => ({
      id:Date.now() + Math.floor(Math.random() * 100000), matricule:i.matricule, nom:i.nom, prenom:i.prenom, classe:i.classe, cantine:Boolean(i.cantine),
      annee_scolaire:i.annee_scolaire || null, telephone:'', famille:String(i.nom || '').toUpperCase(), plan:'trimestre', paye:0,
      history:[], reductions:[], dateDepart:null, motifDepart:'', sourceInscription:i.id,
    }))
    if (!nouveaux.length) { setMessage('Toutes les inscriptions sont déjà présentes.'); return }
    if (!window.confirm(`Importer ${nouveaux.length} nouvelle(s) inscription(s) dans la comptabilité ?`)) return
    await enregistrer({ ...etat, students:[...etat.students, ...nouveaux] }, `${nouveaux.length} inscription(s) importée(s).`)
  }
  const annulerPaiement = async (student, payment) => {
    const courant = etat.students.find(s => s.id === student.id) || student
    const history = (courant.history || []).map(p => p.receiptId === payment.receiptId ? { ...p, cancelled:true, cancelledAt:new Date().toISOString(), cancelledBy:user?.id } : p)
    const originale = etat.ecritures.find(e => e.piece === payment.receiptId)
    const contrepassation = originale ? { ...originale, id:Date.now(), date:new Date().toISOString().slice(0,10), journal:'OD', piece:`ANN-${payment.receiptId}`, libelle:`Annulation — ${originale.libelle}`, compteDebit:originale.compteCredit, compteCredit:originale.compteDebit, source:`annulation-${payment.receiptId}` } : null
    const suivant = remplacerEleve(courant, { history, paye:Math.max(0, totalPaye(courant)-Number(payment.amount || 0)) })
    if (contrepassation && !suivant.ecritures.some(e => e.source === contrepassation.source)) suivant.ecritures = [...suivant.ecritures, contrepassation]
    if (await enregistrer(suivant, `Reçu ${payment.receiptId} annulé par contre-passation.`)) setModal(null)
  }
  const encaisserFamille = async event => {
    event.preventDefault(); setErreur(''); setMessage('')
    const membres = etat.students.filter(s => (s.famille || String(s.nom || '').toUpperCase()) === famille.cle && Number(famille.montants[s.id]) > 0)
    if (!membres.length) return
    const paiements = []
    for (const student of membres) {
      const payment = { amount:Math.round(Number(famille.montants[student.id])), mode:'Espèces', motif:'Scolarité', receiptId:prochainRecu(student), date:new Date().toLocaleString('fr-FR') }
      const { data, error } = await supabase.rpc('enregistrer_paiement', { p_matricule:student.matricule, p_montant:payment.amount, p_mode:payment.mode, p_motif:payment.motif, p_recu:payment.receiptId, p_date_lisible:payment.date })
      if (error || !data?.ok) { setErreur(`${paiements.length} paiement(s) confirmé(s), puis arrêt : ${error?.message || 'refus serveur'}`); return }
      paiements.push({ student, payment })
    }
    const frais = await supabase.from('financement_params').select('state_json,updated_at').eq('id','main').maybeSingle()
    if (frais.error || !frais.data) { setErreur('Paiements confirmés, mais rechargement comptable impossible.'); return }
    const suivant = normalizeEtatComptable(frais.data.state_json)
    for (const item of paiements) if (!suivant.ecritures.some(e => e.source === `student-${item.student.id}-${item.payment.receiptId}`)) suivant.ecritures.push(creerEcriturePaiement(item.student,item.payment))
    const r = await sauverEtat(suivant, frais.data.updated_at)
    if (!r.ok) { setErreur(`Paiements confirmés ; écritures à contrôler : ${r.message}`); return }
    setModal(null); setFamille({ cle:'', montants:{} }); setMessage(`${paiements.length} paiement(s) famille confirmés.`)
  }
  const ajouterEleve = async event => {
    event.preventDefault()
    if (!nouvelEleve.matricule || !nouvelEleve.nom || etat.students.some(s => s.matricule === nouvelEleve.matricule)) { setErreur('Matricule absent ou déjà utilisé.'); return }
    const student = { ...nouvelEleve, id:Date.now(), nom:nouvelEleve.nom.toUpperCase(), famille:nouvelEleve.famille || nouvelEleve.nom.toUpperCase(), paye:0, history:[], reductions:[], dateDepart:null, motifDepart:'', telephone:'' }
    if (await enregistrer({ ...etat, students:[...etat.students,student] }, 'Élève comptable ajouté.')) {
      setModal(null); setNouvelEleve({ matricule:'', nom:'', prenom:'', classe:'cp1', cantine:false, plan:'trimestre', famille:'' })
    }
  }
  const supprimerFixture = async student => {
    if (student.nom !== 'TEST-COMPTA-NATIVE') return
    const recus = new Set((student.history || []).map(p => p.receiptId))
    const annulations = new Set([...recus].map(recu => `annulation-${recu}`))
    const suivant = { ...etat, students:etat.students.filter(s => s.id !== student.id), ecritures:etat.ecritures.filter(e => !recus.has(e.piece) && !String(e.source || '').includes(`student-${student.id}-`) && !annulations.has(e.source)) }
    if (await enregistrer(suivant, 'Fixture comptable supprimée.')) setModal(null)
  }

  const importer = event => {
    const file = event.target.files?.[0]
    if (!file || !window.confirm('Remplacer l’état comptable courant par cette sauvegarde ?')) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const suivant = normalizeEtatComptable(JSON.parse(reader.result))
        const r = await sauverEtat(suivant)
        if (r.ok) setMessage('Sauvegarde importée.'); else setErreur(r.message)
      } catch { setErreur('Fichier de sauvegarde invalide.') }
    }
    reader.readAsText(file)
  }

  const synthese = useMemo(() => syntheseComptable(etat), [etat])
  const classes = useMemo(() => [...new Set(etat.students.map(s => s.classe).filter(Boolean))], [etat.students])
  const eleves = useMemo(() => filtrerEleves(etat.students, recherche, classe, onglet === 'recouvrement'), [etat.students, recherche, classe, onglet])
  const tresorerie = synthese.encaisse - synthese.charges

  return <section className="compta-ra" data-comptabilite-native="true">
    <header className="compta-ra__head"><div>
      <h1 className="compta-ra__title">💰 Session : Comptabilité &amp; Finances</h1>
      <p className="compta-ra__subtitle">Gestion native des encaissements, impayés, charges, trésorerie et journaux — session IDEAL unique.</p>
    </div><div className="compta-ra__actions">
      <button className="compta-ra__button" onClick={charger}>↻ Actualiser</button>
      <button className="compta-ra__button" onClick={() => downloadJson(etat)}>💾 Exporter</button>
      <button className="compta-ra__button" onClick={() => importRef.current?.click()}>📂 Importer</button>
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importer} />
    </div></header>

    <nav className="compta-ra__tabs" role="tablist" aria-label="Sections comptables">
      {ONGLETS.map(([id, label]) => <button key={id} className="compta-ra__tab" role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}>{label}</button>)}
    </nav>
    {chargement && <div className="compta-ra__notice">Chargement des données comptables…</div>}
    {erreur && <div className="compta-ra__notice compta-ra__notice--error">⛔ {erreur}</div>}
    {message && <div className="compta-ra__notice compta-ra__notice--success">✓ {message}</div>}

    {!chargement && onglet === 'dashboard' && <>
      <div className="compta-ra__kpis">
        {[['Encaissements du jour', fcfa(synthese.encaisseJour)], ['Encaissements cumulés', fcfa(synthese.encaisse)],
          ['Élèves suivis', synthese.eleves], ['Impayés connus', fcfa(synthese.impayes)], ['Opérations', synthese.operations]]
          .map(([label, value]) => <div className="compta-ra__kpi" key={label}><div className="compta-ra__kpi-label">{label}</div><div className="compta-ra__kpi-value">{value}</div></div>)}
      </div>
      <div className="compta-ra__grid"><div className="compta-ra__panel"><h2>Situation financière</h2>
        <div className="compta-ra__receipt-line"><span>Encaissements</span><b>{fcfa(synthese.encaisse)}</b></div>
        <div className="compta-ra__receipt-line"><span>Charges annuelles</span><b>{fcfa(synthese.charges)}</b></div>
        <div className="compta-ra__receipt-line"><span>Solde indicatif</span><b style={{ color: tresorerie >= 0 ? '#059669' : '#dc2626' }}>{fcfa(tresorerie)}</b></div>
      </div><div className="compta-ra__panel"><h2>Contrôles rapides</h2>
        <div className="compta-ra__receipt-line"><span>Élèves avec impayé</span><b>{etat.students.filter(s => resteDu(s) > 0).length}</b></div>
        <div className="compta-ra__receipt-line"><span>Écritures comptables</span><b>{etat.ecritures.length}</b></div>
        <div className="compta-ra__receipt-line"><span>Version serveur</span><b>{version ? new Date(version).toLocaleString('fr-FR') : '—'}</b></div>
      </div></div>
    </>}

    {!chargement && ['eleves', 'recouvrement'].includes(onglet) && <div className="compta-ra__panel">
      <h2>{onglet === 'recouvrement' ? 'Impayés et recouvrement' : 'Élèves et encaissements'}</h2>
      <div className="compta-ra__filters"><input className="compta-ra__input" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher nom, matricule ou classe…" />
        <select className="compta-ra__input" value={classe} onChange={e => setClasse(e.target.value)}><option value="toutes">Toutes les classes</option>{classes.map(id => <option key={id} value={id}>{classeLabel(id)}</option>)}</select>
        <button className="compta-ra__button" onClick={() => downloadCsv('situation-eleves.csv', [['Matricule','Nom','Classe','Payé','Reste'], ...eleves.map(s => [s.matricule,`${s.nom || ''} ${s.prenom || ''}`,classeLabel(s.classe),totalPaye(s),resteDu(s)])])}>⬇ CSV</button>
      </div>
      {onglet === 'eleves' && <div className="compta-ra__dialog-actions"><button className="compta-ra__button compta-ra__button--primary" onClick={() => setModal({type:'nouvel-eleve'})}>+ Nouvel élève comptable</button><button className="compta-ra__button" onClick={() => setModal({type:'famille'})}>👨‍👩‍👧‍👦 Encaissement famille</button><button className="compta-ra__button" onClick={importerInscriptions}>📥 Importer les inscriptions</button></div>}
      <div className="compta-ra__table-wrap"><table className="compta-ra__table"><thead><tr><th>Élève</th><th>Classe</th><th className="compta-ra__right">Payé</th><th className="compta-ra__right">Reste</th><th></th></tr></thead><tbody>
        {eleves.map(student => <tr key={student.id || student.matricule}><td data-label="Élève"><b>{student.nom} {student.prenom}</b><br/><small>{student.matricule || 'Sans matricule'}</small></td>
          <td data-label="Classe">{classeLabel(student.classe)}</td><td data-label="Payé" className="compta-ra__right">{fcfa(totalPaye(student))}</td><td data-label="Reste" className="compta-ra__right">{fcfa(resteDu(student))}</td>
          <td data-label="Actions"><div className="compta-ra__student-actions"><button className="compta-ra__button compta-ra__button--primary" onClick={() => setModal({ type:'paiement', student })}>+ Encaisser</button>
            {(student.history || []).length > 0 && <button className="compta-ra__button" onClick={() => setModal({ type:'historique', student })}>Historique</button>}
            <button className="compta-ra__button" onClick={() => setModal({ type:'reduction', student })}>🎁 Réduction</button>
            {student.dateDepart ? <button className="compta-ra__button" onClick={() => reactiver(student)}>↩ Réactiver</button> : <button className="compta-ra__button" onClick={() => setModal({ type:'depart', student })}>🚪 Départ</button>}
            {student.nom === 'TEST-COMPTA-NATIVE' && <button className="compta-ra__button" onClick={() => setModal({ type:'confirmer-suppression-fixture', student })}>🗑 Supprimer fixture</button>}
            {onglet === 'recouvrement' && student.telephone && <button className="compta-ra__button" onClick={() => window.open(`https://wa.me/${String(student.telephone).replace(/\D/g,'')}?text=${encodeURIComponent(`École IDEAL — solde en attente pour ${student.prenom || ''} ${student.nom || ''} : ${fcfa(resteDu(student))}.`)}`, '_blank', 'noopener')}>WhatsApp</button>}
          </div></td></tr>)}
      </tbody></table>{eleves.length === 0 && <div className="compta-ra__empty">Aucun élève ne correspond aux filtres.</div>}</div>
    </div>}

    {!chargement && onglet === 'charges' && <div className="compta-ra__panel"><h2>Charges</h2>
      {etat.charges.map((charge, index) => <label className="compta-ra__charge" key={charge.id || index}><span><b>{charge.label || charge.id}</b></span><input className="compta-ra__input compta-ra__right" type="number" min="0" value={charge.montant || 0} onChange={e => modifierCharge(index, e.target.value)} /></label>)}
      <div className="compta-ra__dialog-actions"><button className="compta-ra__button compta-ra__button--primary" onClick={enregistrerCharges}>Enregistrer les charges</button></div>
    </div>}

    {!chargement && onglet === 'tresorerie' && <div className="compta-ra__grid"><div className="compta-ra__panel"><h2>Trésorerie constatée</h2>
      <div className="compta-ra__receipt-line"><span>Total encaissé</span><b>{fcfa(synthese.encaisse)}</b></div><div className="compta-ra__receipt-line"><span>Charges</span><b>{fcfa(synthese.charges)}</b></div><div className="compta-ra__receipt-line"><span>Solde</span><b>{fcfa(tresorerie)}</b></div>
    </div><div className="compta-ra__panel"><h2>Prévisions conservées</h2><p className="compta-ra__subtitle">Les paramètres historiques restent stockés sans transformation dans le document comptable.</p>
      <div className="compta-ra__receipt-line"><span>Taux de recouvrement</span><b>{etat.tauxRed ?? etat.tauxRecouvrement ?? '—'}%</b></div><div className="compta-ra__receipt-line"><span>Part mensualisée</span><b>{etat.pctMensualise ?? '—'}%</b></div>
    </div></div>}

    {!chargement && onglet === 'compta' && <Journal etat={etat} enregistrer={enregistrer} />}

    {modal?.type === 'paiement' && <div className="compta-ra__modal" role="presentation" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="compta-ra__dialog" role="dialog" aria-modal="true" aria-labelledby="titre-encaissement"><h2 id="titre-encaissement">Encaisser — {modal.student.prenom} {modal.student.nom}</h2>
      <form className="compta-ra__form" onSubmit={encaisser}><label>Montant<input autoFocus className="compta-ra__input" type="number" min="1" required value={paiement.montant} onChange={e => setPaiement({...paiement,montant:e.target.value})}/></label>
        <label>Mode<select className="compta-ra__input" value={paiement.mode} onChange={e => setPaiement({...paiement,mode:e.target.value})}><option>Espèces</option><option>Wave</option><option>Orange Money</option><option>Virement bancaire</option></select></label>
        <label>Motif<select className="compta-ra__input" value={paiement.motif} onChange={e => setPaiement({...paiement,motif:e.target.value})}><option>Scolarité</option><option>Inscription</option><option>Fournitures</option><option>Cantine</option><option>Cotisation</option></select></label>
        <div className="compta-ra__dialog-actions"><button type="button" className="compta-ra__button" onClick={() => setModal(null)}>Annuler</button><button className="compta-ra__button compta-ra__button--primary">Encaisser et générer le reçu</button></div>
      </form></div></div>}

    {modal?.type === 'historique' && <div className="compta-ra__modal" role="presentation" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Historique — {modal.student.prenom} {modal.student.nom}</h2>
      {(modal.student.history || []).map((p,index) => <div className="compta-ra__receipt-line" key={p.receiptId || index}><span>{p.date}<br/><small>{p.receiptId} · {p.mode}</small></span><span><b>{p.cancelled ? 'Annulé' : fcfa(p.amount)}</b>{!p.cancelled && <><button className="compta-ra__button" onClick={() => setModal({ type:'recu', student:modal.student, payment:p })}>🖨️</button><button className="compta-ra__button" onClick={() => setModal({ type:'confirmer-annulation', student:modal.student, payment:p })}>↻ Annuler</button></>}</span></div>)}
      <div className="compta-ra__dialog-actions"><button className="compta-ra__button" onClick={() => setModal(null)}>Fermer</button></div></div></div>}

    {modal?.type === 'confirmer-annulation' && <div className="compta-ra__modal"><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Confirmer la contre-passation</h2>
      <p>Le reçu <b>{modal.payment.receiptId}</b> sera annulé et une écriture inverse sera créée.</p>
      <div className="compta-ra__dialog-actions"><button className="compta-ra__button" onClick={() => setModal({ type:'historique', student:modal.student })}>Conserver</button><button className="compta-ra__button compta-ra__button--primary" onClick={() => annulerPaiement(modal.student, modal.payment)}>Confirmer la contre-passation</button></div>
    </div></div>}

    {modal?.type === 'confirmer-suppression-fixture' && <div className="compta-ra__modal"><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Supprimer la fixture de recette ?</h2>
      <p>Cette action supprimera uniquement <b>TEST-COMPTA-NATIVE</b>, ses reçus et leurs contre-passations.</p>
      <div className="compta-ra__dialog-actions"><button className="compta-ra__button" onClick={() => setModal(null)}>Conserver</button><button className="compta-ra__button compta-ra__button--primary" onClick={() => supprimerFixture(modal.student)}>Supprimer définitivement</button></div>
    </div></div>}

    {modal?.type === 'reduction' && <div className="compta-ra__modal" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Réduction — {modal.student.prenom} {modal.student.nom}</h2><form className="compta-ra__form" onSubmit={ajouterReduction}>
      <label>Libellé<input className="compta-ra__input" value={reduction.libelle} onChange={e => setReduction({...reduction,libelle:e.target.value})}/></label>
      <label>Type<select className="compta-ra__input" value={reduction.type} onChange={e => setReduction({...reduction,type:e.target.value})}><option value="montant">Montant fixe</option><option value="pourcentage">Pourcentage</option></select></label>
      <label>{reduction.type === 'pourcentage' ? 'Pourcentage' : 'Montant'}<input className="compta-ra__input" type="number" min="1" required value={reduction.montant} onChange={e => setReduction({...reduction,montant:e.target.value})}/></label>
      <div className="compta-ra__dialog-actions"><button type="button" className="compta-ra__button" onClick={() => setModal(null)}>Annuler</button><button className="compta-ra__button compta-ra__button--primary">Enregistrer</button></div>
    </form></div></div>}

    {modal?.type === 'depart' && <div className="compta-ra__modal" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Départ — {modal.student.prenom} {modal.student.nom}</h2><form className="compta-ra__form" onSubmit={enregistrerDepart}>
      <label>Date de départ<input className="compta-ra__input" type="date" required value={depart.date} onChange={e => setDepart({...depart,date:e.target.value})}/></label>
      <label>Motif<textarea className="compta-ra__input" required value={depart.motif} onChange={e => setDepart({...depart,motif:e.target.value})}/></label>
      <div className="compta-ra__dialog-actions"><button type="button" className="compta-ra__button" onClick={() => setModal(null)}>Annuler</button><button className="compta-ra__button compta-ra__button--primary">Confirmer le départ</button></div>
    </form></div></div>}

    {modal?.type === 'famille' && <div className="compta-ra__modal" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Encaissement famille</h2><form className="compta-ra__form" onSubmit={encaisserFamille}>
      <label>Famille<select className="compta-ra__input" required value={famille.cle} onChange={e => setFamille({cle:e.target.value,montants:{}})}><option value="">Choisir…</option>{[...new Set(etat.students.map(s => s.famille || String(s.nom || '').toUpperCase()).filter(Boolean))].sort().map(cle => <option key={cle}>{cle}</option>)}</select></label>
      {etat.students.filter(s => famille.cle && (s.famille || String(s.nom || '').toUpperCase()) === famille.cle).map(s => <label key={s.id}>{s.prenom} {s.nom} — reste {fcfa(resteDu(s))}<input className="compta-ra__input" type="number" min="0" max={resteDu(s) || undefined} placeholder="Montant" value={famille.montants[s.id] || ''} onChange={e => setFamille({...famille,montants:{...famille.montants,[s.id]:e.target.value}})}/></label>)}
      <div className="compta-ra__dialog-actions"><button type="button" className="compta-ra__button" onClick={() => setModal(null)}>Annuler</button><button className="compta-ra__button compta-ra__button--primary">Encaisser et générer les reçus</button></div>
    </form></div></div>}

    {modal?.type === 'nouvel-eleve' && <div className="compta-ra__modal" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="compta-ra__dialog" role="dialog" aria-modal="true"><h2>Nouvel élève comptable</h2><form className="compta-ra__form" onSubmit={ajouterEleve}>
      <label>Matricule<input className="compta-ra__input" required value={nouvelEleve.matricule} onChange={e => setNouvelEleve({...nouvelEleve,matricule:e.target.value})}/></label>
      <div className="compta-ra__grid"><label>Nom<input className="compta-ra__input" required value={nouvelEleve.nom} onChange={e => setNouvelEleve({...nouvelEleve,nom:e.target.value})}/></label><label>Prénom<input className="compta-ra__input" required value={nouvelEleve.prenom} onChange={e => setNouvelEleve({...nouvelEleve,prenom:e.target.value})}/></label></div>
      <label>Classe<select className="compta-ra__input" value={nouvelEleve.classe} onChange={e => setNouvelEleve({...nouvelEleve,classe:e.target.value})}>{['ps','gs','cp1','cp2','ce1','ce2','cm1','cm2'].map(code => <option key={code} value={code}>{classeLabel(code)}</option>)}</select></label>
      <label>Famille<input className="compta-ra__input" value={nouvelEleve.famille} onChange={e => setNouvelEleve({...nouvelEleve,famille:e.target.value})}/></label>
      <label><input type="checkbox" checked={nouvelEleve.cantine} onChange={e => setNouvelEleve({...nouvelEleve,cantine:e.target.checked})}/> Cantine</label>
      <div className="compta-ra__dialog-actions"><button type="button" className="compta-ra__button" onClick={() => setModal(null)}>Annuler</button><button className="compta-ra__button compta-ra__button--primary">Ajouter</button></div>
    </form></div></div>}

    {modal?.type === 'recu' && <div className="compta-ra__modal"><div className="compta-ra__dialog compta-ra__receipt" role="dialog" aria-modal="true"><div className="compta-ra__receipt-head"><b>ÉCOLE INTERNATIONALE BILINGUE IDEAL</b><h2>Reçu de paiement</h2></div>
      <div className="compta-ra__receipt-line"><span>Reçu</span><b>{modal.payment.receiptId}</b></div><div className="compta-ra__receipt-line"><span>Élève</span><b>{modal.student.prenom} {modal.student.nom}</b></div><div className="compta-ra__receipt-line"><span>Motif</span><b>{modal.payment.motif}</b></div><div className="compta-ra__receipt-line"><span>Montant</span><b>{fcfa(modal.payment.amount)}</b></div><div className="compta-ra__receipt-line"><span>Mode</span><b>{modal.payment.mode}</b></div><div className="compta-ra__receipt-line"><span>Encaissé par</span><b>{modal.payment.par_nom || '—'}</b></div>
      <div className="compta-ra__dialog-actions"><button className="compta-ra__button" onClick={() => setModal(null)}>Fermer</button><button className="compta-ra__button compta-ra__button--primary" onClick={() => window.print()}>🖨️ Imprimer</button></div></div></div>}
  </section>
}

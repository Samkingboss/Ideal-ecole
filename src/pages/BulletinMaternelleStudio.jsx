import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'
import { MATERNELLE_DOMAINS, estObjectifAnglaisMaternelle, langueMaternelle } from '../lib/programmes/maternelle'
import './BulletinMaternelleStudio.css'

const NIVEAUX = [
  { code: 'TB', court: 'Très bien', valeur: 4 },
  { code: 'B', court: 'Bien', valeur: 3 },
  { code: 'M', court: 'Moyen', valeur: 2 },
  { code: 'AR', court: 'À renforcer', valeur: 1 },
]

const DEVELOPPEMENT_PERSONNEL = [
  { id: 'controle_soi', titre: 'Contrôle de soi', aide: 'Gère progressivement ses émotions et ses impulsions.' },
  { id: 'autonomie', titre: 'Autonomie', aide: 'S’organise, range et demande de l’aide au bon moment.' },
  { id: 'perseverance', titre: 'Persévérance et confiance', aide: 'Essaie, recommence et va au bout d’une activité.' },
  { id: 'cooperation', titre: 'Coopération et empathie', aide: 'Écoute, partage, aide et travaille avec les autres.' },
  { id: 'responsabilite', titre: 'Respect et responsabilité', aide: 'Respecte les règles, les personnes et le matériel.' },
]

const DISTINCTIONS = ['Curiosité', 'Créativité', 'Persévérance', 'Bienveillance', 'Autonomie']
const TRIMESTRES = [{ id: 't1', label: '1er trimestre' }, { id: 't2', label: '2e trimestre' }, { id: 't3', label: '3e trimestre' }]
const STATUTS_SUIVI = [
  { id: 'regulier', label: 'Régulier' },
  { id: 'a_consolider', label: 'À consolider' },
  { id: 'accompagnement', label: 'Besoin d’accompagnement' },
  { id: 'non_applicable', label: 'Non applicable' },
]
const SUIVI_VIDE = {
  devoirs_statut: 'non_applicable', hygiene_statut: 'non_applicable', rencontres_statut: 'non_applicable',
  points_appui: '', a_accompagner: '', contexte: '', droit_reponse: '',
  actions: [
    { texte: '', responsable: 'Famille', echeance: '' },
    { texte: '', responsable: 'École + famille', echeance: '' },
    { texte: '', responsable: 'École', echeance: '' },
  ],
}
const estMaternelle = nom => /^(ps|gs|petite section|grande section)$/i.test(String(nom || '').trim())
const sectionDe = nom => /^(ps|petite section)$/i.test(String(nom || '').trim()) ? 'PS' : 'GS'
const anneeScolaire = () => { const d = new Date(); const a = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return `${a} - ${a + 1}` }
const ageDe = date => {
  if (!date) return '—'
  const naissance = new Date(`${date}T12:00:00`)
  if (Number.isNaN(naissance.getTime())) return '—'
  const d = new Date(); let age = d.getFullYear() - naissance.getFullYear()
  if (d < new Date(d.getFullYear(), naissance.getMonth(), naissance.getDate())) age -= 1
  return `${Math.max(0, age)} ans`
}
const valeurDe = code => NIVEAUX.find(n => n.code === code)?.valeur || 0
const pourcentage = codes => { const notes = codes.map(valeurDe).filter(Boolean); return notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) * 25 / notes.length) : 0 }
const texteScore = score => score >= 85 ? 'Très bien acquis' : score >= 65 ? 'Acquis' : score >= 45 ? 'En cours' : score > 0 ? 'À renforcer' : 'Non évalué'
const PRESENTATION_DOMAINES = {
  langage_prelecture: { couleur: '#2563eb', fond: '#eff6ff', icone: 'Aa' },
  ecriture_motricite_fine: { couleur: '#db2777', fond: '#fdf2f8', icone: '✎' },
  mathematiques: { couleur: '#7c3aed', fond: '#f5f3ff', icone: '123' },
  sciences_decouverte: { couleur: '#059669', fond: '#ecfdf5', icone: '✦' },
  art_expression: { couleur: '#ea580c', fond: '#fff7ed', icone: '♪' },
  motricite_globale: { couleur: '#0891b2', fond: '#ecfeff', icone: '↗' },
  education_civique: { couleur: '#ca8a04', fond: '#fefce8', icone: '♥' },
}
const presentationDomaine = id => PRESENTATION_DOMAINES[id] || { couleur: '#475569', fond: '#f8fafc', icone: '●' }
const resumePerformance = score => score >= 85
  ? 'Les acquis observés sont très solides. Votre enfant mobilise ses compétences avec aisance et régularité.'
  : score >= 65
    ? 'Les apprentissages sont bien engagés. Votre enfant progresse de façon régulière dans les domaines travaillés.'
    : score >= 45
      ? 'Les compétences se construisent progressivement. Les encouragements et la pratique l’aideront à les consolider.'
      : score > 0
        ? 'Plusieurs apprentissages demandent encore un accompagnement attentif et des occasions régulières de s’exercer.'
        : 'Les observations de la période ne sont pas encore assez complètes pour établir une synthèse.'
const statutDepuisTaux = (reussis, observes) => !observes ? 'non_applicable' : reussis / observes >= .9 ? 'regulier' : reussis / observes >= .7 ? 'a_consolider' : 'accompagnement'
const statutLabel = statut => STATUTS_SUIVI.find(s => s.id === statut)?.label || 'Confidentiel'
const statutClasse = statut => ['regulier', 'a_consolider', 'accompagnement', 'non_applicable'].includes(statut) ? statut : 'confidentiel'
const valeurPourcent = code => valeurDe(code) * 25

function EnteteRapport({ titre, sousTitre, trimestre }) {
  return <header className="bm-report-header">
    <div className="bm-brand"><img src="/logo-ideal.png" alt="IDEAL École Internationale Bilingue" /><span>EXCELLENCE · BILINGUISME · INNOVATION</span></div>
    <div className="bm-report-heading"><small>BULLETIN MATERNELLE · ÉCOLE INTERNATIONALE BILINGUE</small><b>{titre}</b><strong>{sousTitre}</strong></div>
    <div className="bm-report-period">{TRIMESTRES.find(t => t.id === trimestre)?.label}<small>{anneeScolaire()}</small></div>
  </header>
}

function SelectStatut({ valeur, onChange, label }) {
  return <label className="bm-family-status-field"><span>{label}</span><select value={valeur || 'non_applicable'} onChange={e => onChange(e.target.value)}>{STATUTS_SUIVI.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
}

function BoutonsNiveau({ valeur, onChange, legende }) {
  return <div className="bm-levels" aria-label={legende}>
    {NIVEAUX.map(n => <button key={n.code} type="button" className={`bm-level bm-level-${n.code.toLowerCase()} ${valeur === n.code ? 'is-selected' : ''}`} onClick={() => onChange(n.code)} aria-pressed={valeur === n.code} title={n.court}>
      <span>{n.code}</span><small>{n.court}</small>
    </button>)}
  </div>
}

export default function BulletinMaternelleStudio({ user, eleves = [] }) {
  const [bulletins, setBulletins] = useState([])
  const [horaires, setHoraires] = useState([])
  const [presences, setPresences] = useState([])
  const [photos, setPhotos] = useState({})
  const [suivisFamille, setSuivisFamille] = useState([])
  const [selection, setSelection] = useState('')
  const [trimestre, setTrimestre] = useState('t1')
  const [vue, setVue] = useState('evaluation')
  const [onglet, setOnglet] = useState('')
  const [brouillons, setBrouillons] = useState({})
  const [suiviBrouillons, setSuiviBrouillons] = useState({})
  const [etat, setEtat] = useState('chargement')
  const [message, setMessage] = useState('')
  const [sauvegarde, setSauvegarde] = useState('')
  const brouillonsRef = useRef(brouillons)
  const suiviBrouillonsRef = useRef(suiviBrouillons)
  const fileSauvegarde = useRef(Promise.resolve())
  const fileSuivi = useRef(Promise.resolve())

  const maternelle = useMemo(() => eleves.filter(e => estMaternelle(e.classes?.nom)), [eleves])
  const langue = langueMaternelle(user)
  const sectionTitulaire = langue === 'fr' ? 'GS' : 'PS'
  const eleve = maternelle.find(e => String(e.id) === String(selection)) || maternelle[0]
  const section = sectionDe(eleve?.classes?.nom)
  const peutImprimer = Boolean(eleve && section === sectionTitulaire)
  const domaines = useMemo(() => (MATERNELLE_DOMAINS[section]?.[trimestre] || []).map(domaine => ({ ...domaine, titre: domaine.title.replace(/^\d+\.\s*/, ''), objectifs: domaine.competencies.map((description, index) => ({ key: `${domaine.id}_${index}`, description })).filter(o => langue === 'en' ? estObjectifAnglaisMaternelle(o.description) : !estObjectifAnglaisMaternelle(o.description)) })).filter(d => d.objectifs.length), [section, trimestre, langue])
  const ligneBulletin = useMemo(() => bulletins.find(b => String(b.eleve_id) === String(eleve?.id) && b.trimestre === trimestre), [bulletins, eleve, trimestre])
  const contributions = ligneBulletin?.donnees?.contributions || {}
  const contribution = contributions[langue] || {}
  const cleBrouillon = `${eleve?.id || 'aucun'}:${trimestre}:${langue}`
  const brouillonServeur = { evaluations: contribution.evaluations || {}, developpement_personnel: contribution.developpement_personnel || {}, appreciation: contribution.appreciation || '', badges: contribution.badges || [] }
  const brouillon = brouillons[cleBrouillon] || brouillonServeur
  const ligneSuivi = useMemo(() => suivisFamille.find(s => String(s.eleve_id) === String(eleve?.id)), [suivisFamille, eleve])
  const cleSuivi = `${eleve?.id || 'aucun'}:${trimestre}`
  const suiviServeur = { ...SUIVI_VIDE, ...(ligneSuivi?.donnees || {}), actions: Array.isArray(ligneSuivi?.donnees?.actions) ? ligneSuivi.donnees.actions : SUIVI_VIDE.actions }
  const suivi = suiviBrouillons[cleSuivi] || suiviServeur

  useEffect(() => {
    let annule = false
    ;(async () => {
      if (!maternelle.length) { setEtat('pret'); return }
      const ids = maternelle.map(e => e.id)
      const [b, h, p, ph, sf] = await Promise.all([
        supabase.rpc('lire_bulletins_maternelle', { p_eleve_ids: ids }), supabase.rpc('lire_pilotage_heures_pedagogiques'),
        supabase.from('presences_eleves').select('eleve_id,date_jour,statut,minutes_retard,justification,heure_arrivee,heure_depart,retard_matin,retard_soir').in('eleve_id', ids),
        supabase.rpc('lire_photos_bulletins_maternelle', { p_eleve_ids: ids }),
        supabase.rpc('lire_suivis_famille_maternelle', { p_eleve_ids: ids, p_trimestre: trimestre, p_annee_scolaire: anneeScolaire() }),
      ])
      if (annule) return
      if (b.error) { console.error('lire_bulletins_maternelle', b.error); setMessage('La sauvegarde serveur des bulletins doit être installée avec le script SQL dédié.') }
      if (sf.error) { console.error('lire_suivis_famille_maternelle', sf.error); setMessage('La fiche famille-école doit être installée avec le script SQL dédié.') }
      setBulletins(Array.isArray(b.data) ? b.data : []); setHoraires(Array.isArray(h.data) ? h.data : []); setPresences(Array.isArray(p.data) ? p.data : [])
      setSuivisFamille(Array.isArray(sf.data) ? sf.data : [])
      const refs = Array.isArray(ph.data) ? ph.data : []; const chemins = [...new Set(refs.map(x => x.photo_chemin).filter(Boolean))]
      const signees = chemins.length ? await supabase.storage.from('inscriptions').createSignedUrls(chemins, 3600) : { data: [] }
      const parChemin = new Map((signees.data || []).filter(x => x.signedUrl && !x.error).map(x => [x.path, x.signedUrl]))
      setPhotos(Object.fromEntries(refs.map(x => [String(x.eleve_id), parChemin.get(x.photo_chemin) || x.photo_base64 || '']))); setEtat('pret')
    })()
    return () => { annule = true }
  }, [maternelle, trimestre])

  const enregistrer = prochain => {
    if (!eleve) return
    setSauvegarde('Sauvegarde…')
    const contexte = { eleveId: eleve.id, trimestre, langue, donnees: ligneBulletin?.donnees || {}, contributions }
    fileSauvegarde.current = fileSauvegarde.current.then(async () => {
      const { error } = await supabase.rpc('sauver_bulletin_maternelle', { p_eleve_id: contexte.eleveId, p_trimestre: contexte.trimestre, p_annee_scolaire: anneeScolaire(), p_donnees: prochain })
      if (error) { console.error('sauver_bulletin_maternelle', error); setSauvegarde('Échec de sauvegarde'); setMessage(`Sauvegarde impossible : ${error.message}`); return }
      setSauvegarde('Sauvegardé')
      setBulletins(actuels => {
        const autres = actuels.filter(b => !(String(b.eleve_id) === String(contexte.eleveId) && b.trimestre === contexte.trimestre))
        const existant = actuels.find(b => String(b.eleve_id) === String(contexte.eleveId) && b.trimestre === contexte.trimestre)
        const base = existant?.donnees || contexte.donnees
        const donnees = { ...base, contributions: { ...(base.contributions || contexte.contributions), [contexte.langue]: prochain }, statut: base.statut || 'brouillon' }
        return [...autres, { eleve_id: contexte.eleveId, trimestre: contexte.trimestre, annee_scolaire: anneeScolaire(), donnees, updated_at: new Date().toISOString() }]
      })
    })
  }
  const modifier = transformation => {
    const actuel = brouillonsRef.current[cleBrouillon] || brouillonServeur
    const prochain = transformation(actuel)
    const tous = { ...brouillonsRef.current, [cleBrouillon]: prochain }
    brouillonsRef.current = tous
    setBrouillons(tous)
    enregistrer(prochain)
  }
  const enregistrerSuivi = prochain => {
    if (!eleve) return
    setSauvegarde('Sauvegarde du suivi…')
    const contexte = { eleveId: eleve.id, trimestre, cle: cleSuivi }
    fileSuivi.current = fileSuivi.current.then(async () => {
      const { error } = await supabase.rpc('sauver_suivi_famille_maternelle', {
        p_eleve_id: contexte.eleveId, p_trimestre: contexte.trimestre,
        p_annee_scolaire: anneeScolaire(), p_donnees: prochain,
      })
      if (error) { console.error('sauver_suivi_famille_maternelle', error); setSauvegarde('Échec de sauvegarde'); setMessage(`Suivi famille impossible : ${error.message}`); return }
      setSauvegarde('Suivi sauvegardé')
      setSuivisFamille(actuels => {
        const autres = actuels.filter(s => String(s.eleve_id) !== String(contexte.eleveId))
        const precedent = actuels.find(s => String(s.eleve_id) === String(contexte.eleveId))
        return [...autres, { ...(precedent || {}), eleve_id: contexte.eleveId, donnees: prochain, updated_at: new Date().toISOString() }]
      })
    })
  }
  const modifierSuivi = (transformation, sauvegarder = true) => {
    const actuel = suiviBrouillonsRef.current[cleSuivi] || suiviServeur
    const prochain = transformation(actuel)
    const tous = { ...suiviBrouillonsRef.current, [cleSuivi]: prochain }
    suiviBrouillonsRef.current = tous
    setSuiviBrouillons(tous)
    if (sauvegarder) enregistrerSuivi(prochain)
    return prochain
  }
  const noterObjectif = (key, valeur) => modifier(b => ({ ...b, evaluations: { ...b.evaluations, [key]: valeur } }))
  const noterDeveloppement = (key, valeur) => modifier(b => ({ ...b, developpement_personnel: { ...b.developpement_personnel, [key]: valeur } }))
  const basculerBadge = badge => modifier(b => ({ ...b, badges: b.badges.includes(badge) ? b.badges.filter(x => x !== badge) : [...b.badges, badge] }))

  const evaluationsFusionnees = { ...(contributions.fr?.evaluations || {}), ...(contributions.en?.evaluations || {}), ...brouillon.evaluations }
  const personnelFusionne = { ...(contributions.fr?.developpement_personnel || {}), ...(contributions.en?.developpement_personnel || {}), ...brouillon.developpement_personnel }
  const tousDomaines = (MATERNELLE_DOMAINS[section]?.[trimestre] || []).map(d => ({ id: d.id, titre: d.title.replace(/^\d+\.\s*/, ''), score: pourcentage(d.competencies.map((_, index) => evaluationsFusionnees[`${d.id}_${index}`])) }))
  const domainesEvalues = tousDomaines.filter(d => d.score > 0)
  const scoreGlobal = domainesEvalues.length ? Math.round(domainesEvalues.reduce((total, d) => total + d.score, 0) / domainesEvalues.length) : 0
  const totalObjectifs = domaines.reduce((n, d) => n + d.objectifs.length, 0)
  const objectifsNotes = domaines.reduce((n, d) => n + d.objectifs.filter(o => brouillon.evaluations[o.key]).length, 0)
  const lignesHeures = horaires.filter(h => String(h.classe_id) === String(eleve?.classe_id))
  const semaines = lignesHeures.reduce((m, h) => Math.max(m, Number(h[`semaines_${trimestre}`]) || 0), 0)
  const heures = lignesHeures.reduce((n, h) => n + Number(h.heures_hebdo || 0), 0) * semaines
  const absences = presences.filter(p => String(p.eleve_id) === String(eleve?.id) && p.statut !== 'present').length
  const joursPointes = Number(ligneSuivi?.jours_pointes || 0)
  const absencesPeriode = Number(ligneSuivi?.absences || 0)
  const joursPresents = Math.max(0, joursPointes - absencesPeriode)
  const arriveesHeure = Number(ligneSuivi?.arrivees_a_l_heure || 0)
  const departsRenseignes = Number(ligneSuivi?.departs_renseignes || 0)
  const retraitsHeure = Number(ligneSuivi?.retraits_a_l_heure || 0)
  const absencesSignalees = Number(ligneSuivi?.absences_signalees || 0)
  const statutArrivee = statutDepuisTaux(arriveesHeure, joursPresents)
  const statutRetrait = statutDepuisTaux(retraitsHeure, departsRenseignes)
  const statutAbsence = statutDepuisTaux(absencesSignalees, absencesPeriode)
  const tauxAssiduite = joursPointes ? Math.round(joursPresents * 100 / joursPointes) : 0
  const valeursEvaluees = Object.values(evaluationsFusionnees).filter(v => NIVEAUX.some(n => n.code === v))
  const acquisReperes = valeursEvaluees.filter(v => v === 'TB' || v === 'B').length
  const petitsPas = valeursEvaluees.filter(v => v === 'M' || v === 'AR').length
  const pointFort = domainesEvalues.reduce((meilleur, d) => !meilleur || d.score > meilleur.score ? d : meilleur, null)
  const conseils = domainesEvalues.slice().sort((a, b) => a.score - b.score).slice(0, 3).map((d, i) => ({
    titre: ['PARLER', 'MANIPULER', 'BOUGER'][i] || 'ENCOURAGER',
    texte: `Reprendre une activité courte de ${d.titre.toLocaleLowerCase('fr')} et laisser l’enfant expliquer ce qu’il fait.`,
  }))

  const soumettre = async () => {
    if (!peutImprimer) return setMessage('Seule la maîtresse titulaire de cette section peut soumettre le bulletin.')
    const { error } = await supabase.rpc('soumettre_bulletin_maternelle', { p_eleve_id: eleve.id, p_trimestre: trimestre, p_annee_scolaire: anneeScolaire() })
    if (error) { console.error('soumettre_bulletin_maternelle', error); return setMessage(`Soumission impossible : ${error.message}`) }
    const notifie = await pushNotification('directeur', { titre: '📘 Bulletin maternelle à signer', message: `${eleve.prenom} ${eleve.nom} · ${section} · ${trimestre.toUpperCase()}`, type: 'bulletin_maternelle', tabTarget: 'maternelle', ref: eleve.id })
    setMessage(notifie ? 'Bulletin soumis à la Direction pour signature.' : 'Bulletin soumis ; la notification Direction doit être vérifiée.')
  }

  if (etat === 'chargement') return <div className="empty-state">Chargement des bulletins maternelle…</div>
  if (!maternelle.length) return <div className="empty-state">Aucun élève de Petite ou Grande Section dans vos classes affectées.</div>
  const domaineActif = onglet === 'developpement-personnel' ? null : (domaines.find(d => d.id === onglet) || domaines[0])
  const statut = ligneBulletin?.donnees?.statut || 'brouillon'
  const suiviLignes = [
    { label: 'Arrivée à l’école à l’heure', source: 'Pointage accueil', observation: joursPresents ? `${arriveesHeure} / ${joursPresents} à l’heure` : 'Aucun pointage', statut: statutArrivee },
    { label: 'Retrait de l’enfant à l’heure', source: 'Pointage sortie', observation: departsRenseignes ? `${retraitsHeure} / ${departsRenseignes} à l’heure` : 'Aucun départ renseigné', statut: statutRetrait },
    { label: 'Absence signalée à temps', source: 'Absences + justificatifs', observation: absencesPeriode ? `${absencesSignalees} / ${absencesPeriode} signalée(s)` : 'Aucune absence', statut: absencesPeriode ? statutAbsence : 'regulier' },
    { label: 'Devoirs / activités rendus à temps', source: 'Cahier de devoirs', observation: 'Observation de l’équipe', statut: suivi.devoirs_statut },
    { label: 'Hygiène et tenue adaptées', source: 'Observation encadrée', observation: 'Observation de l’équipe', statut: suivi.hygiene_statut },
    { label: 'Rencontres / documents suivis', source: 'Agenda + dossier', observation: 'Observation de l’équipe', statut: suivi.rencontres_statut },
    { label: 'Échéancier de scolarité', source: 'Comptabilité · privé', observation: suivi.scolarite_observation || 'Réservé à l’administration', statut: suivi.scolarite_statut || 'confidentiel' },
  ]
  const actionsSuivi = (Array.isArray(suivi.actions) ? suivi.actions : []).filter(a => a?.texte)

  return <section className="bm-studio">
    <header className="bm-title"><div><span>MATERNELLE</span><h2>Évaluer et raconter les progrès</h2><p>Une saisie simple pour l’enseignante, un bulletin clair pour la famille.</p></div><div className="bm-save-state" aria-live="polite">{sauvegarde || 'Prêt'}</div></header>
    {message && <div className={`bm-message ${/impossible|installée|échec/i.test(message) ? 'is-error' : ''}`}>{message}</div>}
    <div className="bm-toolbar">
      <label>Élève<select value={eleve?.id || ''} onChange={e => setSelection(e.target.value)}>{maternelle.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} · {sectionDe(e.classes?.nom)}</option>)}</select></label>
      <div className="bm-trimesters">{TRIMESTRES.map(t => <button key={t.id} className={trimestre === t.id ? 'is-active' : ''} onClick={() => setTrimestre(t.id)}>{t.label}</button>)}</div>
      <div className="bm-view-switch"><button className={vue === 'evaluation' ? 'is-active' : ''} onClick={() => setVue('evaluation')}>✍️ Évaluer</button><button className={vue === 'famille' ? 'is-active' : ''} onClick={() => setVue('famille')}>🤝 Famille-école</button><button className={vue === 'bulletin' ? 'is-active' : ''} onClick={() => setVue('bulletin')}>📊 Voir le bulletin</button></div>
    </div>

    {vue === 'evaluation' && <div className="bm-evaluation">
      <div className="bm-progress"><div><b>{objectifsNotes}/{totalObjectifs}</b><span>objectifs renseignés dans votre langue</span></div><progress max={Math.max(1, totalObjectifs)} value={objectifsNotes} /></div>
      <nav className="bm-domain-nav" aria-label="Domaines d’évaluation">{domaines.map(d => <button key={d.id} className={domaineActif?.id === d.id ? 'is-active' : ''} onClick={() => setOnglet(d.id)}>{d.titre}</button>)}<button className={onglet === 'developpement-personnel' ? 'is-active is-personal' : 'is-personal'} onClick={() => setOnglet('developpement-personnel')}>Développement personnel</button></nav>
      {domaineActif && <article className="bm-domain-panel"><header><div><span style={{ background: domaineActif.color }} /><h3>{domaineActif.titre}</h3></div><b>{domaineActif.objectifs.filter(o => brouillon.evaluations[o.key]).length}/{domaineActif.objectifs.length}</b></header><div className="bm-objectives">{domaineActif.objectifs.map(o => <div className="bm-objective" key={o.key}><p>{o.description}</p><BoutonsNiveau valeur={brouillon.evaluations[o.key]} onChange={v => noterObjectif(o.key, v)} legende={`Évaluation de ${o.description}`} /></div>)}</div></article>}
      {onglet === 'developpement-personnel' && <article className="bm-domain-panel bm-personal-panel"><header><div><span /><h3>Développement personnel</h3></div><b>{Object.keys(brouillon.developpement_personnel).length}/5</b></header><p className="bm-panel-intro">Ces cinq repères sont des observations de vie et de maturité. Ils restent distincts du programme scolaire.</p><div className="bm-objectives">{DEVELOPPEMENT_PERSONNEL.map(c => <div className="bm-objective" key={c.id}><p><strong>{c.titre}</strong><small>{c.aide}</small></p><BoutonsNiveau valeur={brouillon.developpement_personnel[c.id]} onChange={v => noterDeveloppement(c.id, v)} legende={`Observation : ${c.titre}`} /></div>)}</div></article>}
      <article className="bm-after-matrix"><h3>Distinctions et appréciation</h3><p>Cette partie vient après la matrice d’évaluation.</p><div className="bm-badges">{DISTINCTIONS.map(b => <button key={b} className={brouillon.badges.includes(b) ? 'is-active' : ''} onClick={() => basculerBadge(b)}>★ {b}</button>)}</div><label>Appréciation de l’enseignante<textarea value={brouillon.appreciation} onChange={e => { const prochain = { ...(brouillonsRef.current[cleBrouillon] || brouillonServeur), appreciation: e.target.value }; const tous = { ...brouillonsRef.current, [cleBrouillon]: prochain }; brouillonsRef.current = tous; setBrouillons(tous) }} onBlur={() => enregistrer(brouillonsRef.current[cleBrouillon] || brouillonServeur)} placeholder="Un message concret, encourageant et utile à la famille…" /></label></article>
    </div>}

    {vue === 'famille' && <div className="bm-family-editor">
      <div className="bm-family-intro"><div><b>Partenariat famille-école</b><p>Des faits, du contexte et des actions partagées. Cette fiche n’attribue aucune note aux parents et n’affecte jamais les résultats de l’enfant.</p></div><span>Suivi bienveillant</span></div>
      <section className="bm-family-auto"><h3>Repères alimentés automatiquement</h3><div>{suiviLignes.slice(0, 3).map(l => <article key={l.label}><span>{l.label}</span><b>{l.observation}</b><small className={`bm-follow-${statutClasse(l.statut)}`}>{statutLabel(l.statut)}</small></article>)}</div></section>
      <section className="bm-family-manual"><h3>Observations encadrées</h3><p>Choisissez un repère seulement à partir de faits constatés pendant la période.</p><div className="bm-family-status-grid">
        <SelectStatut label="Devoirs / activités rendus à temps" valeur={suivi.devoirs_statut} onChange={v => modifierSuivi(s => ({ ...s, devoirs_statut: v }))} />
        <SelectStatut label="Hygiène et tenue adaptées" valeur={suivi.hygiene_statut} onChange={v => modifierSuivi(s => ({ ...s, hygiene_statut: v }))} />
        <SelectStatut label="Rencontres / documents suivis" valeur={suivi.rencontres_statut} onChange={v => modifierSuivi(s => ({ ...s, rencontres_statut: v }))} />
      </div></section>
      <section className="bm-family-notes"><label>Points d’appui<textarea value={suivi.points_appui || ''} onChange={e => modifierSuivi(s => ({ ...s, points_appui: e.target.value }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="Ce que la famille fait déjà régulièrement…" /></label><label>À accompagner<textarea value={suivi.a_accompagner || ''} onChange={e => modifierSuivi(s => ({ ...s, a_accompagner: e.target.value }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="Un point précis à consolider ensemble…" /></label><label>Contexte partagé<textarea value={suivi.contexte || ''} onChange={e => modifierSuivi(s => ({ ...s, contexte: e.target.value }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="Transport, santé, organisation familiale ou autre explication utile…" /></label></section>
      <section className="bm-family-actions"><h3>Plan d’action école-famille</h3>{(suivi.actions || SUIVI_VIDE.actions).map((action, index) => <div key={index}><span>{index + 1}</span><input value={action.texte || ''} onChange={e => modifierSuivi(s => ({ ...s, actions: (s.actions || SUIVI_VIDE.actions).map((a, i) => i === index ? { ...a, texte: e.target.value } : a) }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="Action concrète" /><input value={action.responsable || ''} onChange={e => modifierSuivi(s => ({ ...s, actions: (s.actions || SUIVI_VIDE.actions).map((a, i) => i === index ? { ...a, responsable: e.target.value } : a) }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="Responsable" /><input value={action.echeance || ''} onChange={e => modifierSuivi(s => ({ ...s, actions: (s.actions || SUIVI_VIDE.actions).map((a, i) => i === index ? { ...a, echeance: e.target.value } : a) }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="Échéance" /></div>)}</section>
      <section className="bm-family-response"><label>Droit de réponse / situation particulière<textarea value={suivi.droit_reponse || ''} onChange={e => modifierSuivi(s => ({ ...s, droit_reponse: e.target.value }), false)} onBlur={() => enregistrerSuivi(suiviBrouillonsRef.current[cleSuivi] || suiviServeur)} placeholder="À compléter avec la famille pendant l’échange…" /></label><aside>La situation de scolarité est réservée au Responsable administratif et à la Direction. Aucun montant n’apparaît dans le bulletin familial.</aside></section>
    </div>}

    {vue === 'bulletin' && <div className="bm-report-wrap">
      <div className="bm-report-actions"><span>Statut : <b>{statut.replaceAll('_', ' ')}</b></span><button onClick={() => window.print()} disabled={!peutImprimer}>🖨️ Imprimer</button><button className="is-primary" onClick={soumettre} disabled={!peutImprimer}>Envoyer à la Direction</button>{!peutImprimer && <small>Impression et soumission réservées à la titulaire de la section.</small>}</div>
      <article className="bm-report">
        <section className="bm-report-page">
          <EnteteRapport titre="CARNET TRIMESTRIEL" sousTitre="DE PROGRÈS" trimestre={trimestre} />
          <section className="bm-performance-card">
          <div className="bm-performance-brand"><img src="/logo-ideal.png" alt="IDEAL École Internationale Bilingue" /><span>MON PORTRAIT D’APPRENTISSAGE</span></div>
          <div className="bm-performance-main">
            <div className="bm-performance-photo">{photos[String(eleve.id)] ? <img src={photos[String(eleve.id)]} alt={`Photo de ${eleve.prenom} ${eleve.nom}`} /> : <div className="bm-photo-placeholder">Photo<br />officielle</div>}</div>
            <div className="bm-performance-identity"><small>{section} · {TRIMESTRES.find(t => t.id === trimestre)?.label}</small><h1>{eleve.prenom} {eleve.nom}</h1><p>Matricule {eleve.matricule || '—'} · {ageDe(eleve.date_naissance)}</p><p>{heures || '—'} h programmées · {absences} absence(s)</p></div>
            <div className="bm-performance-score" style={{ '--bm-score': `${scoreGlobal * 3.6}deg` }}><strong>{scoreGlobal ? `${scoreGlobal}%` : '—'}</strong><span>progression<br />globale</span></div>
          </div>
          <div className="bm-performance-summary"><b>{texteScore(scoreGlobal)}</b><p>{resumePerformance(scoreGlobal)}</p><small>{domainesEvalues.length}/{tousDomaines.length} domaines évalués sur la période</small></div>
          </section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>01</span><div><h2>Le trimestre en un regard</h2><p>Les informations essentielles pour comprendre les progrès de l’enfant.</p></div></div><div className="bm-overview-grid"><article><b>{pointFort?.score ? `${pointFort.score}%` : '—'}</b><span>Point fort</span><small>{pointFort?.titre || 'Pas encore évalué'}</small></article><article><b>{personnelFusionne.autonomie ? `${valeurPourcent(personnelFusionne.autonomie)}%` : '—'}</b><span>Autonomie</span><small>{NIVEAUX.find(n => n.code === personnelFusionne.autonomie)?.court || 'Non évaluée'}</small></article><article><b>{acquisReperes}</b><span>Acquis repérés</span><small>Très bien ou bien acquis</small></article><article><b>{petitsPas}</b><span>Petits pas</span><small>À construire ou renforcer</small></article></div></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>02</span><div><h2>Mon chemin de progrès</h2><p>Une lecture réelle des domaines évalués, sans comparaison entre les enfants.</p></div></div><div className="bm-progress-path">{tousDomaines.map(d => <div key={d.id}><span>{d.titre}</span><i><b style={{ width: `${d.score}%` }} /></i><strong>{d.score ? `${d.score}%` : '—'}</strong></div>)}</div></section>
          <section className="bm-report-section bm-team-summary"><div className="bm-section-heading"><span>03</span><div><h2>Ce que nous retenons</h2><p>La synthèse commune des observations françaises et anglaises.</p></div></div><p>{resumePerformance(scoreGlobal)}</p></section>
          <div className="bm-page-number">Page 1 / 4</div>
        </section>

        <section className="bm-report-page">
          <EnteteRapport titre="MES PROGRÈS" sousTitre="EN DÉTAIL" trimestre={trimestre} />
          <section className="bm-report-section"><div className="bm-section-heading"><span>04</span><div><h2>Progression par matière</h2><p>Chaque carte présente un acquis observé et le prochain petit pas.</p></div></div><div className="bm-domain-cards">{tousDomaines.map(d => { const presentation = presentationDomaine(d.id); return <article key={d.id} className="bm-domain-card" style={{ '--bm-domain': presentation.couleur, '--bm-domain-bg': presentation.fond }}><header><span>{presentation.icone}</span><b>{d.score ? `${d.score}%` : '—'}</b></header><h3>{d.titre}</h3><div className="bm-domain-gauge"><i style={{ width: `${d.score}%` }} /></div><p>{texteScore(d.score)}</p></article> })}</div></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>•</span><div><h2>Grandir avec les autres</h2><p>Cinq repères de développement personnel observés au quotidien.</p></div></div><div className="bm-personal-results">{DEVELOPPEMENT_PERSONNEL.map(c => { const v = personnelFusionne[c.id]; return <div key={c.id}><span>{c.titre}</span><b className={`bm-chip-${String(v || '').toLowerCase()}`}>{NIVEAUX.find(n => n.code === v)?.court || 'Non évalué'}</b></div> })}</div><div className="bm-level-legend">{NIVEAUX.map(n => <span key={n.code} className={`bm-follow-${n.code === 'TB' || n.code === 'B' ? 'regulier' : n.code === 'M' ? 'a_consolider' : 'accompagnement'}`}><b>{n.code}</b>{n.court}</span>)}</div></section>
          <div className="bm-page-number">Page 2 / 4</div>
        </section>

        <section className="bm-report-page">
          <EnteteRapport titre="ENSEMBLE" sousTitre="POUR LA SUITE" trimestre={trimestre} />
          <section className="bm-report-section"><div className="bm-section-heading"><span>05</span><div><h2>Des idées pour continuer à la maison</h2><p>Trois actions simples, concrètes et adaptées au prochain petit pas.</p></div></div><div className="bm-home-tips">{(conseils.length ? conseils : [{ titre: 'PARLER', texte: 'Demander à l’enfant de raconter sa journée en trois phrases.' }, { titre: 'MANIPULER', texte: 'Trier des objets puis expliquer le critère choisi.' }, { titre: 'BOUGER', texte: 'Inventer un petit parcours et nommer chaque mouvement.' }]).map((c, i) => <article key={c.titre}><b>0{i + 1}</b><h3>{c.titre}</h3><p>{c.texte}</p></article>)}</div></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>06</span><div><h2>Les regards croisés de l’équipe</h2><p>Les deux langues racontent ensemble les progrès du même enfant.</p></div></div><div className="bm-appreciations"><p><b>Enseignante · Français</b>{contributions.fr?.appreciation || 'Observation à compléter.'}</p><p><b>Teacher · English</b>{contributions.en?.appreciation || 'Observation to be completed.'}</p></div></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>07</span><div><h2>Vie de classe et développement personnel</h2><p>Des repères essentiels pour comprendre comment l’enfant apprend et grandit.</p></div></div><div className="bm-life-grid"><div>{DEVELOPPEMENT_PERSONNEL.map(c => { const v = personnelFusionne[c.id]; const pct = valeurPourcent(v); return <div key={c.id}><span>{c.titre}</span><i><b style={{ width: `${pct}%` }} /></i><strong>{pct ? `${pct}%` : '—'}</strong></div> })}</div><article><span>ASSIDUITÉ</span><b>{tauxAssiduite ? `${tauxAssiduite}%` : '—'}</b><small>{absencesPeriode} absence(s) sur la période</small></article></div></section>
          <section className="bm-report-section bm-encouragements"><div className="bm-section-heading"><span>08</span><div><h2>Encouragements et distinctions</h2><p>Ce que l’équipe éducative choisit de valoriser ce trimestre.</p></div></div><div className="bm-report-badges">{(brouillon.badges.length ? brouillon.badges : ['Chaque progrès compte']).map(b => <span key={b}>★ {b}</span>)}</div></section>
          <footer><div><span>ENSEIGNANTE · FRANÇAIS</span><i /></div><div><span>ENSEIGNANTE · ANGLAIS</span><i /></div><div><span>DIRECTION</span><i /></div></footer>
          <div className="bm-page-number">Page 3 / 4</div>
        </section>

        <section className="bm-report-page bm-family-report">
          <EnteteRapport titre="PARTENARIAT" sousTitre="FAMILLE - ÉCOLE" trimestre={trimestre} />
          <section className="bm-family-identity"><div className="bm-family-photo">{photos[String(eleve.id)] ? <img src={photos[String(eleve.id)]} alt="" /> : `${eleve.prenom?.[0] || ''}${eleve.nom?.[0] || ''}`}</div><div><h2>{eleve.prenom} {eleve.nom}</h2><p>{section} · {TRIMESTRES.find(t => t.id === trimestre)?.label} · Parent / tuteur : __________________</p><small>Cette fiche soutient le dialogue. Elle n’affecte jamais les résultats ou les droits de l’enfant.</small></div><b>Suivi bienveillant</b></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>09</span><div><h2>Repères factuels de la période</h2><p>Chaque constat indique sa source. « À accompagner » ouvre un dialogue, jamais une sanction.</p></div></div><div className="bm-family-table"><div className="is-head"><b>Indicateur</b><b>Source</b><b>Observation</b><b>Statut</b></div>{suiviLignes.map(l => <div key={l.label}><span>{l.label}</span><small>{l.source}</small><span>{l.observation}</span><b className={`bm-follow-${statutClasse(l.statut)}`}>{statutLabel(l.statut)}</b></div>)}</div></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>10</span><div><h2>Lecture partagée</h2><p>On valorise les points d’appui et on décrit le contexte avant toute conclusion.</p></div></div><div className="bm-shared-reading"><article><b>Points d’appui</b><p>{suivi.points_appui || 'À compléter avec la famille.'}</p></article><article><b>À accompagner</b><p>{suivi.a_accompagner || 'À compléter avec la famille.'}</p></article><article><b>Contexte partagé</b><p>{suivi.contexte || 'Aucun contexte renseigné.'}</p></article></div></section>
          <section className="bm-report-section"><div className="bm-section-heading"><span>11</span><div><h2>Plan d’action école-famille</h2><p>Des engagements simples, datés et partagés, avec une aide proposée par l’école.</p></div></div><div className="bm-action-table">{actionsSuivi.length ? actionsSuivi.map((a, i) => <div key={i}><b>{i + 1}</b><span>{a.texte}</span><small>{a.responsable}</small><em>{a.echeance}</em></div>) : <p>Aucune action particulière définie pour cette période.</p>}</div></section>
          <section className="bm-family-validation"><article><b>Droit de réponse / situation particulière</b><p>{suivi.droit_reponse || 'La famille peut expliquer un contexte, corriger un fait ou demander un accompagnement.'}</p></article><div><b>Validation du dialogue</b><span>École · date</span><span>Parent / tuteur · date</span></div></section>
          <p className="bm-finance-note">La ligne « scolarité » est visible uniquement par le Responsable administratif et la Direction ; aucun montant ne figure sur la version familiale.</p>
          <div className="bm-page-number">Page 4 / 4</div>
        </section>
      </article>
    </div>}
  </section>
}

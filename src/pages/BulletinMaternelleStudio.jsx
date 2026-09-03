import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'
import { MATERNELLE_DOMAINS } from '../lib/programmes/maternelle'
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
const estMaternelle = nom => /^(ps|gs|petite section|grande section)$/i.test(String(nom || '').trim())
const sectionDe = nom => /^(ps|petite section)$/i.test(String(nom || '').trim()) ? 'PS' : 'GS'
const langueDe = user => user?.langue === 'en' || String(user?.fonction || '').includes('-en-') ? 'en' : 'fr'
const estObjectifAnglais = texte => /^(Mastered|Names?|Identifies|Writes?|Counts?|Recognizes|Performs?|Responds?|Draws?|Demonstrates|Washes|Throws|Eats|Flushes|Traces|Executes|Sorts|Conducts|Participates|Coordinates|Explores|Uses|Takes|Revises|Associates|Knows|Sings|Respects)\b/i.test(texte)
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
const couleurScore = score => score >= 85 ? '#10b981' : score >= 65 ? '#22c55e' : score >= 45 ? '#f59e0b' : score > 0 ? '#ef4444' : '#d8e2ea'
const texteScore = score => score >= 85 ? 'Très bien acquis' : score >= 65 ? 'Acquis' : score >= 45 ? 'En cours' : score > 0 ? 'À renforcer' : 'Non évalué'

function BoutonsNiveau({ valeur, onChange, legende }) {
  return <div className="bm-levels" aria-label={legende}>
    {NIVEAUX.map(n => <button key={n.code} type="button" className={`bm-level bm-level-${n.code.toLowerCase()} ${valeur === n.code ? 'is-selected' : ''}`} onClick={() => onChange(n.code)} aria-pressed={valeur === n.code} title={n.court}>
      <span>{n.code}</span><small>{n.court}</small>
    </button>)}
  </div>
}

function PictogrammeIntelligence({ type, color, x, y }) {
  const commun = { stroke: color, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'intrapersonnel') return <g transform={`translate(${x} ${y})`} fill={color}><rect x="6" y="5" width="15" height="10" rx="2" /><rect x="21" y="-6" width="15" height="21" rx="2" /><rect x="36" y="-19" width="15" height="34" rx="2" /><circle cx="-22" cy="-20" r="7" /><path d="M-23-12L-10-2L2-15L8-10L-8 8L-19 0L-26 13L-34 9L-28-5Z" /></g>
  if (type === 'interpersonnel') return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><circle cx="-25" cy="-14" r="8" fill={color} /><circle cx="0" cy="-23" r="9" fill={color} /><circle cx="25" cy="-14" r="8" fill={color} /><path d="M-35 17V1Q-25-7-15 1V17M-10 18V-4L-21-14M10 18V-4L21-14M0-14V18M15 17V1Q25-7 35 1V17" /></g>
  if (type === 'mathematiques') return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><rect x="10" y="-8" width="34" height="40" rx="4" /><path d="M17 1H37M18 10H22M31 10H35M18 20H22M31 20H35" /><path d="M-42-16H-20M-31-27V-5M-40 11L-21 30M-21 11L-40 30" /></g>
  if (type === 'langage_prelecture') return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><circle cx="0" cy="-22" r="9" fill={color} /><path d="M-22 2Q-11-5 0 3Q11-5 22 2V27Q11 20 0 28Q-11 20-22 27ZM0 3V28" /><path d="M-9-8L-3 1M9-8L3 1" /></g>
  if (type === 'art_expression') return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><path d="M-24 18V-17L10-24V10" /><circle cx="-33" cy="20" r="10" fill={color} stroke="none" /><circle cx="1" cy="12" r="10" fill={color} stroke="none" /><path d="M21-9V17M21-9L39-14V10" /><circle cx="13" cy="20" r="8" fill={color} stroke="none" /><circle cx="32" cy="13" r="8" fill={color} stroke="none" /></g>
  if (type === 'motricite') return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><circle cx="-30" cy="14" r="15" /><circle cx="28" cy="14" r="15" /><path d="M-30 14L-12-10L4 14H-30L-17 14M4 14L18-11L28 14M-12-10H5" /><circle cx="9" cy="-23" r="7" fill={color} stroke="none" /><path d="M8-15L-2-3L18-10" /></g>
  if (type === 'sciences_decouverte') return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><path d="M0 29V-7M-31 23Q-27 6-12 5Q-17-12 0-16Q15-15 14-1Q32 1 30 19Q18 28 0 18Q-14 31-31 23Z" fill={color} /><path d="M-13 28L0 11L15 28" /></g>
  return <g transform={`translate(${x} ${y})`} fill="none" {...commun}><circle cx="0" cy="-18" r="8" fill={color} stroke="none" /><path d="M0-9V11M0 2L-17 13M0 2L17 13M0 11L-19 27M0 11L19 27M-28 27Q0 11 28 27" /><ellipse cx="0" cy="2" rx="37" ry="14" transform="rotate(30)" /><ellipse cx="0" cy="2" rx="37" ry="14" transform="rotate(-30)" /></g>
}

function CerveauDeveloppement({ domaines, personnel }) {
  const score = id => domaines.find(d => d.id === id)?.score || 0
  const moyenne = valeurs => { const notes = valeurs.filter(Boolean); return notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0 }
  const scorePersonnel = ids => pourcentage(ids.map(id => personnel?.[id]))
  const intrapersonnel = scorePersonnel(['controle_soi', 'autonomie', 'perseverance'])
  const interpersonnel = moyenne([score('education_civique'), scorePersonnel(['cooperation', 'responsabilite'])])
  const corporel = moyenne([score('motricite_globale'), score('ecriture_motricite_fine')])
  const zones = [
    { id: 'intrapersonnel', label: 'Intrapersonnel', color: '#F8B342', dark: '#C96008', score: intrapersonnel, path: 'M253 8C171 10 109 31 82 92L126 158L253 137Z', x: 183, y: 112 },
    { id: 'interpersonnel', label: 'Interpersonnel', color: '#8C70DD', dark: '#4D2DB8', score: interpersonnel, path: 'M267 8C349 10 411 31 438 92L394 158L267 137Z', x: 337, y: 112 },
    { id: 'mathematiques', label: 'Logique', color: '#49C2EC', dark: '#087CAD', score: score('mathematiques'), path: 'M78 99C29 132 7 207 20 322L118 339L164 267L129 163Z', x: 77, y: 263 },
    { id: 'langage_prelecture', label: 'Linguistique', color: '#F1D40A', dark: '#B86A00', score: score('langage_prelecture'), path: 'M137 170L253 148L253 424L143 441C123 375 116 312 165 264L122 234Z', x: 195, y: 307 },
    { id: 'art_expression', label: 'Musical', color: '#8BD150', dark: '#3E8A0B', score: score('art_expression'), path: 'M267 148L383 170L398 234L355 264C404 312 397 375 377 441L267 424Z', x: 325, y: 307 },
    { id: 'motricite', label: 'Corporel-kinesthésique', color: '#F25C9D', dark: '#B40B58', score: corporel, path: 'M442 99C491 132 513 207 500 322L402 339L356 267L391 163Z', x: 443, y: 263 },
    { id: 'sciences_decouverte', label: 'Naturaliste', color: '#FF6F70', dark: '#B71E25', score: score('sciences_decouverte'), path: 'M20 337C28 431 109 497 253 512L253 438L142 451L115 350Z', x: 151, y: 446 },
    { id: 'existentiel', label: 'Existentiel', color: '#42A8C2', dark: '#05657D', score: moyenne([intrapersonnel, interpersonnel]), path: 'M500 337C492 431 411 497 267 512L267 438L378 451L405 350Z', x: 369, y: 446 },
  ]
  return <div className="bm-brain-card">
    <svg className="bm-brain" viewBox="0 0 520 520" role="img" aria-label="Cerveau des huit dimensions du développement de l’enfant">
      {zones.map(z => <g key={z.id} className="bm-intelligence-zone">
        <path d={z.path} fill={z.color} />
        <PictogrammeIntelligence type={z.id} color={z.dark} x={z.x} y={z.y - 55} />
        <rect x={z.x - (z.label.length > 16 ? 77 : 62)} y={z.y} width={z.label.length > 16 ? 154 : 124} height="30" rx="15" fill={z.dark} opacity=".78" />
        <text x={z.x} y={z.y + 20} textAnchor="middle" className="bm-brain-label">{z.label}</text>
        <text x={z.x} y={z.y + 47} textAnchor="middle" className="bm-brain-score">{z.score ? `${z.score}%` : 'Non évalué'}</text>
      </g>)}
    </svg>
    <p>Cette carte présente les acquisitions observées. Elle accompagne le dialogue avec la famille et ne constitue pas un diagnostic.</p>
  </div>
}

export default function BulletinMaternelleStudio({ user, eleves = [] }) {
  const [bulletins, setBulletins] = useState([])
  const [horaires, setHoraires] = useState([])
  const [presences, setPresences] = useState([])
  const [photos, setPhotos] = useState({})
  const [selection, setSelection] = useState('')
  const [trimestre, setTrimestre] = useState('t1')
  const [vue, setVue] = useState('evaluation')
  const [onglet, setOnglet] = useState('')
  const [brouillons, setBrouillons] = useState({})
  const [etat, setEtat] = useState('chargement')
  const [message, setMessage] = useState('')
  const [sauvegarde, setSauvegarde] = useState('')
  const brouillonsRef = useRef(brouillons)
  const fileSauvegarde = useRef(Promise.resolve())

  const maternelle = useMemo(() => eleves.filter(e => estMaternelle(e.classes?.nom)), [eleves])
  const langue = langueDe(user)
  const sectionTitulaire = langue === 'fr' ? 'GS' : 'PS'
  const eleve = maternelle.find(e => String(e.id) === String(selection)) || maternelle[0]
  const section = sectionDe(eleve?.classes?.nom)
  const peutImprimer = Boolean(eleve && section === sectionTitulaire)
  const domaines = useMemo(() => (MATERNELLE_DOMAINS[section]?.[trimestre] || []).map(domaine => ({ ...domaine, titre: domaine.title.replace(/^\d+\.\s*/, ''), objectifs: domaine.competencies.map((description, index) => ({ key: `${domaine.id}_${index}`, description })).filter(o => langue === 'en' ? estObjectifAnglais(o.description) : !estObjectifAnglais(o.description)) })).filter(d => d.objectifs.length), [section, trimestre, langue])
  const ligneBulletin = useMemo(() => bulletins.find(b => String(b.eleve_id) === String(eleve?.id) && b.trimestre === trimestre), [bulletins, eleve, trimestre])
  const contributions = ligneBulletin?.donnees?.contributions || {}
  const contribution = contributions[langue] || {}
  const cleBrouillon = `${eleve?.id || 'aucun'}:${trimestre}:${langue}`
  const brouillonServeur = { evaluations: contribution.evaluations || {}, developpement_personnel: contribution.developpement_personnel || {}, appreciation: contribution.appreciation || '', badges: contribution.badges || [] }
  const brouillon = brouillons[cleBrouillon] || brouillonServeur

  useEffect(() => {
    let annule = false
    ;(async () => {
      if (!maternelle.length) { setEtat('pret'); return }
      const ids = maternelle.map(e => e.id)
      const [b, h, p, ph] = await Promise.all([
        supabase.rpc('lire_bulletins_maternelle', { p_eleve_ids: ids }), supabase.rpc('lire_pilotage_heures_pedagogiques'),
        supabase.from('presences_eleves').select('eleve_id,date_jour,statut').in('eleve_id', ids), supabase.rpc('lire_photos_bulletins_maternelle', { p_eleve_ids: ids }),
      ])
      if (annule) return
      if (b.error) { console.error('lire_bulletins_maternelle', b.error); setMessage('La sauvegarde serveur des bulletins doit être installée avec le script SQL dédié.') }
      setBulletins(Array.isArray(b.data) ? b.data : []); setHoraires(Array.isArray(h.data) ? h.data : []); setPresences(Array.isArray(p.data) ? p.data : [])
      const refs = Array.isArray(ph.data) ? ph.data : []; const chemins = [...new Set(refs.map(x => x.photo_chemin).filter(Boolean))]
      const signees = chemins.length ? await supabase.storage.from('inscriptions').createSignedUrls(chemins, 3600) : { data: [] }
      const parChemin = new Map((signees.data || []).filter(x => x.signedUrl && !x.error).map(x => [x.path, x.signedUrl]))
      setPhotos(Object.fromEntries(refs.map(x => [String(x.eleve_id), parChemin.get(x.photo_chemin) || x.photo_base64 || '']))); setEtat('pret')
    })()
    return () => { annule = true }
  }, [maternelle])

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
  const noterObjectif = (key, valeur) => modifier(b => ({ ...b, evaluations: { ...b.evaluations, [key]: valeur } }))
  const noterDeveloppement = (key, valeur) => modifier(b => ({ ...b, developpement_personnel: { ...b.developpement_personnel, [key]: valeur } }))
  const basculerBadge = badge => modifier(b => ({ ...b, badges: b.badges.includes(badge) ? b.badges.filter(x => x !== badge) : [...b.badges, badge] }))

  const evaluationsFusionnees = { ...(contributions.fr?.evaluations || {}), ...(contributions.en?.evaluations || {}), ...brouillon.evaluations }
  const personnelFusionne = { ...(contributions.fr?.developpement_personnel || {}), ...(contributions.en?.developpement_personnel || {}), ...brouillon.developpement_personnel }
  const tousDomaines = (MATERNELLE_DOMAINS[section]?.[trimestre] || []).map(d => ({ id: d.id, titre: d.title.replace(/^\d+\.\s*/, ''), score: pourcentage(d.competencies.map((_, index) => evaluationsFusionnees[`${d.id}_${index}`])) }))
  const totalObjectifs = domaines.reduce((n, d) => n + d.objectifs.length, 0)
  const objectifsNotes = domaines.reduce((n, d) => n + d.objectifs.filter(o => brouillon.evaluations[o.key]).length, 0)
  const lignesHeures = horaires.filter(h => String(h.classe_id) === String(eleve?.classe_id))
  const semaines = lignesHeures.reduce((m, h) => Math.max(m, Number(h[`semaines_${trimestre}`]) || 0), 0)
  const heures = lignesHeures.reduce((n, h) => n + Number(h.heures_hebdo || 0), 0) * semaines
  const absences = presences.filter(p => String(p.eleve_id) === String(eleve?.id) && p.statut !== 'present').length

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

  return <section className="bm-studio">
    <header className="bm-title"><div><span>MATERNELLE</span><h2>Évaluer et raconter les progrès</h2><p>Une saisie simple pour l’enseignante, un bulletin clair pour la famille.</p></div><div className="bm-save-state" aria-live="polite">{sauvegarde || 'Prêt'}</div></header>
    {message && <div className={`bm-message ${/impossible|installée|échec/i.test(message) ? 'is-error' : ''}`}>{message}</div>}
    <div className="bm-toolbar">
      <label>Élève<select value={eleve?.id || ''} onChange={e => setSelection(e.target.value)}>{maternelle.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} · {sectionDe(e.classes?.nom)}</option>)}</select></label>
      <div className="bm-trimesters">{TRIMESTRES.map(t => <button key={t.id} className={trimestre === t.id ? 'is-active' : ''} onClick={() => setTrimestre(t.id)}>{t.label}</button>)}</div>
      <div className="bm-view-switch"><button className={vue === 'evaluation' ? 'is-active' : ''} onClick={() => setVue('evaluation')}>✍️ Évaluer</button><button className={vue === 'bulletin' ? 'is-active' : ''} onClick={() => setVue('bulletin')}>🧠 Voir le bulletin</button></div>
    </div>

    {vue === 'evaluation' ? <div className="bm-evaluation">
      <div className="bm-progress"><div><b>{objectifsNotes}/{totalObjectifs}</b><span>objectifs renseignés dans votre langue</span></div><progress max={Math.max(1, totalObjectifs)} value={objectifsNotes} /></div>
      <nav className="bm-domain-nav" aria-label="Domaines d’évaluation">{domaines.map(d => <button key={d.id} className={domaineActif?.id === d.id ? 'is-active' : ''} onClick={() => setOnglet(d.id)}>{d.titre}</button>)}<button className={onglet === 'developpement-personnel' ? 'is-active is-personal' : 'is-personal'} onClick={() => setOnglet('developpement-personnel')}>Développement personnel</button></nav>
      {domaineActif && <article className="bm-domain-panel"><header><div><span style={{ background: domaineActif.color }} /><h3>{domaineActif.titre}</h3></div><b>{domaineActif.objectifs.filter(o => brouillon.evaluations[o.key]).length}/{domaineActif.objectifs.length}</b></header><div className="bm-objectives">{domaineActif.objectifs.map(o => <div className="bm-objective" key={o.key}><p>{o.description}</p><BoutonsNiveau valeur={brouillon.evaluations[o.key]} onChange={v => noterObjectif(o.key, v)} legende={`Évaluation de ${o.description}`} /></div>)}</div></article>}
      {onglet === 'developpement-personnel' && <article className="bm-domain-panel bm-personal-panel"><header><div><span /><h3>Développement personnel</h3></div><b>{Object.keys(brouillon.developpement_personnel).length}/5</b></header><p className="bm-panel-intro">Ces cinq repères sont des observations de vie et de maturité. Ils restent distincts du programme scolaire.</p><div className="bm-objectives">{DEVELOPPEMENT_PERSONNEL.map(c => <div className="bm-objective" key={c.id}><p><strong>{c.titre}</strong><small>{c.aide}</small></p><BoutonsNiveau valeur={brouillon.developpement_personnel[c.id]} onChange={v => noterDeveloppement(c.id, v)} legende={`Observation : ${c.titre}`} /></div>)}</div></article>}
      <article className="bm-after-matrix"><h3>Distinctions et appréciation</h3><p>Cette partie vient après la matrice d’évaluation.</p><div className="bm-badges">{DISTINCTIONS.map(b => <button key={b} className={brouillon.badges.includes(b) ? 'is-active' : ''} onClick={() => basculerBadge(b)}>★ {b}</button>)}</div><label>Appréciation de l’enseignante<textarea value={brouillon.appreciation} onChange={e => { const prochain = { ...(brouillonsRef.current[cleBrouillon] || brouillonServeur), appreciation: e.target.value }; const tous = { ...brouillonsRef.current, [cleBrouillon]: prochain }; brouillonsRef.current = tous; setBrouillons(tous) }} onBlur={() => enregistrer(brouillonsRef.current[cleBrouillon] || brouillonServeur)} placeholder="Un message concret, encourageant et utile à la famille…" /></label></article>
    </div> : <div className="bm-report-wrap">
      <div className="bm-report-actions"><span>Statut : <b>{statut.replaceAll('_', ' ')}</b></span><button onClick={() => window.print()} disabled={!peutImprimer}>🖨️ Imprimer</button><button className="is-primary" onClick={soumettre} disabled={!peutImprimer}>Envoyer à la Direction</button>{!peutImprimer && <small>Impression et soumission réservées à la titulaire de la section.</small>}</div>
      <article className="bm-report">
        <header className="bm-report-header"><div className="bm-brand"><b>IDEAL</b><span>ÉCOLE INTERNATIONALE BILINGUE</span></div><div><span>BULLETIN MATERNELLE</span><b>{TRIMESTRES.find(t => t.id === trimestre)?.label.toUpperCase()}</b><small>{anneeScolaire()}</small></div></header>
        <section className="bm-child-card">{photos[String(eleve.id)] ? <img src={photos[String(eleve.id)]} alt={`Photo de ${eleve.prenom} ${eleve.nom}`} /> : <div className="bm-photo-placeholder">Photo<br />officielle</div>}<div><h1>{eleve.prenom} {eleve.nom}</h1><p>{section} · {ageDe(eleve.date_naissance)} · Matricule {eleve.matricule || '—'}</p><p>{heures || '—'} h programmées · {absences} absence(s) enregistrée(s)</p></div></section>
        <section className="bm-report-section"><div className="bm-section-heading"><span>01</span><div><h2>Le cerveau des acquisitions</h2><p>Une lecture visuelle des grands domaines travaillés.</p></div></div><CerveauDeveloppement domaines={tousDomaines} personnel={personnelFusionne} /></section>
        <section className="bm-report-section"><div className="bm-section-heading"><span>02</span><div><h2>Progression par domaine</h2><p>Les jauges synthétisent les observations françaises et anglaises.</p></div></div><div className="bm-domain-results">{tousDomaines.map(d => <div key={d.id}><header><span>{d.titre}</span><b>{d.score ? `${d.score}%` : '—'}</b></header><div className="bm-gauge"><i style={{ width: `${d.score}%`, background: couleurScore(d.score) }} /></div><small>{texteScore(d.score)}</small></div>)}</div></section>
        <section className="bm-report-section"><div className="bm-section-heading"><span>03</span><div><h2>Grandir avec les autres</h2><p>Cinq repères de développement personnel observés au quotidien.</p></div></div><div className="bm-personal-results">{DEVELOPPEMENT_PERSONNEL.map(c => { const v = personnelFusionne[c.id]; return <div key={c.id}><span>{c.titre}</span><b className={`bm-chip-${String(v || '').toLowerCase()}`}>{NIVEAUX.find(n => n.code === v)?.court || 'Non évalué'}</b></div> })}</div></section>
        {(brouillon.badges.length > 0 || contributions.fr?.appreciation || contributions.en?.appreciation || brouillon.appreciation) && <section className="bm-report-section bm-encouragements"><div className="bm-section-heading"><span>04</span><div><h2>Encouragements</h2><p>Ce que l’équipe souhaite valoriser ce trimestre.</p></div></div>{brouillon.badges.length > 0 && <div className="bm-report-badges">{brouillon.badges.map(b => <span key={b}>★ {b}</span>)}</div>}<div className="bm-appreciations">{contributions.fr?.appreciation && <p><b>Français</b>{contributions.fr.appreciation}</p>}{contributions.en?.appreciation && <p><b>English</b>{contributions.en.appreciation}</p>}{!contributions[langue]?.appreciation && brouillon.appreciation && <p><b>{langue === 'fr' ? 'Français' : 'English'}</b>{brouillon.appreciation}</p>}</div></section>}
        <footer><div><span>ENSEIGNANTE TITULAIRE</span><i /></div><p>Chaque enfant grandit à son rythme.<br />L’école et la famille l’accompagnent ensemble.</p><div><span>DIRECTION</span><i /></div></footer>
      </article>
    </div>}
  </section>
}

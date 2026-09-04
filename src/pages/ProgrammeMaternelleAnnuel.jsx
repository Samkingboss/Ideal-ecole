import { useMemo, useState } from 'react'
import { langueMaternelle, programmeAnnuelMaternelle } from '../lib/programmes/maternelle'
import './ProgrammeMaternelleAnnuel.css'

const TRIMESTRES = [
  { id: 't1', court: 'T1', label: '1er trimestre' },
  { id: 't2', court: 'T2', label: '2e trimestre' },
  { id: 't3', court: 'T3', label: '3e trimestre' },
]

const sectionDe = nom => /^(PS|Petite Section)$/i.test(String(nom || ''))
  ? 'PS'
  : /^(GS|Grande Section)$/i.test(String(nom || '')) ? 'GS' : ''

const normaliser = texte => String(texte || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ')

const objectifsPreparation = preparation => [
  preparation?.objectif,
  preparation?.contenu?.objectif,
  preparation?.contenu?.cours?.objectif,
  preparation?.contenu?.programme?.objectif,
].flat().filter(Boolean).map(normaliser)

export default function ProgrammeMaternelleAnnuel({ user, classes = [], preparations = [] }) {
  const langue = langueMaternelle(user)
  const sections = useMemo(() => {
    const affectees = [...new Set(classes.map(classe => sectionDe(classe?.nom)).filter(Boolean))]
    return affectees.length ? affectees : ['PS', 'GS']
  }, [classes])
  const [sectionDemandee, setSectionDemandee] = useState(sections[0])
  const [matiereDemandee, setMatiereDemandee] = useState('')
  const [recherche, setRecherche] = useState('')
  const section = sections.includes(sectionDemandee) ? sectionDemandee : sections[0]
  const matieres = useMemo(() => programmeAnnuelMaternelle(section, langue), [section, langue])
  const objectifsPrepares = useMemo(() => new Set(preparations.flatMap(objectifsPreparation)), [preparations])
  const matiere = matieres.find(item => item.id === matiereDemandee) || null
  const terme = normaliser(recherche)

  const objectifsDe = item => TRIMESTRES.flatMap(trimestre => item.trimestres[trimestre.id])
  const estPrepare = objectif => objectifsPrepares.has(normaliser(objectif.description))
  const totalObjectifs = matieres.reduce((total, item) => total + objectifsDe(item).length, 0)
  const totalPrepares = matieres.reduce((total, item) => total + objectifsDe(item).filter(estPrepare).length, 0)
  const matieresVisibles = terme
    ? matieres.filter(item => normaliser(item.titre).includes(terme) || objectifsDe(item).some(objectif => normaliser(objectif.description).includes(terme)))
    : matieres

  const choisirSection = prochaine => {
    setSectionDemandee(prochaine)
    setMatiereDemandee('')
    setRecherche('')
  }

  if (!section) return <div className="empty-state">Aucune classe maternelle ne vous est affectée.</div>

  return <section className="pma-shell">
    <header className="pma-hero">
      <div><span>PROGRAMME OFFICIEL · MATERNELLE</span><h2>Tous les objectifs de l’année</h2><p>La même source que le bulletin : chaque objectif préparé ici pourra ensuite être évalué, sans double saisie.</p></div>
      <b>{langue === 'en' ? 'ENGLISH' : 'FRANÇAIS'}</b>
    </header>

    <div className="pma-controls">
      <div className="pma-sections" aria-label="Choisir la section">{sections.map(code => <button key={code} type="button" className={section === code ? 'is-active' : ''} onClick={() => choisirSection(code)}>{code === 'PS' ? 'Petite Section' : 'Grande Section'}</button>)}</div>
      <label className="pma-search"><span>⌕</span><input value={recherche} onChange={event => setRecherche(event.target.value)} placeholder="Rechercher une matière ou un objectif…" /></label>
    </div>

    <div className="pma-kpis"><article><strong>{matieres.length}</strong><span>Matières</span></article><article><strong>{totalObjectifs}</strong><span>Objectifs annuels</span></article><article><strong>{totalPrepares}</strong><span>Déjà préparés</span></article></div>

    {!matiere && <>
      <div className="pma-intro"><div><b>{section === 'PS' ? 'Petite Section' : 'Grande Section'} · année complète</b><span>Sélectionnez une matière pour consulter ses objectifs du premier au troisième trimestre.</span></div><small>{matieresVisibles.length} matière(s)</small></div>
      <div className="pma-subjects">{matieresVisibles.map(item => {
        const objectifs = objectifsDe(item)
        const prepares = objectifs.filter(estPrepare).length
        const progression = objectifs.length ? Math.round(prepares * 100 / objectifs.length) : 0
        return <button type="button" key={item.id} className="pma-subject" style={{ '--pma-color': item.couleur || '#00a8e0' }} onClick={() => { setMatiereDemandee(item.id); setRecherche('') }}>
          <span className="pma-subject-icon">{item.titre.slice(0, 2).toUpperCase()}</span>
          <span className="pma-subject-copy"><b>{item.titre}</b><small>{objectifs.length} objectifs · T1, T2 et T3</small><i><em style={{ width: `${progression}%` }} /></i></span>
          <span className="pma-subject-count"><b>{prepares}/{objectifs.length}</b><small>préparés</small></span>
          <span className="pma-arrow">›</span>
        </button>
      })}</div>
      {!matieresVisibles.length && <div className="empty-state">Aucune matière ou aucun objectif ne correspond à votre recherche.</div>}
    </>}

    {matiere && <div className="pma-detail" style={{ '--pma-color': matiere.couleur || '#00a8e0' }}>
      <button type="button" className="pma-back" onClick={() => setMatiereDemandee('')}>← Retour aux matières</button>
      <header><div className="pma-detail-icon">{matiere.titre.slice(0, 2).toUpperCase()}</div><div><small>{section === 'PS' ? 'Petite Section' : 'Grande Section'} · programme annuel</small><h3>{matiere.titre}</h3><p>{objectifsDe(matiere).length} objectifs à atteindre avant la fin de l’année.</p></div></header>
      <div className="pma-trimesters">{TRIMESTRES.map(trimestre => {
        const objectifs = matiere.trimestres[trimestre.id]
        const prepares = objectifs.filter(estPrepare).length
        return <section key={trimestre.id}>
          <header><span>{trimestre.court}</span><div><b>{trimestre.label}</b><small>{objectifs.length} objectifs · {prepares} déjà préparé(s)</small></div></header>
          {objectifs.length ? <ol>{objectifs.map(objectif => <li key={objectif.id} className={estPrepare(objectif) ? 'is-prepared' : ''}><span>{objectif.description}</span><small>{estPrepare(objectif) ? '✓ Préparé' : 'À programmer'}</small></li>)}</ol> : <p className="pma-empty-period">Aucun objectif dans votre langue pour ce trimestre.</p>}
        </section>
      })}</div>
    </div>}
  </section>
}

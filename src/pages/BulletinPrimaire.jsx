import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NOM_ECOLE } from '../lib/ecole'
import { moyenneEnsemble, moyenneMatiere, moyenneModalite, notesInvalides } from '../lib/bulletinPrimaire'
import './BulletinPrimaire.css'

const TRIMESTRES_PRIMAIRE = [
  { id: 't1', label: '1er trimestre' },
  { id: 't2', label: '2e trimestre' },
  { id: 't3', label: '3e trimestre' },
]

const estMaternelle = nom => /^(ps|gs|petite section|grande section)$/i.test(String(nom || '').trim())
const normaliser = texte => String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
const groupeCouvreClasse = (groupe, classe) => normaliser(groupe)
  .split(/\s*\/\s*/)
  .some(partie => partie === normaliser(classe))
const anneeScolaire = () => {
  const date = new Date()
  const debut = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
  return `${debut} - ${debut + 1}`
}
const noteVide = () => ({ libelle: '', note: '', bareme: '20' })
const matiereVide = programme => ({ programme, notes: { ecrit: [], oral: [] }, appreciation: '' })

const formatNote = note => Number.isFinite(note) ? `${note.toFixed(2).replace('.', ',')} / 20` : '—'
const formatPourcent = note => Number.isFinite(note) ? `${Math.round(note * 5)} %` : '—'
const teinte = note => !Number.isFinite(note) ? '#94a3b8' : note >= 16 ? '#10b981' : note >= 12 ? '#2563eb' : note >= 10 ? '#f59e0b' : '#ef4444'
const appreciationAuto = note => !Number.isFinite(note)
  ? 'Pas encore évalué'
  : note >= 16 ? 'Maîtrise très solide' : note >= 12 ? 'Acquis satisfaisants' : note >= 10 ? 'En cours de consolidation' : 'Accompagnement à renforcer'

function EnteteBulletin({ trimestre }) {
  return <header className="bp-report-header">
    <div className="bp-brand"><img src="/logo-ideal.png" alt="IDEAL École Internationale Bilingue" /><span>EXCELLENCE · BILINGUISME · INNOVATION</span></div>
    <div className="bp-heading"><small>BULLETIN OFFICIEL · PRIMAIRE</small><b>BILAN TRIMESTRIEL</b><strong>DES APPRENTISSAGES</strong></div>
    <div className="bp-period"><b>{TRIMESTRES_PRIMAIRE.find(t => t.id === trimestre)?.label}</b><span>{anneeScolaire()}</span></div>
  </header>
}

function LigneNote({ note, onChange, onRemove }) {
  return <div className="bp-note-line">
    <input aria-label="Intitulé de l'évaluation" value={note.libelle || ''} onChange={e => onChange({ ...note, libelle: e.target.value })} placeholder="Ex. Contrôle 1" />
    <label><span>Note</span><input type="number" min="0" step="0.25" value={note.note ?? ''} onChange={e => onChange({ ...note, note: e.target.value })} /></label>
    <label><span>Sur</span><input type="number" min="1" step="1" value={note.bareme ?? '20'} onChange={e => onChange({ ...note, bareme: e.target.value })} /></label>
    <button type="button" onClick={onRemove} aria-label="Retirer cette note">×</button>
  </div>
}

function EditeurModalite({ titre, couleur, notes, onChange }) {
  const liste = Array.isArray(notes) ? notes : []
  const moyenne = moyenneModalite(liste)
  return <section className="bp-modality" style={{ '--bp-modality': couleur }}>
    <header><div><span /> <b>{titre}</b></div><strong>{formatNote(moyenne)}</strong></header>
    {liste.length === 0 && <p className="bp-modality-empty">Aucune note : cette modalité ne comptera pas dans la moyenne.</p>}
    {liste.map((note, index) => <LigneNote key={index} note={note}
      onChange={suivante => onChange(liste.map((ancienne, i) => i === index ? suivante : ancienne))}
      onRemove={() => onChange(liste.filter((_, i) => i !== index))} />)}
    <button type="button" className="bp-add-note" onClick={() => onChange([...liste, noteVide()])}>+ Ajouter une note</button>
  </section>
}

function ProgrammeTable({ titre, sousTitre, programme, matieres, couleur }) {
  const lignes = Object.entries(matieres || {}).filter(([, valeur]) => valeur.programme === programme)
  return <section className="bp-report-section bp-programme-report" style={{ '--bp-programme': couleur }}>
    <div className="bp-section-title"><span>{programme === 'national' ? 'FR' : 'EN'}</span><div><h2>{titre}</h2><p>{sousTitre}</p></div></div>
    {lignes.length === 0 ? <div className="bp-report-empty">Aucune matière renseignée pour ce programme.</div> : <div className="bp-results-table">
      <div className="bp-result-row is-head"><b>Matière</b><b>Écrit</b><b>Oral</b><b>Moyenne</b><b>Commentaire de l’enseignant</b></div>
      {lignes.map(([nom, valeur]) => {
        const ecrit = moyenneModalite(valeur.notes?.ecrit)
        const oral = moyenneModalite(valeur.notes?.oral)
        const moyenne = moyenneMatiere(valeur)
        return <div className="bp-result-row" key={nom}>
          <span><b>{nom}</b><small>{appreciationAuto(moyenne)}</small></span>
          <span>{formatNote(ecrit)}</span><span>{formatNote(oral)}</span>
          <strong style={{ color: teinte(moyenne) }}>{formatNote(moyenne)}</strong>
          <p>{valeur.appreciation || 'Commentaire à compléter.'}</p>
        </div>
      })}
    </div>}
  </section>
}

export default function BulletinPrimaire({ user, eleves = [] }) {
  const primaire = useMemo(() => eleves.filter(e => !estMaternelle(e.classes?.nom)), [eleves])
  const [selection, setSelection] = useState(primaire[0]?.id || '')
  const [trimestre, setTrimestre] = useState('t1')
  const [bulletins, setBulletins] = useState([])
  const [affectations, setAffectations] = useState([])
  const [photos, setPhotos] = useState({})
  const [brouillons, setBrouillons] = useState({})
  const [matiereActive, setMatiereActive] = useState('')
  const [etat, setEtat] = useState('chargement')
  const [message, setMessage] = useState('')
  const eleve = primaire.find(e => String(e.id) === String(selection)) || primaire[0]

  useEffect(() => {
    if (!eleve?.id) return undefined
    let annule = false
    ;(async () => {
      setEtat('chargement'); setMessage('')
      const groupe = eleve.classes?.nom || ''
      const [bulletinsRes, affRes, pilotageRes, photoRes] = await Promise.all([
        supabase.rpc('lire_bulletins_primaire', { p_eleve_ids: [eleve.id] }),
        supabase.from('affectations_matieres').select('groupe,matiere,prof_id').order('matiere'),
        supabase.rpc('lire_pilotage_heures_pedagogiques'),
        supabase.rpc('lire_photos_bulletins_primaire', { p_eleve_ids: [eleve.id] }),
      ])
      if (annule) return
      if (bulletinsRes.error) {
        setEtat('migration')
        setMessage('La sauvegarde serveur du bulletin primaire doit être installée avec sql/bulletins_primaire.sql.')
        return
      }
      if (affRes.error) { setEtat('erreur'); setMessage(`Matières indisponibles : ${affRes.error.message}`); return }

      const affectationsClasse = (Array.isArray(affRes.data) ? affRes.data : [])
        .filter(a => groupeCouvreClasse(a.groupe, groupe))
      const profIds = [...new Set(affectationsClasse.map(a => a.prof_id).filter(Boolean))]
      const profRes = profIds.length
        ? await supabase.from('users').select('id,prenom,nom,langue,fonction').in('id', profIds)
        : { data: [], error: null }
      if (annule) return
      if (profRes.error) { setEtat('erreur'); setMessage(`Enseignants indisponibles : ${profRes.error.message}`); return }
      if (pilotageRes.error) { setEtat('erreur'); setMessage(`Pilotage pédagogique indisponible : ${pilotageRes.error.message}`); return }
      const profs = new Map((Array.isArray(profRes.data) ? profRes.data : []).map(p => [String(p.id), p]))
      const heures = (Array.isArray(pilotageRes.data) ? pilotageRes.data : [])
        .filter(h => String(h.classe_id) === String(eleve.classe_id))
      const liste = affectationsClasse.map(a => {
        const reglage = heures.find(h => normaliser(h.matiere) === normaliser(a.matiere))
        const prof = profs.get(String(a.prof_id))
        return { ...a, prof, programme: (reglage?.langue || prof?.langue) === 'en' ? 'international' : 'national' }
      })
      setAffectations(liste)
      setBulletins(Array.isArray(bulletinsRes.data) ? bulletinsRes.data : [])
      setMatiereActive(active => liste.some(a => a.matiere === active && String(a.prof_id) === String(user.id))
        ? active : liste.find(a => String(a.prof_id) === String(user.id))?.matiere || liste[0]?.matiere || '')

      const lignePhoto = photoRes.data?.[0]
      if (lignePhoto?.photo_base64) setPhotos(p => ({ ...p, [eleve.id]: lignePhoto.photo_base64 }))
      else if (lignePhoto?.photo_chemin) {
        const signee = await supabase.storage.from('inscriptions').createSignedUrl(lignePhoto.photo_chemin, 3600)
        if (!annule && signee.data?.signedUrl) setPhotos(p => ({ ...p, [eleve.id]: signee.data.signedUrl }))
      }
      setEtat('ok')
    })()
    return () => { annule = true }
  }, [eleve?.id, eleve?.classe_id, eleve?.classes?.nom, user.id])

  const bulletin = bulletins.find(b => b.trimestre === trimestre && b.annee_scolaire === anneeScolaire())
  const matieres = useMemo(() => {
    const sauvegardees = bulletin?.donnees?.matieres || {}
    const fusion = { ...sauvegardees }
    affectations.forEach(a => {
      if (!fusion[a.matiere]) fusion[a.matiere] = matiereVide(a.programme)
      else fusion[a.matiere] = { ...fusion[a.matiere], programme: fusion[a.matiere].programme || a.programme }
    })
    return fusion
  }, [bulletin, affectations])

  const cleBrouillon = `${eleve?.id || ''}:${trimestre}:${matiereActive}`
  const configurationActive = affectations.find(a => a.matiere === matiereActive)
  const peutModifier = String(configurationActive?.prof_id) === String(user.id)
  const saisie = brouillons[cleBrouillon] || matieres[matiereActive] || matiereVide(configurationActive?.programme || 'national')
  const modifierSaisie = prochaine => setBrouillons(tous => ({ ...tous, [cleBrouillon]: prochaine }))

  const enregistrer = async () => {
    setMessage('')
    const invalides = notesInvalides(saisie)
    if (invalides.length) { setMessage('Chaque note doit être comprise entre 0 et son barème.'); return }
    setEtat('sauvegarde')
    const { error } = await supabase.rpc('sauver_evaluation_primaire', {
      p_eleve_id: eleve.id, p_trimestre: trimestre, p_annee_scolaire: anneeScolaire(),
      p_matiere: matiereActive, p_notes: saisie.notes, p_appreciation: saisie.appreciation || '',
    })
    if (error) { setEtat('ok'); setMessage(`Enregistrement impossible : ${error.message}`); return }
    const relu = await supabase.rpc('lire_bulletins_primaire', { p_eleve_ids: [eleve.id] })
    if (relu.error) { setEtat('ok'); setMessage(`Évaluation enregistrée, mais relecture impossible : ${relu.error.message}`); return }
    setBulletins(Array.isArray(relu.data) ? relu.data : [])
    setBrouillons(tous => { const copie = { ...tous }; delete copie[cleBrouillon]; return copie })
    setEtat('ok'); setMessage('Évaluation enregistrée et intégrée au bulletin commun.')
  }

  const donneesParTrimestre = Object.fromEntries(TRIMESTRES_PRIMAIRE.map(t => {
    const ligne = bulletins.find(b => b.trimestre === t.id && b.annee_scolaire === anneeScolaire())
    return [t.id, moyenneEnsemble(ligne?.donnees?.matieres)]
  }))
  const nationales = Object.fromEntries(Object.entries(matieres).filter(([, m]) => m.programme === 'national'))
  const internationales = Object.fromEntries(Object.entries(matieres).filter(([, m]) => m.programme === 'international'))
  const moyenneNationale = moyenneEnsemble(nationales)
  const moyenneInternationale = moyenneEnsemble(internationales)
  const moyenneGlobale = moyenneEnsemble(matieres)
  const moyennesEcrit = Object.values(matieres).map(m => moyenneModalite(m.notes?.ecrit)).filter(Number.isFinite)
  const moyennesOral = Object.values(matieres).map(m => moyenneModalite(m.notes?.oral)).filter(Number.isFinite)
  const moyenneEcrit = moyennesEcrit.length ? moyennesEcrit.reduce((a, b) => a + b, 0) / moyennesEcrit.length : null
  const moyenneOral = moyennesOral.length ? moyennesOral.reduce((a, b) => a + b, 0) / moyennesOral.length : null

  if (!primaire.length) return <div className="empty-state"><p>Aucun élève du primaire dans vos classes.</p></div>

  return <section className="bp-studio">
    <header className="bp-studio-title"><div><span>PRIMAIRE</span><h2>Évaluations &amp; bulletin trimestriel</h2><p>Écrit et oral sont calculés séparément, puis réunis sans pénaliser une modalité non évaluée.</p></div><b>{etat === 'sauvegarde' ? 'Enregistrement…' : 'Données partagées'}</b></header>
    {message && <div className={`bp-message ${etat === 'migration' || /impossible|doit être|comprise/i.test(message) ? 'is-error' : ''}`}>{message}</div>}
    <div className="bp-toolbar">
      <label>Élève<select value={eleve?.id || ''} onChange={e => setSelection(e.target.value)}>{primaire.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} · {e.classes?.nom}</option>)}</select></label>
      <div>{TRIMESTRES_PRIMAIRE.map(t => <button key={t.id} className={trimestre === t.id ? 'is-active' : ''} onClick={() => setTrimestre(t.id)}>{t.label}</button>)}</div>
    </div>

    {(etat === 'chargement' || etat === 'migration' || etat === 'erreur') ? <div className="bp-state">{etat === 'chargement' ? 'Chargement du bulletin…' : message}</div> : <>
      <div className="bp-workspace">
        <nav className="bp-subject-nav" aria-label="Matières du bulletin">
          {affectations.map(a => <button key={a.matiere} className={matiereActive === a.matiere ? 'is-active' : ''} onClick={() => setMatiereActive(a.matiere)}>
            <span>{a.programme === 'international' ? 'EN' : 'FR'}</span><b>{a.matiere}</b><small>{String(a.prof_id) === String(user.id) ? 'À renseigner par vous' : `${a.prof?.prenom || ''} ${a.prof?.nom || ''}`.trim() || 'Autre enseignant'}</small>
          </button>)}
        </nav>
        {matiereActive && <article className="bp-editor">
          <header><div><small>{configurationActive?.programme === 'international' ? 'PROGRAMME INTERNATIONAL · ENGLISH' : 'PROGRAMME NATIONAL · FRANÇAIS'}</small><h3>{matiereActive}</h3></div><strong style={{ color: teinte(moyenneMatiere(saisie)) }}>{formatNote(moyenneMatiere(saisie))}</strong></header>
          {!peutModifier ? <div className="bp-locked">Cette matière est visible dans le bulletin commun, mais seul l’enseignant qui en a l’affectation peut la renseigner.</div> : <>
            <div className="bp-modalities">
              <EditeurModalite titre="Évaluations écrites" couleur="#f97316" notes={saisie.notes?.ecrit} onChange={notes => modifierSaisie({ ...saisie, notes: { ...saisie.notes, ecrit: notes } })} />
              <EditeurModalite titre="Évaluations orales" couleur="#2563eb" notes={saisie.notes?.oral} onChange={notes => modifierSaisie({ ...saisie, notes: { ...saisie.notes, oral: notes } })} />
            </div>
            <label className="bp-comment">Commentaire de l’enseignant<textarea value={saisie.appreciation || ''} onChange={e => modifierSaisie({ ...saisie, appreciation: e.target.value })} placeholder="Une observation concrète : acquis, progrès et prochain point à travailler…" /></label>
            <button className="bp-save" onClick={enregistrer} disabled={etat === 'sauvegarde'}>Enregistrer cette matière</button>
          </>}
        </article>}
      </div>

      <div className="bp-formula"><b>Règle de calcul affichée aux familles</b><span>Note ramenée sur 20 → moyenne des écrits et moyenne des oraux → moyenne des modalités disponibles → moyenne générale des matières évaluées.</span></div>
      <div className="bp-report-actions"><button onClick={() => window.print()}>🖨️ Imprimer le bulletin</button></div>

      <article className="bp-report" id="bulletin-primaire-print">
        <section className="bp-page">
          <EnteteBulletin trimestre={trimestre} />
          <div className="bp-identity">
            <div className="bp-photo">{photos[eleve.id] ? <img src={photos[eleve.id]} alt={`Photo de ${eleve.prenom} ${eleve.nom}`} /> : <span>PHOTO<br />OFFICIELLE</span>}</div>
            <div><small>ÉLÈVE</small><h1>{eleve.prenom} {eleve.nom}</h1><p>{eleve.classes?.nom} · Matricule {eleve.matricule || '—'}</p></div>
            <b>{TRIMESTRES_PRIMAIRE.find(t => t.id === trimestre)?.label}<small>{anneeScolaire()}</small></b>
          </div>
          <div className="bp-kpis">
            <article className="is-orange"><span>ÉCRIT</span><b>{formatNote(moyenneEcrit)}</b><i style={{ '--value': `${Number.isFinite(moyenneEcrit) ? moyenneEcrit * 5 : 0}%` }} /></article>
            <article className="is-blue"><span>ORAL</span><b>{formatNote(moyenneOral)}</b><i style={{ '--value': `${Number.isFinite(moyenneOral) ? moyenneOral * 5 : 0}%` }} /></article>
            <article className="is-green"><span>MOYENNE DU TRIMESTRE</span><b>{formatNote(moyenneGlobale)}</b><small>{appreciationAuto(moyenneGlobale)}</small></article>
            <article className="is-pink"><span>MATIÈRES ÉVALUÉES</span><b>{Object.values(matieres).filter(m => Number.isFinite(moyenneMatiere(m))).length} / {Object.keys(matieres).length}</b><small>toutes langues réunies</small></article>
          </div>
          <section className="bp-report-section">
            <div className="bp-section-title"><span>01</span><div><h2>Évolution de l’année</h2><p>Une lecture immédiate des moyennes trimestrielles déjà disponibles.</p></div></div>
            <div className="bp-evolution">{TRIMESTRES_PRIMAIRE.map(t => { const note = donneesParTrimestre[t.id]; return <div key={t.id}><b>{t.label}</b><i><span style={{ height: `${Number.isFinite(note) ? Math.max(8, note * 5) : 0}%`, background: teinte(note) }} /></i><strong>{formatPourcent(note)}</strong></div> })}</div>
          </section>
          <section className="bp-dual-summary"><article><span>PROGRAMME NATIONAL</span><b>{formatNote(moyenneNationale)}</b><small>{Object.keys(nationales).length} matière(s)</small></article><article><span>PROGRAMME INTERNATIONAL</span><b>{formatNote(moyenneInternationale)}</b><small>{Object.keys(internationales).length} subject(s)</small></article></section>
          <section className="bp-report-section">
            <div className="bp-section-title"><span>02</span><div><h2>Profil pédagogique</h2><p>Chaque jauge correspond à une moyenne de matière, sur 20.</p></div></div>
            <div className="bp-subject-gauges">{Object.entries(matieres).map(([nom, valeur]) => { const note = moyenneMatiere(valeur); return <div key={nom}><span>{nom}</span><i><b style={{ width: `${Number.isFinite(note) ? note * 5 : 0}%`, background: teinte(note) }} /></i><strong>{formatPourcent(note)}</strong></div> })}</div>
          </section>
          <div className="bp-page-number">Page 1 / 3</div>
        </section>

        <section className="bp-page">
          <EnteteBulletin trimestre={trimestre} />
          <ProgrammeTable titre="Programme national malien" sousTitre="Matières enseignées et commentées en français." programme="national" matieres={matieres} couleur="#10b981" />
          <div className="bp-page-number">Page 2 / 3</div>
        </section>

        <section className="bp-page">
          <EnteteBulletin trimestre={trimestre} />
          <ProgrammeTable titre="International programme" sousTitre="Subjects taught and assessed in English." programme="international" matieres={matieres} couleur="#2563eb" />
          <section className="bp-report-section bp-reading-key"><div className="bp-section-title"><span>03</span><div><h2>Clé de lecture</h2><p>Les résultats restent compréhensibles, même lorsqu’une matière n’utilise qu’une modalité.</p></div></div><div><p><b>Écrit</b> moyenne des contrôles écrits, chaque note étant ramenée sur 20.</p><p><b>Oral</b> moyenne des évaluations orales, chaque note étant ramenée sur 20.</p><p><b>Moyenne matière</b> moyenne de l’écrit et de l’oral lorsqu’ils existent ; sinon, seule la modalité évaluée compte.</p><p><b>Moyenne trimestrielle</b> moyenne des matières effectivement évaluées.</p></div></section>
          <footer className="bp-signatures"><div><b>ENSEIGNANT(E) · FRANÇAIS</b><span>Visa et observations</span></div><div><b>TEACHER · ENGLISH</b><span>Visa and comments</span></div><div><b>DIRECTION</b><span>Signature et cachet</span></div></footer>
          <p className="bp-footer-note">{NOM_ECOLE} · Ce bulletin rend compte des apprentissages observés pendant la période. Une case vide signifie « non évalué », jamais zéro.</p>
          <div className="bp-page-number">Page 3 / 3</div>
        </section>
      </article>
    </>}
  </section>
}

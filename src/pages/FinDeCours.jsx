import { useState, useEffect } from 'react'
import { journaliser } from '../lib/audit'

const aujourdhui = () => new Date().toISOString().slice(0, 10)
const heureActuelle = () => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Bamako', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date())
const texte = v => String(v ?? '').trim()
const enMinutes = heure => {
  const [h, m] = texte(heure).split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

export function libelleNote(v, maternelle) {
  if (v === null || v === undefined || v === '') return '—'
  if (!maternelle) return v + '/100'
  return v >= 87 ? 'Bien acquis' : v >= 62 ? 'Acquis' : v >= 37 ? 'En cours' : 'Début'
}

export function couleurNote(v) {
  if (v === null || v === undefined || v === '') return 'var(--muted)'
  return v >= 75 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)'
}

function preparationsEvaluables(preparations, classe, date = aujourdhui(), heure = heureActuelle()) {
  const lignes = Array.isArray(preparations) ? preparations : []
  return lignes.filter(p => {
    const contenu = p.contenu || {}
    if (Number(contenu._seq_index || 0) !== 0 || p.status !== 'validee' || p.date_cours > date) return false
    if (classe && p.classe_id && String(p.classe_id) !== String(classe.id)) return false
    if (classe && !p.classe_id && texte(p.groupe).toLowerCase() !== texte(classe.nom).toLowerCase()) return false
    const nb = Math.max(1, Number(contenu.nb_sequences) || 1)
    const bloc = Array.from({ length: nb }, (_, i) => Number(p.sequence) + i).map(sequence =>
      lignes.find(x => x.status === 'validee' && x.date_cours === p.date_cours
        && texte(x.matiere) === texte(p.matiere) && texte(x.groupe) === texte(p.groupe)
        && Number(x.sequence) === sequence))
    if (bloc.some(x => !x)) return false
    const derniere = bloc[bloc.length - 1]
    const finDerniere = enMinutes(derniere.heure_cours)
    const maintenant = enMinutes(heure)
    return p.date_cours < date || (finDerniere !== null && maintenant !== null && finDerniere + 30 <= maintenant)
  }).sort((a, b) => String(b.date_cours).localeCompare(String(a.date_cours)) || Number(b.sequence) - Number(a.sequence))
}

const moyenneCheckpoint = (participation, comprehension) =>
  Math.round((Number(participation) + Number(comprehension)) / 2)

export default function FinDeCours({ user, selectedClasse, classEleves, preparations, supabase }) {
  const [preparationId, setPreparationId] = useState('')
  const [participations, setParticipations] = useState({})
  const [comprehensions, setComprehensions] = useState({})
  const [statuts, setStatuts] = useState({})
  const [observations, setObservations] = useState({})
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null)
  const [tableManquante, setTableManquante] = useState(false)

  const maternelle = selectedClasse?.nom === 'Petite Section' || selectedClasse?.nom === 'Grande Section'
  const selectedClasseId = selectedClasse?.id
  const evaluables = preparationsEvaluables(preparations, selectedClasse)
  const preparation = evaluables.find(p => p.id === preparationId) || null
  const date = preparation?.date_cours || aujourdhui()
  const matiere = preparation?.matiere || ''
  const lecon = preparation?.contenu?.programme?.titre || preparation?.contenu?.objectif || ''

  useEffect(() => {
    let annule = false
    async function charger() {
      if (!selectedClasse || !preparationId) {
        setParticipations({}); setComprehensions({}); setStatuts({}); setObservations({})
        return
      }
      const { data, error } = await supabase.from('comprehensions')
        .select('eleve_id, note, participation, comprehension, statut, observation')
        .eq('classe_id', selectedClasseId).eq('preparation_id', preparationId)
      if (annule) return
      if (error) {
        if (error.code === '42P01' || error.code === '42703') setTableManquante(true)
        return
      }
      setTableManquante(false)
      const p = {}, c = {}, s = {}, o = {}
      ;(Array.isArray(data) ? data : []).forEach(r => {
        if (r.participation != null) p[r.eleve_id] = r.participation
        if (r.comprehension != null) c[r.eleve_id] = r.comprehension
        s[r.eleve_id] = r.statut || 'evalue'
        if (r.observation) o[r.eleve_id] = r.observation
      })
      setParticipations(p); setComprehensions(c); setStatuts(s); setObservations(o)
    }
    charger()
    return () => { annule = true }
  }, [selectedClasse, selectedClasseId, preparationId, supabase])

  const absents = classEleves.filter(e => statuts[e.id] === 'absent')
  const notees = classEleves.filter(e => statuts[e.id] !== 'absent'
    && participations[e.id] !== undefined && comprehensions[e.id] !== undefined)
  const moyenne = notees.length
    ? Math.round(notees.reduce((s, e) => s + moyenneCheckpoint(participations[e.id], comprehensions[e.id]), 0) / notees.length)
    : null

  function majNote(setter, id, valeur) {
    if (valeur === '') {
      setter(prev => { const copie = { ...prev }; delete copie[id]; return copie })
      return
    }
    const v = Math.max(0, Math.min(100, parseInt(valeur, 10) || 0))
    setter(prev => ({ ...prev, [id]: v }))
  }

  async function enregistrer() {
    if (!preparation) return setMessage({ type: 'err', texte: 'Choisissez une préparation validée.' })
    if (notees.length + absents.length !== classEleves.length) {
      return setMessage({ type: 'err', texte: 'Évaluez chaque élève ou marquez-le absent.' })
    }
    setEnCours(true); setMessage(null)
    const lignes = classEleves.map(e => {
      const absent = statuts[e.id] === 'absent'
      const participation = absent ? null : Number(participations[e.id])
      const comprehension = absent ? null : Number(comprehensions[e.id])
      return {
        eleve_id: e.id, classe_id: selectedClasse.id, prof_id: user.id,
        preparation_id: preparation.id, date_cours: date, matiere: matiere.trim(),
        lecon: lecon.trim() || null, participation, comprehension,
        note: absent ? 0 : moyenneCheckpoint(participation, comprehension),
        statut: absent ? 'absent' : 'evalue',
        observation: (observations[e.id] || '').trim() || null,
        saisi_par: [user.prenom, user.nom].filter(Boolean).join(' '),
      }
    })
    const { error } = await supabase.from('comprehensions')
      .upsert(lignes, { onConflict: 'eleve_id,preparation_id,date_cours,matiere' })
    setEnCours(false)
    if (error) return setMessage({ type: 'err', texte: 'Enregistrement refusé : ' + error.message })
    setMessage({ type: 'ok', texte: `${notees.length} élève(s) évalué(s), ${absents.length} absent(s) à rattraper.` })
    journaliser({ table: 'comprehensions', ligneId: preparation.id, champ: 'checkpoint_final',
      apres: `${matiere} · ${date} — ${notees.length} évalué(s), ${absents.length} à rattraper, moyenne ${moyenne ?? '—'}/100`, action: 'saisie' })
  }

  if (!selectedClasse) return <div className="empty-state"><div className="empty-icon">🏫</div><p>Choisissez d'abord une classe.</p></div>
  if (tableManquante) return <div className="empty-state"><div className="empty-icon">🛠️</div><p>Le nouveau check-point attend sa migration.</p><p style={{ fontSize:12, color:'var(--muted)' }}>Exécutez une fois <code>sql/comprehensions.sql</code> dans Supabase.</p></div>

  return <>
    <div className="section-head">
      <div className="section-title">Check-point de fin de leçon — {selectedClasse.nom}</div>
      {moyenne !== null && <span style={{ fontSize:12, fontWeight:800, color:couleurNote(moyenne) }}>Moyenne {libelleNote(moyenne, maternelle)}</span>}
    </div>
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 14px', marginBottom:12 }}>
      <label style={{ fontSize:11, fontWeight:700, color:'var(--muted)' }}>Préparation validée dont les séquences sont terminées
        <select value={preparationId} onChange={e => setPreparationId(e.target.value)} style={{ width:'100%', marginTop:4, padding:'9px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:13 }}>
          <option value="">— Choisir la leçon —</option>
          {evaluables.map(p => {
            const fin = Number(p.sequence) + Math.max(1, Number(p.contenu?.nb_sequences) || 1) - 1
            return <option key={p.id} value={p.id}>{p.date_cours} · {p.matiere} · S{p.sequence} à S{fin}</option>
          })}
        </select>
      </label>
      {preparation && <div style={{ marginTop:9, fontSize:12, color:'var(--muted)' }}><b>{matiere}</b>{lecon ? ` — ${lecon}` : ''} · dernière séquence terminée</div>}
    </div>
    {!preparation ? <div className="empty-state"><div className="empty-icon">📘</div><p>Choisissez une préparation validée pour ouvrir son check-point.</p></div> : <>
      <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden' }}>
        <div style={{ background:'#0d2a3b', color:'#fff', padding:'8px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Participation + compréhension — {notees.length}/{classEleves.length} évalué(s) · {absents.length} à rattraper</div>
        {classEleves.map(el => {
          const absent = statuts[el.id] === 'absent'
          const participation = participations[el.id]
          const comprehension = comprehensions[el.id]
          const v = !absent && participation !== undefined && comprehension !== undefined ? moyenneCheckpoint(participation, comprehension) : null
          const couleur = absent ? 'var(--amber)' : couleurNote(v)
          return <div key={el.id} style={{ padding:'11px 14px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="avatar av-blue" style={{ width:30, height:30, fontSize:10, flexShrink:0 }}>{(el.prenom[0] || '') + (el.nom[0] || '')}</div>
              <div style={{ flex:1, fontSize:13, fontWeight:700 }}>{el.prenom} {el.nom}</div>
              <button type="button" onClick={() => setStatuts(prev => ({ ...prev, [el.id]: absent ? 'evalue' : 'absent' }))} style={{ border:'1px solid '+couleur, borderRadius:8, padding:'6px 8px', background:absent?'#fff7ed':'#fff', color:couleur, fontWeight:800, fontSize:11 }}>{absent ? '↩ Présent' : 'Absent'}</button>
            </div>
            {absent ? <div style={{ marginTop:8, color:'var(--amber)', fontSize:12, fontWeight:800 }}>Absent — notion à rattraper</div> : <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                {[['Participation', participations, setParticipations], ['Compréhension', comprehensions, setComprehensions]].map(([label, valeurs, setter]) => <label key={label} style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>{label}<div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}><input type="number" min="0" max="100" value={valeurs[el.id] ?? ''} onChange={e => majNote(setter, el.id, e.target.value)} placeholder="—" style={{ width:'100%', padding:'7px 8px', borderRadius:8, border:'1px solid var(--border)', fontWeight:800 }} /><span>%</span></div></label>)}
              </div>
              {v !== null && <div style={{ marginTop:7, fontSize:12, fontWeight:800, color:couleur }}>Note générale : {libelleNote(v, maternelle)}</div>}
            </>}
            {!absent && v !== null && v < 50 && <input value={observations[el.id] || ''} onChange={e => setObservations({ ...observations, [el.id]:e.target.value })} placeholder="Ce qui a bloqué (repris dans le rapport aux parents)" style={{ width:'100%', marginTop:7, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12 }} />}
          </div>
        })}
      </div>
      {message && <div style={{ marginTop:12, padding:'10px 14px', borderRadius:10, fontSize:13, fontWeight:600, background:message.type==='ok'?'rgba(46,158,79,.10)':'rgba(220,53,69,.10)', color:message.type==='ok'?'var(--green)':'var(--red)' }}>{message.texte}</div>}
      <button className="btn-primary" onClick={enregistrer} disabled={enCours} style={{ width:'100%', marginTop:12, padding:12, borderRadius:12, fontSize:14, fontWeight:800 }}>{enCours ? 'Enregistrement…' : '💾 Enregistrer le check-point'}</button>
    </>}
  </>
}

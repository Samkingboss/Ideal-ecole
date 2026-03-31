import { useState } from 'react'

export default function CheckpointModal({ classEleves, programmeData, selectedClasse, checkpoints, planifications, selectedPeriode, supabase, user, plan, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0,10)
  const [cpDate, setCpDate] = useState(today)
  const [entries, setEntries] = useState(() => {
    const e = {}
    classEleves.forEach(el => {
      e[el.id] = {}
      programmeData.forEach(mat => {
        mat.objectifs.forEach(obj => {
          obj.competences.forEach(comp => { e[el.id][comp.id] = 0 })
        })
      })
    })
    return e
  })
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const isPS = selectedClasse?.nom === 'Petite Section' || selectedClasse?.nom === 'Grande Section'

  const setVal = (eid, cid, val) => {
    setEntries(prev => ({ ...prev, [eid]: { ...prev[eid], [cid]: val } }))
  }

  const save = async () => {
    setLoading(true)
    const { data: cpData, error } = await supabase.from('checkpoints')
      .insert({ prof_id: user.id, date_checkpoint: cpDate, planification_id: plan?.id })
      .select().single()
    if (error) { setLoading(false); alert('Erreur: ' + error.message); return }
    const progressions = []
    Object.entries(entries).forEach(([eleveId, comps]) => {
      Object.entries(comps).forEach(([compId, pct]) => {
        if (pct > 0) progressions.push({ checkpoint_id: cpData.id, eleve_id: eleveId, competence_id: compId, pourcentage: pct })
      })
    })
    if (progressions.length > 0) { const {error: insErr} = await supabase.from('progressions').insert(progressions); if(insErr) alert('Erreur insert: ' + insErr.message) }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal" style={{maxHeight:'88vh',overflowY:'auto'}}>
        <div className="modal-handle"></div>
        <div className="modal-title">Check-point — {selectedClasse?.nom}</div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={cpDate} max={today} onChange={e => { if(e.target.value <= today) setCpDate(e.target.value) }} />
        </div>
        {classEleves.map(el => {
          const isActive = activeId === el.id
          return (
            <div key={el.id} style={{background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', marginBottom:'.8rem', overflow:'hidden', boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s'}}>
              <div 
                onClick={() => setActiveId(isActive ? null : el.id)}
                style={{padding:'.8rem 1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background: isActive ? 'rgba(26,175,224,.05)' : 'transparent'}}
              >
                <div style={{fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:10}}>
                  <div className="avatar av-blue" style={{width:30, height:30, fontSize:11}}>{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                  {el.prenom} {el.nom}
                </div>
                <div style={{fontSize:18, color:'var(--muted)', transform: isActive ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}>⌄</div>
              </div>

              {isActive && (
                <div style={{padding:'0 1rem 1rem', borderTop:'1px solid var(--border)'}}>
                  <div style={{height: 12}}></div>
                  {programmeData.length === 0 ? (
                    <div style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>Aucun programme défini.</div>
                  ) : programmeData.map(mat => (
                    <div key={mat.id} style={{marginBottom:12}}>
                      <div style={{fontSize:11,fontWeight:800,color:'var(--accent)',textTransform:'uppercase',background:'rgba(26,175,224,.08)',padding:'4px 10px',borderRadius:8,marginBottom:8}}>{mat.nom}</div>
                      {mat.objectifs.map(obj => (
                        <div key={obj.id} style={{paddingLeft:6,marginBottom:8}}>
                          <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',marginBottom:6}}>Objectif: {obj.nom}</div>
                          {obj.competences.length === 0
                            ? <div style={{fontSize:10,color:'var(--muted)',fontStyle:'italic',paddingLeft:8}}>Aucune compétence</div>
                            : obj.competences.map(comp => (
                              <div key={comp.id} className="obj-row" style={{padding:'4px 0'}}>
                                <div className="obj-label" style={{fontSize:12}}>{comp.nom}</div>
                                {isPS ? (
                                  <select value={entries[el.id]?.[comp.id] || 0} onChange={e => setVal(el.id, comp.id, parseInt(e.target.value))} style={{padding:'6px 10px',borderRadius:10,border:'1px solid var(--border)',fontSize:12,background:'var(--bg)', cursor:'pointer'}}>
                                    <option value={0}>-- Choisir --</option>
                                    <option value={25}>Début</option>
                                    <option value={50}>En cours</option>
                                    <option value={75}>Acquis</option>
                                    <option value={100}>Bien acquis</option>
                                  </select>
                                ) : (
                                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                                    <input type="number" min="0" max="100" value={entries[el.id]?.[comp.id] || ''} placeholder="0" onChange={e => setVal(el.id, comp.id, Math.min(100,Math.max(0,parseInt(e.target.value)||0)))} style={{width:65,padding:'6px 10px',borderRadius:10,border:'1px solid var(--border)',fontSize:13,textAlign:'center'}} />
                                    <span style={{fontSize:12,color:'var(--muted)'}}>%</span>
                                  </div>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
        <button className="btn-cancel" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

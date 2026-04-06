import { useState } from 'react'

export default function CheckpointModal({ classEleves, programmeData, selectedClasse, selectedPeriode, supabase, user, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0,10)
  const [cpDate, setCpDate] = useState(today)
  const [entries, setEntries] = useState(() => {
    const e = {}
    classEleves.forEach(el => {
      e[el.id] = {}
      programmeData.forEach(mat => {
        mat.objectifs.forEach(obj => { e[el.id][obj.id] = 0 })
      })
    })
    return e
  })
  const [loading, setLoading] = useState(false)
  const [activeEleve, setActiveEleve] = useState(null)
  const isPS = selectedClasse?.nom === 'Petite Section' || selectedClasse?.nom === 'Grande Section'

  const setVal = (eid, oid, val) => {
    setEntries(prev => ({ ...prev, [eid]: { ...prev[eid], [oid]: val } }))
  }

  const save = async () => {
    setLoading(true)
    const { data: cpData, error } = await supabase
      .from('checkpoints')
      .insert({ prof_id: user.id, date_checkpoint: cpDate, classe_id: selectedClasse?.id, periode_id: selectedPeriode?.id })
      .select().single()
    if (error) { setLoading(false); alert('Erreur: ' + error.message); return }
    const progressions = []
    Object.entries(entries).forEach(([eleveId, objs]) => {
      Object.entries(objs).forEach(([objId, pct]) => {
        if (pct > 0) progressions.push({ checkpoint_id: cpData.id, eleve_id: eleveId, objectif_id: objId, pourcentage: pct })
      })
    })
    if (progressions.length > 0) {
      const { error: insErr } = await supabase.from('progressions').insert(progressions)
      if (insErr) { alert('Erreur progressions: ' + insErr.message); setLoading(false); return }
    }
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

        {classEleves.map(el => (
          <div key={el.id} style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',marginBottom:'.8rem',overflow:'hidden'}}>
            <div onClick={() => setActiveEleve(activeEleve === el.id ? null : el.id)}
              style={{padding:'.8rem 1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',background:activeEleve===el.id?'rgba(26,175,224,.05)':'transparent'}}>
              <div style={{fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:10}}>
                <div className="avatar av-blue" style={{width:30,height:30,fontSize:11}}>{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                {el.prenom} {el.nom}
              </div>
              <span style={{fontSize:18,color:'var(--muted)',transform:activeEleve===el.id?'rotate(180deg)':'none',transition:'transform .2s'}}>⌄</span>
            </div>
            {activeEleve === el.id && (
              <div style={{padding:'0 1rem 1rem',borderTop:'1px solid var(--border)'}}>
                <div style={{height:12}}></div>
                {programmeData.length === 0 ? (
                  <div style={{fontSize:12,color:'var(--muted)',fontStyle:'italic'}}>Aucun programme defini.</div>
                ) : programmeData.map(mat => (
                  <div key={mat.id} style={{marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:800,color:'var(--accent)',textTransform:'uppercase',background:'rgba(26,175,224,.08)',padding:'4px 10px',borderRadius:8,marginBottom:8}}>
                      {mat.nom}
                    </div>
                    {mat.objectifs.length === 0 ? (
                      <div style={{fontSize:11,color:'var(--muted)',fontStyle:'italic',paddingLeft:8}}>Aucun objectif</div>
                    ) : mat.objectifs.map(obj => (
                      <div key={obj.id} className="obj-row" style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                        <div className="obj-label" style={{fontSize:12,fontWeight:600}}>{obj.nom}</div>
                        {isPS ? (
                          <select value={entries[el.id]?.[obj.id] || 0} onChange={e => setVal(el.id, obj.id, parseInt(e.target.value))} style={{padding:'6px 10px',borderRadius:10,border:'1px solid var(--border)',fontSize:12,background:'var(--bg)',cursor:'pointer'}}>
                            <option value={0}>-- Choisir --</option>
                            <option value={25}>Debut</option>
                            <option value={50}>En cours</option>
                            <option value={75}>Acquis</option>
                            <option value={100}>Bien acquis</option>
                          </select>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <input type="number" min="0" max="100" value={entries[el.id]?.[obj.id] || ''} placeholder="0" onChange={e => setVal(el.id, obj.id, Math.min(100,Math.max(0,parseInt(e.target.value)||0)))} style={{width:65,padding:'6px 10px',borderRadius:10,border:'1px solid var(--border)',fontSize:13,textAlign:'center'}} />
                            <span style={{fontSize:12,color:'var(--muted)'}}>%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <button className="btn btn-primary" onClick={save} disabled={loading} style={{marginTop:8}}>
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button className="btn-cancel" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

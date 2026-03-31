import { useState, useEffect } from "react"

export default function ProgrammeManager({ user, selectedClasse, supabase, onUpdate }) {
  const [matieres, setMatieres] = useState([])
  const [selectedMatiere, setSelectedMatiere] = useState(null)
  const [selectedObjectif, setSelectedObjectif] = useState(null)
  const [objectifs, setObjectifs] = useState([])
  const [competences, setCompetences] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState("matieres")
  const [showForm, setShowForm] = useState(false)
  const [formVal, setFormVal] = useState("")
  const [editItem, setEditItem] = useState(null)

  useEffect(() => { loadMatieres() }, [selectedClasse])

  const loadMatieres = async () => {
    if (!selectedClasse) return
    const { data } = await supabase.from("matieres").select("*").eq("prof_id", user.id).eq("classe_id", selectedClasse.id).order("nom")
    setMatieres(data || [])
    setSelectedMatiere(null); setSelectedObjectif(null); setView("matieres")
  }

  const loadObjectifs = async (matiere) => {
    setSelectedMatiere(matiere); setSelectedObjectif(null); setView("objectifs")
    const { data } = await supabase.from("objectifs_v2").select("*").eq("matiere_id", matiere.id).order("nom")
    setObjectifs(data || [])
  }

  const loadCompetences = async (objectif) => {
    setSelectedObjectif(objectif); setView("competences")
    const { data } = await supabase.from("competences").select("*").eq("objectif_id", objectif.id).order("nom")
    setCompetences(data || [])
  }

  const handleSave = async () => {
    if (!formVal.trim()) return
    setLoading(true)
    if (view === "matieres") {
      if (editItem) { await supabase.from("matieres").update({ nom: formVal }).eq("id", editItem.id) }
      else { await supabase.from("matieres").insert({ nom: formVal, prof_id: user.id, classe_id: selectedClasse.id }) }
      await loadMatieres()
    } else if (view === "objectifs") {
      if (editItem) { await supabase.from("objectifs_v2").update({ nom: formVal }).eq("id", editItem.id) }
      else { await supabase.from("objectifs_v2").insert({ nom: formVal, matiere_id: selectedMatiere.id }) }
      const { data } = await supabase.from("objectifs_v2").select("*").eq("matiere_id", selectedMatiere.id).order("nom")
      setObjectifs(data || [])
    } else {
      if (editItem) { await supabase.from("competences").update({ nom: formVal }).eq("id", editItem.id) }
      else { await supabase.from("competences").insert({ nom: formVal, objectif_id: selectedObjectif.id }) }
      const { data } = await supabase.from("competences").select("*").eq("objectif_id", selectedObjectif.id).order("nom")
      setCompetences(data || [])
    }
    setFormVal(""); setShowForm(false); setEditItem(null); setLoading(false)
    if (onUpdate) onUpdate()
  }

  const handleDelete = async (table, id) => {
    if (!window.confirm("Supprimer cet element ?")) return
    await supabase.from(table).delete().eq("id", id)
    if (view === "matieres") await loadMatieres()
    else if (view === "objectifs") { const { data } = await supabase.from("objectifs_v2").select("*").eq("matiere_id", selectedMatiere.id).order("nom"); setObjectifs(data || []) }
    else { const { data } = await supabase.from("competences").select("*").eq("objectif_id", selectedObjectif.id).order("nom"); setCompetences(data || []) }
    if (onUpdate) onUpdate()
  }

  const startEdit = (item) => { setEditItem(item); setFormVal(item.nom); setShowForm(true) }
  const currentItems = view === "matieres" ? matieres : view === "objectifs" ? objectifs : competences
  const currentTable = view === "matieres" ? "matieres" : view === "objectifs" ? "objectifs_v2" : "competences"
  const label = view === "matieres" ? "Matiere" : view === "objectifs" ? "Objectif" : "Competence"
  const emoji = view === "matieres" ? "📚" : view === "objectifs" ? "🎯" : "⭐"

  return (
    <div style={{padding:"1rem 1.2rem 3rem"}}>
      <div className="section-head"><div className="section-title">Programme</div></div>

      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:"1rem",flexWrap:"wrap"}}>
        <span onClick={()=>{setView("matieres");setSelectedMatiere(null);setSelectedObjectif(null);}} style={{fontSize:12,fontWeight:700,color:view==="matieres"?"var(--accent)":"var(--muted)",cursor:"pointer"}}>Matieres</span>
        {selectedMatiere && (<><span style={{color:"var(--muted)"}}>›</span><span onClick={()=>{setView("objectifs");setSelectedObjectif(null);}} style={{fontSize:12,fontWeight:700,color:view==="objectifs"?"var(--accent)":"var(--muted)",cursor:"pointer"}}>{selectedMatiere.nom}</span></>)}
        {selectedObjectif && (<><span style={{color:"var(--muted)"}}>›</span><span style={{fontSize:12,fontWeight:700,color:"var(--accent)"}}>{selectedObjectif.nom}</span></>)}
      </div>

      {view === "matieres" && (
        <div style={{background:"linear-gradient(135deg,#0d2a3b,#1565a0)",borderRadius:14,padding:"1rem",marginBottom:"1rem",color:"#fff",display:"flex",gap:16,alignItems:"center"}}>
          <div style={{fontSize:28,fontWeight:900}}>{matieres.length}</div>
          <div><div style={{fontWeight:700,fontSize:13}}>Matieres dans le programme</div><div style={{fontSize:11,opacity:.7,marginTop:2}}>Classe : {selectedClasse?.nom}</div></div>
        </div>
      )}

      <div style={{background:"var(--card)",borderRadius:14,border:"1px solid var(--border)",overflow:"hidden",marginBottom:"1rem"}}>
        <div style={{background:"#0d2a3b",color:"#fff",padding:"8px 14px",fontSize:11,fontWeight:700,textTransform:"uppercase",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{view === "matieres" ? "Matieres" : view === "objectifs" ? "Objectifs — "+selectedMatiere?.nom : "Competences — "+selectedObjectif?.nom}</span>
          <span style={{fontSize:10,opacity:.7}}>{currentItems.length} element{currentItems.length>1?"s":""}</span>
        </div>
        {currentItems.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">{emoji}</div><p>Aucune {label.toLowerCase()} pour l instant</p></div>
        ) : currentItems.map(item => (
          <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
            <div style={{width:32,height:32,borderRadius:10,background:"rgba(26,175,224,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{emoji}</div>
            <div style={{flex:1,fontSize:13,fontWeight:600,cursor:view!=="competences"?"pointer":"default"}} onClick={()=>{ if(view==="matieres") loadObjectifs(item); else if(view==="objectifs") loadCompetences(item); }}>
              {item.nom}{view!=="competences"&&<span style={{fontSize:10,color:"var(--accent)",marginLeft:6}}>Voir →</span>}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>startEdit(item)} style={{background:"rgba(26,175,224,.1)",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"var(--accent)"}}>✏️</button>
              <button onClick={()=>handleDelete(currentTable,item.id)} style={{background:"rgba(237,28,36,.1)",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"var(--red)"}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{background:"var(--card)",borderRadius:14,border:"1px solid var(--accent)",padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:"var(--accent)"}}>{editItem?"Modifier":"Ajouter"} {label==="Objectif"?"un":"une"} {label.toLowerCase()}</div>
          <input className="form-input" value={formVal} onChange={e=>setFormVal(e.target.value)} placeholder={"Nom de la "+label.toLowerCase()+"..."} onKeyDown={e=>e.key==="Enter"&&handleSave()} autoFocus />
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{flex:1}}>{loading?"Enregistrement...":editItem?"Modifier":"Ajouter"}</button>
            <button onClick={()=>{setShowForm(false);setEditItem(null);setFormVal("");}} style={{flex:1,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"8px",cursor:"pointer",fontSize:13}}>Annuler</button>
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditItem(null);setFormVal("");}} style={{width:"100%"}}>
        + Ajouter {view==="matieres"?"une matiere":view==="objectifs"?"un objectif":"une competence"}
      </button>
    </div>
  )
}

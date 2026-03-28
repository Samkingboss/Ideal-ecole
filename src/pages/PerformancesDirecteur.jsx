import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

const MOIS = ["Jan","Fev","Mar","Avr","Mai","Jun","Jul","Aou","Sep","Oct","Nov","Dec"]

export default function PerformancesDirecteur({ profs }) {
  const [perfs, setPerfs] = useState([])
  const [moisIdx, setMoisIdx] = useState(new Date().getMonth())
  const [annee] = useState(new Date().getFullYear())
  const [joursOuvres, setJoursOuvres] = useState(22)

  useEffect(() => { chargerPerfs() }, [moisIdx])

  const chargerPerfs = async () => {
    const debut = annee + "-" + String(moisIdx+1).padStart(2,"0") + "-01"
    const fin = annee + "-" + String(moisIdx+1).padStart(2,"0") + "-31"
    const { data } = await supabase.from("performances")
      .select("*, recrees(*)")
      .gte("date_jour", debut)
      .lte("date_jour", fin)
    setPerfs(data || [])
  }

  const calcScore = (profId) => {
    const myPerfs = perfs.filter(p => p.prof_id === profId)
    let ponct = 0, gestion = 0, prep = 0
    myPerfs.forEach(p => {
      if (p.heure_arrivee) {
        if (p.heure_arrivee <= "07:30") ponct += 30
        else if (p.heure_arrivee <= "08:00") ponct += 25
      }
      if (p.sacs_accroches) gestion += 4
      const recrees = p.recrees || []
      recrees.forEach(r => {
        const checks = [r.outils,r.tables,r.ventilo,r.fermee,r.cle].filter(Boolean).length
        gestion += checks + (checks === 5 ? 2 : 0)
      })
      prep += p.preparation || 0
    })
    const total = ponct + gestion + prep
    const maxPossible = joursOuvres * 75
    const pct = maxPossible > 0 ? Math.round(total / maxPossible * 100) : 0
    return { ponct, gestion, prep, total, pct, jours: myPerfs.length }
  }

  const getBadge = (pct) => {
    if (pct >= 85) return { label: "Excellent", color: "#16a34a" }
    if (pct >= 70) return { label: "Bien", color: "#1AAFE0" }
    if (pct >= 55) return { label: "Moyen", color: "#F7941D" }
    return { label: "Insuffisant", color: "#ED1C24" }
  }

  const enseignants = profs.filter(p => p.role === "professeur")

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Performances</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:"1rem",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {MOIS.map((m,i) => (
            <button key={i} onClick={() => setMoisIdx(i)}
              style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",fontSize:11,fontWeight:600,cursor:"pointer",
                borderColor: moisIdx===i ? "var(--accent)" : "var(--border)",
                background: moisIdx===i ? "var(--accent)" : "var(--card)",
                color: moisIdx===i ? "#fff" : "var(--muted)"}}>
              {m}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:"var(--muted)"}}>Jours ouvres:</span>
          <input type="number" value={joursOuvres} onChange={e=>setJoursOuvres(parseInt(e.target.value)||22)}
            style={{width:50,padding:"4px 8px",borderRadius:8,border:"1px solid var(--border)",fontSize:12,textAlign:"center"}} />
        </div>
      </div>
      {enseignants.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">⭐</div><p>Aucun enseignant enregistre</p></div>
      ) : enseignants.map(prof => {
        const sc = calcScore(prof.id)
        const badge = getBadge(sc.pct)
        const col = badge.color
        return (
          <div key={prof.id} style={{background:"var(--card)",borderRadius:14,border:"1px solid var(--border)",marginBottom:10,overflow:"hidden"}}>
            <div style={{background:"linear-gradient(135deg,#0d2a3b,#1565a0)",color:"#fff",padding:".8rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{prof.prenom} {prof.nom}</div>
                <div style={{fontSize:11,opacity:.6,marginTop:2}}>{prof.langue === "en" ? "Anglais" : "Francais"} · {sc.jours} jours pointes</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:28,fontWeight:900,color:"#1AAFE0"}}>{sc.pct}%</div>
                <span style={{fontSize:10,fontWeight:700,background:"rgba(255,255,255,.15)",padding:"2px 8px",borderRadius:20}}>{badge.label}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:"var(--border)"}}>
              <div style={{background:"var(--card)",padding:".6rem",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:"var(--accent)"}}>{sc.ponct}</div>
                <div style={{fontSize:9,color:"var(--muted)",marginTop:2}}>Ponctualite</div>
              </div>
              <div style={{background:"var(--card)",padding:".6rem",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:"var(--green)"}}>{sc.gestion}</div>
                <div style={{fontSize:9,color:"var(--muted)",marginTop:2}}>Gestion classe</div>
              </div>
              <div style={{background:"var(--card)",padding:".6rem",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:"var(--amber)"}}>{sc.prep}</div>
                <div style={{fontSize:9,color:"var(--muted)",marginTop:2}}>Preparations</div>
              </div>
            </div>
            <div style={{padding:".6rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)",marginBottom:4}}>
                <span>Score global</span>
                <span style={{fontWeight:700,color:col}}>{sc.total} / {joursOuvres * 75} pts</span>
              </div>
              <div style={{background:"var(--bg)",borderRadius:20,height:8,overflow:"hidden"}}>
                <div style={{height:"100%",background:col,borderRadius:20,width:sc.pct+"%",transition:"width .4s"}}></div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
import { useState } from 'react'
const JOURS_FERIES = [
  { date: '2026-01-01', label: 'Nouvel An' },
  { date: '2026-01-20', label: 'Fete de l Armee' },
  { date: '2026-03-19', label: 'Ramadan' },
  { date: '2026-03-20', label: 'Ramadan' },
  { date: '2026-03-26', label: 'Journee des Martyrs' },
  { date: '2026-04-06', label: 'Lundi de Paques' },
  { date: '2026-05-01', label: 'Fete du Travail' },
  { date: '2026-05-26', label: 'Tabaski' },
  { date: '2026-05-27', label: 'Tabaski' },
  { date: '2026-06-29', label: 'Fin d annee' },
]
const VACANCES = [
  { debut: '2025-11-15', fin: '2025-11-22', label: 'Conge Periode 1' },
  { debut: '2025-12-23', fin: '2026-01-04', label: 'Vacances Noel' },
  { debut: '2026-02-21', fin: '2026-03-01', label: 'Conge Periode 3' },
  { debut: '2026-04-18', fin: '2026-04-26', label: 'Conge Periode 4' },
  { debut: '2026-06-30', fin: '2026-09-30', label: 'Grandes Vacances' },
]
const PERIODES = [
  { num: 1, debut: '2025-10-01', fin: '2025-11-14', color: '#1AAFE0', label: 'Periode 1' },
  { num: 2, debut: '2025-11-24', fin: '2025-12-19', color: '#8DC63F', label: 'Periode 2' },
  { num: 3, debut: '2026-01-05', fin: '2026-02-20', color: '#F7941D', label: 'Periode 3' },
  { num: 4, debut: '2026-03-02', fin: '2026-04-17', color: '#EC008C', label: 'Periode 4' },
  { num: 5, debut: '2026-04-27', fin: '2026-06-29', color: '#00B5B8', label: 'Periode 5' },
]
const MOIS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']
const JOURS = ['L','M','M','J','V','S','D']
const toStr = (y,m,d) => y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0')
const isFerie = d => JOURS_FERIES.find(f => f.date === d)
const isVacance = d => VACANCES.find(v => d >= v.debut && d <= v.fin)
const getPeriode = d => PERIODES.find(p => d >= p.debut && d <= p.fin)

export default function AgendaCalendrier({ checkpoints }) {
  const today = new Date()
  const [moisIdx, setMoisIdx] = useState(today.getMonth())
  const [annee, setAnnee] = useState(today.getFullYear())
  const [selected, setSelected] = useState(null)
  const premierJour = new Date(annee, moisIdx, 1).getDay()
  const offset = premierJour === 0 ? 6 : premierJour - 1
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate()
  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate())
  const cpDates = (checkpoints||[]).map(cp => cp.date_checkpoint?.slice(0,10)).filter(Boolean)
  const cells = [...Array(offset).fill(null), ...Array.from({length:nbJours},(_,i)=>i+1)]
  const moisPrecedent = () => { if(moisIdx===0){setMoisIdx(11);setAnnee(a=>a-1);}else setMoisIdx(m=>m-1); setSelected(null); }
  const moisSuivant = () => { if(moisIdx===11){setMoisIdx(0);setAnnee(a=>a+1);}else setMoisIdx(m=>m+1); setSelected(null); }
  const periodeActuelle = getPeriode(todayStr)
  return (
    <div style={{padding:'1rem 1.2rem 3rem'}}>
      <div className="section-head"><div className="section-title">Agenda</div></div>
      {periodeActuelle && (
        <div style={{background:'linear-gradient(135deg,#0d2a3b,#1565a0)',borderRadius:14,padding:'1rem',marginBottom:'1rem',color:'#fff',display:'flex',gap:12,alignItems:'center'}}>
          <div style={{width:12,height:12,borderRadius:'50%',background:periodeActuelle.color,flexShrink:0}}></div>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>{periodeActuelle.label} en cours</div>
            <div style={{fontSize:11,opacity:.7,marginTop:2}}>Fin le {new Date(periodeActuelle.fin+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</div>
          </div>
        </div>
      )}
      <div style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden',marginBottom:'1rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.8rem 1rem',background:'#0d2a3b',color:'#fff'}}>
          <button onClick={moisPrecedent} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16}}>‹</button>
          <div style={{fontWeight:700,fontSize:15}}>{MOIS[moisIdx]} {annee}</div>
          <button onClick={moisSuivant} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16}}>›</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,background:'var(--border)',padding:'1px'}}>
          {JOURS.map((j,i) => (
            <div key={i} style={{background:'var(--bg)',textAlign:'center',padding:'6px 0',fontSize:10,fontWeight:700,color:'var(--muted)'}}>{j}</div>
          ))}
          {cells.map((d,i) => {
            if(!d) return <div key={'e'+i} style={{background:'var(--bg)'}}></div>
            const ds = toStr(annee, moisIdx, d)
            const ferie = isFerie(ds)
            const vac = isVacance(ds)
            const per = getPeriode(ds)
            const isToday = ds === todayStr
            const hasCp = cpDates.includes(ds)
            const bg = vac ? 'rgba(237,28,36,.08)' : per ? per.color+'18' : 'var(--card)'
            const col = ferie ? '#EC008C' : vac ? '#ED1C24' : 'var(--text)'
            return (
              <div key={d} onClick={()=>setSelected({ds,ferie,vac,per,hasCp})}
                style={{background:bg,padding:'6px 4px',textAlign:'center',cursor:'pointer',border:isToday?'2px solid var(--accent)':'2px solid transparent',borderRadius:4}}>
                <div style={{fontSize:12,fontWeight:isToday?900:400,color:col}}>{d}</div>
                {hasCp && <div style={{width:5,height:5,borderRadius:'50%',background:'#F7941D',margin:'2px auto 0'}}></div>}
                {ferie && <div style={{width:5,height:5,borderRadius:'50%',background:'#EC008C',margin:'2px auto 0'}}></div>}
              </div>
            )
          })}
        </div>
      </div>
      {selected && (
        <div style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',padding:'1rem',marginBottom:'1rem'}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>
            {new Date(selected.ds+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
          {selected.ferie && <div style={{fontSize:12,color:'#EC008C',fontWeight:600,marginBottom:4}}>Jour ferie : {selected.ferie.label}</div>}
          {selected.vac && <div style={{fontSize:12,color:'#ED1C24',fontWeight:600,marginBottom:4}}>{selected.vac.label}</div>}
          {selected.per && <div style={{fontSize:12,color:selected.per.color,fontWeight:600,marginBottom:4}}>{selected.per.label}</div>}
          {selected.hasCp && <div style={{fontSize:12,color:'#F7941D',fontWeight:600}}>Check-point enregistre ce jour</div>}
          {!selected.ferie && !selected.vac && !selected.per && !selected.hasCp && (
            <div style={{fontSize:12,color:'var(--muted)'}}>Hors annee scolaire</div>
          )}
        </div>
      )}
    </div>
  )
}

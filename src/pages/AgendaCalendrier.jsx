import { useState } from 'react'

const JOURS_FERIES_2025_2026 = [
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

const TRIMESTRES = [
  { num: 1, debut: '2025-10-01', fin: '2025-11-14', color: '#1AAFE0', label: 'Periode 1' },
  { num: 2, debut: '2025-11-24', fin: '2025-12-19', color: '#8DC63F', label: 'Periode 2' },
  { num: 3, debut: '2026-01-05', fin: '2026-02-20', color: '#F7941D', label: 'Periode 3' },
  { num: 4, debut: '2026-03-02', fin: '2026-04-17', color: '#EC008C', label: 'Periode 4' },
  { num: 5, debut: '2026-04-27', fin: '2026-06-29', color: '#00B5B8', label: 'Periode 5' },
]

const MOIS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']
const JOURS = ['L','M','M','J','V','S','D']

const isFerie = (dateStr) => JOURS_FERIES_2025_2026.find(f => f.date === dateStr)
const isVacance = (dateStr) => VACANCES.find(v => dateStr >= v.debut && dateStr <= v.fin)
const getTrimestre = (dateStr) => TRIMESTRES.find(t => dateStr >= t.debut && dateStr <= t.fin)

const toDateStr = (y, m, d) => y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0')

export default function AgendaCalendrier({ checkpoints }) {
  const today = new Date()
  const [moisIdx, setMoisIdx] = useState(today.getMonth())
  const [annee, setAnnee] = useState(today.getFullYear())
  const [selected, setSelected] = useState(null)

  const premierJour = new Date(annee, moisIdx, 1).getDay()
  const offset = premierJour === 0 ? 6 : premierJour - 1
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate()

  const moisPrecedent = () => {
    if (moisIdx === 0) { setMoisIdx(11); setAnnee(a => a - 1) }
    else setMoisIdx(m => m - 1)
  }
  const moisSuivant = () => {
    if (moisIdx === 11) { setMoisIdx(0); setAnnee(a => a + 1) }
    else setMoisIdx(m => m + 1)
  }

  const getCpDates = () => {
    if (!checkpoints) return []
    return checkpoints.map(cp => cp.date_checkpoint)
  }
  const cpDates = getCpDates()

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= nbJours; d++) cells.push(d)

  const todayStr = today.toISOString().slice(0,10)
  const trimCourant = getTrimestre(todayStr)

  return (
    <div style={{padding:'0 0 2rem'}}>
      <div style={{background:'linear-gradient(135deg,#0d2a3b,#1565a0)',borderRadius:14,padding:'1rem',marginBottom:'1rem',color:'#fff'}}>
        <div style={{fontSize:13,opacity:.6,marginBottom:4}}>Annee scolaire 2025-2026</div>
        {trimCourant ? (
          <div>
            <div style={{fontWeight:700,fontSize:16}}>{trimCourant.label}</div>
            <div style={{fontSize:11,opacity:.7,marginTop:2}}>{trimCourant.debut.slice(8)}/{trimCourant.debut.slice(5,7)} au {trimCourant.fin.slice(8)}/{trimCourant.fin.slice(5,7)}</div>
          </div>
        ) : (
          <div style={{fontWeight:700,fontSize:16}}>Vacances scolaires</div>
        )}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:'1rem',flexWrap:'wrap'}}>
        {TRIMESTRES.map(t => (
          <div key={t.num} style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'4px 10px',fontSize:11}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:t.color,flexShrink:0}}></div>
            <span style={{fontWeight:600}}>{t.label}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'4px 10px',fontSize:11}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:'rgba(237,28,36,.3)',flexShrink:0}}></div>
          <span style={{fontWeight:600}}>Vacances</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'4px 10px',fontSize:11}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:'#EC008C',flexShrink:0}}></div>
          <span style={{fontWeight:600}}>Ferie</span>
        </div>
      </div>

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
          {cells.map((d, i) => {
            if (!d) return <div key={'e'+i} style={{background:'var(--bg)'}}></div>
            const dateStr = toDateStr(annee, moisIdx, d)
            const ferie = isFerie(dateStr)
            const vac = isVacance(dateStr)
            const trim = getTrimestre(dateStr)
            const isToday = dateStr === todayStr
            const hasCp = cpDates.includes(dateStr)
            const bg = vac ? 'rgba(237,28,36,.08)' : trim ? trim.color + '15' : 'var(--card)'
            const textCol = ferie ? '#EC008C' : vac ? '#ED1C24' : 'var(--text)'
            return (
              <div key={d} onClick={() => setSelected({dateStr, ferie, vac, trim, hasCp})}
                style={{background:bg,padding:'6px 4px',textAlign:'center',cursor:'pointer',position:'relative',
                  border: isToday ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius:4}}>
                <div style={{fontSize:12,fontWeight:isToday?900:400,color:textCol}}>{d}</div>
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
            {new Date(selected.dateStr+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
          {selected.ferie && <div style={{fontSize:12,color:'#EC008C',fontWeight:600,marginBottom:4}}>Jour ferie : {selected.ferie.label}</div>}
          {selected.vac && <div style={{fontSize:12,color:'#ED1C24',fontWeight:600,marginBottom:4}}>{selected.vac.label}</div>}
          {selected.trim && <div style={{fontSize:12,color:selected.trim.color,fontWeight:600,marginBottom:4}}>{selected.trim.label}</div>}
          {selected.hasCp && <div style={{fontSize:12,color:'#F7941D',fontWeight:600}}>Check-point enregistre ce jour</div>}
          {!selected.ferie && !selected.vac && !selected.trim && !selected.hasCp && (
            <div style={{fontSize:12,color:'var(--muted)'}}>Jour hors annee scolaire</div>
          )}
        </div>
      )}

      <div style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden'}}>
        <div style={{background:'#0d2a3b',color:'#fff',padding:'8px 14px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>
          Jours feries 2025-2026
        </div>
        {JOURS_FERIES_2025_2026.map((f,i) => (
          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:12}}>
            <span style={{fontWeight:600,color:'#EC008C'}}>{f.label}</span>
            <span style={{color:'var(--muted)'}}>{new Date(f.date+'T12:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

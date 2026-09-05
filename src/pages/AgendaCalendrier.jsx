import { useEffect, useState } from 'react'
import { PERIODES_AGENDA } from '../lib/periodeScolaire'
import { supabase } from '../lib/supabase'
// ─── Calendrier scolaire IDEAL 2026-2027 ───
const JOURS_FERIES = [
  { date: '2027-01-20', label: 'Fete de l Armee' },
  { date: '2027-03-10', label: 'Ramadan*' },
  { date: '2027-03-12', label: 'Ramadan*' },
  { date: '2027-03-26', label: 'Journee des Martyrs' },
  { date: '2027-03-29', label: 'Lundi de Paques' },
  { date: '2027-05-17', label: 'Fete de Tabaski*' },
  { date: '2027-05-18', label: 'Fete de Tabaski*' },
  { date: '2027-06-26', label: 'Celebration Fin d annee' },
]
const VACANCES = [
  { debut: '2026-11-14', fin: '2026-11-22', label: 'Conge Periode 1' },
  { debut: '2026-12-19', fin: '2027-01-03', label: 'Vacances de Noel' },
  { debut: '2027-02-20', fin: '2027-02-28', label: 'Conge Periode 3' },
  { debut: '2027-04-17', fin: '2027-04-25', label: 'Conge Periode 4' },
  { debut: '2027-06-26', fin: '2027-09-30', label: 'Grandes Vacances' },
]
// Les bornes de l'année vivaient ici, en dur, et `periodeScolaire.js` en
// tenait une seconde copie pour dater les devoirs. Deux copies finissent par
// diverger — c'est exactement le reproche fait à la table `periodes`. Il n'y
// en a plus qu'une, et c'est celle-ci qu'écrit la migration.
const PERIODES = PERIODES_AGENDA
const EVENEMENTS = [
  { date: '2026-08-10', label: 'Reprise des formations des enseignants', icon: '🎓' },
  { date: '2026-10-01', label: 'Rentree scolaire 2026-2027', icon: '🏫' },
  { date: '2027-06-25', label: 'Fin des cours', icon: '🏁' },
]
const isEvent = d => EVENEMENTS.find(e => e.date === d)
const MOIS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']
const JOURS = ['L','M','M','J','V','S','D']
const toStr = (y,m,d) => y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0')
const isFerie = d => JOURS_FERIES.find(f => f.date === d)
const isVacance = d => VACANCES.find(v => d >= v.debut && d <= v.fin)
const getPeriode = d => PERIODES.find(p => d >= p.debut && d <= p.fin)

export default function AgendaCalendrier({ checkpoints, anniversaires = [], user, isAdmin = false }) {
  // Anniversaires récurrents (clé MM-JJ)
  const annivMap = {}
  ;(anniversaires || []).forEach(a => {
    if (!a.date_naissance) return
    const mmjj = a.date_naissance.slice(5, 10)
    ;(annivMap[mmjj] = annivMap[mmjj] || []).push(((a.prenom || '') + ' ' + (a.nom || '')).trim())
  })
  const getAnnivs = ds => annivMap[ds.slice(5, 10)] || []
  const today = new Date()
  const todayISO0 = toStr(today.getFullYear(), today.getMonth(), today.getDate())
  // Avant la rentree, on ouvre le calendrier sur le mois du prochain evenement
  const preRentree = todayISO0 < '2026-10-01'
  const [moisIdx, setMoisIdx] = useState(preRentree ? 7 : today.getMonth())
  const [annee, setAnnee] = useState(preRentree ? 2026 : today.getFullYear())
  const [selected, setSelected] = useState(null)
  const [evenementsPerso, setEvenementsPerso] = useState([])
  const [edition, setEdition] = useState(null)
  const [messageAgenda, setMessageAgenda] = useState('')
  // L'agenda appartient à toute personne qui dispense des cours. Le Directeur
  // et le Responsable administratif peuvent désormais recevoir des matières
  // depuis le même écran d'affectation que les enseignants ; leurs rappels
  // restent privés et filtrés par leur identité serveur exactement comme ceux
  // d'un professeur.
  const agendaPersonnelActif = !isAdmin && ['professeur', 'directeur', 'responsable_administratif'].includes(user?.role)
  const premierJour = new Date(annee, moisIdx, 1).getDay()
  const offset = premierJour === 0 ? 6 : premierJour - 1
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate()
  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate())
  const cpDates = (checkpoints||[]).map(cp => cp.date_checkpoint?.slice(0,10)).filter(Boolean)
  const cells = [...Array(offset).fill(null), ...Array.from({length:nbJours},(_,i)=>i+1)]
  const moisPrecedent = () => { if(moisIdx===0){setMoisIdx(11);setAnnee(a=>a-1);}else setMoisIdx(m=>m-1); setSelected(null); }
  const moisSuivant = () => { if(moisIdx===11){setMoisIdx(0);setAnnee(a=>a+1);}else setMoisIdx(m=>m+1); setSelected(null); }
  const periodeActuelle = getPeriode(todayStr)

  const chargerAgendaPersonnel = async () => {
    if (!agendaPersonnelActif) return
    const debut = new Date(annee, moisIdx, 1).toISOString()
    const fin = new Date(annee, moisIdx + 1, 1).toISOString()
    const { data, error } = await supabase.rpc('lire_mon_agenda', { p_debut: debut, p_fin: fin })
    if (error) {
      setMessageAgenda(error.code === '42883' ? 'L’agenda personnel attend son activation.' : `Agenda indisponible : ${error.message}`)
      return
    }
    // `Array.isArray` plutot que `data || []` : l'erreur est deja traitee
    // trois lignes plus haut, et le cliquet C1 compte la FORME `data || []`,
    // pas l'intention. Meme idiome que le reste du depot.
    setEvenementsPerso(Array.isArray(data) ? data : [])
    setMessageAgenda('')
  }

  useEffect(() => { chargerAgendaPersonnel() }, [agendaPersonnelActif, annee, moisIdx])
  useEffect(() => {
    if (!agendaPersonnelActif) return undefined
    const verifier = () => supabase.rpc('traiter_mes_rappels_agenda').then(({ error }) => {
      if (error && error.code !== '42883') console.error('Rappel agenda non traité :', error.message)
    })
    verifier()
    const intervalle = window.setInterval(verifier, 60000)
    return () => window.clearInterval(intervalle)
  }, [agendaPersonnelActif])

  const commencerAjout = ds => setEdition({ id: null, titre: '', description: '', commence_at: `${ds}T08:00`, rappel_minutes: 30 })
  const modifierEvenement = evenement => setEdition({
    ...evenement,
    commence_at: new Date(evenement.commence_at).toLocaleString('sv-SE', { timeZone: 'Africa/Bamako' }).slice(0, 16),
  })
  const sauverEvenement = async e => {
    e.preventDefault()
    const { error } = await supabase.rpc('sauver_mon_evenement_agenda', {
      p_id: edition.id, p_titre: edition.titre, p_description: edition.description,
      p_commence_at: new Date(edition.commence_at).toISOString(), p_rappel_minutes: Number(edition.rappel_minutes),
    })
    if (error) return setMessageAgenda(`Enregistrement impossible : ${error.message}`)
    setEdition(null); setMessageAgenda('Événement enregistré.'); await chargerAgendaPersonnel()
  }
  const supprimerEvenement = async id => {
    if (!window.confirm('Supprimer cet événement personnel ?')) return
    const { error } = await supabase.rpc('supprimer_mon_evenement_agenda', { p_id: id })
    if (error) return setMessageAgenda(`Suppression impossible : ${error.message}`)
    setEdition(null); setMessageAgenda('Événement supprimé.'); await chargerAgendaPersonnel()
  }
  return (
    <div style={{padding:'1rem 1.2rem 3rem'}}>
      <div className="section-head"><div className="section-title">Agenda 2026-2027</div></div>
      {(() => {
        const prochains = EVENEMENTS.filter(e => e.date >= todayStr).slice(0,2)
        if(!prochains.length) return null
        return (
          <div style={{marginBottom:'1rem'}}>
            {prochains.map(e => (
              <div key={e.date} style={{background:'#fff',border:'1px solid var(--border)',borderLeft:'4px solid #7E57C2',borderRadius:12,padding:'.7rem .9rem',marginBottom:8,display:'flex',gap:10,alignItems:'center'}}>
                <div style={{fontSize:20}}>{e.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--text)'}}>{e.label}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{new Date(e.date+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}
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
            const ev = isEvent(ds)
            const annivs = getAnnivs(ds)
            const perso = evenementsPerso.filter(e => e.commence_at?.slice(0,10) === ds)
            const bg = ev ? 'rgba(126,87,194,.12)' : vac ? 'rgba(237,28,36,.08)' : per ? per.color+'18' : 'var(--card)'
            const col = ferie ? '#EC008C' : vac ? '#ED1C24' : 'var(--text)'
            return (
              <div key={d} onClick={()=>setSelected({ds,ferie,vac,per,hasCp,ev,annivs,perso})}
                style={{background:bg,padding:'6px 4px',textAlign:'center',cursor:'pointer',border:isToday?'2px solid var(--accent)':ev?'2px solid #7E57C2':'2px solid transparent',borderRadius:4}}>
                <div style={{fontSize:12,fontWeight:isToday||ev?900:400,color:col}}>{d}</div>
                {ev && <div style={{fontSize:9,lineHeight:1,marginTop:1}}>{ev.icon}</div>}
                {annivs.length>0 && <div style={{fontSize:9,lineHeight:1,marginTop:1}}>🎂</div>}
                {perso.length>0 && <div style={{fontSize:9,lineHeight:1,marginTop:1}}>🔔</div>}
                {hasCp && <div style={{width:5,height:5,borderRadius:'50%',background:'#F7941D',margin:'2px auto 0'}}></div>}
                {ferie && !ev && <div style={{width:5,height:5,borderRadius:'50%',background:'#EC008C',margin:'2px auto 0'}}></div>}
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
          {selected.ev && <div style={{fontSize:13,color:'#7E57C2',fontWeight:700,marginBottom:4}}>{selected.ev.icon} {selected.ev.label}</div>}
          {selected.annivs && selected.annivs.length>0 && <div style={{fontSize:12,color:'#EC008C',fontWeight:700,marginBottom:4}}>🎂 Anniversaire : {selected.annivs.join(', ')}</div>}
          {selected.ferie && <div style={{fontSize:12,color:'#EC008C',fontWeight:600,marginBottom:4}}>Jour ferie : {selected.ferie.label}</div>}
          {selected.vac && <div style={{fontSize:12,color:'#ED1C24',fontWeight:600,marginBottom:4}}>{selected.vac.label}</div>}
          {selected.per && <div style={{fontSize:12,color:selected.per.color,fontWeight:600,marginBottom:4}}>{selected.per.label}</div>}
          {selected.hasCp && <div style={{fontSize:12,color:'#F7941D',fontWeight:600}}>Check-point enregistre ce jour</div>}
          {selected.perso?.map(evenement => <button type="button" key={evenement.id} onClick={() => modifierEvenement(evenement)} style={{ width:'100%', marginTop:8, padding:'10px 12px', textAlign:'left', cursor:'pointer', borderRadius:10, border:'1px solid #7E57C2', background:'rgba(126,87,194,.08)', color:'var(--text)' }}><b>🔔 {new Date(evenement.commence_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · {evenement.titre}</b>{evenement.description && <div style={{fontSize:11,marginTop:3,color:'var(--muted)'}}>{evenement.description}</div>}</button>)}
          {agendaPersonnelActif && <button type="button" className="btn-sm" onClick={() => commencerAjout(selected.ds)} style={{marginTop:12}}>＋ Planifier un rappel</button>}
          {!selected.ev && !(selected.annivs&&selected.annivs.length) && !selected.ferie && !selected.vac && !selected.per && !selected.hasCp && !(selected.perso?.length) && (
            <div style={{fontSize:12,color:'var(--muted)'}}>Hors annee scolaire</div>
          )}
        </div>
      )}
      {agendaPersonnelActif && messageAgenda && <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>{messageAgenda}</div>}
      {agendaPersonnelActif && edition && <form onSubmit={sauverEvenement} style={{background:'var(--card)',borderRadius:14,border:'2px solid rgba(126,87,194,.35)',padding:'1rem',marginBottom:'1rem'}}>
        <div style={{fontWeight:900,marginBottom:10}}>{edition.id ? 'Modifier le rappel' : 'Nouveau rappel personnel'}</div>
        <label className="form-label">Titre</label><input className="form-input" required maxLength={160} value={edition.titre} onChange={e=>setEdition({...edition,titre:e.target.value})} placeholder="Réunion, documents à préparer…" />
        <label className="form-label" style={{marginTop:10}}>Date et heure</label><input className="form-input" type="datetime-local" required value={edition.commence_at} onChange={e=>setEdition({...edition,commence_at:e.target.value})} />
        <label className="form-label" style={{marginTop:10}}>Me rappeler</label><select className="form-select" value={edition.rappel_minutes} onChange={e=>setEdition({...edition,rappel_minutes:Number(e.target.value)})}><option value={0}>À l’heure prévue</option><option value={15}>15 minutes avant</option><option value={30}>30 minutes avant</option><option value={60}>1 heure avant</option><option value={1440}>1 jour avant</option><option value={10080}>1 semaine avant</option></select>
        <label className="form-label" style={{marginTop:10}}>Note facultative</label><textarea className="form-input" rows={3} value={edition.description || ''} onChange={e=>setEdition({...edition,description:e.target.value})} />
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}><button className="btn-primary" type="submit">Enregistrer</button><button className="btn-sm" type="button" onClick={()=>setEdition(null)}>Annuler</button>{edition.id && <button className="btn-sm" type="button" onClick={()=>supprimerEvenement(edition.id)} style={{color:'var(--red)'}}>Supprimer</button>}</div>
      </form>}
    </div>
  )
}

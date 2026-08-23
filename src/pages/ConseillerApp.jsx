import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { messageLisible } from '../lib/chargement'
import AgendaCalendrier from './AgendaCalendrier'
import NotificationCenter from './NotificationCenter'

const dateLocale = () => new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Africa/Bamako', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date())

const heureLocale = () => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Bamako', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(new Date())

// Jours restants avant le prochain anniversaire (récurrent)
const joursAvantAnniv = (dn) => {
  if (!dn) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const [ , mm, jj] = dn.split('-').map(Number)
  let next = new Date(now.getFullYear(), mm - 1, jj)
  if (next < now) next = new Date(now.getFullYear() + 1, mm - 1, jj)
  return Math.round((next - now) / 86400000)
}

export default function ConseillerApp({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [selectedTrimester, setSelectedTrimester] = useState('T3')
  const [retardStats, setRetardStats] = useState([])
  // Combien d'enregistrements de présence existent sur la période, tous
  // statuts confondus. Zéro retard sur un registre tenu et zéro retard sur un
  // registre jamais ouvert s'affichaient à l'identique : le second n'est pas
  // une bonne nouvelle, c'est une absence de mesure.
  const [couverture, setCouverture] = useState(null)  // null = pas encore su
  const [eleves, setEleves] = useState([])
  const [classes, setClasses] = useState([])
  const [disciplines, setDisciplines] = useState([])
  const [checkpoints, setCheckpoints] = useState([])
  const [presences, setPresences] = useState({})
  const [devoirs, setDevoirs] = useState([])
  const [loading, setLoading] = useState(false)
  // LOADING ≠ EMPTY ≠ ERROR. Sans ces deux états, un registre vide parce
  // que la requête a échoué se lit « aucun retard aujourd'hui ».
  const [erreur, setErreur] = useState('')
  const [blocsEnEchec, setBlocsEnEchec] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [pointagePersonnel, setPointagePersonnel] = useState(null)
  const [pointageEnCours, setPointageEnCours] = useState(false)

  const TRIMESTRES = {
    T1: { start: '2025-09-01', end: '2025-12-31', label: '1er Trimestre' },
    T2: { start: '2026-01-01', end: '2026-03-31', label: '2ème Trimestre' },
    T3: { start: '2026-04-01', end: '2026-06-30', label: '3ème Trimestre' }
  }

  useEffect(() => { loadData(); loadPointagePersonnel() }, [])
  useEffect(() => { if (tab === 'retards') loadRetardStats() }, [tab, selectedTrimester, selectedClass])

  const loadRetardStats = async () => {
    if (!selectedClass) return
    setLoading(true)
    const period = TRIMESTRES[selectedTrimester]
    
    // Tous les statuts, pas seulement les retards : c'est le seul moyen de
    // savoir si le registre a été tenu. Une requête, deux réponses — sur le
    // réseau d'ici, un aller-retour économisé compte.
    const { data, error } = await supabase
      .from('presences_eleves')
      .select('eleve_id, statut, minutes_retard, eleves(prenom, nom, classe_id)')
      .gte('date_jour', period.start)
      .lte('date_jour', period.end)

    // `if (!error)` sans branche `else` : sur échec, la fonction ne faisait
    // rien et l'écran conservait les statistiques du trimestre précédent,
    // sans que rien ne l'indique. Le conseiller lisait des retards périmés.
    if (error) {
      setErreur(messageLisible(error))
      setRetardStats([])
      setCouverture(null)   // on ne sait pas : surtout ne pas dire « registre vide »
      setLoading(false)
      return
    }
    setErreur('')
    {
      // Filtrer par classe (car le join via select ne filtre pas la racine)
      const classPresences = (Array.isArray(data) ? data : []).filter(r => r.eleves?.classe_id === selectedClass)
      const classRetards = classPresences.filter(r => r.statut === 'retard')
      setCouverture(classPresences.length)
      
      // Aggréger par élève
      const stats = {}
      // Initialiser tous les élèves de la classe à 0
      eleves.filter(e => e.classe_id === selectedClass).forEach(e => {
        stats[e.id] = { name: `${e.prenom} ${e.nom}`, total: 0 }
      })
      
      classRetards.forEach(r => {
        if (stats[r.eleve_id]) {
          stats[r.eleve_id].total += (r.minutes_retard || 0)
        }
      })
      
      setRetardStats(Object.values(stats).sort((a,b) => b.total - a.total))
    }
    setLoading(false)
  }

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    // Six requêtes dont aucune erreur n'était déstructurée. Un refus RLS
    // sur `eleves` vidait le registre du jour sans un mot — et le registre
    // de présence est la source officielle de l'école (V2.1 §7).
    const [
      { data: el, error: eEl },
      { data: cl, error: eCl },
      { data: disc, error: eDisc },
      { data: cp, error: eCp },
      { data: pres, error: ePres },
      { data: dev, error: eDev }
    ] = await Promise.all([
      supabase.from('eleves').select('*, classes(nom)').eq('actif', true).order('nom'),
      supabase.from('classes').select('*').order('ordre'),
      supabase.from('disciplines').select('*, users!prof_id(prenom, nom)').eq('date_incident', today),
      supabase.from('checkpoints').select('*, planification:planifications(classe_id), progressions(eleve_id, pourcentage, objectifs(nom))').eq('date_checkpoint', today),
      supabase.from('presences_eleves').select('*').eq('date_jour', today),
      supabase.from('devoirs').select('*').gte('date_rendu', today)
    ])
    
    const enEchec = [
      ['élèves', eEl], ['classes', eCl], ['incidents', eDisc],
      ['checkpoints', eCp], ['présences', ePres], ['devoirs', eDev],
    ].filter(([, e]) => e)

    // Signaler par bloc : une requête en échec ne doit pas faire perdre les
    // cinq autres, mais elle ne doit pas non plus passer inaperçue.
    setBlocsEnEchec(enEchec.map(([nom]) => nom))
    setErreur(enEchec.length ? messageLisible(enEchec[0][1]) : '')

    const liste = (d) => Array.isArray(d) ? d : []
    setEleves(liste(el))
    setClasses(liste(cl))
    setDisciplines(liste(disc))
    setCheckpoints(liste(cp))
    setDevoirs(liste(dev))

    const pMap = {}
    liste(pres).forEach(p => { pMap[p.eleve_id] = p })
    setPresences(pMap)
    
    if (cl && cl.length > 0 && !selectedClass) setSelectedClass(cl[0].id)
    setLoading(false)
  }

  // saveEleve, la modale d'eleve et l'etat associe ont ete retires : le
  // conseiller ne cree ni ne modifie plus d'eleve. Les inscriptions et les
  // dossiers sont tenus par le responsable administratif.

  const loadPointagePersonnel = async () => {
    if (!user?.id) return
    const { data } = await supabase.from('performances').select('*')
      .eq('prof_id', user.id).eq('date_jour', dateLocale()).maybeSingle()
    setPointagePersonnel(data || null)
  }

  const pointerPersonnel = async (type) => {
    if (!user?.id || pointageEnCours) return
    if (type === 'arrivee' && pointagePersonnel?.heure_arrivee) return
    if (type === 'depart' && (!pointagePersonnel?.heure_arrivee || pointagePersonnel?.heure_depart)) return
    setPointageEnCours(true)
    const maintenant = new Date().toISOString()
    const heure = heureLocale()
    const patch = type === 'arrivee'
      ? { heure_arrivee: heure, arrivee_reelle: maintenant }
      : { heure_depart: heure }
    const { data, error } = await supabase.from('performances').upsert({
      prof_id: user.id,
      date_jour: dateLocale(),
      ...patch,
      saisi_par: user.id,
      saisi_le: maintenant
    }, { onConflict: 'prof_id,date_jour' }).select().single()
    if (error) alert(`Impossible d'enregistrer le pointage : ${error.message}`)
    else setPointagePersonnel(data)
    setPointageEnCours(false)
  }

  const generateCartography = (eleve, toGroup = false) => {
    try {
      const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const pres = presences[eleve.id]
      const disc = (disciplines || []).filter(d => d.eleve_id === eleve.id)
      const studentCps = (checkpoints || []).filter(cp => cp.planification?.classe_id === eleve.classe_id)
      const classDevs = (devoirs || []).filter(d => d.classe_id === eleve.classe_id)
      
      let msg = `*BILAN QUOTIDIEN - ÉCOLE IDEAL*\n`
      msg += `Date : *${today}*\n`
      msg += `Élève : *${eleve.prenom} ${eleve.nom}*\n`
      msg += `--------------------------\n`

      // 1. SECTION ASSIDUITÉ (Toujours obligatoire)
      msg += `\n[ ASSIDUITÉ ] : `
      if (!pres) msg += `Non renseigné\n`
      else if (pres.statut === 'present') msg += `PRESENT(E)\n`
      else if (pres.statut === 'absent') msg += `ABSENT(E)${pres.justification ? ` (Justifié: ${pres.justification})` : ' (Non justifié)'}\n`
      else msg += `ARRIVÉE TARDIVE (${pres.minutes_retard} min)\n`
      
      // 2. SECTION PÉDAGOGIQUE (Conditionnelle)
      const hasPedaResults = studentCps.some(cp => cp.progressions?.some(p => p.eleve_id === eleve.id))
      const hasHomework = classDevs.length > 0
      if (hasPedaResults || hasHomework) {
        msg += `\n- - - - - - - - - - - -\n`
        msg += `*SITUATION PÉDAGOGIQUE*\n\n`
        
        if (hasPedaResults) {
          studentCps.forEach(cp => {
            const prog = cp.progressions?.find(p => p.eleve_id === eleve.id)
            if (prog && prog.pourcentage !== undefined) {
              msg += `- ${prog.objectifs?.nom || 'Leçon'} : *${prog.pourcentage}%*\n`
            }
          })
        } else if (hasHomework) {
          msg += `- Voir travail à la maison ci-dessous\n`
        }

        if (hasHomework) {
          msg += `\n[ TRAVAIL À LA MAISON ] :\n`
          classDevs.forEach(d => {
            msg += `> ${d.matiere || 'Devoir'} : ${d.description || 'RAS'}\n`
            msg += `A rendre pour le : ${d.date_rendu ? new Date(d.date_rendu).toLocaleDateString('fr-FR') : '—'}\n`
          })
        }
      }
      
      // 3. SECTION DISCIPLINE (Conditionnelle)
      if (disc.length > 0) {
        msg += `\n- - - - - - - - - - - -\n`
        msg += `*DISCIPLINE*\n`
        disc.forEach(d => {
          msg += `- ${d.motif || 'Incident'} (-${d.points_perdus || 0} pts)\n`
        })
        msg += `Capital restant : *${eleve.points_discipline || 100}/100*\n`
      }
      
      msg += `\n--------------------------\n`
      msg += `À demain pour de nouveaux progrès !\n_Administration IDEAL_`
      
      if (toGroup) {
        // Envoi vers un groupe (ou choix libre du destinataire)
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
      } else {
        // Envoi direct au parent
        let phone = eleve.parent_phone?.replace(/[^\d+]/g, '') || ''
        if (phone.length === 8 && !phone.startsWith('+')) phone = '223' + phone
        if (phone.startsWith('00')) phone = phone.substring(2)
        if (!phone.startsWith('+')) phone = '+' + phone

        if (phone.length < 5) {
          alert("Numéro de téléphone invalide ou manquant pour cet élève.")
          return
        }

        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error(err)
      alert("Erreur lors de la génération du message. Vérifiez les informations de l'élève.")
    }
  }

  const hasDailyInfo = (el) => {
    // Info si : Absence/Retard OU Discipline OU Note
    const p = presences[el.id]
    if (p && p.statut !== 'present') return true
    if (disciplines.some(d => d.eleve_id === el.id)) return true
    if (checkpoints.some(cp => cp.progressions?.some(pr => pr.eleve_id === el.id))) return true
    return false
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">Conseiller Vie Scolaire</div>
          </div>
        </div>
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationCenter user={user} role="conseiller" onNavigateTab={setTab} />
          <span className="role-badge" style={{background:'var(--accent)', color:'#fff'}}>CVS</span>
          <button className="btn-logout" onClick={onLogout} style={{marginLeft:10}}>Déconnexion</button>
        </div>
      </div>

      <div className="bottom-nav">
        <button className={`nav-item ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')} aria-label="Tableau de bord">
          <div className="nav-icon" aria-hidden="true">📊</div>
          <span>Stats</span>
        </button>
        <button className={`nav-item ${tab==='inscriptions'?'active':''}`} onClick={()=>setTab('inscriptions')} aria-label="Liste des élèves">
          <div className="nav-icon" aria-hidden="true">🎒</div>
          <span>Élèves</span>
        </button>
        <button className={`nav-item ${tab==='pointage'?'active':''}`} onClick={()=>setTab('pointage')} aria-label="Pointage des présences">
          <div className="nav-icon" aria-hidden="true">⏰</div>
          <span>Pointage</span>
        </button>
        <button className={`nav-item ${tab==='agenda'?'active':''}`} onClick={()=>setTab('agenda')} aria-label="Agenda et anniversaires">
          <div className="nav-icon" aria-hidden="true">📅</div>
          <span>Agenda</span>
        </button>
        <button className={`nav-item ${tab==='rapports'?'active':''}`} onClick={()=>setTab('rapports')} aria-label="Rapports hebdomadaires">
          <div className="nav-icon" aria-hidden="true">📄</div>
          <span>Rapports</span>
        </button>
        <button className={`nav-item ${tab==='retards'?'active':''}`} onClick={()=>setTab('retards')} aria-label="Bilan des retards trimestriels">
          <div className="nav-icon" aria-hidden="true">📊</div>
          <span>Retards</span>
        </button>
      </div>

      <div className="page-content ux-page" style={{paddingBottom:100}}>
        {/* Le registre de présence est la source officielle de l'école
            (V2.1 §7). Un registre vide parce que la lecture a échoué doit se
            distinguer d'une journée sans incident. */}
        {loading && (
          <div style={{ background:'#f1f5f9', border:'1px solid #cbd5e1', borderRadius:10,
                        padding:'10px 16px', marginBottom:12, fontSize:13, color:'#475569' }}>
            Chargement du registre…
          </div>
        )}
        {!loading && erreur && (
          <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderLeft:'5px solid #dc2626',
                        borderRadius:10, padding:'14px 18px', marginBottom:12 }}>
            <div style={{ fontWeight:900, color:'#991b1b', fontSize:13.5 }}>
              ⛔ Registre incomplet{blocsEnEchec.length ? ` — ${blocsEnEchec.join(', ')}` : ''}
            </div>
            <div style={{ fontSize:12.5, color:'#7f1d1d', marginTop:4 }}>{erreur}</div>
            <div style={{ fontSize:12, color:'#7f1d1d', marginTop:5 }}>
              Ce qui s'affiche n'est pas la situation du jour. Ne clôturez pas l'appel sur cette base.
            </div>
            <button className="btn-sm" style={{ marginTop:9 }} onClick={loadData}>Réessayer</button>
          </div>
        )}
        {tab === 'dashboard' && (
          <>
            <div className="section-head"><div className="section-title">Tableau de Bord</div></div>
            {(() => {
              const proch = eleves
                .map(e => ({ e, j: joursAvantAnniv(e.date_naissance) }))
                .filter(x => x.j !== null && x.j <= 5)
                .sort((a, b) => a.j - b.j)
              if (!proch.length) return null
              return (
                <div style={{background:'linear-gradient(135deg,#EC008C,#b8005f)', color:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:16}}>
                  <div style={{fontWeight:800, fontSize:14, marginBottom:6}}>🎂 Anniversaires à venir (5 jours)</div>
                  {proch.map(({e, j}) => (
                    <div key={e.id} style={{fontSize:12, opacity:.95, marginTop:3}}>
                      {e.prenom} {e.nom} — {j === 0 ? "aujourd'hui 🎉" : j === 1 ? 'demain' : `dans ${j} jours`}
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20}}>
              <div className="kpi-card kpi-accent">
                <div className="kpi-value">{eleves.length}</div>
                <div className="kpi-label">Élèves inscrits</div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='present').length}</div>
                <div className="kpi-label">Présents ce matin</div>
              </div>
              <div className="kpi-card kpi-amber">
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='retard').length}</div>
                <div className="kpi-label">En retard</div>
              </div>
              <div className="kpi-card kpi-pink">
                <div className="kpi-value">{Object.values(presences).filter(p=>p.statut==='absent').length}</div>
                <div className="kpi-label">Absents</div>
              </div>
            </div>
          </>
        )}

        {tab === 'inscriptions' && (
          <>
            {/* Les inscriptions relèvent du responsable administratif seul.
                Le conseiller consulte les élèves — il en a besoin pour le
                pointage et les rapports — mais ne les crée ni ne les modifie. */}
            <div className="section-head">
              <div className="section-title">Les élèves</div>
            </div>
            <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px', marginBottom:10, fontSize:12, color:'var(--muted)'}}>
              Liste consultable. Les inscriptions et les dossiers élèves sont tenus par le responsable administratif.
            </div>
            {classes.map(cls => (
              <div key={cls.id} className="card" style={{marginBottom:10}}>
                <div className="card-header">{cls.nom}</div>
                <div className="card-body">
                  {eleves.filter(e => e.classe_id === cls.id).map(el => (
                    <div key={el.id} className="user-row">
                      <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700, fontSize:13}}>{el.prenom} {el.nom}</div>
                        <div style={{fontSize:10, color:'var(--muted)'}}>{el.parent_phone}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'pointage' && (
          <>
            <div className="section-head">
              <div className="section-title">Mon pointage du jour</div>
            </div>
            <div className="card" style={{padding:20, textAlign:'center', maxWidth:560, margin:'0 auto'}}>
              <div style={{fontSize:13, color:'var(--muted)', marginBottom:18}}>
                {new Date().toLocaleDateString('fr-FR', {timeZone:'Africa/Bamako', weekday:'long', day:'numeric', month:'long', year:'numeric'})}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12}}>
                <button
                  className="btn-primary"
                  disabled={pointageEnCours || Boolean(pointagePersonnel?.heure_arrivee)}
                  onClick={() => pointerPersonnel('arrivee')}
                  style={{minHeight:74, background:'#22a447', opacity:pointagePersonnel?.heure_arrivee ? .7 : 1}}
                >
                  <span style={{display:'block', fontSize:18, fontWeight:900}}>✓ ARRIVÉE</span>
                  <span style={{display:'block', marginTop:5, fontSize:13}}>
                    {pointagePersonnel?.heure_arrivee ? `Heure enregistrée : ${pointagePersonnel.heure_arrivee.slice(0, 5)}` : 'Pointer maintenant'}
                  </span>
                </button>
                <button
                  className="btn-primary"
                  disabled={pointageEnCours || !pointagePersonnel?.heure_arrivee || Boolean(pointagePersonnel?.heure_depart)}
                  onClick={() => pointerPersonnel('depart')}
                  style={{minHeight:74, background:'#f59e0b', color:'#fff', opacity:(!pointagePersonnel?.heure_arrivee || pointagePersonnel?.heure_depart) ? .7 : 1}}
                >
                  <span style={{display:'block', fontSize:18, fontWeight:900}}>↗ DÉPART</span>
                  <span style={{display:'block', marginTop:5, fontSize:13}}>
                    {pointagePersonnel?.heure_depart ? `Heure enregistrée : ${pointagePersonnel.heure_depart.slice(0, 5)}` : 'Pointer maintenant'}
                  </span>
                </button>
              </div>
              <div style={{fontSize:12, color:'var(--muted)', marginTop:16, lineHeight:1.5}}>
                L’heure de Bamako est enregistrée automatiquement. Le départ devient disponible après le pointage d’arrivée.
              </div>
            </div>
          </>
        )}

        {tab === 'agenda' && (
          <AgendaCalendrier checkpoints={checkpoints} anniversaires={eleves} />
        )}

        {tab === 'rapports' && (
          <>
            <div className="section-head"><div className="section-title">Rapports hebdomadaires</div></div>
            <a href="/rapports.html" style={{textDecoration:'none'}}>
              <div style={{background:'linear-gradient(135deg,#F7941D,#d97706)', color:'#fff', borderRadius:16, padding:'18px 18px', marginBottom:16}}>
                <div style={{fontSize:26}}>📄</div>
                <div style={{fontWeight:800, fontSize:16, marginTop:6}}>Composer les rapports</div>
                <div style={{fontSize:12, opacity:.9, marginTop:2}}>Bulletin hebdomadaire de chaque élève, transmis via IDEAL — le même outil que la direction.</div>
              </div>
            </a>

            <div className="section-head"><div className="section-title">Regard sur les élèves</div>
              <select className="form-input" style={{width:'auto'}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            {eleves.filter(e => e.classe_id === selectedClass).map(el => {
              const p = presences[el.id] || {}
              const jr = joursAvantAnniv(el.date_naissance)
              const nbDisc = disciplines.filter(d => d.eleve_id === el.id).length
              return (
                <div key={el.id} className="card" style={{marginBottom:8, padding:12}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div className="avatar av-blue">{(el.prenom[0]||'')+(el.nom[0]||'')}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800, fontSize:14}}>{el.prenom} {el.nom}</div>
                      <div style={{fontSize:11, color:'var(--muted)'}}>{classes.find(c=>c.id===el.classe_id)?.nom} · {el.parent_phone||'—'}</div>
                    </div>
                    {el.date_naissance && <span style={{fontSize:10, fontWeight:700, color:'#EC008C'}}>🎂 {jr===0?"aujourd'hui":`J-${jr}`}</span>}
                  </div>
                  <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
                    <span className={`chip ${p.statut==='absent'?'chip-red':(p.retard_matin>0||p.retard_soir>0)?'chip-amber':p.heure_arrivee?'chip-green':''}`} style={{fontSize:10}}>
                      {p.statut==='absent'?'Absent':(p.minutes_retard>0)?`Retard ${p.minutes_retard}'`:p.heure_arrivee?'Présent':'Non pointé'}
                    </span>
                    {nbDisc>0 && <span className="chip chip-amber" style={{fontSize:10}}>{nbDisc} incident(s)</span>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'retards' && (
          <div className="printable-bilan" style={{fontFamily: "'Inter', sans-serif"}}>
            <div className="section-head no-print">
              <div className="section-title" style={{fontWeight:900}}>Bilan Retards</div>
            </div>
            
            <div className="no-print" style={{display:'flex', gap:8, marginBottom:20}}>
              <select className="form-input" style={{flex:1}} value={selectedTrimester} onChange={e=>setSelectedTrimester(e.target.value)}>
                {Object.entries(TRIMESTRES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select className="form-input" style={{flex:1}} value={selectedClass||''} onChange={e=>setSelectedClass(e.target.value)}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            <div className="no-print" style={{marginBottom:25}}>
              <button className="btn btn-primary" onClick={() => window.print()} style={{width:'100%', background:'linear-gradient(135deg, #1AAFE0, #0d2a3b)'}}>
                🖨️ Imprimer le rapport
              </button>
            </div>

            <div className="print-header" style={{textAlign:'center', marginBottom:40}}>
              <h2 style={{fontSize:28, fontWeight:900, letterSpacing:'-1px', margin:0}}>ÉCOLE INTERNATIONALE BILINGUE IDEAL</h2>
              <div style={{fontSize:12, textTransform:'uppercase', letterSpacing:2, color:'var(--muted)', marginTop:5, marginBottom:15}}>Rapport d'Assiduité Trimestriel</div>
              <p style={{margin:0, fontSize:15}}>Classe : <strong>{classes.find(c=>c.id===selectedClass)?.nom}</strong> | Période : <strong>{TRIMESTRES[selectedTrimester].label}</strong></p>
            </div>

            {/* Un registre non tenu ne se lit pas comme un registre exemplaire.
                V2.1 §7 : le registre de présence est la source officielle ; tant
                qu'il n'est pas alimenté, aucun chiffre d'assiduité ne signifie
                quoi que ce soit. Le dire ici vaut mieux que d'aligner des
                pastilles vertes sur une mesure qui n'a pas eu lieu. */}
            {couverture === 0 && (
              <div style={{
                background:'#fffbeb', border:'1px solid #fde68a', borderRadius:14,
                padding:'14px 16px', marginBottom:14, fontSize:13, color:'#92400e',
              }} role="status">
                <strong>Registre non tenu sur cette période.</strong> Aucune présence n'a
                été enregistrée pour cette classe entre le {TRIMESTRES[selectedTrimester].start.split('-').reverse().join('/')} et
                le {TRIMESTRES[selectedTrimester].end.split('-').reverse().join('/')}. Les
                totaux ci-dessous valent zéro faute de saisie, non faute de retard :
                ils ne peuvent pas servir de bilan d'assiduité.
              </div>
            )}

            <div className="card" style={{padding:0, overflow:'hidden', borderRadius:16, border:'1px solid var(--border)'}}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{width:50}}>#</th>
                    <th>Élève</th>
                    <th style={{textAlign:'right'}}>Situation</th>
                  </tr>
                </thead>
                <tbody>
                  {retardStats.length === 0 ? (
                    <tr><td colSpan="3" style={{textAlign:'center', padding:40, color:'var(--muted)'}}>
                      {couverture === 0
                        ? "Registre non tenu : aucune présence enregistrée sur la période."
                        : 'Aucun retard enregistré. ✅'}
                    </td></tr>
                  ) : (
                    retardStats.map((s, idx) => {
                      let bClass = 'badge-green'
                      if (s.total > 120) bClass = 'badge-red'
                      else if (s.total > 60) bClass = 'badge-orange'
                      else if (s.total > 0) bClass = 'badge-amber'

                      return (
                        <tr key={idx}>
                          <td style={{fontWeight:700, color:'var(--muted)'}}>{idx + 1}</td>
                          <td style={{fontWeight:700}}>{s.name}</td>
                          <td style={{textAlign:'right'}}>
                            {/* Sans registre, pas de pastille verte : la couleur
                                dirait « vérifié, rien à signaler » là où rien
                                n'a été vérifié. */}
                            {couverture === 0
                              ? <span style={{fontSize:12, color:'var(--muted)', fontStyle:'italic'}}>non renseigné</span>
                              : <span className={`badge ${bClass}`}>{s.total} min</span>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="print-footer" style={{marginTop:50, display:'flex', justifyContent:'flex-end'}}>
              <div style={{textAlign:'center', width:250}}>
                <p style={{fontWeight:700, marginBottom:60}}>Le Conseiller Vie Scolaire</p>
                <div style={{borderBottom:'1px solid #000', width:'100%'}}></div>
                <p style={{fontSize:10, color:'#666', marginTop:10}}>Fait à Bamako, le {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* La modale d'ajout/modification d'eleve a ete retiree : les
          inscriptions et les dossiers releveent du responsable administratif. */}
    </div>
  )
}

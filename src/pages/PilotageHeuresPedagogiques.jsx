import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const langueMatiere = matiere => /english|mathematics|science|handwriting|arts|pe/i.test(String(matiere || '')) ? 'en' : 'fr'
const n = valeur => Math.max(0, Number(valeur) || 0)

export default function PilotageHeuresPedagogiques({ classes = [] }) {
  const [lignes, setLignes] = useState([])
  const [message, setMessage] = useState('')
  const [chargement, setChargement] = useState(true)

  useEffect(() => { (async () => {
    const [{ data: grille }, { data: config, error }] = await Promise.all([
      supabase.from('emploi_du_temps').select('groupe,matiere'),
      supabase.rpc('lire_pilotage_heures_pedagogiques'),
    ])
    if (error) { setMessage('Le pilotage horaire doit être installé avec son script SQL.'); setChargement(false); return }
    const existantes = Array.isArray(config) ? config : []
    const parCle = new Map(existantes.map(x => [`${x.classe_id}|${x.matiere}|${x.langue}`, x]))
    const groupes = new Map()
    ;(grille || []).forEach(x => {
      const cle = `${x.groupe}|${x.matiere}`
      groupes.set(cle, (groupes.get(cle) || 0) + .5)
    })
    const base = []
    classes.forEach(classe => {
      const groupe = /^(CE1|CE2)$/.test(classe.nom) ? 'CE1-CE2' : /^(CM1|CM2)$/.test(classe.nom) ? 'CM1-CM2' : classe.nom
      for (const [cle, heures] of groupes) {
        const [groupeGrille, matiere] = cle.split('|')
        if (groupeGrille !== groupe) continue
        const langue = langueMatiere(matiere), trouve = parCle.get(`${classe.id}|${matiere}|${langue}`)
        base.push(trouve || { classe_id:classe.id, classe_nom:classe.nom, matiere, langue, heures_hebdo:heures, semaines_t1:12, semaines_t2:12, semaines_t3:12 })
      }
      if (/^(PS|GS|Petite Section|Grande Section)$/i.test(classe.nom)) {
        ;[['Programme maternelle — Français','fr'],['Kindergarten curriculum — English','en']].forEach(([matiere,langue]) => {
          const trouve = parCle.get(`${classe.id}|${matiere}|${langue}`)
          base.push(trouve || { classe_id:classe.id, classe_nom:classe.nom, matiere, langue, heures_hebdo:15, semaines_t1:12, semaines_t2:12, semaines_t3:12 })
        })
      }
    })
    setLignes(base.sort((a,b) => `${a.classe_nom}${a.langue}${a.matiere}`.localeCompare(`${b.classe_nom}${b.langue}${b.matiere}`,'fr')))
    setChargement(false)
  })() }, [classes])

  const totaux = useMemo(() => lignes.reduce((a,l) => {
    a[l.langue] += n(l.heures_hebdo); a.total += n(l.heures_hebdo); return a
  }, { fr:0, en:0, total:0 }), [lignes])
  const modifier = (index, champ, valeur) => setLignes(l => l.map((x,i) => i === index ? { ...x, [champ]:n(valeur) } : x))
  const sauver = async () => {
    setMessage('Enregistrement…')
    const { error } = await supabase.rpc('sauver_pilotage_heures_pedagogiques', { p_lignes:lignes.map(({classe_id,matiere,langue,heures_hebdo,semaines_t1,semaines_t2,semaines_t3}) => ({classe_id,matiere,langue,heures_hebdo,semaines_t1,semaines_t2,semaines_t3})) })
    setMessage(error ? `Enregistrement impossible : ${error.message}` : 'Volumes horaires enregistrés. Les bulletins sont maintenant alimentés automatiquement.')
  }
  if (chargement) return <div className="empty-state">Chargement du pilotage horaire…</div>
  return <section className="card" style={{padding:16,marginBottom:20}}>
    <h2 style={{margin:'0 0 4px'}}>⏱️ Pilotage des volumes horaires</h2>
    <p style={{fontSize:12,color:'var(--muted)',margin:'0 0 12px'}}>La Direction fixe les heures hebdomadaires et le nombre de semaines. Les volumes trimestriels et annuels sont calculés automatiquement.</p>
    {message && <div role="status" style={{padding:9,borderRadius:9,background:'#f0f9ff',fontSize:12,marginBottom:10}}>{message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
      <b>Français : {totaux.fr} h/sem.</b><b>Anglais : {totaux.en} h/sem.</b><b>Total : {totaux.total} h/sem.</b>
    </div>
    <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}><table style={{width:'100%',minWidth:760,borderCollapse:'collapse',fontSize:12}}>
      <thead><tr>{['Classe','Matière','Langue','h/semaine','Sem. T1','Sem. T2','Sem. T3','Total annuel'].map(x=><th key={x} style={{padding:8,textAlign:'left',borderBottom:'1px solid var(--border)'}}>{x}</th>)}</tr></thead>
      <tbody>{lignes.map((l,i)=><tr key={`${l.classe_id}-${l.matiere}-${l.langue}`}>
        <td style={{padding:7}}><b>{l.classe_nom}</b></td><td>{l.matiere}</td><td>{l.langue.toUpperCase()}</td>
        {['heures_hebdo','semaines_t1','semaines_t2','semaines_t3'].map(c=><td key={c}><input type="number" min="0" step={c==='heures_hebdo'?'.5':'1'} value={l[c]} onChange={e=>modifier(i,c,e.target.value)} style={{width:70,padding:7,border:'1px solid var(--border)',borderRadius:7}}/></td>)}
        <td><b>{n(l.heures_hebdo)*(n(l.semaines_t1)+n(l.semaines_t2)+n(l.semaines_t3))} h</b></td>
      </tr>)}</tbody>
    </table></div>
    <button className="btn btn-primary" onClick={sauver} style={{marginTop:12}}>Enregistrer les volumes horaires</button>
  </section>
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { genererFichesCahiers, paginerFiches } from '../lib/fichesCahiers'

const normaliser = valeur => String(valeur || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const nomEnseignant = user => [user?.prenom, user?.nom].filter(Boolean).join(' ')
const classeEquivalent = (nom, groupe) => {
  const n = normaliser(nom), g = normaliser(groupe)
  if (n === g || n.includes(g) || g.includes(n)) return true
  if (g === 'ps') return ['ps', 'petitesection', 'maternelle1'].includes(n)
  if (g === 'gs') return ['gs', 'grandesection', 'maternelle2'].includes(n)
  return false
}

function Fiche({ fiche }) {
  const maternelle = fiche.template === 'maternelle'
  return <article className={`fiche-cahier ${maternelle ? 'fiche-cahier--maternelle' : 'fiche-cahier--primaire'}`}>
    <header className="fiche-cahier__header">
      <div className="fiche-cahier__marque">IDEAL · École Internationale Bilingue</div>
      <h2>{maternelle ? `🌈 LA JOURNÉE D’APPRENTISSAGE DE ${fiche.prenom.toUpperCase()}` : `FICHE D’APPRENTISSAGE DE ${fiche.prenom.toUpperCase()}`}</h2>
      <div className="fiche-cahier__meta">{fiche.date} · {fiche.classe} · {fiche.matiere}</div>
    </header>
    <section><h3>{fiche.absent ? 'Apprentissages de la journée' : maternelle ? `${fiche.prenom} a découvert` : fiche.introduction}</h3>{fiche.absent && <p>{fiche.introduction}</p>}{fiche.objectif && <p>{fiche.objectif}</p>}</section>
    {!fiche.absent && fiche.activites.length > 0 && <section><h3>{maternelle ? 'Nous avons fait' : 'Ce que nous avons travaillé'}</h3><ul>{fiche.activites.map((a,i)=><li key={i}>{a}</li>)}</ul></section>}
    {fiche.progression && <section><h3>Repère dans le programme</h3><p>{fiche.progression}</p></section>}
    {fiche.trace && <section><h3>{maternelle ? 'À refaire à la maison' : 'À revoir à la maison'}</h3><p>{fiche.trace}</p></section>}
    {fiche.observation && <section className="fiche-cahier__observation"><h3>Pour {fiche.prenom}</h3><p>{fiche.observation}</p></section>}
    {fiche.note && <section><h3>Note de l’enseignant</h3><p>{fiche.note}</p></section>}
    <footer>{fiche.enseignant ? `Enseignant : ${fiche.enseignant}` : 'Équipe pédagogique IDEAL'}</footer>
  </article>
}

export default function FichesCahiers({ preparation, creneau, user, onFerme }) {
  const [classe, setClasse] = useState(null)
  const [eleves, setEleves] = useState([])
  const [selection, setSelection] = useState([])
  const [observations, setObservations] = useState({})
  const [presences, setPresences] = useState({})
  const [note, setNote] = useState('')
  const [etat, setEtat] = useState('chargement')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let annule = false
    ;(async () => {
      setEtat('chargement'); setErreur('')
      const { data: classes, error: erreurClasses } = await supabase.from('classes').select('id,nom').order('ordre')
      if (annule) return
      if (erreurClasses) { setErreur('Impossible de lire la classe.'); setEtat('erreur'); return }
      const cible = (classes || []).find(c => String(c.id) === String(creneau?.classe_id))
        || (classes || []).find(c => classeEquivalent(c.nom, creneau?.groupe))
      if (!cible) { setErreur(`Classe introuvable pour « ${creneau?.groupe || 'séance'} ».`); setEtat('erreur'); return }
      setClasse(cible)
      const resEleves = await supabase.from('eleves').select('id,prenom,nom,classe_id,actif').eq('classe_id', cible.id).eq('actif', true).order('nom')
      if (annule) return
      if (resEleves.error) { setErreur('Impossible de charger les élèves actifs de cette classe.'); setEtat('erreur'); return }
      const liste = Array.isArray(resEleves.data) ? resEleves.data : []
      const ids = liste.map(e => e.id)
      const [resPresences, resComprehensions] = ids.length ? await Promise.all([
        supabase.from('presences_eleves').select('eleve_id,statut').eq('date_jour', preparation.date_cours).in('eleve_id', ids),
        supabase.from('comprehensions').select('eleve_id,observation').eq('classe_id', cible.id).eq('date_cours', preparation.date_cours).eq('matiere', preparation.matiere).in('eleve_id', ids),
      ]) : [{ data: [] }, { data: [] }]
      if (annule) return
      setEleves(liste); setSelection(liste.map(e => e.id))
      setPresences(Object.fromEntries((resPresences.data || []).map(p => [p.eleve_id, p])))
      setObservations(Object.fromEntries((resComprehensions.data || []).filter(o => o.observation).map(o => [o.eleve_id, o.observation])))
      setEtat('ok')
    })()
    return () => { annule = true }
  }, [creneau?.classe_id, creneau?.groupe, preparation.date_cours, preparation.matiere])

  const fiches = useMemo(() => genererFichesCahiers({
    preparation,
    eleves: eleves.filter(e => selection.includes(e.id)),
    classeNom: classe?.nom || creneau?.groupe,
    enseignant: nomEnseignant(user), observations, presences, note,
  }), [preparation, eleves, selection, classe, creneau?.groupe, user, observations, presences, note])
  const pages = useMemo(() => paginerFiches(fiches, 2), [fiches])

  return <div className="fiches-cahiers-overlay">
    <style>{`
      .fiches-cahiers-overlay{position:fixed;inset:0;z-index:9500;background:#eef3f7;overflow:auto;padding:16px;color:#0d2a3b}
      .fiches-cahiers-outils{max-width:210mm;margin:0 auto 14px;background:#fff;border:1px solid #dbe4ea;border-radius:14px;padding:14px;display:grid;gap:10px}
      .fiches-cahiers-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.fiches-cahiers-actions button{min-height:40px}
      .fiches-cahiers-eleves{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;max-height:150px;overflow:auto}
      .fiches-cahiers-eleves label{display:flex;gap:7px;align-items:center;font-size:12px;font-weight:700}
      .fiche-cahier-page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto 14px;background:#fff;padding:8mm;box-sizing:border-box;display:grid;grid-template-rows:1fr 1fr;gap:6mm;box-shadow:0 4px 20px #0d2a3b22;page-break-after:always}
      .fiche-cahier{border:1px dashed #8ca1af;border-radius:10px;padding:7mm;box-sizing:border-box;overflow:hidden;break-inside:avoid;page-break-inside:avoid;display:flex;flex-direction:column}
      .fiche-cahier__header{border-bottom:3px solid #00a8e0;padding-bottom:7px}.fiche-cahier__marque{font-size:9px;font-weight:900;letter-spacing:.08em;color:#64748b}.fiche-cahier h2{font-size:18px;margin:5px 0}.fiche-cahier__meta{font-size:10px;color:#64748b}.fiche-cahier section{margin-top:8px}.fiche-cahier h3{font-size:11px;text-transform:uppercase;color:#087eaf;margin:0 0 3px}.fiche-cahier p,.fiche-cahier li{font-size:11px;line-height:1.35;margin:0}.fiche-cahier ul{margin:0;padding-left:18px}.fiche-cahier footer{margin-top:auto;padding-top:7px;font-size:9px;color:#64748b;border-top:1px solid #dbe4ea}
      .fiche-cahier--maternelle{border-color:#ffb67d}.fiche-cahier--maternelle .fiche-cahier__header{border-color:#ff914d}.fiche-cahier--maternelle h3{color:#c65d16}.fiche-cahier__observation{background:#f0fdf4;padding:6px;border-radius:7px}
      @media(max-width:600px){.fiches-cahiers-overlay{padding:8px;overflow-x:hidden}.fiches-cahiers-outils,.fiche-cahier-page,.fiche-cahier{min-width:0}.fiches-cahiers-actions>*{flex:1 1 140px}.fiche-cahier-page{min-height:0;padding:7px;gap:8px;display:block}.fiche-cahier{min-height:420px;margin-bottom:8px;padding:14px}.fiche-cahier h2{font-size:15px;overflow-wrap:anywhere}}
      @media print{body *{visibility:hidden!important}.fiches-cahiers-overlay,.fiches-cahiers-overlay *{visibility:visible!important}.fiches-cahiers-overlay{position:absolute;inset:0;padding:0;background:#fff;overflow:visible}.fiches-cahiers-outils{display:none!important}.fiche-cahier-page{width:210mm;height:297mm;min-height:297mm;margin:0;box-shadow:none;padding:8mm;page-break-after:always}.fiche-cahier{overflow:hidden}.fiche-cahier-page:last-child{page-break-after:auto}@page{size:A4 portrait;margin:0}}
    `}</style>
    <div className="fiches-cahiers-outils">
      <div><b>Fiches cahiers · {classe?.nom || creneau?.groupe}</b><div style={{fontSize:12,color:'#64748b'}}>{fiches.length} fiche(s) · {pages.length} page(s) A4 · 2 fiches par page</div></div>
      {etat === 'chargement' && <div>Chargement des élèves…</div>}
      {etat === 'erreur' && <div style={{color:'#b91c1c'}}>{erreur}</div>}
      {etat === 'ok' && <>
        <div className="fiches-cahiers-actions"><button className="btn-sm" onClick={()=>setSelection(selection.length===eleves.length?[]:eleves.map(e=>e.id))}>{selection.length===eleves.length?'Tout décocher':'Toute la classe'}</button><button className="btn btn-primary" disabled={!fiches.length} onClick={()=>window.print()}>🖨️ Imprimer / PDF</button><button className="btn-sm" onClick={onFerme}>Fermer</button></div>
        <div className="fiches-cahiers-eleves">{eleves.map(e=><label key={e.id}><input type="checkbox" checked={selection.includes(e.id)} onChange={()=>setSelection(s=>s.includes(e.id)?s.filter(id=>id!==e.id):[...s,e.id])}/>{e.prenom} {e.nom}</label>)}</div>
        <label style={{fontSize:12,fontWeight:700}}>Note commune facultative<textarea className="form-input" rows="2" value={note} onChange={e=>setNote(e.target.value)} placeholder="Courte indication utile aux parents — facultatif"/></label>
      </>}
    </div>
    {pages.map((page,i)=><div className="fiche-cahier-page" key={i}>{page.map(fiche=><Fiche key={fiche.id} fiche={fiche}/>)}</div>)}
  </div>
}

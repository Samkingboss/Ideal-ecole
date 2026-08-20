import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const telephoneWA = valeur => {
  let n = String(valeur || '').replace(/\D/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (n.length === 8) n = `223${n}`
  return n.length >= 10 ? n : ''
}

export default function InscriptionsValidation({ inscriptions = [], directeur, onValidated, inscriptionCiblee }) {
  const [selection, setSelection] = useState(null)
  const [responsable, setResponsable] = useState(null)
  const [signatureParentUrl, setSignatureParentUrl] = useState('')
  const [nomDirecteur, setNomDirecteur] = useState(`${directeur?.prenom || ''} ${directeur?.nom || ''}`.trim())
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState('')
  const canvasRef = useRef(null)
  const dessinRef = useRef(false)

  const enAttente = inscriptions.filter(i => i.statut !== 'validee')
  const validees = inscriptions.filter(i => i.statut === 'validee')

  useEffect(() => {
    if (!inscriptionCiblee) return
    const trouvee = inscriptions.find(i => String(i.id) === String(inscriptionCiblee))
    if (trouvee) setSelection(trouvee)
  }, [inscriptionCiblee, inscriptions])

  useEffect(() => {
    if (!selection?.responsable1_id) { setResponsable(null); return }
    supabase.from('responsables').select('*').eq('id', selection.responsable1_id).maybeSingle()
      .then(({ data }) => setResponsable(data || null))
  }, [selection])

  useEffect(() => {
    setSignatureParentUrl('')
    if (!selection?.signature_chemin) return
    supabase.storage.from('inscriptions').createSignedUrl(selection.signature_chemin, 900)
      .then(({ data }) => setSignatureParentUrl(data?.signedUrl || ''))
  }, [selection])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selection) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#17364d'
  }, [selection])

  const position = event => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const debut = event => {
    dessinRef.current = true
    canvasRef.current.setPointerCapture(event.pointerId)
    const p = position(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const tracer = event => {
    if (!dessinRef.current) return
    const p = position(event)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const fin = () => { dessinRef.current = false }
  const effacer = () => {
    const canvas = canvasRef.current
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    if (canvas) canvas.dataset.signed = ''
  }

  const ouvrirWhatsApp = (inscription, parent) => {
    const numero = telephoneWA(parent?.whatsapp || parent?.tel1)
    const texte = `Bonjour ${parent?.prenom || 'cher parent'},\n\nL'inscription de ${inscription.prenom} ${String(inscription.nom || '').toUpperCase()} à l'École Internationale Bilingue IDEAL est désormais validée par la Direction.\n\n📋 Matricule : ${inscription.matricule}\n🏫 Classe : ${String(inscription.classe_demandee || '').replace(/\s+Bilingue/gi, '')}\n📅 Année scolaire : ${inscription.annee_scolaire || '2026-2027'}\n\nBienvenue à IDEAL.\nÉcole Internationale Bilingue IDEAL — Bamako`
    window.open(numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texte)}` : `https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank')
  }

  const valider = async () => {
    const canvas = canvasRef.current
    if (!nomDirecteur.trim()) { setMessage('Le nom du directeur est obligatoire.'); return }
    if (!canvas || !canvas.dataset.signed) { setMessage('La signature du directeur est obligatoire.'); return }
    setEnCours(true); setMessage('')
    let chemin = ''
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      chemin = `signatures-direction/${selection.id}-${Date.now()}.png`
      const { error: uploadError } = await supabase.storage.from('inscriptions').upload(chemin, blob, { contentType: 'image/png' })
      if (uploadError) throw uploadError
      const { data, error } = await supabase.rpc('valider_inscription_direction', {
        p_inscription_id: selection.id,
        p_signature_chemin: chemin,
        p_directeur_nom: nomDirecteur.trim(),
      })
      if (error) throw error
      if (!data?.ok) throw new Error('La validation n’a pas été confirmée par la base.')
      ouvrirWhatsApp(selection, responsable)
      setSelection(null)
      await onValidated?.()
    } catch (error) {
      if (chemin) await supabase.storage.from('inscriptions').remove([chemin])
      setMessage(error.message?.includes('valider_inscription_direction')
        ? 'La migration SQL de validation doit être exécutée dans Supabase avant cette action.'
        : `Validation impossible : ${error.message}`)
    } finally { setEnCours(false) }
  }

  return <section>
    <div style={{background:'linear-gradient(120deg,#123d5a,#174e72)',color:'#fff',padding:20,borderRadius:16,display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',flexWrap:'wrap'}}>
      <div><div style={{fontSize:11,fontWeight:900,color:'#f5a15a',letterSpacing:1.2}}>VALIDATION DE LA DIRECTION</div><h2 style={{margin:'5px 0'}}>Dossiers d’inscription</h2><p style={{margin:0,fontSize:12,opacity:.8}}>Chaque dossier reste en attente jusqu’à la signature du directeur.</p></div>
      <div style={{display:'flex',gap:9}}><b style={{background:'rgba(255,255,255,.12)',padding:'10px 14px',borderRadius:10}}>{enAttente.length} en attente</b><b style={{background:'rgba(22,163,74,.25)',padding:'10px 14px',borderRadius:10}}>{validees.length} validés</b></div>
    </div>
    <div style={{display:'grid',gap:10,marginTop:14}}>{inscriptions.map(i => <article key={i.id} style={{background:'#fff',border:`1px solid ${i.statut === 'validee' ? '#b8dfca' : '#d9e3e9'}`,borderLeft:`5px solid ${i.statut === 'validee' ? '#16825d' : '#f28c28'}`,borderRadius:12,padding:'13px 15px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><b style={{color:'#17364d'}}>{i.prenom} {i.nom}</b><div style={{fontSize:11,color:'#71808b',marginTop:3}}>{i.matricule} · {String(i.classe_demandee || '').replace(/\s+Bilingue/gi, '')}</div></div><div style={{display:'flex',alignItems:'center',gap:9}}><span style={{fontSize:11,fontWeight:850,color:i.statut === 'validee' ? '#16825d' : '#b86613'}}>{i.statut === 'validee' ? '✓ Validée' : '⏳ En attente'}</span><button onClick={() => setSelection(i)} style={{border:0,borderRadius:8,padding:'8px 11px',background:'#174e72',color:'#fff',fontWeight:800,cursor:'pointer'}}>{i.statut === 'validee' ? 'Voir la fiche' : 'Examiner et signer'}</button></div></article>)}</div>
    {!inscriptions.length && <div style={{padding:30,textAlign:'center',color:'#71808b'}}>Aucun dossier d’inscription.</div>}
    {selection && <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setSelection(null)} style={{zIndex:999999}}><div className="modal" style={{maxWidth:720,maxHeight:'92vh',overflowY:'auto'}}><div className="modal-title">Dossier — {selection.prenom} {selection.nom}</div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,background:'#f3f6f8',padding:14,borderRadius:10,fontSize:13}}><div><b>Matricule</b><br/>{selection.matricule}</div><div><b>Classe demandée</b><br/>{selection.classe_demandee}</div><div><b>Date de naissance</b><br/>{selection.date_naissance}</div><div><b>Responsable</b><br/>{responsable ? `${responsable.prenom} ${responsable.nom}` : 'Chargement…'}</div><div><b>Signature parent</b><br/>{selection.signature_chemin ? '✓ Enregistrée' : '✗ Absente'}</div><div><b>Statut</b><br/>{selection.statut === 'validee' ? 'Validée' : 'En attente de la Direction'}</div></div><a href={`/fiche.html?matricule=${encodeURIComponent(selection.matricule)}`} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:12,color:'#174e72',fontWeight:850}}>Ouvrir la fiche complète ↗</a>{signatureParentUrl && <div style={{marginTop:12}}><div className="form-label">Signature du responsable légal</div><img src={signatureParentUrl} alt="Signature du responsable légal" style={{display:'block',width:'100%',maxWidth:360,height:95,objectFit:'contain',objectPosition:'left center',background:'#fff',border:'1px solid #dbe3e9',borderRadius:8}}/></div>}{selection.statut !== 'validee' && <><label className="form-label" style={{marginTop:15}}>Nom du directeur signataire</label><input className="form-input" value={nomDirecteur} onChange={e => setNomDirecteur(e.target.value)}/><label className="form-label" style={{marginTop:12}}>Signature manuscrite du directeur</label><canvas ref={canvasRef} onPointerDown={e=>{debut(e);e.currentTarget.dataset.signed='1'}} onPointerMove={tracer} onPointerUp={fin} onPointerCancel={fin} style={{display:'block',width:'100%',height:150,border:'2px solid #174e72',borderRadius:10,background:'#fff',touchAction:'none'}}/><button onClick={effacer} className="btn-sm" style={{marginTop:7}}>Effacer la signature</button>{message && <div style={{marginTop:10,color:'#b91c1c',fontWeight:700,fontSize:12}}>{message}</div>}<button className="btn btn-primary" disabled={enCours || !selection.signature_chemin} onClick={valider} style={{marginTop:15,width:'100%'}}>{enCours ? 'Validation…' : 'Signer, valider et informer le parent'}</button></>}<button className="btn-cancel" onClick={()=>setSelection(null)}>Fermer</button></div></div>}
  </section>
}

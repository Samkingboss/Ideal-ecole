import { useEffect, useRef, useState } from 'react'
import { etatDossier, libelleEtat, etatPiece, LIBELLE_CONTEXTE } from '../lib/dossierPieces'
import { supabase } from '../lib/supabase'
import { lienWhatsAppEcole, NOM_ECOLE } from '../lib/ecole'

const telephoneWA = valeur => {
  let n = String(valeur || '').replace(/\D/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (n.length === 8) n = `223${n}`
  return n.length >= 10 ? n : ''
}

export default function InscriptionsValidation({ inscriptions = [], directeur, onValidated, inscriptionCiblee }) {
  const [selection, setSelection] = useState(null)
  const [responsable, setResponsable] = useState(null)
  // Les pièces du dossier. `documents_inscription` n'avait AUCUN lecteur dans
  // tout le dépôt : les fichiers montaient, et plus personne ne savait ce qui
  // manquait à un dossier.
  const [pieces, setPieces] = useState([])
  const [piecesEtat, setPiecesEtat] = useState('inconnu')
  const [signatureParentUrl, setSignatureParentUrl] = useState('')
  const [nomDirecteur, setNomDirecteur] = useState(`${directeur?.prenom || ''} ${directeur?.nom || ''}`.trim())
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState('')
  const [edition, setEdition] = useState(null)
  const canvasRef = useRef(null)
  const dessinRef = useRef(false)

  const enAttente = inscriptions.filter(i => i.statut !== 'validee')
  const validees = inscriptions.filter(i => i.statut === 'validee')
  const estResponsableAdministratif = directeur?.role === 'responsable_administratif'

  useEffect(() => {
    if (!inscriptionCiblee) return
    const trouvee = inscriptions.find(i => String(i.id) === String(inscriptionCiblee))
    if (trouvee) setSelection(trouvee)
  }, [inscriptionCiblee, inscriptions])

  useEffect(() => {
    if (!selection?.id) { setPieces([]); setPiecesEtat('inconnu'); return }
    let vivant = true
    setPiecesEtat('chargement')
    supabase.from('documents_inscription')
      .select('id, type, nom_fichier, uploaded_at, chemin')
      .eq('inscription_id', selection.id)
      .then(({ data, error }) => {
        if (!vivant) return
        // Une lecture en échec n'est pas un dossier vide : un dossier complet
        // affiché comme incomplet enverrait le secrétariat réclamer des pièces
        // déjà remises.
        if (error) { setPiecesEtat('erreur'); setPieces([]); return }
        // On n'arrive ici que sans erreur : une liste vide signifie alors
        // réellement zéro pièce, et non une lecture qui a échoué.
        setPieces(Array.isArray(data) ? data : [])
        setPiecesEtat('charge')
      })
    return () => { vivant = false }
  }, [selection])

  useEffect(() => {
    if (!selection?.responsable1_id) { setResponsable(null); return }
    setResponsable(null)
    supabase.from('responsables').select('*').eq('id', selection.responsable1_id).maybeSingle()
      .then(({ data }) => setResponsable(data || null))
  }, [selection])

  useEffect(() => {
    if (!selection) { setEdition(null); return }
    setEdition({
      eleve: {
        nom: selection.nom || '', prenom: selection.prenom || '', sexe: selection.sexe || '',
        date_naissance: selection.date_naissance || '', lieu_naissance: selection.lieu_naissance || '',
        groupe_sanguin: selection.groupe_sanguin || '', nationalite: selection.nationalite || '',
        langue_maison: selection.langue_maison || '', ancienne_ecole: selection.ancienne_ecole || '',
        classe_precedente: selection.classe_precedente || '', classe_demandee: selection.classe_demandee || '',
        adresse: selection.adresse || '', cantine: !!selection.cantine,
        allergies: selection.allergies || '', restrictions: selection.restrictions || '',
        transport: !!selection.transport, droit_image: !!selection.droit_image,
      },
      responsable1: null,
    })
  }, [selection])

  useEffect(() => {
    if (!responsable || !selection) return
    setEdition(courant => courant ? ({ ...courant, responsable1: {
      nom: responsable.nom || '', prenom: responsable.prenom || '', lien_parente: responsable.lien_parente || '',
      tel1: responsable.tel1 || '', whatsapp: responsable.whatsapp || '', email: responsable.email || '',
      adresse: responsable.adresse || '', profession: responsable.profession || '',
      situation_matrimoniale: responsable.situation_matrimoniale || '',
    } }) : courant)
  }, [responsable, selection])

  const changerEdition = (bloc, champ, valeur) => setEdition(courant => ({
    ...courant, [bloc]: { ...(courant?.[bloc] || {}), [champ]: valeur },
  }))

  const enregistrerModification = async () => {
    if (!selection?.id || !edition?.responsable1) return
    setEnCours(true); setMessage('')
    const { data, error } = await supabase.rpc('modifier_inscription_administration', {
      p_inscription_id: selection.id,
      p_modifications: edition,
    })
    if (error || !data?.ok) {
      setMessage(`Modification impossible : ${error?.message || 'la base n’a pas confirmé la modification.'}`)
      setEnCours(false)
      return
    }
    setMessage('✓ Informations mises à jour dans le dossier et la fiche élève.')
    await onValidated?.()
    setSelection(courant => courant ? ({ ...courant, ...edition.eleve }) : courant)
    setResponsable(courant => courant ? ({ ...courant, ...edition.responsable1 }) : courant)
    setEnCours(false)
  }

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
    const texte = `Bonjour ${parent?.prenom || 'cher parent'},\n\nL'inscription de ${inscription.prenom} ${String(inscription.nom || '').toUpperCase()} à ${NOM_ECOLE} est désormais validée par la Direction.\n\n📋 Matricule : ${inscription.matricule}\n🏫 Classe : ${String(inscription.classe_demandee || '').replace(/\s+Bilingue/gi, '')}\n📅 Année scolaire : ${inscription.annee_scolaire || '2026-2027'}\n\nBienvenue à IDEAL.\n${NOM_ECOLE} — Bamako`
    window.open(lienWhatsAppEcole(numero, texte), '_blank')
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
      // Le retrait du fichier deposé exigerait un DELETE Storage que
      // personne n'a — et qu'on ne veut pas : un droit de suppression sur
      // tout le bucket pour rattraper une panne rare est un mauvais
      // échange. On laisse donc l'orphelin et on le NOMME, sinon il
      // devient introuvable.
      if (chemin) console.warn(`[IDEAL] signature déposée sans validation : inscriptions/${chemin}`)
      // Trois pannes distinctes, trois conduites différentes. « Validation
      // impossible : new row violates row-level security policy » est exact et
      // n'apprend rien à personne : le directeur ne peut pas savoir que c'est
      // sa session qui a expiré, ni quoi faire.
      const brut = String(error?.message || '')
      const sansSession = /row-level security|violates row|not authorized|JWT|401/i.test(brut)
      const sansFonction = /valider_inscription_direction|does not exist|PGRST202/i.test(brut)
      setMessage(
        sansFonction
          ? 'La migration SQL de validation doit être exécutée dans Supabase avant cette action.'
        : sansSession
          ? "Votre session n'autorise pas le dépôt de la signature. Reconnectez-vous, puis "
            + 'recommencez. Si le problème persiste, la signature de direction n\'est pas '
            + 'ouverte à votre compte : signalez-le.'
          : `Validation impossible : ${brut}`
      )
    } finally { setEnCours(false) }
  }

  return <section>
    <div style={{background:'linear-gradient(120deg,#123d5a,#174e72)',color:'#fff',padding:20,borderRadius:16,display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',flexWrap:'wrap'}}>
      <div><div style={{fontSize:11,fontWeight:900,color:'#f5a15a',letterSpacing:1.2}}>VALIDATION DE LA DIRECTION</div><h2 style={{margin:'5px 0'}}>Dossiers d’inscription</h2><p style={{margin:0,fontSize:12,opacity:.8}}>Chaque dossier reste en attente jusqu’à la signature du directeur.</p></div>
      <div style={{display:'flex',gap:9}}><b style={{background:'rgba(255,255,255,.12)',padding:'10px 14px',borderRadius:10}}>{enAttente.length} en attente</b><b style={{background:'rgba(22,163,74,.25)',padding:'10px 14px',borderRadius:10}}>{validees.length} validés</b></div>
    </div>
    <div style={{display:'grid',gap:10,marginTop:14}}>{inscriptions.map(i => <article id={`inscription-${i.id}`} key={i.id} style={{background:'#fff',border:`2px solid ${String(i.id) === String(inscriptionCiblee) ? '#00a8e0' : i.statut === 'validee' ? '#b8dfca' : '#d9e3e9'}`,borderLeft:`5px solid ${i.statut === 'validee' ? '#16825d' : '#f28c28'}`,borderRadius:12,padding:'13px 15px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',boxShadow:String(i.id) === String(inscriptionCiblee) ? '0 0 0 4px rgba(0,168,224,.16)' : 'none'}}><div><b style={{color:'#17364d'}}>{i.prenom} {i.nom}</b><div style={{fontSize:11,color:'#71808b',marginTop:3}}>{i.matricule} · {String(i.classe_demandee || '').replace(/\s+Bilingue/gi, '')}</div></div><div style={{display:'flex',alignItems:'center',gap:9}}><span style={{fontSize:11,fontWeight:850,color:i.statut === 'validee' ? '#16825d' : '#b86613'}}>{i.statut === 'validee' ? '✓ Validée' : '⏳ En attente'}</span><button onClick={() => setSelection(i)} style={{border:0,borderRadius:8,padding:'8px 11px',background:'#174e72',color:'#fff',fontWeight:800,cursor:'pointer'}}>{i.statut === 'validee' ? 'Voir la fiche' : 'Examiner et signer'}</button></div></article>)}</div>
    {!inscriptions.length && <div style={{padding:30,textAlign:'center',color:'#71808b'}}>Aucun dossier d’inscription.</div>}
    {selection && <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setSelection(null)} style={{zIndex:999999}}><div className="modal" style={{maxWidth:720,maxHeight:'92vh',overflowY:'auto'}}><div className="modal-title">Dossier — {selection.prenom} {selection.nom}</div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,background:'#f3f6f8',padding:14,borderRadius:10,fontSize:13}}><div><b>Matricule</b><br/>{selection.matricule}</div><div><b>Classe demandée</b><br/>{selection.classe_demandee}</div><div><b>Date de naissance</b><br/>{selection.date_naissance}</div><div><b>Responsable</b><br/>{responsable ? `${responsable.prenom} ${responsable.nom}` : 'Chargement…'}</div><div><b>Signature parent</b><br/>{selection.signature_chemin ? '✓ Enregistrée' : '✗ Absente'}</div><div><b>Statut</b><br/>{selection.statut === 'validee' ? 'Validée' : 'En attente de la Direction'}</div></div>{estResponsableAdministratif && edition && <details open style={{marginTop:12,border:'1px solid #bfdbfe',borderRadius:10,padding:12,background:'#eff6ff'}}><summary style={{cursor:'pointer',fontWeight:900,color:'#174e72'}}>✏️ Modifier les informations du dossier</summary><div style={{marginTop:10,fontSize:12,color:'#475569'}}>Le matricule, les signatures et le statut restent protégés. Pour une inscription déjà validée, la fiche élève est synchronisée automatiquement.</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:9,marginTop:10}}>{[
          ['nom','Nom'],['prenom','Prénom(s)'],['sexe','Sexe (M/F)'],['date_naissance','Date de naissance'],
          ['lieu_naissance','Lieu de naissance'],['groupe_sanguin','Groupe sanguin'],['nationalite','Nationalité'],
          ['langue_maison','Langue à la maison'],['ancienne_ecole','Ancienne école'],['classe_precedente','Classe précédente'],
          ['classe_demandee','Classe demandée'],['adresse','Adresse de l’élève'],['allergies','Allergies'],['restrictions','Restrictions'],
        ].map(([champ,label]) => <label key={champ} className="form-label">{label}<input className="form-input" type={champ === 'date_naissance' ? 'date' : 'text'} value={edition.eleve[champ]} onChange={e => changerEdition('eleve', champ, e.target.value)}/></label>)}</div><div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:10}}>{[['cantine','Cantine'],['transport','Transport'],['droit_image','Droit à l’image']].map(([champ,label]) => <label key={champ} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:800}}><input type="checkbox" checked={edition.eleve[champ]} onChange={e => changerEdition('eleve', champ, e.target.checked)}/>{label}</label>)}</div>{edition.responsable1 && <><div style={{fontWeight:900,color:'#174e72',marginTop:15}}>Responsable légal principal</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:9,marginTop:8}}>{[
          ['nom','Nom'],['prenom','Prénom(s)'],['lien_parente','Lien de parenté'],['tel1','Téléphone principal'],
          ['whatsapp','WhatsApp'],['email','Courriel'],['adresse','Adresse'],['profession','Profession'],['situation_matrimoniale','Situation matrimoniale'],
        ].map(([champ,label]) => <label key={champ} className="form-label">{label}<input className="form-input" type={champ === 'email' ? 'email' : 'text'} value={edition.responsable1[champ]} onChange={e => changerEdition('responsable1', champ, e.target.value)}/></label>)}</div></>}<button className="btn btn-primary" disabled={enCours || !edition.responsable1} onClick={enregistrerModification} style={{marginTop:14,width:'100%'}}>{enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>{message && <div style={{marginTop:10,color:message.startsWith('✓') ? '#166534' : '#b91c1c',fontWeight:700,fontSize:12}}>{message}</div>}</details>}{(() => {
          if (piecesEtat === 'chargement') return <div style={{marginTop:12,fontSize:13,color:'#64748b'}}>Lecture des pièces…</div>
          if (piecesEtat === 'erreur') return (
            <div style={{marginTop:12,padding:'10px 12px',borderRadius:10,background:'rgba(239,68,68,.08)',border:'1px solid #ef4444',fontSize:13}}>
              Les pièces du dossier n’ont pas pu être lues. <b>Ce dossier n’est pas nécessairement incomplet</b> — ne réclamez rien avant d’avoir rechargé.
            </div>)
          if (piecesEtat !== 'charge') return null
          const ep = etatDossier(pieces, selection)
          return (
            <div style={{marginTop:12,padding:'12px 14px',borderRadius:10,background: ep.complet ? 'rgba(46,158,79,.08)' : 'rgba(244,121,32,.08)',border: `1px solid ${ep.complet ? 'rgba(46,158,79,.45)' : 'rgba(244,121,32,.55)'}`}}>
              <div style={{fontWeight:900,fontSize:13,color: ep.complet ? '#166534' : '#9a3412'}}>{ep.complet ? '✓ ' : '⚠ '}{libelleEtat(ep)}</div>
              <div style={{fontSize:11.5,color:'#64748b',marginTop:2}}>{LIBELLE_CONTEXTE[ep.contexte]}</div>
              <div style={{marginTop:8,display:'grid',gap:4}}>
                {ep.detail.map(d => {
                  const e = etatPiece(d)
                  const signe = { fournie:'✓', manquante:'✗', a_confirmer:'?', sans_objet:'—' }[e]
                  const teinte = { fournie:'#166534', manquante:'#9a3412', a_confirmer:'#7c5800', sans_objet:'#94a3b8' }[e]
                  const suffixe = { a_confirmer:' — à confirmer', sans_objet:' — sans objet ici' }[e] || ''
                  return (
                    <div key={d.id} style={{fontSize:13,color:teinte}}>
                      {signe} {d.label}<span style={{color:'#94a3b8'}}>{suffixe}</span>
                    </div>
                  )
                })}
              </div>
              {ep.aConfirmer.length > 0 && (
                <div style={{marginTop:8,fontSize:12,color:'#7c5800'}}>
                  La scolarisation antérieure n’est pas renseignée sur ce dossier.
                  Ces pièces ne sont <b>pas comptées comme manquantes</b> — mais si
                  l’enfant vient d’un autre établissement, elles sont à réclamer.
                </div>
              )}
              {!ep.complet && <div style={{marginTop:8,fontSize:12,color:'#64748b'}}>Une pièce manquante <b>n’empêche ni l’inscription ni l’encaissement</b>. Elle peut être apportée plus tard.</div>}
            </div>)
        })()}{/* Le dossier complet se lit ICI, dans le portail, où la session existe.

          Il s'ouvrait auparavant dans `/fiche.html`, page publique et cible du
          QR imprimé sur la carte scolaire : le même lien qui servait à la
          direction livrait l'adresse du domicile et les coordonnées des
          parents à quiconque ramassait une carte. La page publique ne vérifie
          plus qu'une carte ; les données familiales restent derrière une
          session. */}
        <details style={{marginTop:12}}>
          <summary style={{cursor:'pointer',color:'#174e72',fontWeight:850}}>Dossier complet</summary>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,background:'#fff',border:'1px solid #dbe3e9',padding:14,borderRadius:10,fontSize:13,marginTop:8}}>
            <div><b>Lieu de naissance</b><br/>{selection.lieu_naissance || '—'}</div>
            <div><b>Sexe</b><br/>{selection.sexe === 'M' ? 'Garçon' : selection.sexe === 'F' ? 'Fille' : (selection.sexe || '—')}</div>
            <div><b>Nationalité</b><br/>{selection.nationalite || '—'}</div>
            <div><b>Langue à la maison</b><br/>{selection.langue_maison || '—'}</div>
            <div style={{gridColumn:'1 / -1'}}><b>Adresse</b><br/>{selection.adresse || '—'}</div>
            <div><b>Ancienne école</b><br/>{selection.ancienne_ecole || 'Première inscription'}</div>
            <div><b>Classe précédente</b><br/>{selection.classe_precedente || '—'}</div>
            <div><b>Cantine</b><br/>{selection.cantine ? 'Oui' : 'Non'}</div>
            <div><b>Droit à l’image</b><br/>{selection.droit_image ? 'Accordé' : 'Refusé'}</div>
            {(selection.allergies || selection.restrictions) && <div style={{gridColumn:'1 / -1'}}><b>Allergies et restrictions</b><br/>{[selection.allergies, selection.restrictions].filter(Boolean).join(' · ')}</div>}
            {responsable && <>
              <div style={{gridColumn:'1 / -1',borderTop:'1px solid #e2e8f0',paddingTop:8,fontWeight:850,color:'#174e72'}}>Responsable légal</div>
              <div><b>Lien de parenté</b><br/>{responsable.lien_parente || '—'}</div>
              <div><b>Profession</b><br/>{responsable.profession || '—'}</div>
              <div><b>Téléphone</b><br/>{responsable.tel1 || '—'}</div>
              <div><b>WhatsApp</b><br/>{responsable.whatsapp || '—'}</div>
              <div style={{gridColumn:'1 / -1'}}><b>Courriel</b><br/>{responsable.email || '—'}</div>
            </>}
          </div>
        </details>{signatureParentUrl && <div style={{marginTop:12}}><div className="form-label">Signature du responsable légal</div><img src={signatureParentUrl} alt="Signature du responsable légal" style={{display:'block',width:'100%',maxWidth:360,height:95,objectFit:'contain',objectPosition:'left center',background:'#fff',border:'1px solid #dbe3e9',borderRadius:8}}/></div>}{!estResponsableAdministratif && selection.statut !== 'validee' && <><label className="form-label" style={{marginTop:15}}>Nom du directeur signataire</label><input className="form-input" value={nomDirecteur} onChange={e => setNomDirecteur(e.target.value)}/><label className="form-label" style={{marginTop:12}}>Signature manuscrite du directeur</label><canvas ref={canvasRef} onPointerDown={e=>{debut(e);e.currentTarget.dataset.signed='1'}} onPointerMove={tracer} onPointerUp={fin} onPointerCancel={fin} style={{display:'block',width:'100%',height:150,border:'2px solid #174e72',borderRadius:10,background:'#fff',touchAction:'none'}}/><button onClick={effacer} className="btn-sm" style={{marginTop:7}}>Effacer la signature</button>{message && <div style={{marginTop:10,color:'#b91c1c',fontWeight:700,fontSize:12}}>{message}</div>}<button className="btn btn-primary" disabled={enCours || !selection.signature_chemin} onClick={valider} style={{marginTop:15,width:'100%'}}>{enCours ? 'Validation…' : 'Signer, valider et informer le parent'}</button></>}<button className="btn-cancel" onClick={()=>setSelection(null)}>Fermer</button></div></div>}
  </section>
}

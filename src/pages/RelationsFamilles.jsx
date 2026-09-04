import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { messageLisible } from '../lib/chargement'
import './RelationsFamilles.css'

const ANNEE_SCOLAIRE = '2026-2027'
const aujourdHui = () => new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Africa/Bamako', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const dateHeureLocale = valeur => valeur
  ? new Date(valeur).toLocaleString('fr-FR', { timeZone: 'Africa/Bamako', dateStyle: 'short', timeStyle: 'short' })
  : '—'
const datePourChamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Bamako' }).slice(0, 16)

const joursAvantAnniversaire = dateNaissance => {
  if (!dateNaissance) return null
  const maintenant = new Date(); maintenant.setHours(0, 0, 0, 0)
  const [, mois, jour] = dateNaissance.split('-').map(Number)
  let prochaine = new Date(maintenant.getFullYear(), mois - 1, jour)
  if (prochaine < maintenant) prochaine = new Date(maintenant.getFullYear() + 1, mois - 1, jour)
  return Math.round((prochaine - maintenant) / 86400000)
}

const STATUTS_PROSPECT = {
  nouveau: 'Nouveau', a_relancer: 'À relancer', rendez_vous: 'Rendez-vous',
  inscrit: 'Inscrit', sans_suite: 'Sans suite',
}
const RESULTATS_CONTACT = {
  joint: 'Parent joint', sans_reponse: 'Sans réponse', a_rappeler: 'À rappeler',
  message_envoye: 'Message envoyé', rendez_vous: 'Rendez-vous fixé',
}
const STATUTS_ANNIVERSAIRE = {
  a_contacter: 'À contacter', parent_contacte: 'Parent contacté', a_confirmer: 'À confirmer',
  confirme_ecole: 'Confirmé à l’école', non_celebre: 'Non célébré', annule: 'Annulé', celebre: 'Célébré',
}

const prospectVide = {
  id: null, nom_parent: '', telephone: '', nombre_enfants: 1, classe_ids: [],
  besoin: '', statut: 'nouveau', prochaine_relance: '', notes: '',
}
const relanceVide = {
  cible: 'prospect', cible_id: '', responsable_contacte: '', telephone: '',
  date_contact: datePourChamp(), motif: '', resultat: 'joint', resume: '',
  prochaine_action: '', date_suivi: '',
}
const visiteVide = {
  visiteur_nom: '', telephone: '', type_visite: 'retrait_eleve', eleve_id: '',
  personne_recherchee: '', motif: '', arrivee_at: datePourChamp(), notes: '',
}

const ouvrirWhatsApp = (telephone, message) => {
  let numero = String(telephone || '').replace(/[^\d+]/g, '')
  if (numero.startsWith('00')) numero = numero.slice(2)
  if (numero.length === 8) numero = `223${numero}`
  numero = numero.replace(/^\+/, '')
  if (numero.length < 8) return false
  window.open(`https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(message)}`, '_blank')
  return true
}

function EtatSource({ chargement, erreur, onRetry }) {
  if (chargement) return <div className="rf-source rf-source-loading">Chargement des relations familles…</div>
  if (!erreur) return null
  return <div className="rf-source rf-source-error" role="alert">
    <b>Données de suivi indisponibles</b><span>{erreur}</span>
    <button type="button" onClick={onRetry}>Réessayer</button>
  </div>
}

export default function RelationsFamilles({ section, setSection, eleves = [], classes = [], presences = {}, disciplines = [] }) {
  const [prospects, setProspects] = useState([])
  const [relances, setRelances] = useState([])
  const [visites, setVisites] = useState([])
  const [suivisAnniversaires, setSuivisAnniversaires] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [prospect, setProspect] = useState(prospectVide)
  const [relance, setRelance] = useState(relanceVide)
  const [visite, setVisite] = useState(visiteVide)
  const [recherche, setRecherche] = useState('')

  const charger = async () => {
    setChargement(true); setErreur('')
    const debut = new Date(); debut.setDate(debut.getDate() - 90)
    const fin = new Date(); fin.setDate(fin.getDate() + 1); fin.setHours(0, 0, 0, 0)
    const [p, r, v, a] = await Promise.all([
      supabase.rpc('lire_prospects_familles'),
      supabase.rpc('lire_relances_familles'),
      supabase.rpc('lire_visites_accueil', { p_debut: debut.toISOString(), p_fin: fin.toISOString() }),
      supabase.rpc('lire_suivis_anniversaires', { p_annee_scolaire: ANNEE_SCOLAIRE }),
    ])
    const premierEchec = [p, r, v, a].find(x => x.error)
    if (premierEchec) {
      const activation = premierEchec.error?.code === '42883'
      setErreur(activation
        ? 'L’espace attend l’activation de sa migration sécurisée.'
        : messageLisible(premierEchec.error))
    }
    setProspects(Array.isArray(p.data) ? p.data : [])
    setRelances(Array.isArray(r.data) ? r.data : [])
    setVisites(Array.isArray(v.data) ? v.data : [])
    setSuivisAnniversaires(Array.isArray(a.data) ? a.data : [])
    setChargement(false)
  }

  useEffect(() => {
    // Décaler le premier chargement d'un tour évite une mise à jour d'état
    // synchrone pendant l'installation de l'effet React.
    const premierChargement = window.setTimeout(() => { charger() }, 0)
    supabase.rpc('traiter_rappels_anniversaires').then(({ error: e }) => {
      if (e && e.code !== '42883') console.error('Rappels anniversaires non traités :', e.message)
    })
    return () => window.clearTimeout(premierChargement)
  }, [])

  const suivisAnniversaireParEleve = useMemo(() => Object.fromEntries(
    suivisAnniversaires.map(s => [s.eleve_id, s]),
  ), [suivisAnniversaires])
  const anniversaires = useMemo(() => eleves
    .map(e => ({ ...e, jours: joursAvantAnniversaire(e.date_naissance) }))
    .filter(e => e.jours !== null)
    .sort((a, b) => a.jours - b.jours), [eleves])
  const relancesAujourdhui = useMemo(() => prospects.filter(p =>
    p.prochaine_relance && p.prochaine_relance <= aujourdHui() && !['inscrit', 'sans_suite'].includes(p.statut)
  ), [prospects])
  const anniversairesAContacter = anniversaires.filter(e => e.jours <= 3 &&
    !['parent_contacte', 'a_confirmer', 'confirme_ecole', 'non_celebre', 'annule', 'celebre']
      .includes(suivisAnniversaireParEleve[e.id]?.statut))
  const incidentsDuJour = disciplines.length
  const absentsDuJour = Object.values(presences).filter(p => p.statut === 'absent').length
  const retardsDuJour = Object.values(presences).filter(p => p.statut === 'retard' || Number(p.minutes_retard) > 0).length
  const visitesOuvertes = visites.filter(v => !v.depart_at)

  const choisirClasses = id => setProspect(p => ({
    ...p, classe_ids: p.classe_ids.includes(id) ? p.classe_ids.filter(x => x !== id) : [...p.classe_ids, id],
  }))

  const sauverProspect = async event => {
    event.preventDefault(); setEnregistrement(true); setMessage('')
    const { error: e } = await supabase.rpc('sauver_prospect_famille', {
      p_id: prospect.id, p_nom_parent: prospect.nom_parent, p_telephone: prospect.telephone,
      p_nombre_enfants: Number(prospect.nombre_enfants), p_classes: prospect.classe_ids,
      p_besoin: prospect.besoin, p_statut: prospect.statut,
      p_prochaine_relance: prospect.prochaine_relance || null, p_notes: prospect.notes,
    })
    if (e) setMessage(`Enregistrement impossible : ${messageLisible(e)}`)
    else { setProspect(prospectVide); setMessage('Prospect enregistré.'); await charger() }
    setEnregistrement(false)
  }

  const editerProspect = ligne => {
    setProspect({ ...prospectVide, ...ligne, classe_ids: Array.isArray(ligne.classe_ids) ? ligne.classe_ids : [], prochaine_relance: ligne.prochaine_relance || '' })
    document.querySelector('.rf-form-prospect')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const preparerRelance = ({ type, ligne }) => {
    setRelance({
      ...relanceVide, cible: type, cible_id: ligne.id,
      responsable_contacte: type === 'prospect' ? ligne.nom_parent : (ligne.parent_nom || 'Parent / tuteur'),
      telephone: ligne.telephone || ligne.parent_phone || '', date_contact: datePourChamp(),
      motif: type === 'prospect' ? 'Suivi de la demande d’inscription' : 'Suivi de la scolarité',
    })
    setSection('suivi')
  }

  const enregistrerRelance = async event => {
    event.preventDefault(); setEnregistrement(true); setMessage('')
    const { error: e } = await supabase.rpc('enregistrer_relance_famille', {
      p_prospect_id: relance.cible === 'prospect' ? relance.cible_id || null : null,
      p_eleve_id: relance.cible === 'eleve' ? relance.cible_id || null : null,
      p_responsable_contacte: relance.responsable_contacte, p_telephone: relance.telephone,
      p_date_contact: relance.date_contact ? new Date(relance.date_contact).toISOString() : null,
      p_motif: relance.motif, p_resultat: relance.resultat, p_resume: relance.resume,
      p_prochaine_action: relance.prochaine_action, p_date_suivi: relance.date_suivi || null,
    })
    if (e) setMessage(`Relance non enregistrée : ${messageLisible(e)}`)
    else { setRelance(relanceVide); setMessage('Contact ajouté à l’historique.'); await charger() }
    setEnregistrement(false)
  }

  const enregistrerVisite = async event => {
    event.preventDefault(); setEnregistrement(true); setMessage('')
    const { error: e } = await supabase.rpc('enregistrer_visite_accueil', {
      p_visiteur_nom: visite.visiteur_nom, p_telephone: visite.telephone,
      p_type_visite: visite.type_visite, p_eleve_id: visite.eleve_id || null,
      p_personne_recherchee: visite.personne_recherchee, p_motif: visite.motif,
      p_arrivee_at: visite.arrivee_at ? new Date(visite.arrivee_at).toISOString() : null,
      p_notes: visite.notes,
    })
    if (e) setMessage(`Visite non enregistrée : ${messageLisible(e)}`)
    else { setVisite(visiteVide); setMessage('Arrivée enregistrée.'); await charger() }
    setEnregistrement(false)
  }

  const cloreVisite = async id => {
    const { error: e } = await supabase.rpc('clore_visite_accueil', {
      p_id: id, p_depart_at: new Date().toISOString(), p_notes: '',
    })
    if (e) setMessage(`Départ non enregistré : ${messageLisible(e)}`)
    else { setMessage('Départ enregistré.'); await charger() }
  }

  const sauverAnniversaire = async (eleveId, statut, notes = '') => {
    setMessage('')
    const { error: e } = await supabase.rpc('sauver_suivi_anniversaire', {
      p_eleve_id: eleveId, p_annee_scolaire: ANNEE_SCOLAIRE, p_statut: statut, p_notes: notes,
    })
    if (e) setMessage(`Suivi non enregistré : ${messageLisible(e)}`)
    else { setMessage('Suivi anniversaire mis à jour.'); await charger() }
  }

  const prospectsFiltres = prospects.filter(p => `${p.nom_parent} ${p.telephone} ${(p.classes_souhaitees || []).join(' ')}`.toLowerCase().includes(recherche.toLowerCase()))
  const elevesFiltres = eleves.filter(e => `${e.prenom} ${e.nom} ${e.matricule || ''} ${e.classes?.nom || ''}`.toLowerCase().includes(recherche.toLowerCase()))

  const messageGlobal = message && <div className={`rf-message ${/impossible|non enregistré/i.test(message) ? 'error' : ''}`}>{message}</div>
  const etat = <EtatSource chargement={chargement} erreur={erreur} onRetry={charger} />

  if (section === 'dashboard') return <>
    {etat}{messageGlobal}
    <section className="rf-hero">
      <div><span>RELATIONS FAMILLES</span><h2>Que dois-je traiter aujourd’hui ?</h2><p>Les priorités utiles, sans ressaisie des dossiers élèves.</p></div>
      <b>{new Date().toLocaleDateString('fr-FR', { timeZone: 'Africa/Bamako', weekday: 'long', day: 'numeric', month: 'long' })}</b>
    </section>
    <div className="rf-priorites">
      <button onClick={() => setSection('prospects')}><strong>{relancesAujourdhui.length}</strong><span>prospect(s) à relancer</span><small>Ouvrir les prospects →</small></button>
      <button onClick={() => setSection('anniversaires')}><strong>{anniversairesAContacter.length}</strong><span>famille(s) à appeler</span><small>Anniversaires à J-3 →</small></button>
      <button onClick={() => setSection('suivi')}><strong>{absentsDuJour + retardsDuJour}</strong><span>absence(s) ou retard(s)</span><small>Suivre les élèves →</small></button>
      <button onClick={() => setSection('visiteurs')}><strong>{visitesOuvertes.length}</strong><span>visiteur(s) sur place</span><small>Ouvrir le registre →</small></button>
    </div>
    <div className="rf-signalements">
      <h3>Situation scolaire du jour</h3>
      <div><span><b>{absentsDuJour}</b> absents</span><span><b>{retardsDuJour}</b> retards</span><span><b>{incidentsDuJour}</b> incidents</span></div>
    </div>
  </>

  if (section === 'prospects') return <>
    {etat}{messageGlobal}
    <div className="rf-heading"><div><span>INSCRIPTIONS</span><h2>Prospects & relances</h2><p>Une fiche courte pour ne perdre aucun parent intéressé.</p></div></div>
    <form className="rf-panel rf-form-prospect" onSubmit={sauverProspect}>
      <div className="rf-panel-title"><b>{prospect.id ? 'Modifier le prospect' : 'Nouveau prospect'}</b>{prospect.id && <button type="button" onClick={() => setProspect(prospectVide)}>Annuler</button>}</div>
      <div className="rf-form-grid">
        <label>Nom du parent<input required value={prospect.nom_parent} onChange={e => setProspect({ ...prospect, nom_parent: e.target.value })} placeholder="Nom et prénom" /></label>
        <label>Téléphone<input required inputMode="tel" value={prospect.telephone} onChange={e => setProspect({ ...prospect, telephone: e.target.value })} placeholder="+223…" /></label>
        <label>Nombre d’enfants<input required type="number" min="1" max="20" value={prospect.nombre_enfants} onChange={e => setProspect({ ...prospect, nombre_enfants: e.target.value })} /></label>
        <label>Situation<select value={prospect.statut} onChange={e => setProspect({ ...prospect, statut: e.target.value })}>{Object.entries(STATUTS_PROSPECT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Date de relance<input type="date" value={prospect.prochaine_relance} onChange={e => setProspect({ ...prospect, prochaine_relance: e.target.value })} /></label>
      </div>
      <fieldset className="rf-classes"><legend>Classes souhaitées</legend>{classes.map(c => <label key={c.id}><input type="checkbox" checked={prospect.classe_ids.includes(c.id)} onChange={() => choisirClasses(c.id)} />{c.nom}</label>)}</fieldset>
      <label className="rf-wide">Ce que recherche la famille<textarea rows="2" value={prospect.besoin} onChange={e => setProspect({ ...prospect, besoin: e.target.value })} placeholder="Bilinguisme, cantine, niveau recherché, rendez-vous…" /></label>
      <label className="rf-wide">Notes internes<textarea rows="2" value={prospect.notes} onChange={e => setProspect({ ...prospect, notes: e.target.value })} /></label>
      <button className="rf-primary" disabled={enregistrement}>{prospect.id ? 'Enregistrer les modifications' : 'Ajouter le prospect'}</button>
    </form>
    <div className="rf-list-head"><h3>{prospects.length} prospect(s)</h3><input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un parent…" /></div>
    <div className="rf-list">{prospectsFiltres.map(p => <article className="rf-card" key={p.id}>
      <div className="rf-card-main"><div className="rf-avatar">{p.nom_parent.slice(0, 1).toUpperCase()}</div><div><h3>{p.nom_parent}</h3><p>{p.telephone} · {p.nombre_enfants} enfant(s)</p><small>{(p.classes_souhaitees || []).join(', ') || 'Classe à préciser'}</small></div><span className={`rf-status ${p.statut}`}>{STATUTS_PROSPECT[p.statut]}</span></div>
      {p.besoin && <p className="rf-besoin">{p.besoin}</p>}
      <div className="rf-card-meta"><span>{p.nombre_relances || 0} contact(s)</span><span>{p.prochaine_relance ? `Relance : ${new Date(`${p.prochaine_relance}T12:00`).toLocaleDateString('fr-FR')}` : 'Aucune relance planifiée'}</span></div>
      <div className="rf-actions"><button onClick={() => editerProspect(p)}>Modifier</button><button onClick={() => preparerRelance({ type: 'prospect', ligne: p })}>Ajouter un contact</button><button onClick={() => ouvrirWhatsApp(p.telephone, `Bonjour, l’École IDEAL revient vers vous au sujet de votre demande d’inscription.`)}>WhatsApp</button></div>
    </article>)}</div>
    {!chargement && !erreur && !prospectsFiltres.length && <div className="rf-empty">Aucun prospect ne correspond à la recherche.</div>}
  </>

  if (section === 'suivi') return <>
    {etat}{messageGlobal}
    <div className="rf-heading"><div><span>VIE SCOLAIRE</span><h2>Suivi des familles</h2><p>Chaque appel reste attaché au bon prospect ou au bon élève.</p></div></div>
    <form className="rf-panel" onSubmit={enregistrerRelance}>
      <div className="rf-panel-title"><b>Enregistrer un contact</b></div>
      <div className="rf-form-grid">
        <label>Type<select value={relance.cible} onChange={e => setRelance({ ...relanceVide, cible: e.target.value, date_contact: datePourChamp() })}><option value="prospect">Parent prospect</option><option value="eleve">Famille d’un élève</option></select></label>
        <label>Personne concernée<select required value={relance.cible_id} onChange={e => {
          const liste = relance.cible === 'prospect' ? prospects : eleves
          const cible = liste.find(x => x.id === e.target.value) || {}
          setRelance({ ...relance, cible_id: e.target.value, responsable_contacte: relance.cible === 'prospect' ? cible.nom_parent || '' : cible.parent_nom || 'Parent / tuteur', telephone: cible.telephone || cible.parent_phone || '' })
        }}><option value="">Choisir…</option>{(relance.cible === 'prospect' ? prospects : eleves).map(x => <option key={x.id} value={x.id}>{relance.cible === 'prospect' ? x.nom_parent : `${x.prenom} ${x.nom}`}</option>)}</select></label>
        <label>Responsable contacté<input required value={relance.responsable_contacte} onChange={e => setRelance({ ...relance, responsable_contacte: e.target.value })} /></label>
        <label>Téléphone<input inputMode="tel" value={relance.telephone} onChange={e => setRelance({ ...relance, telephone: e.target.value })} /></label>
        <label>Date et heure<input type="datetime-local" required value={relance.date_contact} onChange={e => setRelance({ ...relance, date_contact: e.target.value })} /></label>
        <label>Résultat<select value={relance.resultat} onChange={e => setRelance({ ...relance, resultat: e.target.value })}>{Object.entries(RESULTATS_CONTACT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="rf-wide">Motif<input required value={relance.motif} onChange={e => setRelance({ ...relance, motif: e.target.value })} placeholder="Absence, inscription, anniversaire…" /></label>
        <label className="rf-wide">Résumé de l’échange<textarea rows="2" value={relance.resume} onChange={e => setRelance({ ...relance, resume: e.target.value })} /></label>
        <label>Prochaine action<input value={relance.prochaine_action} onChange={e => setRelance({ ...relance, prochaine_action: e.target.value })} /></label>
        <label>Date de suivi<input type="date" value={relance.date_suivi} onChange={e => setRelance({ ...relance, date_suivi: e.target.value })} /></label>
      </div>
      <button className="rf-primary" disabled={enregistrement}>Ajouter à l’historique</button>
    </form>
    <div className="rf-list-head"><h3>Élèves à suivre</h3><input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom, matricule ou classe…" /></div>
    <div className="rf-students">{elevesFiltres.map(e => {
      const presence = presences[e.id]
      const incidents = disciplines.filter(d => d.eleve_id === e.id).length
      return <article key={e.id}><div className="rf-avatar student">{(e.prenom?.[0] || '') + (e.nom?.[0] || '')}</div><div><h3>{e.prenom} {e.nom}</h3><p>{e.classes?.nom || 'Sans classe'} · {e.matricule || 'Sans matricule'}</p><small>{presence?.statut === 'absent' ? 'Absent aujourd’hui' : presence?.statut === 'retard' || presence?.minutes_retard > 0 ? `Retard ${presence.minutes_retard || 0} min` : presence ? 'Présence renseignée' : 'Non pointé'}{incidents ? ` · ${incidents} incident(s)` : ''}</small></div><button onClick={() => preparerRelance({ type: 'eleve', ligne: e })}>Contacter</button></article>
    })}</div>
    <div className="rf-list-head"><h3>Historique récent</h3></div>
    <div className="rf-timeline">{relances.slice(0, 30).map(r => <article key={r.id}><i /><div><b>{r.eleve_nom || r.prospect_nom || r.responsable_contacte}</b><span>{r.motif} · {RESULTATS_CONTACT[r.resultat]}</span><p>{r.resume || 'Aucun résumé saisi.'}</p><small>{dateHeureLocale(r.date_contact)}{r.date_suivi ? ` · suivi le ${new Date(`${r.date_suivi}T12:00`).toLocaleDateString('fr-FR')}` : ''}</small></div></article>)}</div>
  </>

  if (section === 'anniversaires') return <>
    {etat}{messageGlobal}
    <div className="rf-heading"><div><span>ANTICIPATION</span><h2>Anniversaires des élèves</h2><p>La date vient directement du dossier élève. L’appel est attendu trois jours avant.</p></div></div>
    <div className="rf-birthday-banner"><b>{anniversairesAContacter.length}</b><span>famille(s) à contacter maintenant</span></div>
    <div className="rf-list">{anniversaires.slice(0, 40).map(e => {
      const suivi = suivisAnniversaireParEleve[e.id]
      const statut = suivi?.statut || 'a_contacter'
      return <article className={`rf-card rf-birthday ${e.jours <= 3 ? 'urgent' : ''}`} key={e.id}>
        <div className="rf-card-main"><div className="rf-avatar birthday">🎂</div><div><h3>{e.prenom} {e.nom}</h3><p>{e.classes?.nom || 'Sans classe'} · {e.parent_phone || 'Téléphone manquant'}</p><small>{e.jours === 0 ? 'Aujourd’hui' : e.jours === 1 ? 'Demain' : `Dans ${e.jours} jours`}</small></div></div>
        <label className="rf-birthday-status">Suivi<select value={statut} onChange={ev => sauverAnniversaire(e.id, ev.target.value, suivi?.notes || '')}>{Object.entries(STATUTS_ANNIVERSAIRE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <div className="rf-actions"><button onClick={() => preparerRelance({ type: 'eleve', ligne: { ...e, parent_nom: e.parent_nom || 'Parent / tuteur' } })}>Noter l’appel</button><button onClick={() => ouvrirWhatsApp(e.parent_phone, `Chers parents, l’École IDEAL vous contacte au sujet de l’anniversaire de ${e.prenom} ${e.nom}. Souhaitez-vous l’organiser à l’école ?`)}>WhatsApp</button></div>
      </article>
    })}</div>
    {!chargement && !erreur && !anniversaires.length && <div className="rf-empty">Aucune date de naissance n’est disponible dans les dossiers élèves.</div>}
  </>

  if (section === 'visiteurs') return <>
    {etat}{messageGlobal}
    <div className="rf-heading"><div><span>ACCUEIL</span><h2>Registre des visiteurs</h2><p>Qui est venu, pour qui, pourquoi et à quelle heure.</p></div></div>
    <form className="rf-panel" onSubmit={enregistrerVisite}>
      <div className="rf-panel-title"><b>Enregistrer une arrivée</b></div>
      <div className="rf-form-grid">
        <label>Nom du visiteur<input required value={visite.visiteur_nom} onChange={e => setVisite({ ...visite, visiteur_nom: e.target.value })} /></label>
        <label>Téléphone<input inputMode="tel" value={visite.telephone} onChange={e => setVisite({ ...visite, telephone: e.target.value })} /></label>
        <label>Type de visite<select value={visite.type_visite} onChange={e => setVisite({ ...visite, type_visite: e.target.value, eleve_id: e.target.value === 'retrait_eleve' ? visite.eleve_id : '' })}><option value="retrait_eleve">Venir chercher un élève</option><option value="rendez_vous">Rendez-vous</option><option value="livraison">Livraison</option><option value="autre">Autre</option></select></label>
        {visite.type_visite === 'retrait_eleve' ? <label>Élève concerné<select required value={visite.eleve_id} onChange={e => setVisite({ ...visite, eleve_id: e.target.value })}><option value="">Choisir…</option>{eleves.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} · {e.classes?.nom || '—'}</option>)}</select></label> : <label>Personne recherchée<input value={visite.personne_recherchee} onChange={e => setVisite({ ...visite, personne_recherchee: e.target.value })} /></label>}
        <label>Date et heure d’arrivée<input type="datetime-local" required value={visite.arrivee_at} onChange={e => setVisite({ ...visite, arrivee_at: e.target.value })} /></label>
        <label className="rf-wide">Motif<input required value={visite.motif} onChange={e => setVisite({ ...visite, motif: e.target.value })} /></label>
        <label className="rf-wide">Observation<textarea rows="2" value={visite.notes} onChange={e => setVisite({ ...visite, notes: e.target.value })} /></label>
      </div>
      <button className="rf-primary" disabled={enregistrement}>Enregistrer l’arrivée</button>
    </form>
    <div className="rf-list-head"><h3>Visites récentes</h3></div>
    <div className="rf-list">{visites.map(v => <article className={`rf-card rf-visit ${!v.depart_at ? 'open' : ''}`} key={v.id}>
      <div className="rf-card-main"><div className="rf-avatar visit">{v.depart_at ? '✓' : '↗'}</div><div><h3>{v.visiteur_nom}</h3><p>{v.eleve_nom || v.personne_recherchee || v.motif}</p><small>Arrivée {dateHeureLocale(v.arrivee_at)}{v.depart_at ? ` · Départ ${dateHeureLocale(v.depart_at)}` : ' · Sur place'}</small></div></div>
      <p className="rf-besoin">{v.motif}</p>{!v.depart_at && <div className="rf-actions"><button className="important" onClick={() => cloreVisite(v.id)}>Enregistrer le départ</button></div>}
    </article>)}</div>
    {!chargement && !erreur && !visites.length && <div className="rf-empty">Aucune visite enregistrée sur les 90 derniers jours.</div>}
  </>

  return null
}

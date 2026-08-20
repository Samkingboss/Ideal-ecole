import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PerformancesDirecteur from './PerformancesDirecteur'
import AgendaCalendrier from './AgendaCalendrier'
import NotificationCenter from './NotificationCenter'
import {
  CONFIG_DEFAUT, calculerPoints, montantEte, valeurAction,
  avantagesDe, ancienneteAnnees, pointsMaxAnnee,
} from '../lib/points'
import { lireJournal } from '../lib/audit'
import { pushNotification } from '../lib/notifications'
import AffectationsMatieres from './AffectationsMatieres'
import ActivitePersonnel from './ActivitePersonnel'
import CartesScolaires from './CartesScolaires'
import CertificatScolarite from './CertificatScolarite'
import FichesEffectifs from './FichesEffectifs'
import InscriptionsValidation from './InscriptionsValidation'
import DocumentPrintStudio from './DocumentPrintStudio'
import { statutDe, libelleStatut, ponctualiteAuDepot, raconter } from '../lib/preparations'
import { MaternelleDirection } from './MaternelleApp'

const BOTTOM_TABS = [
  { id:'dashboard', icon:'📊', label:'Bord' },
  { id:'agenda', icon:'📅', label:'Agenda' },
  { id:'perfs', icon:'⭐', label:'Perfs' },
]

const TOP_TABS = [
  { id:'profs', icon:'👥', label:'Équipe' },
  { id:'rh', icon:'💼', label:'RH & Paie' },
  { id:'points', icon:'🏆', label:'Points & prime' },
  { id:'eleves', icon:'🎒', label:'Élèves' },
  { id:'cartes', icon:'💳', label:'Cartes Scolaires' },
  { id:'certificat', icon:'📜', label:'Certificat Scolarité' },
  { id:'synthese', icon:'📊', label:'Synthèse' },
  { id:'discipline', icon:'⚖️', label:'Discipline' },
  { id:'pedagogie', icon:'📚', label:'Pédagogie' },
  { id:'emploi', icon:'🗓️', label:'Emploi du temps' },
  { id:'maternelle', icon:'🧸', label:'Maternelle' },
]

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

const fmtRole = r => {
  const map = {
    'directeur': 'Directeur',
    'professeur': 'Enseignant',
    'surveillant': 'Surveillant',
    'conseiller_vie_scolaire': 'Conseiller Vie Scolaire',
    'responsable_administratif': 'Responsable Administratif',
    'cuisiniere': 'Chef Cuisinière / Cantine'
  }
  return map[r] || r
}

// Référentiel par défaut des postes (seed si app_state rh/postes est vide).
// Doit rester aligné avec SALAIRES_DETAIL de public/comptabilite.html.
const DEFAULT_POSTES = [
  { id:'directeur',              label:'Directeur',                       mensuel:400000, commentaire:'Direction générale' },
  { id:'resp-administratif',     label:'Responsable administratif',       mensuel:150000, commentaire:'Secrétariat et suivi' },
  { id:'conseillere-vie-scol',   label:'Conseillère de vie scolaire',     mensuel:75000,  commentaire:'' },
  { id:'surveillant',            label:'Surveillant(e)',                  mensuel:75000,  commentaire:'Sécurité et discipline' },
  { id:'cuisiniere',             label:'Chef Cuisinière / Cantine',       mensuel:90000,  commentaire:'Restauration et gestion cantine' },
  { id:'menageres',              label:'Ménagères (× 3)',                 mensuel:150000, commentaire:'50 000 FCFA × 3' },
  { id:'gardien',                label:'Gardien',                         mensuel:30000,  commentaire:'Sécurité nocturne' },
  { id:'maitresse-fr-mat',       label:'Maîtresse Français (Maternelle)', mensuel:125000, commentaire:'' },
  { id:'maitresse-en-mat',       label:'Maîtresse Anglais (Maternelle)',  mensuel:125000, commentaire:'' },
  { id:'assistante-fr-mat',      label:'Assistante Français (Mater.)',    mensuel:75000,  commentaire:'' },
  { id:'assistante-en-mat',      label:'Assistante Anglais (Mater.)',     mensuel:75000,  commentaire:'' },
  { id:'maitre-fr-cp',           label:'Maître Français (CP1-CP2)',       mensuel:125000, commentaire:'Cours bilingue CP' },
  { id:'maitre-en-cp',           label:'Maître Anglais (CP1-CP2)',        mensuel:125000, commentaire:'Cours bilingue CP' },
  { id:'maitre-fr-ce',           label:'Maître Français (CE1-CE2)',       mensuel:125000, commentaire:'Cours bilingue CE' },
  { id:'maitre-en-ce',           label:'Maître Anglais (CE1-CE2)',        mensuel:125000, commentaire:'Cours bilingue CE' },
  { id:'maitre-fr-cm',           label:'Maître Français (CM1-CM2)',       mensuel:125000, commentaire:'Cours bilingue CM' },
  { id:'maitre-en-cm',           label:'Maître Anglais (CM1-CM2)',        mensuel:125000, commentaire:'Cours bilingue CM' },
  { id:'remun-associe',          label:'Rémunération Associé',            mensuel:250000, commentaire:'Retour sur investissement – Associé' },
  { id:'remun-directeur',        label:'Rémunération Directeur',          mensuel:100000, commentaire:'Retour sur investissement – Directeur' },
]

const fmtFCFA = n => (parseInt(n, 10) || 0).toLocaleString('fr-FR') + ' FCFA'

export default function DirecteurApp({ user, onLogout }) {
  const [tab, setTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('tab') || 'dashboard'
  })
  const [stats, setStats] = useState({ profs:0, eleves:0, checkpoints:0 })
  const [profs, setProfs] = useState([])
  const [eleves, setEleves] = useState([])
  const [inscriptions, setInscriptions] = useState([])
  const [classes, setClasses] = useState([])
  const [periodes, setPeriodes] = useState([])
  const [evenements, setEvenements] = useState([])
  const [calendrierUrl, setCalendrierUrl] = useState('')
  const [joursOuvresGlobal, setJoursOuvresGlobal] = useState(20)
  const [showModal, setShowModal] = useState(null)
  const [newProf, setNewProf] = useState({ prenom:'', nom:'', role:'professeur', langue:'fr', code_acces:'', plafond_salaire: 180000, classe_ids: [] })
  const [newEleve, setNewEleve] = useState({ prenom:'', nom:'', classe_id:'' })
  const [newEvenement, setNewEvenement] = useState({ titre:'', date_event:'', description:'' })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [preparations, setPreparations] = useState([])
  // Carte de préparation dépliée pour montrer sa frise d'historique.
  const [prepOuverte, setPrepOuverte] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [syntheseData, setSyntheseData] = useState([])
  const [activeSyntheseClass, setActiveSyntheseClass] = useState(null)
  const [activeEleveClass, setActiveEleveClass] = useState(null)
  const [disciplines, setDisciplines] = useState([])
  const [postes, setPostes] = useState(DEFAULT_POSTES)
  const [posteDraft, setPosteDraft] = useState([])
  const [demandesRH, setDemandesRH] = useState([])

  // Demande désignée par une notification. La cloche transmet son identifiant ;
  // l'écran déroule jusqu'à elle et l'encadre quelques secondes. Sans cela, le
  // clic ouvrait la session RH et déposait le directeur en haut de la page,
  // devant les indicateurs de masse salariale, à lui de retrouver de quelle
  // demande on lui parlait.
  const [demandeCiblee, setDemandeCiblee] = useState(null)

  useEffect(() => {
    if (!demandeCiblee) return
    // On laisse le temps à la session RH de se rendre avant de chercher la ligne.
    const t = setTimeout(() => {
      const el = document.getElementById(`demande-${demandeCiblee}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    // La mise en évidence s'efface d'elle-même : elle sert à trouver, pas à rester.
    const fin = setTimeout(() => setDemandeCiblee(null), 6000)
    return () => { clearTimeout(t); clearTimeout(fin) }
  }, [demandeCiblee, demandesRH])

  // Reponse de la direction a une demande RH.
  //
  // Trois choses doivent se produire ensemble, et c'est la troisieme qui
  // manquait : enregistrer la decision, verifier qu'elle est bien partie, et
  // prevenir l'enseignant. Sans notification, la demande restait « en cours de
  // traitement » sur son ecran et il n'apprenait jamais la reponse.
  //
  // La notification vise `d.user_id` et non un role : c'est l'enseignant
  // concerne qu'on informe, pas la salle des profs.
  const repondreDemande = async (d, statut, reponse) => {
    const updated = demandesRH.map(x => (x.id === d.id ? { ...x, statut, reponse_direction: reponse } : x))
    setDemandesRH(updated)

    const { error } = await supabase.from('app_state').upsert({
      app: 'rh', key: 'demandes_rh_global', value: updated, updated_at: new Date().toISOString(),
    }, { onConflict: 'app,key' })

    if (error) {
      setDemandesRH(demandesRH)   // on remet l'ecran dans l'etat de la base
      alert("La reponse n'a pas ete enregistree : " + error.message)
      return
    }

    const transmise = await pushNotification(d.user_id, {
      titre: /refus/i.test(statut) ? 'Votre demande a été refusée' : 'Votre demande a été approuvée',
      message: reponse ? `${statut} — ${reponse}` : String(statut),
      type: 'rh',
      tabTarget: 'demandes',
    })

    // La decision est enregistree quoi qu'il arrive ; seule l'alerte a pu
    // echouer. Le dire, plutot que de laisser croire l'enseignant prevenu.
    if (!transmise) {
      alert("Reponse enregistree, mais la notification n'a pas pu etre envoyee a l'enseignant. Prevenez-le de vive voix.")
    }
  }
  const [pointsConfig, setPointsConfig] = useState(CONFIG_DEFAUT)
  const [personnelRH, setPersonnelRH] = useState({})
  const [sourcesPoints, setSourcesPoints] = useState({ preparations: [], checkpoints: [], performances: [], rapports: [], saisieManuelle: {} })
  const [profSelectionne, setProfSelectionne] = useState(null)
  const [journal, setJournal] = useState([])
  const [journalOuvert, setJournalOuvert] = useState(false)
  const [subTabEleve, setSubTabEleve] = useState('dossiers')
  const [inscriptionCiblee, setInscriptionCiblee] = useState(null)

  // Une notification système peut ouvrir l'application après sa fermeture.
  // Sa cible voyage alors dans l'URL, puisque le service worker ne partage pas
  // l'état React. On rejoue exactement la même navigation que pour la cloche.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const target = params.get('notificationTab')
    const ref = params.get('notificationRef')
    if (!target) return
    setTab(target)
    if (target === 'eleves') {
      setSubTabEleve('dossiers')
      setInscriptionCiblee(ref || null)
    } else {
      setDemandeCiblee(ref || null)
    }
    params.delete('notificationTab')
    params.delete('notificationRef')
    const reste = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${reste ? `?${reste}` : ''}${window.location.hash}`)
  }, [])
  const [subTabPersonnel, setSubTabPersonnel] = useState('profs')
  const [ficheMarcheCantine, setFicheMarcheCantine] = useState({ budget: 0, articles: [] })
  const [justificatifsCuisine, setJustificatifsCuisine] = useState([])
  const [selectedJustificatif, setSelectedJustificatif] = useState(null)

  useEffect(() => { 
    loadData() 
  }, [])

  const loadData = async () => {
    try {
      const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const results = await Promise.all([
        supabase.from('users').select('*').neq('role','directeur').eq('actif',true),
        supabase.from('eleves').select('*, classes(nom)').eq('actif',true),
        supabase.from('classes').select('*').order('ordre'),
        supabase.from('periodes').select('*').order('ordre'),
        supabase.from('evenements').select('*').order('date_event', { ascending: true }),
        supabase.from('documents').select('*').eq('type', 'calendrier').order('created_at', { ascending: false }).limit(1),
        supabase.from('parametres_mois').select('*').eq('mois', currentMoisStr).maybeSingle(),
        supabase.from('preparations').select('*, users(prenom, nom), classes(nom)').order('heure_depot', { ascending: false }),
        supabase.from('checkpoints').select('*'),
        supabase.from('prof_classes').select('*'),
        supabase.from('disciplines').select('*, eleves(prenom, nom, classe_id, classes(nom)), users!prof_id(prenom, nom)').order('created_at', { ascending: false }),
        supabase.from('inscriptions').select('*').order('created_at', { ascending: false })
      ])

      const u = results[0].data || []
      const el = results[1].data || []
      const cl = results[2].data || []
      const ev = results[4].data || []
      const docs = results[5].data || []
      const param = results[6].data
      const prep = results[7].data || []
      const cp = results[8].data || []
      const pc = results[9].data || []
      const disc = results[10].data || []
      const inscs = results[11].data || []

      // Les données médicales et l'inscription cantine appartiennent au
      // dossier d'inscription. On les rattache à l'élève actif sans créer une
      // seconde source de vérité dans `eleves`.
      const elevesEnrichis = el.map(e => {
        const dossier = inscs.find(i => String(i.id) === String(e.inscription_id) || (e.matricule && i.matricule === e.matricule))
        return {
          ...e,
          cantine: dossier?.cantine ?? false,
          allergies: dossier?.allergies || '',
          restrictions: dossier?.restrictions || '',
          inscription_id: e.inscription_id || dossier?.id || null,
          matricule: e.matricule || dossier?.matricule || null,
        }
      })

      // Seuls les dossiers signés par la Direction deviennent des élèves
      // actifs. Un dossier « en attente » reste visible dans le registre de
      // validation, mais ne gonfle ni les effectifs ni la cantine.
      const elevesExistants = new Set(elevesEnrichis.flatMap(e => [e.matricule, e.inscription_id].filter(Boolean).map(String)))
      const elInscs = inscs.filter(i => i.statut === 'validee' && !elevesExistants.has(String(i.matricule)) && !elevesExistants.has(String(i.id))).map(i => {
        const matchingCl = cl.find(c => (c.nom || '').toLowerCase().trim() === (i.classe_demandee || '').toLowerCase().trim());
        return {
          id: i.id,
          nom: i.nom,
          prenom: i.prenom,
          matricule: i.matricule,
          date_naissance: i.date_naissance,
          sexe: i.sexe,
          classe_id: matchingCl ? matchingCl.id : null,
          classe_nom: i.classe_demandee,
          points_discipline: 100,
          actif: true,
          is_inscription: true
        };
      });

      const allCombinedEleves = [...elevesEnrichis, ...elInscs];

      setDisciplines(disc)
      if (param) setJoursOuvresGlobal(param.jours_ouvres);
      setPreparations(prep)

      setEleves(allCombinedEleves)
      setInscriptions(inscs)
      setClasses(cl)
      setEvenements(ev)
      if (docs && docs.length > 0) setCalendrierUrl(docs[0].url)
      setStats({ profs: u.length, eleves: allCombinedEleves.length, checkpoints: cp.length })
      setCheckpoints(cp)
      
      const enrichedProfs = u.map(p => ({
        ...p,
        role: (p.fonction === 'cuisiniere' || p.custom_role === 'cuisiniere') ? 'cuisiniere' : p.role,
        classe_ids: pc.filter(link => link.user_id === p.id).map(link => link.classe_id)
      }))
      setProfs(enrichedProfs)
      
      if (cl.length > 0) setNewEleve(p => ({ ...p, classe_id: cl[0].id }))

      const { data: allMats } = await supabase.from('matieres').select('*, objectifs(*)')
      const { data: allProgs } = await supabase.from('progressions').select('*, eleves(classe_id), objectifs(id)')
      
      const analysis = []
      cl.forEach(c => {
        const cMats = (allMats || []).filter(m => m.classe_id === c.id)
        const cProgs = (allProgs || []).filter(p => p.eleves?.classe_id === c.id)
        const matStats = cMats.map(m => {
          const mObjIds = (m.objectifs || []).map(o => o.id)
          const mProgs = cProgs.filter(p => mObjIds.includes(p.objectif_id))
          const avg = mProgs.length ? Math.round(mProgs.reduce((acc,p)=>acc+p.pourcentage,0)/mProgs.length) : 0
          return { nom: m.nom, avg }
        }).sort((a,b) => b.avg - a.avg)
        analysis.push({ classe: c.nom, stats: matStats })
      })
      setSyntheseData(analysis)

      // Référentiel Postes & salaires (partagé avec la comptabilité via app_state rh/postes)
      const { data: rhPostes } = await supabase.from('app_state')
        .select('value').eq('app', 'rh').eq('key', 'postes').maybeSingle()
      if (Array.isArray(rhPostes?.value) && rhPostes.value.length > 0) {
        const cleaned = rhPostes.value.map(p => ({
          ...p,
          commentaire: (p.commentaire || '').replace(/Fati\s*DJIRÉ/gi, '').replace(/\(–\s*trilingue\)/gi, '').replace(/\(Fati\s*DJIRÉ\s*–\s*trilingue\)/gi, '').trim()
        }))
        setPostes(cleaned)
        await supabase.from('app_state').upsert(
          { app: 'rh', key: 'postes', value: cleaned, updated_at: new Date().toISOString() },
          { onConflict: 'app,key' }
        )
      }

      // Demandes RH soumises par les enseignants
      const { data: globalDem } = await supabase.from('app_state')
        .select('value').eq('app', 'rh').eq('key', 'demandes_rh_global').maybeSingle()
      if (globalDem && globalDem.value && Array.isArray(globalDem.value)) setDemandesRH(globalDem.value)

      // Fiche du marché cantine de la Cuisinière
      const { data: stateMarche } = await supabase.from('app_state')
        .select('value').eq('key', 'cantine_fiche_marche').maybeSingle()
      if (stateMarche && stateMarche.value) setFicheMarcheCantine(stateMarche.value)

      // Historique des Justificatifs du Jour transmis par la Cuisinière
      const { data: stateJustifs } = await supabase.from('app_state')
        .select('value').eq('key', 'cantine_justificatifs_historique').maybeSingle()
      if (stateJustifs && Array.isArray(stateJustifs.value)) {
        setJustificatifsCuisine(stateJustifs.value)
      }

      // ─── Points & prime d'été ───
      const [cfgRes, persRes, manRes, perfRes, rapRes] = await Promise.all([
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'points_config').maybeSingle(),
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'personnel').maybeSingle(),
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'saisie_manuelle').maybeSingle(),
        supabase.from('performances').select('prof_id, date_jour, heure_arrivee'),
        supabase.from('app_state').select('value').eq('app', 'rapports_eleves'),
      ])
      if (cfgRes.data?.value) setPointsConfig({ ...CONFIG_DEFAUT, ...cfgRes.data.value })
      if (persRes.data?.value) setPersonnelRH(persRes.data.value)
      setSourcesPoints({
        preparations: prep || [],
        checkpoints: cp || [],
        performances: perfRes.data || [],
        rapports: (rapRes.data || []).map(r => r.value).filter(Boolean),
        saisieManuelle: manRes.data?.value || {},
      })
    } catch (e) {
      console.error('Error loading data:', e)
    }
  }

  const savePostes = async () => {
    const cleaned = posteDraft
      .filter(p => (p.label || '').trim())
      .map(p => ({
        id: p.id || (p.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poste-' + Date.now()),
        label: p.label.trim(),
        mensuel: parseInt(p.mensuel, 10) || 0,
        commentaire: (p.commentaire || '').trim()
      }))
    setLoading(true)
    const { error } = await supabase.from('app_state').upsert(
      { app: 'rh', key: 'postes', value: cleaned, updated_at: new Date().toISOString() },
      { onConflict: 'app,key' }
    )
    setLoading(false)
    if (error) { setMsg('Erreur: ' + error.message); return }
    setPostes(cleaned)
    setShowModal(null)
    setMsg('Postes & salaires enregistrés — la comptabilité est synchronisée.')
  }

  // ─── Points & prime d'été : persistance dans app_state ───
  const sauverRH = async (key, value, message) => {
    const { error } = await supabase.from('app_state').upsert(
      { app: 'rh', key, value, updated_at: new Date().toISOString() },
      { onConflict: 'app,key' }
    )
    if (error) { setMsg('Erreur: ' + error.message); return false }
    if (message) setMsg(message)
    return true
  }

  const majConfig = (patch) => {
    const next = { ...pointsConfig, ...patch }
    setPointsConfig(next)
    sauverRH('points_config', next)
  }

  const majPersonnel = (userId, patch) => {
    const next = { ...personnelRH, [userId]: { ...(personnelRH[userId] || {}), ...patch } }
    setPersonnelRH(next)
    sauverRH('personnel', next)
  }

  const majSaisie = (userId, triId, indId, valeur) => {
    const sm = sourcesPoints.saisieManuelle || {}
    const next = {
      ...sm,
      [userId]: {
        ...(sm[userId] || {}),
        [triId]: { ...((sm[userId] || {})[triId] || {}), [indId]: parseInt(valeur, 10) || 0 },
      },
    }
    setSourcesPoints(s => ({ ...s, saisieManuelle: next }))
    sauverRH('saisie_manuelle', next)
  }

  /** Enseignants avec leurs points calculés — recalculé à chaque rendu */
  const equipePoints = profs
    .filter(p => p.role === 'professeur')
    .map(p => {
      const nomComplet = `${p.prenom || ''} ${p.nom || ''}`.trim()
      const calc = calculerPoints(pointsConfig, sourcesPoints, p.id, nomComplet)
      const ete = montantEte(calc.pourcentage, pointsConfig)
      const av = avantagesDe(calc.pourcentage, (personnelRH[p.id] || {}).dateEmbauche, personnelRH[p.id], pointsConfig)
      return { prof: p, nomComplet, calc, ete, av }
    })
    .sort((a, b) => b.calc.total - a.calc.total)

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  const saveProf = async () => {
    setLoading(true)
    try {
      const code = newProf.code_acces || generateCode()
      let { data: userData, error } = await supabase.from('users').upsert({ 
        id: newProf.id || undefined,
        prenom: newProf.prenom, 
        nom: newProf.nom, 
        role: newProf.role, 
        langue: newProf.langue, 
        code_acces: code, 
        plafond_salaire: newProf.plafond_salaire,
        fonction: newProf.poste_id || null,
        actif: true 
      }, { onConflict: 'id' }).select().single()

      // Si la contrainte CHECK bloque le rôle en base, on fait un fallback transparent
      if (error && error.message.includes('users_role_check')) {
        console.warn('Contrainte users_role_check détectée. Application du fallback fonction: cuisiniere...')
        const fallback = await supabase.from('users').upsert({
          id: newProf.id || undefined,
          prenom: newProf.prenom, 
          nom: newProf.nom, 
          role: 'surveillant',
          fonction: 'cuisiniere',
          langue: newProf.langue, 
          code_acces: code, 
          plafond_salaire: newProf.plafond_salaire,
          actif: true 
        }, { onConflict: 'id' }).select().single()

        userData = fallback.data
        error = fallback.error
      }

      if (error) {
        alert('❌ Compte non enregistré : ' + (error.message || 'Erreur inattendue'))
        setMsg('Erreur: ' + error.message)
      } else if (userData) {
        if (newProf.role === 'professeur') {
          await supabase.from('prof_classes').delete().eq('user_id', userData.id)
          if (newProf.classe_ids?.length > 0) {
            const links = newProf.classe_ids.map(cid => ({ 
              user_id: userData.id, 
              classe_id: cid,
              langue: newProf.langue || 'fr'
            }))
            const { error: linkErr } = await supabase.from('prof_classes').insert(links)
            if (linkErr) {
              alert("Classes non sauvées: " + linkErr.message)
            }
          }
        }
        setMsg(`Compte ${newProf.id ? 'mis à jour' : 'créé'} ! Code: ` + code)
        await loadData()
        setShowModal(null)
        setNewProf({ prenom:'', nom:'', role:'professeur', langue:'fr', code_access:'', plafond_salaire: 180000, classe_ids: [] })
      }
    } catch (e) {
      console.error(e)
      setMsg('Erreur imprévue')
    } finally {
      setLoading(false)
    }
  }

  const saveJoursOuvres = async () => {
    setLoading(true);
    const currentMoisStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const { error } = await supabase.from('parametres_mois').upsert({ mois: currentMoisStr, jours_ouvres: joursOuvresGlobal }, { onConflict: 'mois' });
    if (error) setMsg('Erreur: ' + error.message);
    else setMsg('Configurations financières mises à jour !');
    setLoading(false);
  }

  const saveEleve = async () => {
    setLoading(true)
    const { error } = await supabase.from('eleves').insert({ ...newEleve, actif: true })
    if (error) { setMsg('Erreur: ' + error.message) } else { loadData(); setShowModal(null) }
    setLoading(false)
  }

  const majDossierCantine = async (eleve, changements) => {
    const avant = eleves
    setEleves(liste => liste.map(item => item.id === eleve.id ? { ...item, ...changements } : item))
    let requete = supabase.from('inscriptions').update(changements)
    requete = eleve.inscription_id
      ? requete.eq('id', eleve.inscription_id)
      : requete.eq('matricule', eleve.matricule || '__sans_matricule__')
    const { error } = await requete
    if (error) {
      setEleves(avant)
      setMsg(`Mise à jour cantine impossible : ${error.message}`)
      return false
    }
    setMsg('Dossier cantine mis à jour.')
    return true
  }

  const saveEvenement = async () => {
    if (!newEvenement.titre || !newEvenement.date_event) { setMsg('Titre et date obligatoires'); return }
    setLoading(true)
    const { error } = await supabase.from('evenements').insert({ ...newEvenement })
    if (error) { setMsg('Erreur: ' + error.message) } else { loadData(); setShowModal(null); setNewEvenement({titre:'',date_event:'',description:''}) }
    setLoading(false)
  }

  const handleUploadPDF = async (e, type, planId = null) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${type}_${Math.random()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file)
    if (uploadError) { setMsg('Erreur upload: ' + uploadError.message); setUploading(false); return }
    
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)
    
    if (type === 'calendrier') {
      await supabase.from('documents').insert({ nom: file.name, url: publicUrl, type: 'calendrier' })
      setCalendrierUrl(publicUrl)
      setMsg('Calendrier mis à jour !')
    } else if (type === 'planification' && planId) {
      await supabase.from('planifications').update({ pdf_url: publicUrl }).eq('id', planId)
      loadData()
      setMsg('PDF de planification ajouté !')
    }
    setUploading(false)
  }


  const deleteProf = async (id) => {
    await supabase.from('users').update({ actif: false }).eq('id', id)
    loadData()
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERFACE DÉDIÉE : RESPONSABLE ADMINISTRATIF (3 SESSIONS DISTINCTES)
  // ═══════════════════════════════════════════════════════════════════
  if (user.role === 'responsable_administratif') {
    const masseSalariale = (postes || []).reduce((s, p) => s + (p.mensuel || 0), 0)
    const nbInscrits = eleves.filter(e => e.is_inscription).length
    const nbEleves = eleves.filter(e => !e.is_inscription).length

    // Active session among the 3 distinct sessions: 'eleves', 'rh', 'compta'
    const activeSession = ['eleves', 'rh', 'compta'].includes(tab) ? tab : 'eleves'

    return (
      <div className="app-shell">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-brand">
            <div>
              <div className="topbar-logo">IDEAL</div>
              <div className="topbar-sub">ADMINISTRATION & GESTION</div>
            </div>
          </div>
          <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationCenter user={user} role={user.role} onNavigateTab={(t, ref) => {
              setTab(t)
              if (t === 'eleves') {
                setSubTabEleve('dossiers')
                setInscriptionCiblee(ref || null)
              } else {
                setDemandeCiblee(ref || null)
              }
            }} />
            <span className="role-badge" style={{ background: 'rgba(0,168,224,0.18)', color: '#00a8e0', border: '1px solid #00a8e0', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
              Responsable Admin
            </span>
            <button className="btn-logout" onClick={onLogout}>Déconnexion</button>
          </div>
        </div>

        {/* Navigation des 3 SESSIONS DISTINCTES.
            Cette barre était un simple `flex` sans défilement : sur un
            téléphone de 375 px, la troisième session sortait de l'écran et
            restait inatteignable. Elle défile désormais horizontalement,
            comme les barres des autres comptes. */}
        <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '2px solid var(--border)', padding: '6px 12px', gap: 8, position: 'sticky', top: 51, zIndex: 99, overflowX: 'auto', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap' }}>
          <button 
            className={`top-nav-item ${activeSession === 'eleves' ? 'active' : ''}`}
            onClick={() => setTab('eleves')}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            🎓 1. Gestion Élèves
          </button>
          <button 
            className={`top-nav-item ${activeSession === 'rh' ? 'active' : ''}`}
            onClick={() => setTab('rh')}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            💼 2. RH & Paie
          </button>
          <button 
            className={`top-nav-item ${activeSession === 'compta' ? 'active' : ''}`}
            onClick={() => setTab('compta')}
            style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            💰 3. Comptabilité
          </button>
        </div>

        <div className="page-content" style={{ padding: '1.5rem 1.2rem 40px' }}>

          {/* ════════════════ SESSION 1 : GESTION ÉLÈVES ════════════════ */}
          {activeSession === 'eleves' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>🎓 Session : Gestion Élèves</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Gestion complète des élèves : inscriptions, dossiers numériques, cartes scolaires et certificats de scolarité.</p>
              </div>

              {/* Raccourcis et modules pour la Gestion Élèves */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                <a href="/inscription.html" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'linear-gradient(135deg,#00a8e0,#0078b4)', color: '#fff', padding: '18px 16px', borderRadius: 14, boxShadow: '0 4px 14px rgba(0,168,224,0.25)', cursor: 'pointer' }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>📝</div>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>Inscriptions &amp; Dossiers</div>
                    <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>{nbInscrits} nouvelles demandes</div>
                  </div>
                </a>
                <div 
                  onClick={() => setSubTabEleve('cartes')}
                  style={{ background: subTabEleve === 'cartes' ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: '18px 16px', borderRadius: 14, boxShadow: '0 4px 14px rgba(16,185,129,0.25)', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>💳</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Cartes Scolaires</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>Génération &amp; impression PDF</div>
                </div>
                <div 
                  onClick={() => setSubTabEleve('certificat')}
                  style={{ background: subTabEleve === 'certificat' ? 'linear-gradient(135deg,#1d4ed8,#1e40af)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', padding: '18px 16px', borderRadius: 14, boxShadow: '0 4px 14px rgba(59,130,246,0.25)', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>📜</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Certificat de Scolarité</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>Format portrait A4 officiel</div>
                </div>
                <div 
                  onClick={() => setSubTabEleve('liste')}
                  style={{ background: subTabEleve === 'liste' ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', padding: '18px 16px', borderRadius: 14, boxShadow: '0 4px 14px rgba(245,158,11,0.25)', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🎒</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Fiches &amp; Effectifs</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>{nbEleves} élèves actifs</div>
                </div>
                <div 
                  onClick={() => setSubTabEleve('cantine')}
                  style={{ background: subTabEleve === 'cantine' ? 'linear-gradient(135deg,#155e75,#0d2a3b)' : 'linear-gradient(135deg,#0d2a3b,#155e75)', color: '#fff', padding: '18px 16px', borderRadius: 14, boxShadow: '0 4px 14px rgba(13,42,59,0.3)', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🥗</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Cantine &amp; Budget Cuisine</div>
                  <div style={{ fontSize: 11, opacity: .9, marginTop: 2 }}>Synchronisé Cuisinière</div>
                </div>
              </div>

              {/* Contenu dynamique du module actif dans Gestion Élèves */}
              {subTabEleve === 'cartes' && <CartesScolaires eleves={eleves} classes={classes} />}
              {subTabEleve === 'certificat' && <CertificatScolarite eleves={eleves} classes={classes} />}

              {subTabEleve === 'cantine' && (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>🥗 Suivi Cantine, Inscriptions &amp; Budget de la Cuisine</h2>
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Panneau de gestion partagé avec la Cuisinière : allocation budgétaire, validation des achats du marché et suivi des allergies.</p>
                  </div>

                  {/* Section Budget & Fiche d'Utilisation du Marché */}
                  <div className="card" style={{ padding: '1.2rem', marginBottom: 20, borderLeft: '4px solid #7bc142' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0d2a3b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span>💵 Gestion du Budget &amp; Justificatif des Dépenses de la Cuisine</span>
                      <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(0,168,224,0.12)', color: 'var(--accent)', padding: '4px 12px', borderRadius: 8 }}>
                        {(ficheMarcheCantine.type_periode || 'journalier') === 'journalier' ? `📅 Budget Journalier (${ficheMarcheCantine.date_du_jour || 'Aujourd\'hui'})` : `🗓️ Budget Hebdomadaire (${ficheMarcheCantine.periode_semaine || 'Semaine'})`}
                      </span>
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: 'rgba(0,168,224,0.06)', border: '1px solid #00a8e0', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>BUDGET CANTINE ALLOUÉ (FCFA)</div>
                        <input
                          type="number"
                          className="form-input"
                          value={ficheMarcheCantine.budget || 0}
                          onChange={async (e) => {
                            const b = Number(e.target.value) || 0
                            const updated = { ...ficheMarcheCantine, budget: b }
                            setFicheMarcheCantine(updated)
                            await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_fiche_marche', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
                          }}
                          style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}
                        />
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Défini par le Responsable Administratif</div>
                      </div>

                      <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid #ef4444', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>DÉPENSES RÉELLES DU MARCHÉ</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>
                          {fcfa((ficheMarcheCantine.articles || []).reduce((s, a) => a.en_stock ? s : s + (Number(a.pu) * (parseFloat(a.quantite) || 1)), 0))}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{(ficheMarcheCantine.articles || []).length} achats saisis par la cuisinière</div>
                      </div>

                      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid #10b981', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>SOLDE DISPONIBLE (RESTE)</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', margin: '4px 0' }}>
                          {fcfa((ficheMarcheCantine.budget || 0) - (ficheMarcheCantine.articles || []).reduce((s, a) => a.en_stock ? s : s + (Number(a.pu) * (parseFloat(a.quantite) || 1)), 0))}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Synchronisé en temps réel</div>
                      </div>
                    </div>

                    {/* Tableau des Ingrédients / Fiche d'Utilisation du Marché */}
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 800 }}>🧾 Fiche d'Utilisation du Budget (Achats de la Cuisinière)</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Aliment / Ingrédient</th>
                              <th style={{ textAlign: 'center', padding: '8px 10px' }}>Quantité</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>P.U (FCFA)</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>Total (FCFA)</th>
                              <th style={{ textAlign: 'center', padding: '8px 10px' }}>Statut Payé</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ficheMarcheCantine.articles || []).map((art, idx) => {
                              const totalArt = art.en_stock ? 0 : Number(art.pu) * (parseFloat(art.quantite) || 1)
                              return (
                                <tr key={art.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{art.nom}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{art.quantite}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fcfa(art.pu)}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{fcfa(totalArt)}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <span className={`chip ${art.en_stock || art.achete ? 'chip-green' : 'chip-amber'}`}>{art.en_stock ? 'En stock' : art.achete ? '✓ Acheté' : 'À acheter'}</span>
                                  </td>
                                </tr>
                              )
                            })}
                            {(ficheMarcheCantine.articles || []).length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)' }}>Aucun achat saisi par la Cuisinière pour le moment.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Section Registre des Justificatifs du Jour Transmis par la Cuisine */}
                  <div className="card" style={{ padding: '1.2rem', marginBottom: 20, borderLeft: '4px solid #f59e0b', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0d2a3b' }}>
                          🧾 Registre des Justificatifs du Jour &amp; Fiches de Marché Transmises
                        </h3>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Feuilles d'achats validées, signées électroniquement par la Cuisinière et répertoriées dans les justificatifs du Responsable Administratif.
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', padding: '4px 12px', borderRadius: 8 }}>
                        📜 {justificatifsCuisine.length} Justificatif(s) Enregistré(s)
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Période / Date</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Signataire (Chef Cuisinière)</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px' }}>Budget Alloué</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px' }}>Total Achats</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px' }}>Solde Restant</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px' }}>Horodatage Transmission</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {justificatifsCuisine.map(justif => (
                            <tr key={justif.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0d2a3b' }}>
                                {justif.type_periode === 'journalier' ? `📅 Jour du ${justif.date_du_jour || justif.date}` : `🗓️ ${justif.periode_semaine || 'Semaine'}`}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: '#d97706' }}>
                                ✍️ {justif.signature_nom || 'Chef Cuisinière IDEAL'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                                {fcfa(justif.budget)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#dc2626' }}>
                                {fcfa(justif.total_depense)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: justif.solde >= 0 ? '#16a34a' : '#dc2626' }}>
                                {fcfa(justif.solde)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                                {justif.timestamp || justif.date}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => setSelectedJustificatif(justif)}
                                  style={{ background: '#0d2a3b', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                                >
                                  👁️ Voir / Imprimer
                                </button>
                              </td>
                            </tr>
                          ))}

                          {justificatifsCuisine.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                <div style={{ fontSize: 32, marginBottom: 6 }}>🧾</div>
                                <div style={{ fontWeight: 800, fontSize: 13 }}>Aucun justificatif transmis par la cuisine pour le moment.</div>
                                <div style={{ fontSize: 11, marginTop: 4 }}>Dès que la Cuisinière valide et signe sa fiche du marché, elle s'affichera automatiquement ici.</div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section Inscriptions Cantine & Allergies */}
                  <div className="card" style={{ padding: '1.2rem' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}>🎒 Synchronisation des Inscriptions Cantine &amp; Allergies Élèves</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Nom &amp; Prénom</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Classe</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px' }}>Inscrit à la Cantine</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Allergies Médicales</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px' }}>Restrictions Alimentaires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eleves.map(e => {
                            const estInscrit = e.cantine !== false
                            return (
                              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 800 }}>{e.prenom} {e.nom}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span className="chip chip-blue">{e.classe_nom || classes.find(c => c.id === e.classe_id)?.nom || '—'}</span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <button
                                    onClick={async () => {
                                      await majDossierCantine(e, { cantine: !estInscrit })
                                    }}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: 20,
                                      fontWeight: 800,
                                      fontSize: 11,
                                      border: 'none',
                                      cursor: 'pointer',
                                      background: estInscrit ? 'linear-gradient(135deg,#10b981,#059669)' : '#e2e8f0',
                                      color: estInscrit ? '#fff' : '#64748b'
                                    }}
                                  >
                                    {estInscrit ? '🟢 Inscrit' : '⚪ Non inscrit'}
                                  </button>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <input
                                    className="form-input"
                                    style={{ fontSize: 12, padding: '4px 8px' }}
                                    defaultValue={e.allergies || 'Aucune'}
                                    onBlur={async (evt) => {
                                      await majDossierCantine(e, { allergies: evt.target.value.trim() })
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <input
                                    className="form-input"
                                    style={{ fontSize: 12, padding: '4px 8px' }}
                                    defaultValue={e.restrictions || 'Aucune'}
                                    onBlur={async (evt) => {
                                      await majDossierCantine(e, { restrictions: evt.target.value.trim() })
                                    }}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {subTabEleve === 'dossiers' && <InscriptionsValidation inscriptions={inscriptions} directeur={user} onValidated={loadData} inscriptionCiblee={inscriptionCiblee} />}
              {subTabEleve === 'liste' && <FichesEffectifs eleves={eleves} classes={classes} onCertificat={() => setSubTabEleve('certificat')} onCarte={() => setSubTabEleve('cartes')} />}
            </div>
          )}

          {/* ════════════════ SESSION 2 : RH & PAIE ════════════════ */}
          {activeSession === 'rh' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>💼 Session : RH &amp; Paie du Personnel</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Référentiel des postes, masse salariale, émargement mensuel et fiches de paie du personnel.</p>
              </div>

              {/* Demandes RH — le responsable administratif reçoit les mêmes
                  notifications que la direction, il doit donc voir les demandes
                  et pouvoir y répondre. Sa cloche menait jusqu'ici à cet écran
                  où il n'y en avait aucune trace. */}
              <div className="card" style={{ marginBottom: 20, padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📑 Demandes RH du personnel</h3>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>
                    {(demandesRH || []).filter(d => d.statut === 'En attente').length} en attente
                  </span>
                </div>

                {(demandesRH || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>Aucune demande soumise.</div>
                ) : (demandesRH || []).map(d => (
                  <div
                    key={d.id}
                    id={`demande-${d.id}`}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', marginBottom: 8,
                      background: demandeCiblee === d.id ? 'rgba(0,168,224,0.12)' : 'transparent',
                      outline: demandeCiblee === d.id ? '2px solid var(--accent)' : 'none',
                      transition: 'background .3s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{d.user_name || 'Enseignant'}</div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                        background: d.statut === 'Approuvée' ? 'rgba(16,185,129,0.12)' : d.statut === 'Refusée' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                        color: d.statut === 'Approuvée' ? 'var(--green)' : d.statut === 'Refusée' ? 'var(--red)' : 'var(--amber)',
                      }}>{d.statut}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {d.type}{d.details?.montant ? ` · ${Number(d.details.montant).toLocaleString('fr-FR')} F` : ''}
                      {' · '}{new Date(d.date_soumission).toLocaleDateString('fr-FR')}
                    </div>
                    {d.details?.motif && <div style={{ fontSize: 12, marginTop: 4 }}>« {d.details.motif} »</div>}
                    {d.reponse_direction && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <b style={{ color: 'var(--accent)' }}>Réponse :</b> {d.reponse_direction}
                      </div>
                    )}
                    {d.statut === 'En attente' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn-sm" style={{ background: 'var(--green)', color: '#fff' }}
                          onClick={async () => { const r = prompt("Commentaire d'approbation :", 'Approuvé'); if (r !== null) await repondreDemande(d, 'Approuvée', r) }}>
                          ✓ Approuver
                        </button>
                        <button className="btn-sm" style={{ background: 'var(--red)', color: '#fff' }}
                          onClick={async () => { const r = prompt('Motif du refus :', 'Refusé'); if (r) await repondreDemande(d, 'Refusée', r) }}>
                          ✖ Refuser
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* KPI Masse Salariale */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'rgba(142,68,173,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(142,68,173,0.2)' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#8e44ad' }}>{stats.profs}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Employés actifs</div>
                </div>
                <div style={{ background: 'rgba(141,198,63,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(141,198,63,0.2)' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{fcfa(masseSalariale)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Masse salariale / mois</div>
                </div>
                <div style={{ background: 'rgba(236,0,140,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(236,0,140,0.2)' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--pink)' }}>{fcfa(masseSalariale * 12)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Masse salariale / an</div>
                </div>
              </div>

              {/* 📂 DOSSIERS DU PERSONNEL */}
              <div className="card" style={{ marginBottom: 20, padding: '1.2rem', borderLeft: '4px solid #8e44ad' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--dark)' }}>📂 Dossiers du Personnel Enseignant &amp; Administratif</h3>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Fiches individuelles, informations renseignées, codes d'accès et classes attribuées</div>
                  </div>
                  <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => { setNewProf({ prenom: '', nom: '', role: 'professeur', langue: 'fr', code_acces: '', plafond_salaire: 180000, classe_ids: [] }); setShowModal('prof') }}>
                    + Nouveau Dossier Personnel
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {(profs || []).map((p, i) => (
                    <div key={p.id || i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#8e44ad,#6c3483)', color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          {(p.prenom?.[0] || '') + (p.nom?.[0] || '')}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--dark)' }}>{p.prenom} {p.nom}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Rôle: <b style={{ color: 'var(--accent)' }}>{fmtRole(p.role)}</b> {p.langue ? `(${p.langue.toUpperCase()})` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text)', background: 'var(--card)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
                        🔑 Code d'accès : <b style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{p.code_acces}</b>
                      </div>

                      {p.role === 'professeur' && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Classes attribuées :</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(p.classe_ids || []).map(cid => (
                              <span key={cid} style={{ fontSize: 10, background: 'rgba(0,168,224,0.12)', color: '#00a8e0', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                                {classes.find(c => c.id === cid)?.nom || cid}
                              </span>
                            ))}
                            {(p.classe_ids || []).length === 0 && <span style={{ fontSize: 10, color: 'var(--red)', fontStyle: 'italic' }}>Aucune classe</span>}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11 }}>
                        <span style={{ color: 'var(--muted)' }}>Plafond: <b>{fcfa(p.plafond_salaire || 0)}</b></span>
                        <button 
                          className="btn-sm" 
                          style={{ background: 'rgba(142,68,173,0.1)', color: '#8e44ad', border: '1px solid #8e44ad', padding: '3px 8px', fontSize: 10 }}
                          onClick={() => alert(`Dossier complet de ${p.prenom} ${p.nom}\n- Code: ${p.code_acces}\n- Rôle: ${p.role}\n- Statut: Actif`)}
                        >
                          👁️ Voir Fiche
                        </button>
                      </div>
                    </div>
                  ))}
                  {(profs || []).length === 0 && (
                    <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '2rem' }}>
                      Aucun dossier personnel enregistré.
                    </div>
                  )}
                </div>
              </div>

              {/* Grille Salariale complète */}
              <div className="card" style={{ marginBottom: 20, padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💼 Référentiel des Postes &amp; Salaires</h3>
                  <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => { setPosteDraft(postes.map(p => ({ ...p }))); setShowModal('postes') }}>
                    ✏️ Éditer les Postes
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Poste / Emploi</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px' }}>Salaire Mensuel</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px' }}>Cumul Annuel (12 mois)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(postes || []).map((p, i) => (
                        <tr key={p.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.label}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fcfa(p.mensuel)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fcfa((p.mensuel || 0) * 12)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ SESSION 3 : COMPTABILITÉ ════════════════ */}
          {activeSession === 'compta' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>💰 Session : Comptabilité &amp; Finances</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Plateforme financière : gestion des frais de scolarité, reçus, dépenses et trésorerie prévisionnelle (séparée de la paie et des élèves).</p>
              </div>
              <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, #0d2a3b, #1565a0)', color: '#fff', borderRadius: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px 0' }}>Plateforme Comptabilité Financière Purifiée</h2>
                <p style={{ fontSize: 13, opacity: 0.85, maxWidth: 500, margin: '0 auto 24px' }}>
                  Accédez au portail comptable dédié pour suivre les effectifs &amp; recettes, les dépenses fixes et la trésorerie mensuelle sans aucune interférence RH.
                </p>
                <a href="/comptabilite.html" style={{ textDecoration: 'none' }}>
                  <button style={{ background: 'linear-gradient(135deg,#8DC63F,#7bc142)', color: '#0d2a3b', border: 'none', padding: '14px 32px', borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.4)' }}>
                    💵 Accéder à la Comptabilité Financière →
                  </button>
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERFACE DIRECTEUR (Organisée en 6 sessions distinctes et structurées)
  // ═══════════════════════════════════════════════════════════════════
  const DIRECTOR_SESSIONS = [
    { id: 'agenda',     icon: '🗓️', label: 'Emploi du temps & Agenda' },
    { id: 'rh',         icon: '💼', label: 'RH' },
    { id: 'personnel',  icon: '👥', label: 'Gestion du Personnel' },
    { id: 'pedagogie',  icon: '📚', label: 'Pédagogie' },
    { id: 'maternelle', icon: '🧸', label: 'Maternelle' },
    { id: 'discipline', icon: '⚖️', label: 'Discipline' },
    { id: 'synthese',   icon: '📊', label: 'Synthèse' },
  ]

  const activeDirectorTab = ['agenda', 'rh', 'personnel', 'profs', 'points', 'pedagogie', 'discipline', 'synthese', 'dashboard', 'emploi', 'maternelle'].includes(tab)
    ? tab
    : 'synthese'

  return (
    <div className="app-shell">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo">IDEAL</div>
            <div className="topbar-sub">ÉCOLE INTERNATIONALE BILINGUE</div>
          </div>
        </div>
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationCenter user={user} role={user.role || 'directeur'} onNavigateTab={(t, ref) => {
            setTab(t)
            if (t === 'eleves') {
              setSubTabEleve('dossiers')
              setInscriptionCiblee(ref || null)
            } else {
              setDemandeCiblee(ref || null)
            }
          }} />
          <span className="role-badge role-directeur">Directeur v2.5</span>
          <button className="btn-logout" onClick={onLogout}>Deconnexion</button>
        </div>
      </div>

      {/* Barre de navigation des 6 SESSIONS DIRECTEUR (Mobile-friendly Scroll horizontal sans chevauchement) */}
      {/* Un seul conteneur de defilement, et c'est `.top-nav-secondary`.
          Il y en avait deux, imbriques : la classe defile deja (overflow-x
          auto), et on l'avait enfermee dans un second conteneur defilant en
          lui imposant `width: max-content`. La classe n'avait alors plus rien
          a faire defiler, et son `overscroll-behavior-x: contain` empechait le
          geste de remonter au parent, seul a deborder vraiment : le doigt ne
          deplacait plus rien. */}
      <div className="top-nav-secondary" style={{ borderBottom: '2px solid var(--border)', boxShadow: 'none', padding: '6px 8px' }}>
          {DIRECTOR_SESSIONS.map(t => {
            const isActive = activeDirectorTab === t.id ||
              (t.id === 'agenda' && activeDirectorTab === 'emploi') ||
              (t.id === 'personnel' && (activeDirectorTab === 'profs' || activeDirectorTab === 'points')) ||
              (t.id === 'synthese' && activeDirectorTab === 'dashboard')

            return (
              <button 
                key={t.id} 
                className={`top-nav-item ${isActive ? 'active' : ''}`} 
                onClick={() => setTab(t.id)}
                style={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  padding: '9px 16px',
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{t.icon}</span> <span>{t.label}</span>
              </button>
            )
          })}
      </div>

      <div className="page-content" style={{ padding: '1.5rem 1.2rem calc(130px + env(safe-area-inset-bottom))' }}>
        {msg && <div className="error-msg" style={{background:'rgba(141,198,63,.1)',borderColor:'var(--green)',color:'var(--green)',marginBottom:'1rem'}} onClick={()=>setMsg('')}>{msg}</div>}

        {/* ════════════════ 1. EMPLOI DU TEMPS & AGENDA ════════════════ */}
        {(activeDirectorTab === 'agenda' || activeDirectorTab === 'emploi') && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>🗓️ Session : Emploi du Temps &amp; Agenda</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Gestion de l'agenda de l'établissement, événements, calendrier scolaire et plannings des cours.</p>
            </div>

            {/* Agenda & Événements */}
            <div style={{ marginBottom: 20 }}>
              <AgendaCalendrier checkpoints={checkpoints} classes={classes} periodes={periodes} isAdmin={true} anniversaires={eleves} />
            </div>

            {/* Emplois du temps par classe */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 800 }}>🗓️ Emplois du Temps par Classe</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {classes.map(c => (
                  <div key={c.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 6 }}>🏫 Classe : {c.nom}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Planning &amp; enseignants référents</div>
                    <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff', marginTop: 10, width: '100%' }} onClick={() => alert(`Emploi du temps officiel de la classe ${c.nom}`)}>
                      👁️ Voir Planning
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ 2. RH ════════════════ */}
        {activeDirectorTab === 'rh' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>💼 Session : Ressources Humaines (RH)</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Référentiel des postes, masse salariale, indemnités et émargement mensuel du personnel.</p>
            </div>

            {/* KPI Masse Salariale */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(142,68,173,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(142,68,173,0.2)' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#8e44ad' }}>{stats.profs}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Employés actifs</div>
              </div>
              <div style={{ background: 'rgba(141,198,63,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(141,198,63,0.2)' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{fcfa((postes || []).reduce((s, x) => s + (Number(x.mensuel) || 0), 0))}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Masse salariale / mois</div>
              </div>
              <div style={{ background: 'rgba(236,0,140,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid rgba(236,0,140,0.2)' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--pink)' }}>{fcfa((postes || []).reduce((s, x) => s + (Number(x.mensuel) || 0), 0) * 12)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Masse salariale / an</div>
              </div>
            </div>

            {/* Demandes RH en attente */}
            <div className="card" style={{ marginBottom: 20, padding: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📑 Demandes RH &amp; Congés du Personnel</h3>
                <span className="badge" style={{ background: 'rgba(0,168,224,0.1)', color: 'var(--accent)', fontWeight: 700, padding: '4px 10px', borderRadius: 20, fontSize: 11 }}>{(demandesRH || []).filter(d => d.statut === 'En attente').length} En attente</span>
              </div>
              {(demandesRH || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '1.5rem' }}>Aucune demande RH soumise.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Employé</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Type</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Motif</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Statut</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Décision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(demandesRH || []).map(d => (
                        <tr
                          key={d.id}
                          id={`demande-${d.id}`}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            // Encadrée quelques secondes quand on arrive par une
                            // notification : c'est ce qui fait la différence
                            // entre « la bonne page » et « la bonne ligne ».
                            background: demandeCiblee === d.id ? 'rgba(0,168,224,0.12)' : 'transparent',
                            outline: demandeCiblee === d.id ? '2px solid var(--accent)' : 'none',
                            transition: 'background .3s',
                          }}
                        >
                          {/* `prof_nom` n'a jamais existé sur ces demandes : la
                              colonne affichait « Enseignant » pour tout le monde. */}
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.user_name || 'Enseignant'}</td>
                          <td style={{ padding: '10px 12px' }}>{d.type}</td>
                          <td style={{ padding: '10px 12px' }}>{d.motif}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700, background: d.statut === 'Approuvée' ? 'rgba(16,185,129,0.1)' : d.statut === 'Refusée' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: d.statut === 'Approuvée' ? 'var(--green)' : d.statut === 'Refusée' ? 'var(--red)' : 'var(--amber)' }}>
                              {d.statut}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {d.statut === 'En attente' ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button className="btn-sm" style={{ background: 'var(--green)', color: '#fff' }} onClick={async () => { const rep = prompt('Commentaire d\'approbation :', 'Approuvé'); if (rep !== null) await repondreDemande(d, 'Approuvée', rep) }}>✓ Approuver</button>
                                <button className="btn-sm" style={{ background: 'var(--red)', color: '#fff' }} onClick={async () => { const rep = prompt('Motif du refus :', 'Refusé'); if (rep) await repondreDemande(d, 'Refusée', rep) }}>✖ Refuser</button>
                              </div>
                            ) : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Traitée</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Référentiel des Postes */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💼 Référentiel Salarial du Personnel</h3>
                <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => { setPosteDraft(postes.map(p => ({ ...p }))); setShowModal('postes') }}>
                  ✏️ Éditer les Postes
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Poste / Fonction</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Salaire Mensuel</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Cumul Annuel (12 mois)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(postes || []).map((p, i) => (
                      <tr key={p.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.label}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fcfa(p.mensuel)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fcfa((p.mensuel || 0) * 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ 3. GESTION DU PERSONNEL ════════════════ */}
        {(activeDirectorTab === 'personnel' || activeDirectorTab === 'profs' || activeDirectorTab === 'points') && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>👥 Session : Gestion du Personnel</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Gestion de l'équipe enseignante, affectations des matières/classes et système de points de performance.</p>
            </div>

            {/* Sous-onglets de Gestion du Personnel */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <button 
                className={`btn-sm ${subTabPersonnel === 'profs' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('profs')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                👥 Équipe &amp; Fiches Staff
              </button>
              <button 
                className={`btn-sm ${subTabPersonnel === 'activite' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('activite')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                📊 Activité du Personnel
              </button>
              <button 
                className={`btn-sm ${subTabPersonnel === 'matieres' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('matieres')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                📚 Affectations des Matières
              </button>
              <button 
                className={`btn-sm ${subTabPersonnel === 'points' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSubTabPersonnel('points')}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                🏆 Points &amp; Primes
              </button>
            </div>

            {/* Sous-module Équipe */}
            {subTabPersonnel === 'profs' && (
              <div className="card" style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>👥 Équipe Enseignante &amp; Personnel ({profs.length})</h3>
                  <button className="btn-sm" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => setShowModal('prof')}>
                    + Ajouter un membre
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {profs.map(p => (
                    <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)' }}>{p.prenom} {p.nom}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 8px' }}>Rôle: <b style={{ color: 'var(--accent)' }}>{fmtRole(p.role)}</b></div>
                      <div style={{ fontSize: 11, background: 'var(--card)', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
                        🔑 Code : <b style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{p.code_acces}</b>
                      </div>
                      <button className="btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid var(--red)', width: '100%' }} onClick={() => deleteProf(p.id)}>
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sous-module Affectations */}
            {subTabPersonnel === 'activite' && <ActivitePersonnel user={user} />}

            {subTabPersonnel === 'matieres' && (
              <AffectationsMatieres classes={classes} profs={profs} disciplines={disciplines} />
            )}

            {/* Sous-module Points & Primes */}
            {subTabPersonnel === 'points' && (() => {
              const maxAnnee = pointsMaxAnnee(pointsConfig)
              const n = equipePoints.length
              const moyenne = n ? equipePoints.reduce((s, e) => s + e.calc.pourcentage, 0) / n : 0
              const coutActuel = equipePoints.reduce((s, e) => s + e.ete.total, 0)
              const plafond = n * pointsConfig.enveloppeEte
              return (
                <div>
                  <div className="section-head" style={{ marginBottom: 14 }}>
                    <div className="section-title">Points &amp; prime d'été</div>
                    <button className="btn-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => setShowModal('bareme')}>⚙️ Barème</button>
                  </div>

                  <div className="kpi-grid" style={{ marginBottom: 16 }}>
                    <div className="kpi-card kpi-accent">
                      <div className="kpi-value">{Math.round(moyenne)}%</div>
                      <div className="kpi-label">Moyenne de l'équipe</div>
                    </div>
                    <div className="kpi-card kpi-green">
                      <div className="kpi-value" style={{ fontSize: 18 }}>{fcfa(coutActuel)}</div>
                      <div className="kpi-label">Prime d'été actuelle</div>
                    </div>
                    <div className="kpi-card kpi-amber">
                      <div className="kpi-value" style={{ fontSize: 18 }}>{fcfa(plafond)}</div>
                      <div className="kpi-label">Plafond à 100 %</div>
                    </div>
                    <div className="kpi-card kpi-pink">
                      <div className="kpi-value">{maxAnnee}</div>
                      <div className="kpi-label">Points max / an</div>
                    </div>
                  </div>

                  {/* Classement des enseignants */}
                  {equipePoints.map((e, i) => (
                    <div key={e.prof.id} className="card" style={{ marginBottom: 10, padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{e.nomComplet}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.calc.total} / {e.calc.max} pts · {e.calc.pourcentage}%</div>
                        </div>
                        <span className="chip chip-green" style={{ fontSize: 12, fontWeight: 800 }}>{fcfa(e.ete.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* ════════════════ 4. PÉDAGOGIE ════════════════ */}
        {activeDirectorTab === 'pedagogie' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>📚 Session : Suivi Pédagogique</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Fiches de préparations de cours déposées par les professeurs et avancement des programmes.</p>
            </div>

            <div className="card" style={{ padding: '1.2rem' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800 }}>📚 Fiches de Préparation Déposées ({preparations.length})</h3>
              {preparations.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Aucune préparation de cours enregistrée.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {preparations.map((prep, i) => {
                    // `prep.titre` et `prep.classe_nom` n'ont jamais existé dans
                    // la table : les dix-sept cartes affichaient « Préparation
                    // sans titre » et « Classe : — ». Les données étaient là,
                    // sous d'autres noms.
                    //
                    // Deux formes de préparation coexistent, et la carte doit
                    // lire les deux. Les quinze dépôts d'origine portent un
                    // fichier et une classe liée, sans matière ni contenu. Les
                    // fiches saisies depuis l'emploi du temps portent matière,
                    // groupe et rubriques, mais pas de classe liée.
                    const st   = statutDe(prep.status)
                    const aTemps = ponctualiteAuDepot(prep)
                    const classe = prep.classes?.nom || prep.groupe || '—'
                    const prof = prep.users ? `${prep.users.prenom || ''} ${prep.users.nom || ''}`.trim() : null
                    const objectif = prep.contenu?.objectif
                    const frise = Array.isArray(prep.historique_statuts) ? prep.historique_statuts : []
                    const ouverte = prepOuverte === prep.id
                    return (
                    <div key={prep.id || i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--dark)', minWidth: 0 }}>
                          {prep.matiere || 'Préparation'}{prep.sequence ? ` · séquence ${prep.sequence}` : ''}
                        </div>
                        <span style={{ flex: 'none', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                                       color: st.couleur, background: 'var(--card)', border: `1px solid ${st.couleur}` }}>
                          {st.icone} {libelleStatut(prep.status)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        Classe : <b>{classe}</b>{prof && <> · Enseignant : <b>{prof}</b></>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        Cours du <b>{prep.date_cours || '—'}</b>{prep.heure_cours ? ` à ${String(prep.heure_cours).slice(0, 5)}` : ''}
                        {aTemps !== null && (
                          <> · <span style={{ color: aTemps ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>
                            {aTemps ? 'déposée à temps' : 'déposée après l’échéance'}
                          </span></>
                        )}
                      </div>
                      {objectif && (
                        <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 6, lineHeight: 1.4 }}>{objectif}</div>
                      )}
                      {prep.url_doc && (
                        <a href={prep.url_doc} target="_blank" rel="noreferrer"
                           style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                          Ouvrir le document déposé
                        </a>
                      )}
                      {frise.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <button onClick={() => setPrepOuverte(ouverte ? null : prep.id)}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                           fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                            {ouverte ? '▾' : '▸'} Historique ({frise.length})
                          </button>
                          {ouverte && (
                            <div style={{ marginTop: 6, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                              {frise.map((e, k) => {
                                const r = raconter(e)
                                return (
                                  <div key={k} style={{ marginBottom: 6 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text)' }}>{r.texte}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.quand}</div>
                                    {r.commentaire && (
                                      <div style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>
                                        « {r.commentaire} »
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ 5. DISCIPLINE ════════════════ */}
        {activeDirectorTab === 'discipline' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>⚖️ Session : Discipline &amp; Suivi de Conduite</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Registre des fautes, alertes pour fautes graves et avertissements de conduite.</p>
            </div>

            <div className="card" style={{ padding: '1.2rem' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800 }}>⚖️ Registre des Signalements &amp; Incidents</h3>
              {disciplines.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Aucun incident disciplinaire signalé.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Élève</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px' }}>Motif</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Gravité</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disciplines.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.eleve_nom || 'Élève'}</td>
                          <td style={{ padding: '10px 12px' }}>{d.description || d.motif}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700, background: d.gravite === 'grave' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: d.gravite === 'grave' ? 'var(--red)' : 'var(--amber)' }}>
                              {d.gravite}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{d.statut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeDirectorTab === 'maternelle' && (
          <div className="page-content" style={{ paddingBottom: 100 }}>
            <MaternelleDirection />
          </div>
        )}

        {/* ════════════════ 6. SYNTHÈSE ════════════════ */}
        {(activeDirectorTab === 'synthese' || activeDirectorTab === 'dashboard') && (() => {
          const cpParClasse = classes.map(cl => {
            const elevesCl = eleves.filter(e => e.classe_id === cl.id)
            const cpCl = checkpoints.filter(cp => elevesCl.some(e => e.id === cp.eleve_id))
            const total = elevesCl.length * 3
            const fait = cpCl.filter(cp => cp.statut === 'validé' || cp.note !== null).length
            return { classe: cl.nom, pct: total > 0 ? Math.round(fait / total * 100) : 0, fait, total: elevesCl.length }
          })

          return (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--dark)', margin: '0 0 4px 0' }}>📊 Session : Synthèse &amp; Bilan Global</h1>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Tableau de bord général de l'établissement et indicateurs clés de performance.</p>
              </div>

              {/* KPI Cards */}
              <div className="kpi-grid" style={{ marginBottom: 20 }}>
                <div className="kpi-card kpi-accent">
                  <div className="kpi-value">{stats.profs}</div>
                  <div className="kpi-label">Enseignants</div>
                </div>
                <div className="kpi-card kpi-green">
                  <div className="kpi-value">{stats.eleves}</div>
                  <div className="kpi-label">Élèves</div>
                </div>
                <div className="kpi-card kpi-amber">
                  <div className="kpi-value">{classes.length}</div>
                  <div className="kpi-label">Classes</div>
                </div>
                <div className="kpi-card kpi-pink">
                  <div className="kpi-value">{preparations.length}</div>
                  <div className="kpi-label">Préparations</div>
                </div>
              </div>

              {/* Avancement des Check-points */}
              <div className="card" style={{ padding: '1.2rem', marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800 }}>📌 Avancement des Check-points par Classe</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {cpParClasse.map(c => (
                    <div key={c.classe} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{c.classe}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', margin: '4px 0' }}>{c.pct}%</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.fait} check-points validés</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Globale */}
              <PerformancesDirecteur />
            </div>
          )
        })()}

      </div>

      <div className="bottom-nav" role="tablist">
        {BOTTOM_TABS
          .filter(t => {
            if (user.role === 'responsable_administratif') {
              return t.id !== 'agenda'
            }
            return true
          })
          .map(t => (
          <button 
            key={t.id} 
            className={`nav-item ${tab===t.id?'active':''}`} 
            onClick={()=>setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
            aria-label={t.label}
          >
            <div className="nav-icon" aria-hidden="true">{t.icon}</div>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {showModal === 'prof' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouveau membre de l'équipe</div>
            <div className="form-group"><label className="form-label">Prénom</label><input className="form-input" value={newProf.prenom} onChange={e=>setNewProf({...newProf,prenom:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Nom</label><input className="form-input" value={newProf.nom} onChange={e=>setNewProf({...newProf,nom:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Rôle</label>
              <select className="form-select" value={newProf.role} onChange={e=>setNewProf({...newProf,role:e.target.value})}>
                <option value="professeur">Enseignant</option>
                <option value="surveillant">Surveillant</option>
                <option value="conseiller_vie_scolaire">Conseiller de vie scolaire</option>
                <option value="responsable_administratif">Responsable administratif</option>
                <option value="cuisiniere">Chef Cuisinière / Cantine</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Poste / Catégorie de paie</label>
              <select className="form-select" value={newProf.poste_id || postes.find(p => p.mensuel === newProf.plafond_salaire)?.id || ''}
                onChange={e => {
                  const p = postes.find(x => x.id === e.target.value)
                  const maternelle = /^(maitresse|assistante)-(fr|en)-mat$/.test(e.target.value)
                  const langueMat = e.target.value.includes('-en-') ? 'en' : 'fr'
                  setNewProf({
                    ...newProf,
                    poste_id: e.target.value,
                    plafond_salaire: p ? p.mensuel : newProf.plafond_salaire,
                    ...(maternelle ? { role: 'professeur', langue: langueMat } : {})
                  })
                }}>
                <option value="">— Choisir un poste —</option>
                {postes.map(p => <option key={p.id} value={p.id}>{p.label} ({fmtFCFA(p.mensuel)}/mois)</option>)}
              </select>
              <div style={{fontSize:10, color:'var(--muted)', marginTop:4}}>Liste modifiable via « 💼 Postes & salaires » (onglet Équipe) — synchronisée avec la comptabilité.</div>
              {/^(maitresse|assistante)-(fr|en)-mat$/.test(newProf.poste_id || '') && (
                <div style={{fontSize:11, color:'#0369a1', marginTop:6, fontWeight:700}}>
                  🧸 Le compte ouvrira automatiquement l’espace Maternelle ({(newProf.poste_id || '').includes('-en-') ? 'anglais' : 'français'}).
                </div>
              )}
            </div>

            {newProf.role === 'professeur' && (
              <>
                <div className="form-group">
                  <label className="form-label">Langue enseignée</label>
                  <select className="form-select" value={newProf.langue} onChange={e=>setNewProf({...newProf,langue:e.target.value})}>
                    <option value="fr">Français</option>
                    <option value="en">Anglais</option>
                    <option value="both">Les deux</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Classes attribuées</label>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, background:'rgba(255,255,255,0.05)', padding:12, borderRadius:12, border:'1px solid var(--border)'}}>
                    {classes.map(c => (
                      <label key={c.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer'}}>
                        <input 
                          type="checkbox" 
                          checked={newProf.classe_ids?.includes(c.id)} 
                          onChange={e => {
                            const ids = e.target.checked 
                              ? [...(newProf.classe_ids||[]), c.id]
                              : (newProf.classe_ids||[]).filter(id => id !== c.id)
                            setNewProf({...newProf, classe_ids: ids})
                          }} 
                        />
                        {c.nom}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Code d acces (laisser vide pour generer)</label>
              <input className="form-input code-input" value={newProf.code_acces} onChange={e=>setNewProf({...newProf,code_acces:e.target.value.toUpperCase()})} placeholder="Auto-genere" maxLength={12} />
            </div>
            <button className="btn btn-primary" onClick={saveProf} disabled={loading}>{loading?'...':'Creer le compte'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {showModal === 'bareme' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">⚙️ Barème des points</div>
            <p style={{fontSize:12, color:'var(--muted)', marginBottom:'1rem', lineHeight:1.5}}>
              Tout est modifiable. Les montants s'appliquent immédiatement au calcul de l'équipe.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Salaire de base mensuel</label>
                <input type="number" className="form-input" defaultValue={pointsConfig.salaireBase}
                  onBlur={e=>majConfig({ salaireBase: parseInt(e.target.value,10)||0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Enveloppe d'été max.</label>
                <input type="number" className="form-input" defaultValue={pointsConfig.enveloppeEte}
                  onBlur={e=>majConfig({ enveloppeEte: parseInt(e.target.value,10)||0 })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Coefficients par trimestre</label>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                {pointsConfig.trimestres.map((t, i) => (
                  <div key={t.id}>
                    <div style={{fontSize:10, color:'var(--muted)', marginBottom:3}}>{t.label}</div>
                    <input type="number" step="0.1" min="0.1" className="form-input" defaultValue={t.coef}
                      onBlur={e=>{
                        const tri = pointsConfig.trimestres.map((x,k)=> k===i ? {...x, coef: parseFloat(e.target.value)||1} : x)
                        majConfig({ trimestres: tri })
                      }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Indicateurs — points et objectif par trimestre</label>
              {pointsConfig.indicateurs.map((ind, i) => (
                <div key={ind.id} style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                  <span style={{flex:1, fontSize:12}}>{ind.label}</span>
                  <input type="number" min="0" className="form-input" style={{width:62, padding:'.4rem'}} defaultValue={ind.points}
                    onBlur={e=>{
                      const list = pointsConfig.indicateurs.map((x,k)=> k===i ? {...x, points: parseInt(e.target.value,10)||0} : x)
                      majConfig({ indicateurs: list })
                    }} />
                  <span style={{fontSize:11, color:'var(--muted)'}}>pts /</span>
                  <input type="number" min="1" className="form-input" style={{width:62, padding:'.4rem'}} defaultValue={ind.cible}
                    onBlur={e=>{
                      const list = pointsConfig.indicateurs.map((x,k)=> k===i ? {...x, cible: parseInt(e.target.value,10)||1} : x)
                      majConfig({ indicateurs: list })
                    }} />
                </div>
              ))}
              <div style={{fontSize:11, color: pointsConfig.indicateurs.reduce((s,i)=>s+i.points,0)===100 ? 'var(--green)' : 'var(--red)', marginTop:4}}>
                Total : {pointsConfig.indicateurs.reduce((s,i)=>s+i.points,0)} points bruts par trimestre {pointsConfig.indicateurs.reduce((s,i)=>s+i.points,0)===100 ? '✓' : '(viser 100)'}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Paliers — seuil, bourse enfant, formation</label>
              {pointsConfig.paliers.map((p, i) => (
                <div key={p.id} style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                  <span style={{flex:1, fontSize:12}}>{p.label}</span>
                  <input type="number" className="form-input" style={{width:56, padding:'.4rem'}} defaultValue={p.seuil}
                    onBlur={e=>{
                      const l = pointsConfig.paliers.map((x,k)=> k===i ? {...x, seuil: parseInt(e.target.value,10)||0} : x)
                      majConfig({ paliers: l })
                    }} />
                  <input type="number" className="form-input" style={{width:56, padding:'.4rem'}} defaultValue={p.bourseEnfant}
                    onBlur={e=>{
                      const l = pointsConfig.paliers.map((x,k)=> k===i ? {...x, bourseEnfant: parseInt(e.target.value,10)||0} : x)
                      majConfig({ paliers: l })
                    }} />
                  <input type="number" className="form-input" style={{width:56, padding:'.4rem'}} defaultValue={p.formation}
                    onBlur={e=>{
                      const l = pointsConfig.paliers.map((x,k)=> k===i ? {...x, formation: parseInt(e.target.value,10)||0} : x)
                      majConfig({ paliers: l })
                    }} />
                </div>
              ))}
              <div style={{fontSize:10, color:'var(--muted)'}}>seuil % · bourse enfant % · formation %</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ancienneté bourse enfant</label>
                <input type="number" min="0" className="form-input" defaultValue={pointsConfig.anciennete.bourseEnfant}
                  onBlur={e=>majConfig({ anciennete: {...pointsConfig.anciennete, bourseEnfant: parseInt(e.target.value,10)||0} })} />
              </div>
              <div className="form-group">
                <label className="form-label">Ancienneté formation</label>
                <input type="number" min="0" className="form-input" defaultValue={pointsConfig.anciennete.formation}
                  onBlur={e=>majConfig({ anciennete: {...pointsConfig.anciennete, formation: parseInt(e.target.value,10)||0} })} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Plafond annuel de la bourse d'études</label>
              <input type="number" className="form-input" defaultValue={pointsConfig.bourseEtudesPlafond}
                onBlur={e=>majConfig({ bourseEtudesPlafond: parseInt(e.target.value,10)||0 })} />
            </div>

            <button className="btn btn-primary" onClick={()=>setShowModal(null)}>Fermer</button>
          </div>
        </div>
      )}

      {showModal === 'postes' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal" style={{maxHeight:'85vh', overflowY:'auto'}}>
            <div className="modal-handle"></div>
            <div className="modal-title">💼 Postes & salaires</div>
            <div style={{fontSize:11, color:'var(--muted)', marginBottom:12}}>
              Référentiel unique des postes de l'école. Les montants alimentent la masse salariale de la comptabilité et le formulaire d'ajout de membre.
            </div>
            {posteDraft.map((p, i) => (
              <div key={i} style={{display:'flex', gap:6, alignItems:'center', marginBottom:8}}>
                <div style={{flex:1}}>
                  <input className="form-input" style={{marginBottom:4}} placeholder="Intitulé du poste" value={p.label}
                    onChange={e=>{const d=[...posteDraft]; d[i]={...d[i], label:e.target.value}; setPosteDraft(d)}} />
                  <input className="form-input" style={{fontSize:11}} placeholder="Commentaire (optionnel)" value={p.commentaire || ''}
                    onChange={e=>{const d=[...posteDraft]; d[i]={...d[i], commentaire:e.target.value}; setPosteDraft(d)}} />
                </div>
                <input className="form-input" type="number" min="0" step="5000" style={{width:110, textAlign:'right'}} placeholder="FCFA/mois" value={p.mensuel}
                  onChange={e=>{const d=[...posteDraft]; d[i]={...d[i], mensuel:e.target.value}; setPosteDraft(d)}} />
                <button aria-label="Supprimer ce poste" className="btn-sm" style={{background:'rgba(237,28,36,.1)', border:'1px solid var(--red)', color:'var(--red)', padding:'6px 8px'}}
                  onClick={()=>{if(confirm(`Supprimer le poste « ${p.label || 'sans nom'} » ?`)) setPosteDraft(posteDraft.filter((_,j)=>j!==i))}}>🗑️</button>
              </div>
            ))}
            <button className="btn-sm" style={{background:'var(--bg)', border:'1px dashed var(--border)', color:'var(--text)', width:'100%', marginBottom:12}}
              onClick={()=>setPosteDraft([...posteDraft, { id:'', label:'', mensuel:0, commentaire:'' }])}>+ Ajouter un poste</button>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, padding:'10px 0', borderTop:'1px solid var(--border)', marginBottom:10}}>
              <span>Masse salariale mensuelle</span>
              <span style={{color:'var(--accent)'}}>{fmtFCFA(posteDraft.reduce((s,p)=>s+(parseInt(p.mensuel,10)||0),0))}</span>
            </div>
            <button className="btn btn-primary" onClick={savePostes} disabled={loading}>{loading?'...':'Enregistrer le référentiel'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {showModal === 'eleve' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouvel eleve</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Prenom</label><input className="form-input" value={newEleve.prenom} onChange={e=>setNewEleve({...newEleve,prenom:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Nom</label><input className="form-input" value={newEleve.nom} onChange={e=>setNewEleve({...newEleve,nom:e.target.value})} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Classe</label>
              <select className="form-select" value={newEleve.classe_id} onChange={e=>setNewEleve({...newEleve,classe_id:e.target.value})}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone Parent (WhatsApp)</label>
              <input className="form-input" value={newEleve.parent_phone} onChange={e=>setNewEleve({...newEleve,parent_phone:e.target.value})} placeholder="+223..." />
            </div>
            <button className="btn btn-primary" onClick={saveEleve} disabled={loading}>{loading?'...':'Ajouter'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {showModal === 'evenement' && (
        <div className="modal-overlay" onClick={e=>e.target.className==='modal-overlay'&&setShowModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Nouvel événement</div>
            <div className="form-group"><label className="form-label">Titre de l événement</label><input className="form-input" value={newEvenement.titre} onChange={e=>setNewEvenement({...newEvenement,titre:e.target.value})} placeholder="Ex: Réunion Parents-Profs" /></div>
            <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={newEvenement.date_event} onChange={e=>setNewEvenement({...newEvenement,date_event:e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Description (optionnel)</label><textarea className="form-input" value={newEvenement.description} onChange={e=>setNewEvenement({...newEvenement,description:e.target.value})} rows={3} /></div>
            <button className="btn btn-primary" onClick={saveEvenement} disabled={loading}>{loading?'...':'Enregistrer'}</button>
            <button className="btn-cancel" onClick={()=>setShowModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {/* MODAL FICHE DE JUSTIFICATIF MARCHÉ SÉLECTIONNÉ (RESPONSABLE ADMINISTRATIF) */}
      {selectedJustificatif && (
        <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setSelectedJustificatif(null)} style={{ zIndex: 999999 }}>
          <div style={{ background: '#fff', borderRadius: 24, maxWidth: 880, width: '95%', maxHeight: '92vh', overflowY: 'auto', padding: 24, margin: '20px auto', position: 'relative' }}>
            <DocumentPrintStudio
              type="restauration"
              documentTitle="JUSTIFICATIF DU MARCHÉ & DÉPENSES CUISINE"
              subTitlePill={`👑 FICHE VALIDÉE ET SIGNÉE LE ${selectedJustificatif.timestamp || selectedJustificatif.date}`}
              eleveInfo={{
                nom: `SIGNÉ PAR : ${selectedJustificatif.signature_nom || 'Chef Cuisinière'}`,
                matricule: `BUDGET : ${fcfa(selectedJustificatif.budget)}`,
                classe: selectedJustificatif.type_periode === 'journalier' ? `DU ${selectedJustificatif.date_du_jour || selectedJustificatif.date}` : selectedJustificatif.periode_semaine,
                date: selectedJustificatif.timestamp || selectedJustificatif.date
              }}
              onClose={() => setSelectedJustificatif(null)}
            >
              <div style={{ background: '#fffbeb', borderRadius: 20, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#b45309' }}>BUDGET CANTINE ALLOUÉ</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0d2a3b' }}>{fcfa(selectedJustificatif.budget)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#dc2626' }}>TOTAL ACHATS DU MARCHÉ</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626' }}>{fcfa(selectedJustificatif.total_depense)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#16a34a' }}>SOLDE RESTANT (RESTE)</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: selectedJustificatif.solde >= 0 ? '#16a34a' : '#dc2626' }}>{fcfa(selectedJustificatif.solde)}</div>
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#0d2a3b' }}>🛒 Détail des Ingrédients / Aliments Achetés</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#0d2a3b', color: '#fff', fontSize: 12, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Aliment / Ingrédient</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Quantité</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Prix Unitaire</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Prix Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedJustificatif.articles || []).map((art, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>{art.nom}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{art.quantite}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fcfa(art.pu)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#16a34a' }}>
                        {fcfa((Number(art.pu) || 0) * (parseFloat(art.quantite) || 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTop: '1.5px solid #fde68a' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#047857' }}>STATUT DE TRANSMISSION :</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2a3b', marginTop: 2 }}>
                    ✅ Validé &amp; Signé par {selectedJustificatif.signature_nom || 'la Chef Cuisinière'}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#d97706', marginBottom: 4 }}>SIGNATURE ÉLECTRONIQUE</div>
                  <div style={{ border: '2px solid #d97706', borderRadius: 12, padding: '10px 20px', background: '#fffbeb', fontWeight: 900, color: '#b45309' }}>
                    ✍️ {selectedJustificatif.signature_nom || 'Chef Cuisinière IDEAL'}
                  </div>
                </div>
              </div>
            </DocumentPrintStudio>
          </div>
        </div>
      )}

    </div>
  )
}

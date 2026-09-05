import React, { Component, useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import LoginPage from './pages/LoginPage'
import DirecteurApp from './pages/DirecteurApp'
import ProfApp from './pages/ProfApp'
import SurveillantApp from './pages/SurveillantApp'
import ConseillerApp from './pages/ConseillerApp'
import CuisiniereApp from './pages/CuisiniereApp'
import SignalementIncident from './pages/SignalementIncident'
import { posteEnAnglais, useEnglishInterface } from './lib/interfaceLanguage'
import './App.css'

// ── Faut-il rendre la main à l'écran de connexion ? ──────────────────────────
//
// Une règle, un seul endroit. `getSession()` peut échouer pour deux raisons
// qui n'appellent pas la même réponse :
//
//   TRANSPORT — réseau coupé, délai dépassé, serveur momentanément muet. La
//   session existe peut-être encore ; on ne déconnecte pas. L'enseignante
//   continue de travailler, et les écritures protégées refuseront proprement
//   si le jeton manque vraiment.
//
//   DÉFINITIF — jeton de rafraîchissement invalide, expiré, révoqué, ou
//   session absente. Plus rien ne partira en `authenticated` : laisser l'écran
//   afficher quelqu'un de connecté est précisément le défaut d'origine.
//
// La frontière n'est pas devinée à partir d'un message : c'est celle que le
// SDK trace lui-même. Dans `_callRefreshToken`, il ne supprime la session que
// `if (!isAuthRetryableFetchError(error))`. On lit la même fonction que lui.
//
// Toute erreur hors de cette classe — y compris inconnue — est traitée comme
// définitive : sans session, la requête suivante part en `anon`, et il vaut
// mieux une reconnexion de trop qu'un écran qui ment.
// Non exportée : ce fichier exporte un composant, et y ajouter un export
// ordinaire casse le rafraîchissement à chaud de Vite. La garde l'extrait du
// source et l'exécute — elle vérifie le code livré, pas une copie.
const sessionPerdue = (session, error) =>
  !session && !(error && isAuthRetryableFetchError(error))

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Erreur interceptée par ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const english = Boolean(this.props.english)
      return (
        <div style={{ padding: 24, textAlign: 'center', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏫</div>
          <h2 style={{ color: '#0d2a3b', margin: '0 0 8px 0' }}>{english ? 'IDEAL School — Recovery' : 'IDEAL École — Diagnostic de Secours'}</h2>
          <p style={{ color: '#64748b', fontSize: 13, maxWidth: 420, margin: '0 0 20px 0' }}>
            {english
              ? 'A display problem occurred. Select the button below to sign in again immediately.'
              : "Une légère indisponibilité d'affichage est survenue. Cliquez ci-dessous pour vous reconnecter immédiatement."}
          </p>
          <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: 8, fontSize: 11, color: '#ef4444', marginBottom: 20, textAlign: 'left', maxWidth: 500, overflowX: 'auto', fontFamily: 'monospace' }}>
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('ideal_user')
              window.location.href = '/'
            }}
            style={{ background: 'linear-gradient(135deg, #00a8e0, #0078b4)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
          >
            {english ? '🔄 Reset & Sign in again' : '🔄 Réinitialiser & Reconnecter'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Session déposée dans le navigateur ────────────────────────────────
//
// Jusqu'au 23 août 2026, `LoginPage` lisait la ligne du compte avec
// `select('*')` et l'objet complet — code d'accès inclus — était déposé
// dans `localStorage`. Le secret dormait donc en clair sur le téléphone de
// chaque membre du personnel, parfois partagé.
//
// Liste blanche explicite plutôt que retrait des champs sensibles : une
// liste de champs interdits laisse passer tout ce qu'on n'a pas prévu, et
// c'est précisément ce qui s'est produit. Ces huit champs sont les seuls
// que le code lise réellement sur l'objet de session.
//
// La session reste falsifiable — c'est la phase 3 qui y remédiera. Ce qui
// change ici, c'est qu'elle ne transporte plus de secret.
const CHAMPS_SESSION = [
  'id', 'prenom', 'nom', 'role', 'actif',
  'fonction', 'langue', 'sexe',
]

const CHAMPS_SENSIBLES = ['code_acces', 'plafond_salaire']

const assainirSession = (u) => {
  if (!u || typeof u !== 'object') return null
  const propre = {}
  for (const champ of CHAMPS_SESSION) {
    if (u[champ] !== undefined) propre[champ] = u[champ]
  }
  return propre
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const interfaceAnglaise = posteEnAnglais(user)
  useEnglishInterface(interfaceAnglaise)

  useEffect(() => {
    const stored = localStorage.getItem('ideal_user')
    if (stored) {
      try {
        const brut = JSON.parse(stored)

        // Une session ouverte avant ce correctif transporte encore le code
        // d'accès. On ne se contente pas de l'assainir en mémoire : la
        // valeur resterait écrite sur le disque du navigateur jusqu'à la
        // prochaine déconnexion. On efface, et la personne se reconnecte
        // une fois.
        const contaminee = CHAMPS_SENSIBLES.some(c => brut && brut[c] !== undefined)

        if (contaminee) {
          localStorage.removeItem('ideal_user')
        } else {
          const propre = assainirSession(brut)
          // Réécrire si la session portait des champs inutiles : le
          // stockage converge vers la liste blanche sans déconnecter.
          if (propre && JSON.stringify(propre) !== stored) {
            localStorage.setItem('ideal_user', JSON.stringify(propre))
          }
          setUser(propre)
        }
      } catch(e) {}
    }

    // ── La session AFFICHÉE doit être la session RÉELLE ───────────────────
    //
    // `ideal_user` n'était qu'un drapeau posé dans le stockage local, sans
    // aucun lien avec la session Supabase Auth. Quand celle-ci disparaissait —
    // jeton de rafraîchissement expiré, rafraîchissement manqué — le drapeau
    // survivait : l'écran continuait d'afficher l'enseignante connectée, et
    // toutes ses requêtes partaient en `anon`. Elle lisait « permission
    // denied » sans comprendre, et sa préparation s'écrivait quand même, en
    // anonyme, portant un identifiant que le serveur n'avait jamais vérifié.
    //
    // `getSession()` lit le stockage, mais tente un rafraîchissement si le
    // jeton d'accès a expiré : hors connexion, cet appel échoue. C'est
    // `sessionPerdue` qui distingue cette panne d'une session réellement
    // morte — voir sa définition en tête de fichier.
    let annule = false
    ;(async () => {
      const { data, error } = await supabase.auth.getSession()
      if (annule) return
      if (sessionPerdue(data?.session, error)) {
        localStorage.removeItem('ideal_user')
        setUser(null)
      }
      setLoading(false)
    })()
    return () => { annule = true }
  }, [])

  // ── Rester synchronisé pendant la session ─────────────────────────────
  //
  // Un jeton peut expirer pendant que l'écran est ouvert, et un autre onglet
  // peut se déconnecter : le SDK diffuse l'événement d'un onglet à l'autre.
  //
  // `INITIAL_SESSION` est volontairement ignoré : l'effet ci-dessus décide
  // seul de l'état de départ. Deux décideurs pour le même instant, c'est un
  // nettoyage incohérent en attente.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (evenement === 'INITIAL_SESSION') return
      if (evenement !== 'SIGNED_OUT' && session) return
      localStorage.removeItem('ideal_user')
      // Réglé à `null` seulement s'il ne l'est pas déjà : React abandonne le
      // rendu quand l'état ne change pas, ce qui coupe toute boucle.
      setUser(u => (u === null ? u : null))
    })
    return () => subscription.unsubscribe()
  }, [])

  // Une correction faite par la Direction doit aussi atteindre le compte du
  // membre déjà connecté. Sans cette synchronisation, son nom ou sa fonction
  // resterait ancien dans le bandeau jusqu'à sa prochaine déconnexion.
  useEffect(() => {
    if (!user?.id) return undefined

    let lectureEnCours = false
    const actualiserProfil = async () => {
      if (lectureEnCours) return
      lectureEnCours = true
      try {
        const { data, error } = await supabase.from('users')
          .select(CHAMPS_SESSION.join(','))
          .eq('id', user.id)
          .maybeSingle()
        if (error || !data) return
        const propre = assainirSession(data)
        if (!propre) return
        const serialise = JSON.stringify(propre)
        localStorage.setItem('ideal_user', serialise)
        setUser(actuel => JSON.stringify(actuel) === serialise ? actuel : propre)
      } finally {
        lectureEnCours = false
      }
    }

    const auRetour = () => {
      if (document.visibilityState === 'visible') actualiserProfil()
    }
    document.addEventListener('visibilitychange', auRetour)
    const canal = supabase.channel(`profil-session-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}`,
      }, actualiserProfil)
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', auRetour)
      supabase.removeChannel(canal)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      document.title = "Connexion - IDEAL EcoleApp"
    } else {
      const poste = String(user.fonction || '').toLowerCase()
      const roleMap = {
        'directeur': 'Direction',
        'professeur': 'Espace Enseignant',
        'surveillant': 'Surveillance',
        'conseiller_vie_scolaire': 'Vie Scolaire',
        'responsable_administratif': 'Administration',
        'cuisiniere': 'Cuisine & Cantine'
      }
      const english = posteEnAnglais(user)
      const titreMaternelle = poste.startsWith('assistante-') ? (english ? 'Kindergarten Teaching Assistant' : 'Assistante Maternelle')
        : poste.startsWith('maitresse-') ? (english ? 'Kindergarten Teacher' : 'Maîtresse Maternelle') : null
      if (english && user.role === 'professeur') roleMap.professeur = 'Teacher Portal'
      document.title = `${titreMaternelle || roleMap[user.role] || 'Portail'} - IDEAL EcoleApp`
    }
  }, [user])

  const handleLogin = (u) => {
    if (u && u.fonction === 'cuisiniere') {
      u.role = 'cuisiniere'
    }
    // Assainissement après la réaffectation de rôle ci-dessus, pour que
    // celle-ci soit conservée.
    const propre = assainirSession(u)
    localStorage.setItem('ideal_user', JSON.stringify(propre))
    setUser(propre)
  }
  const handleLogout = async () => {
    // La session Auth d'abord. Sans cet appel, elle survivait à la
    // déconnexion : l'appareil restait porteur d'un jeton valide, et
    // l'écran de connexion s'affichait par-dessus une session ouverte.
    //
    // `signOut()` déclenche `SIGNED_OUT`, donc le nettoyage ci-dessus se
    // rejoue. Les deux gestes sont idempotents — retirer une clé absente et
    // remettre `null` sur `null` ne font rien — il n'y a donc pas deux
    // nettoyages qui se contredisent, mais le même, deux fois.
    try { await supabase.auth.signOut() }
    catch (e) { console.error('Déconnexion Auth incomplète :', e?.message || e) }
    localStorage.removeItem('ideal_user')
    setUser(null)
  }

  if (loading) return (
    <div className="splash">
      <div className="splash-icon">🏫</div>
      <div className="splash-title">IDEAL</div>
      <div className="splash-sub">École Internationale Bilingue</div>
    </div>
  )

  const renderApp = () => {
    if (!user) return <LoginPage onLogin={handleLogin} />
    const r = user.fonction === 'cuisiniere' ? 'cuisiniere' : user.role
    const poste = String(user.fonction || '').toLowerCase()
    if (poste.startsWith('maitresse-') || poste.startsWith('assistante-')) {
      return <ProfApp user={user} onLogout={handleLogout} />
    }
    if (r === 'directeur' || r === 'responsable_administratif') {
      return <DirecteurApp user={user} onLogout={handleLogout} />
    }
    if (r === 'professeur') return <ProfApp user={user} onLogout={handleLogout} />
    if (r === 'surveillant') return <SurveillantApp user={user} onLogout={handleLogout} />
    if (r === 'conseiller_vie_scolaire') return <ConseillerApp user={user} onLogout={handleLogout} />
    if (r === 'cuisiniere') return <CuisiniereApp user={{...user, role: 'cuisiniere'}} onLogout={handleLogout} />
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <ErrorBoundary key={interfaceAnglaise ? 'interface-en' : 'interface-fr'} english={interfaceAnglaise}>
      {renderApp()}
      {user && user.role !== 'professeur' && !/^(maitresse|assistante)-/.test(String(user.fonction || '').toLowerCase()) && <SignalementIncident user={user} flottant />}
    </ErrorBoundary>
  )
}

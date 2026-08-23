import React, { Component, useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DirecteurApp from './pages/DirecteurApp'
import ProfApp from './pages/ProfApp'
import SurveillantApp from './pages/SurveillantApp'
import ConseillerApp from './pages/ConseillerApp'
import CuisiniereApp from './pages/CuisiniereApp'
import SignalementIncident from './pages/SignalementIncident'
import { posteEnAnglais, useEnglishInterface } from './lib/interfaceLanguage'
import './App.css'

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
      return (
        <div style={{ padding: 24, textAlign: 'center', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏫</div>
          <h2 style={{ color: '#0d2a3b', margin: '0 0 8px 0' }}>IDEAL École — Diagnostic de Secours</h2>
          <p style={{ color: '#64748b', fontSize: 13, maxWidth: 420, margin: '0 0 20px 0' }}>
            Une légère indisponibilité d'affichage est survenue. Cliquez ci-dessous pour vous reconnecter immédiatement.
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
            🔄 Réinitialiser &amp; Reconnecter
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
// c'est précisément ce qui s'est produit. Ces neuf champs sont les seuls
// que le code lise réellement sur l'objet de session.
//
// La session reste falsifiable — c'est la phase 3 qui y remédiera. Ce qui
// change ici, c'est qu'elle ne transporte plus de secret.
const CHAMPS_SESSION = [
  'id', 'prenom', 'nom', 'role', 'actif',
  'fonction', 'langue', 'poste_id', 'custom_role',
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
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) {
      document.title = "Connexion - IDEAL EcoleApp"
    } else {
      const poste = String(user.fonction || user.poste_id || '').toLowerCase()
      const roleMap = {
        'directeur': 'Direction',
        'professeur': 'Espace Enseignant',
        'surveillant': 'Surveillance',
        'conseiller_vie_scolaire': 'Vie Scolaire',
        'responsable_administratif': 'Administration',
        'cuisiniere': 'Cuisine & Cantine'
      }
      const titreMaternelle = poste.startsWith('assistante-') ? 'Assistante Maternelle'
        : poste.startsWith('maitresse-') ? 'Maîtresse Maternelle' : null
      document.title = `${titreMaternelle || roleMap[user.role] || 'Portail'} - IDEAL EcoleApp`
    }
  }, [user])

  const handleLogin = (u) => {
    if (u && (u.fonction === 'cuisiniere' || u.custom_role === 'cuisiniere')) {
      u.role = 'cuisiniere'
    }
    // Assainissement après la réaffectation de rôle ci-dessus, pour que
    // celle-ci soit conservée.
    const propre = assainirSession(u)
    localStorage.setItem('ideal_user', JSON.stringify(propre))
    setUser(propre)
  }
  const handleLogout = () => {
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
    const r = (user.fonction === 'cuisiniere' || user.custom_role === 'cuisiniere') ? 'cuisiniere' : user.role
    const poste = String(user.fonction || user.poste_id || '').toLowerCase()
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
    <ErrorBoundary key={interfaceAnglaise ? 'interface-en' : 'interface-fr'}>
      {renderApp()}
      {user && user.role !== 'professeur' && !/^(maitresse|assistante)-/.test(String(user.fonction || user.poste_id || '').toLowerCase()) && <SignalementIncident user={user} flottant />}
    </ErrorBoundary>
  )
}

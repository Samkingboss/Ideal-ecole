import React, { Component, useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DirecteurApp from './pages/DirecteurApp'
import ProfApp from './pages/ProfApp'
import SurveillantApp from './pages/SurveillantApp'
import ConseillerApp from './pages/ConseillerApp'
import CuisiniereApp from './pages/CuisiniereApp'
import MaternelleApp from './pages/MaternelleApp'
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

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const interfaceAnglaise = posteEnAnglais(user)
  useEnglishInterface(interfaceAnglaise)

  useEffect(() => {
    const stored = localStorage.getItem('ideal_user')
    if (stored) { try { setUser(JSON.parse(stored)) } catch(e) {} }
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
    localStorage.setItem('ideal_user', JSON.stringify(u))
    setUser(u)
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
      return <MaternelleApp user={user} onLogout={handleLogout} />
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
    </ErrorBoundary>
  )
}

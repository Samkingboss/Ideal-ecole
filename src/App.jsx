import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DirecteurApp from './pages/DirecteurApp'
import ProfApp from './pages/ProfApp'
import SurveillantApp from './pages/SurveillantApp'
import './App.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('ideal_user')
    if (stored) { try { setUser(JSON.parse(stored)) } catch(e) {} }
    setLoading(false)
  }, [])

  const handleLogin = (u) => {
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

  if (!user) return <LoginPage onLogin={handleLogin} />
  if (user.role === 'directeur') return <DirecteurApp user={user} onLogout={handleLogout} />
  if (user.role === 'professeur') return <ProfApp user={user} onLogout={handleLogout} />
  if (user.role === 'surveillant') return <SurveillantApp user={user} onLogout={handleLogout} />
  return <LoginPage onLogin={handleLogin} />
}

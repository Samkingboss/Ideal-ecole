import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage({ onLogin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('code_acces', code.toUpperCase().trim())
        .eq('actif', true)
        .single()
      if (error || !data) {
        setError('Code incorrect ou compte inactif.')
        setLoading(false)
        return
      }
      onLogin(data)
    } catch(e) {
      setError('Erreur de connexion. Verifiez votre connexion internet.')
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-icon">🏫</div>
        <div className="login-title">IDEAL</div>
        <div className="login-sub">Ecole Internationale Bilingue</div>
      </div>
      <div className="login-card">
        <h2>Connexion</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Code d acces</label>
            <input
              className="form-input code-input"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Saisir votre code"
              maxLength={20}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Verification...' : 'Se connecter'}
          </button>
        </form>
        <p style={{fontSize:'12px',color:'var(--muted)',textAlign:'center',marginTop:'1rem'}}>
          Contactez la direction pour obtenir votre code acces
        </p>
      </div>
    </div>
  )
}

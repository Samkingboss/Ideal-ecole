import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Événement d'installation PWA capté au plus tôt (avant le montage React)
let _installEvt = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _installEvt = e
    window.dispatchEvent(new Event('pwa-installable'))
  })
}

export default function LoginPage({ onLogin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [canInstall, setCanInstall] = useState(!!_installEvt)

  useEffect(() => {
    const onInstallable = () => setCanInstall(true)
    window.addEventListener('pwa-installable', onInstallable)
    return () => window.removeEventListener('pwa-installable', onInstallable)
  }, [])

  const handleInstall = async () => {
    if (_installEvt) {
      _installEvt.prompt()
      const { outcome } = await _installEvt.userChoice
      if (outcome === 'accepted') { _installEvt = null; setCanInstall(false) }
    } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      alert("Pour installer sur iPhone/iPad :\n\n1. Bouton Partager (carré avec flèche) dans Safari\n2. « Sur l'écran d'accueil »\n3. « Ajouter »")
    } else {
      alert("Ouvrez le menu du navigateur (⋮ ou ☰) puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».")
    }
  }

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
        <div className="login-icon" aria-hidden="true">🏫</div>
        <h1 className="login-title">IDEAL</h1>
        <div className="login-sub">Ecole Internationale Bilingue</div>
      </div>
      <div className="login-card">
        <h2>Connexion</h2>
        {error && <div className="error-msg" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="access-code">Code d'accès</label>
            <input
              id="access-code"
              className="form-input code-input"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Saisir votre code"
              maxLength={20}
              required
              aria-label="Code d'accès personnel"
              autoComplete="off"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Vérification...' : 'Se connecter'}
          </button>
        </form>
        <p style={{fontSize:'12px',color:'var(--muted)',textAlign:'center',marginTop:'1rem'}}>
          Contactez la direction pour obtenir votre code d'accès
        </p>
        {!window.matchMedia('(display-mode: standalone)').matches && (
          <button type="button" onClick={handleInstall}
            style={{width:'100%', marginTop:'0.75rem', background:'none', border:'1.5px dashed var(--border, #d0e8f0)', borderRadius:12, padding:'10px', color:'var(--muted)', fontSize:'13px', fontWeight:600, cursor:'pointer'}}>
            📲 Installer l'application sur ce téléphone
          </button>
        )}
      </div>
    </div>
  )
}

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

// Les codes d'accès ne contiennent que des lettres et des chiffres. Sur
// tablette, le clavier ajoute volontiers un espace après un « mot », voire un
// caractère invisible (espace insécable, largeur nulle) : le code paraît juste
// à l'écran mais la comparaison échoue. On ne garde donc que l'alphanumérique.
const normaliserCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// Une requête qui n'a pas atteint le serveur ne dit rien du code saisi.
const estPanneReseau = e => {
  const m = ((e && (e.message || e.details)) || '').toLowerCase()
  return !navigator.onLine || m.includes('fetch') || m.includes('network')
      || m.includes('timeout') || m.includes('réseau')
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
    const propre = normaliserCode(code)
    if (!propre) { setError('Saisissez votre code d\'accès.'); return }
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('code_acces', propre)
        .eq('actif', true)
        .maybeSingle()

      // Ne pas confondre « mauvais code » et « serveur injoignable » : sur une
      // connexion coupée, annoncer un code incorrect envoie chercher un
      // problème là où il n'y en a pas.
      if (error) {
        setError(estPanneReseau(error)
          ? 'Impossible de joindre le serveur. Vérifiez la connexion internet, puis réessayez.'
          : 'Connexion impossible : ' + (error.message || 'erreur inattendue'))
        setLoading(false)
        return
      }
      if (!data) {
        setError('Code incorrect ou compte inactif.')
        setLoading(false)
        return
      }
      onLogin(data)
    } catch (err) {
      setError(estPanneReseau(err)
        ? 'Impossible de joindre le serveur. Vérifiez la connexion internet, puis réessayez.'
        : 'Erreur inattendue : ' + (err.message || ''))
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
            {/* Correction et majuscules automatiques désactivées : sur
                tablette elles transforment le code sans que rien ne le
                montre. La valeur affichée est déjà celle qui sera envoyée. */}
            <input
              id="access-code"
              className="form-input code-input"
              value={code}
              onChange={e => setCode(normaliserCode(e.target.value))}
              placeholder="Saisir votre code"
              maxLength={20}
              required
              aria-label="Code d'accès personnel"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
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

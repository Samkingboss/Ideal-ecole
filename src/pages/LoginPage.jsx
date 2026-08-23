import { useState, useEffect } from 'react'
import { supabase, identifiantVersEmail } from '../lib/supabase'

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
  // L'identifiant n'est pas un secret : on peut le retenir sur un appareil
  // de confiance. Le code, jamais.
  const [identifiant, setIdentifiant] = useState(() => {
    try { return localStorage.getItem('ideal_identifiant') || '' } catch { return '' }
  })
  const [seSouvenir, setSeSouvenir] = useState(() => {
    try { return !!localStorage.getItem('ideal_identifiant') } catch { return false }
  })
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
    const ident = String(identifiant || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!ident)   { setError('Saisissez votre identifiant.'); return }
    if (!propre)  { setError('Saisissez votre code d\'accès.'); return }
    setLoading(true)
    setError('')

    // L'identifiant se retient, le code jamais.
    try {
      if (seSouvenir) localStorage.setItem('ideal_identifiant', ident)
      else localStorage.removeItem('ideal_identifiant')
    } catch { /* stockage indisponible : sans conséquence */ }
    try {
      // ── Supabase Auth fait autorité ────────────────────────────────
      //
      // L'adresse est déterministe : « bnabo » devient
      // « bnabo@comptes.ideal-ecole.ml ». Aucune requête préalable, donc
      // aucune dépendance réseau supplémentaire avant même de tenter la
      // connexion — ce qui compte quand le réseau est mauvais.
      const { data: sess, error: errAuth } = await supabase.auth.signInWithPassword({
        email: identifiantVersEmail(ident),
        password: propre,
      })

      if (!errAuth && sess?.user) {
        // Le profil IDEAL est lu par `auth.uid()`, côté serveur. Le rôle
        // ne vient plus du client : c'est toute la différence entre une
        // permission et une convention d'affichage.
        const { data: profil, error: errProfil } = await supabase.rpc('ideal_profil')
        if (errProfil || !profil) {
          setError("Votre compte existe mais aucun profil IDEAL n'y est rattaché. Signalez-le à la direction.")
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
        onLogin(Array.isArray(profil) ? profil[0] : profil)
        return
      }

      // ── Plus de repli ──────────────────────────────────────────────
      //
      // Un repli vers `authentifier_par_code` a couvert la migration. Il est
      // devenu un contournement : `--reparer-codes` a changé les mots de
      // passe Auth, pas `users_secrets`, qui détient encore les anciens
      // codes en clair. Un compte banni par Auth pouvait donc entrer par
      // cette porte avec son ancien code.
      //
      // Les treize identités Auth existent et sont vérifiées. Supabase Auth
      // fait seul autorité.
      if (estPanneReseau(errAuth)) {
        setError('Impossible de joindre le serveur. Vérifiez la connexion internet, puis réessayez.')
        setLoading(false)
        return
      }

      // GoTrue ne distingue pas un identifiant inconnu d'un mauvais code —
      // c'est délibéré, cela empêche d'énumérer les comptes. Un compte
      // désactivé, lui, est refusé explicitement.
      const banni = /banned|user_banned/i.test(errAuth?.message || '') || errAuth?.code === 'user_banned'
      setError(banni
        ? "Ce compte est désactivé. Contactez la direction."
        : 'Identifiant ou code incorrect.')
      setLoading(false)
      return
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
            <label className="form-label" htmlFor="identifiant">Identifiant</label>
            <input
              id="identifiant"
              className="form-input"
              value={identifiant}
              onChange={e => setIdentifiant(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              placeholder="ex. bnabo"
              maxLength={20}
              required
              aria-label="Identifiant de connexion"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
            />
          </div>
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
          {/* L'identifiant n'est pas un secret : le retenir évite une
              saisie quotidienne. Le code, lui, n'est jamais conservé. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                          color: 'var(--muted)', margin: '2px 0 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={seSouvenir}
                   onChange={e => setSeSouvenir(e.target.checked)} />
            Retenir mon identifiant sur cet appareil
          </label>
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

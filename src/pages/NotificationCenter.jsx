import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationCenter({ user, role, onNavigateTab }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(() => {
      loadNotifications()
    }, 15000) // Polling discret toutes les 15s
    return () => clearInterval(timer)
  }, [user?.id, role])

  const loadNotifications = async () => {
    try {
      const userKey = `notifs_${user?.id || 'guest'}`
      let list = []

      const localData = localStorage.getItem(userKey)
      if (localData) list = JSON.parse(localData)

      // Supabase fetch
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', userKey)
        .maybeSingle()

      if (data && data.value && Array.isArray(data.value)) {
        list = data.value
      } else if (list.length === 0) {
        // Exemples de démarrage personnalisés par rôle
        if (role === 'directeur' || role === 'responsable_administratif') {
          list = [
            {
              id: 1,
              titre: '🚀 Plateforme IDEAL Prête',
              message: 'Bienvenue sur le centre de pilotage global d\'IDEAL École.',
              date: new Date().toISOString(),
              lu: false,
              type: 'systeme',
              tabTarget: 'dashboard'
            },
            {
              id: 2,
              titre: '💼 Module RH & Paie Disponible',
              message: 'Les états de salaires mensuels et dossiers du personnel sont prêts.',
              date: new Date(Date.now() - 3600000).toISOString(),
              lu: false,
              type: 'rh',
              tabTarget: 'rh'
            }
          ]
        } else {
          list = [
            {
              id: 101,
              titre: '📂 Mon Dossier RH & Maternité',
              message: 'Remplissez votre dossier du personnel et vos demandes dans l\'onglet RH.',
              date: new Date().toISOString(),
              lu: false,
              type: 'rh',
              tabTarget: 'dossier'
            }
          ]
        }
      }

      setNotifications(list)
      const count = list.filter(n => !n.lu).length
      setUnreadCount(count)
    } catch (err) {
      console.error('Erreur chargement notifications:', err)
    }
  }

  const saveNotifications = async (newList) => {
    setNotifications(newList)
    setUnreadCount(newList.filter(n => !n.lu).length)
    const userKey = `notifs_${user?.id || 'guest'}`
    localStorage.setItem(userKey, JSON.stringify(newList))

    try {
      await supabase
        .from('app_state')
        .upsert({
          key: userKey,
          value: newList,
          updated_at: new Date().toISOString()
        })
    } catch (e) {
      console.error('Erreur sync notifs:', e)
    }
  }

  const handleMarkAsRead = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, lu: true } : n)
    saveNotifications(updated)
  }

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, lu: true }))
    saveNotifications(updated)
  }

  const handleNotificationClick = (notif) => {
    handleMarkAsRead(notif.id)
    setOpen(false)
    if (notif.tabTarget && onNavigateTab) {
      onNavigateTab(notif.tabTarget)
    }
  }

  const formatTime = (isoStr) => {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return 'À l\'instant'
    if (diffMin < 60) return `Il y a ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `Il y a ${diffH}h`
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Bouton Cloche 🔔 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '50%',
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: 18,
          transition: 'all 0.2s',
          outline: 'none'
        }}
        title="Centre de Notifications IDEAL"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 900,
              borderRadius: 10,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(239,68,68,0.8)',
              animation: 'pulse 2s infinite'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Tiroir des Notifications (Parfaitement cadré sur Mobile & Desktop) */}
      {open && (
        <>
          {/* Backdrop semi-transparent pour fermer au clic à l'extérieur */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              zIndex: 99990
            }}
          />

          {/* Modal / Tiroir de notification centré & sans aucun tronquage */}
          <div
            style={{
              position: 'fixed',
              top: 70,
              left: 12,
              right: 12,
              maxWidth: 400,
              margin: '0 auto',
              background: '#ffffff',
              borderRadius: 18,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 5px 15px rgba(0,0,0,0.15)',
              border: '1px solid #cbd5e1',
              zIndex: 99999,
              overflow: 'hidden',
              color: '#1e293b',
              fontFamily: 'sans-serif'
            }}
          >
            {/* Header Popover */}
            <div style={{ background: '#0d2a3b', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔔 Notifications</span>
                {unreadCount > 0 && (
                  <span style={{ background: '#00a8e0', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 900 }}>
                    {unreadCount} non lue(s)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    Tout lire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, fontWeight: 900, cursor: 'pointer', padding: 0 }}
                  title="Fermer"
                >
                  ✖
                </button>
              </div>
            </div>

            {/* Liste des notifications */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>🔕</div>
                  <b>Aucune notification pour le moment.</b>
                  <p style={{ fontSize: 11, marginTop: 4 }}>Vous recevrez les alertes RH et scolaires ici.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '13px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      background: n.lu ? '#ffffff' : 'rgba(0,168,224,0.06)',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: n.lu ? 700 : 900, fontSize: 13, color: '#0d2a3b' }}>
                        {!n.lu && <span style={{ display: 'inline-block', width: 8, height: 8, background: '#00a8e0', borderRadius: '50%', marginRight: 6 }}></span>}
                        {n.titre}
                      </div>
                      <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatTime(n.date)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Popover */}
            <div style={{ padding: '9px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                💡 Cliquez sur une alerte pour ouvrir le module concerné
              </span>
            </div>

          </div>
        </>
      )}

    </div>
  )
}

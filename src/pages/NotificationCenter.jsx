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

      {/* Popover / Tiroir des Notifications */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            width: 340,
            maxWidth: '90vw',
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 15px 35px rgba(0,0,0,0.25), 0 5px 15px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 9999,
            overflow: 'hidden',
            color: '#1e293b',
            fontFamily: 'sans-serif'
          }}
        >
          {/* Header Popover */}
          <div style={{ background: '#0d2a3b', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔔 Notifications</span>
              {unreadCount > 0 && (
                <span style={{ background: '#00a8e0', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 900 }}>
                  {unreadCount} nouvelle(s)
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Tout lire
              </button>
            )}
          </div>

          {/* Liste des notifications */}
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>🔕</div>
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    background: n.lu ? '#ffffff' : 'rgba(0,168,224,0.06)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ fontWeight: n.lu ? 600 : 800, fontSize: 12.5, color: '#0d2a3b' }}>
                      {!n.lu && <span style={{ display: 'inline-block', width: 7, height: 7, background: '#00a8e0', borderRadius: '50%', marginRight: 6 }}></span>}
                      {n.titre}
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatTime(n.date)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 3, lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Popover */}
          <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
            <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
              💡 Notifications synchronisées en temps réel · IDEAL École
            </span>
          </div>

        </div>
      )}

    </div>
  )
}

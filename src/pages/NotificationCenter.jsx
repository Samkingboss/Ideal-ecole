import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationCenter({ user, role, onNavigateTab }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushStatus, setPushStatus] = useState('default') // 'default' | 'granted' | 'denied'

  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission)
    }

    loadNotifications()
    const timer = setInterval(() => {
      loadNotifications()
    }, 8000) // Verification automatique toutes les 8s

    return () => clearInterval(timer)
  }, [user?.id, role])

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('⚠️ Les notifications push ne sont pas supportées par ce navigateur.')
      return
    }

    try {
      const perm = await Notification.requestPermission()
      setPushStatus(perm)
      if (perm === 'granted') {
        alert('✅ Notifications push activées avec succès sur cet appareil !')
        new Notification('IDEAL École', {
          body: 'Vous recevrez désormais les alertes directement sur votre écran !',
          icon: '/logo-ideal.png'
        })
      } else {
        alert('⚠️ Permission refusée ou restreinte par le navigateur.')
      }
    } catch (e) {
      console.error('Erreur demande permission push:', e)
    }
  }

  const loadNotifications = async () => {
    try {
      const activeRole = role || user?.role || 'directeur'
      const keysToFetch = [
        'notifs_global',
        `notifs_${activeRole}`,
        user?.id ? `notifs_${user.id}` : null
      ].filter(Boolean)

      let mergedNotifs = []

      // 1. Chargement local
      for (const key of keysToFetch) {
        const localData = localStorage.getItem(key)
        if (localData) {
          try {
            const parsed = JSON.parse(localData)
            if (Array.isArray(parsed)) mergedNotifs.push(...parsed)
          } catch (e) {}
        }
      }

      // 2. Chargement Supabase app_state
      const { data: rows } = await supabase
        .from('app_state')
        .select('key, value')
        .in('key', keysToFetch)

      if (rows && rows.length > 0) {
        rows.forEach(r => {
          if (r.value && Array.isArray(r.value)) {
            mergedNotifs.push(...r.value)
          }
        })
      }

      // 3. Pour la Direction & Admin: intégrer les demandes RH reçues de demandes_rh_global
      if (activeRole === 'directeur' || activeRole === 'responsable_administratif') {
        const { data: globalState } = await supabase
          .from('app_state')
          .select('value')
          .eq('key', 'demandes_rh_global')
          .maybeSingle()

        if (globalState && globalState.value && Array.isArray(globalState.value)) {
          globalState.value.forEach(d => {
            const typeLabel = d.type === 'avance' ? 'Avance de salaire' :
                              d.type === 'pret' ? 'Prêt' :
                              d.type === 'maternite' ? 'Congé Maternité' :
                              d.type === 'permission' ? 'Permission' : 'Demande RH'

            mergedNotifs.push({
              id: `dem_${d.id}`,
              titre: `📩 ${typeLabel} en attente`,
              message: `${d.user_name} a soumis une demande (${d.statut}).`,
              date: d.date_soumission,
              lu: d.statut !== 'En attente',
              type: 'rh',
              tabTarget: 'rh'
            })
          })
        }
      }

      // Déduplication par ID et tri chronologique descendant
      const uniqueMap = new Map()
      mergedNotifs.forEach(n => {
        if (!uniqueMap.has(n.id)) {
          uniqueMap.set(n.id, n)
        }
      })

      const sortedList = Array.from(uniqueMap.values()).sort((a, b) => {
        const dA = new Date(a.date || 0).getTime()
        const dB = new Date(b.date || 0).getTime()
        return dB - dA
      })

      // Déclencher une alerte système si de nouvelles notifications non lues arrivent
      const currentUnread = sortedList.filter(n => !n.lu).length
      if (currentUnread > unreadCount && unreadCount >= 0 && pushStatus === 'granted') {
        const latest = sortedList.find(n => !n.lu)
        if (latest) {
          try {
            new Notification(latest.titre, {
              body: latest.message,
              icon: '/logo-ideal.png'
            })
          } catch (e) {}
        }
      }

      setNotifications(sortedList)
      setUnreadCount(currentUnread)
    } catch (err) {
      console.error('Erreur chargement notifications:', err)
    }
  }

  const handleMarkAsRead = async (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, lu: true } : n)
    setNotifications(updated)
    setUnreadCount(updated.filter(n => !n.lu).length)
    const activeRole = role || user?.role || 'directeur'
    const key = `notifs_${activeRole}`
    localStorage.setItem(key, JSON.stringify(updated))
  }

  const handleMarkAllRead = async () => {
    const updated = notifications.map(n => ({ ...n, lu: true }))
    setNotifications(updated)
    setUnreadCount(0)
    const activeRole = role || user?.role || 'directeur'
    const key = `notifs_${activeRole}`
    localStorage.setItem(key, JSON.stringify(updated))
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
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: 19,
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
              boxShadow: '0 0 8px rgba(239,68,68,0.9)'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Tiroir des Notifications */}
      {open && (
        <>
          {/* Backdrop semi-transparent */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 99990
            }}
          />

          {/* Modal / Tiroir de notification centré sur mobile */}
          <div
            style={{
              position: 'fixed',
              top: 70,
              left: 12,
              right: 12,
              maxWidth: 420,
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

            {/* Bannière activation push téléphone */}
            {pushStatus !== 'granted' && (
              <div style={{ background: 'rgba(0,168,224,0.08)', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>
                  📲 Recevoir les bannières sur l'écran verrouillé du téléphone ?
                </div>
                <button
                  type="button"
                  onClick={requestPushPermission}
                  style={{ background: '#00a8e0', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Activer
                </button>
              </div>
            )}

            {/* Liste des notifications */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>🔕</div>
                  <b>Aucune notification pour le moment.</b>
                  <p style={{ fontSize: 11, marginTop: 4 }}>Les demandes RH et alertes scolaires apparaîtront ici.</p>
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

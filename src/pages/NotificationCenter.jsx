import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { APP_NOTIFS } from '../lib/notifications'
import { abonnementPushActif, activerNotificationsPush } from '../lib/push'

// Les notifications lues sont mémorisées par utilisateur, sur son appareil.
// Sans cela, la relecture toutes les 6 secondes recharge la version stockée
// en base — où la notification est encore « non lue » — et la pastille
// rouge revenait aussitôt après avoir été effacée.
const cleLues = user => `notifs_lus_${user?.id || 'anonyme'}`

const lireLues = user => {
  try { return new Set(JSON.parse(localStorage.getItem(cleLues(user)) || '[]')) }
  catch (e) { return new Set() }
}

const marquerLue = (user, ids) => {
  const s = lireLues(user)
  ids.forEach(id => s.add(String(id)))
  localStorage.setItem(cleLues(user), JSON.stringify([...s]))
}

// Cadence du sondage.
//
// Six secondes conviennent sur une connexion correcte. Sur un réseau lent,
// elles étaient une faute : rien n'empêchait un sondage de partir alors que le
// précédent n'était pas revenu. Un navigateur ouvre six connexions par origine ;
// une fois ces six places prises par des sondages en attente, les requêtes de
// la page elle-même font la queue derrière. L'écran restait vide, non parce que
// le serveur était lent, mais parce que l'application se bloquait elle-même.
//
// Deux règles suffisent : jamais deux sondages en vol, et un intervalle qui
// s'allonge quand le réseau peine — jusqu'à une minute — puis revient à six
// secondes dès qu'une réponse arrive vite.
const CADENCE_MIN = 6000
const CADENCE_MAX = 60000

export default function NotificationCenter({ user, role, onNavigateTab }) {
  const enVol = useRef(false)
  const cadence = useRef(CADENCE_MIN)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushStatus, setPushStatus] = useState('default') // 'default' | 'granted' | 'denied'

  useEffect(() => {
    if ('Notification' in window) {
      Promise.resolve(abonnementPushActif())
        .then(active => setPushStatus(Notification.permission === 'granted' && active ? 'granted' : 'default'))
        .catch(() => setPushStatus(Notification.permission))
    }

    loadNotifications()

    // Toutes les 6 s, mais seulement écran allumé et application au premier
    // plan. Auparavant la cloche interrogeait le serveur en continu, y compris
    // téléphone rangé : 600 requêtes par heure sur un forfait de données que
    // l'enseignant paie lui-même, pour rien. Le retour sur l'application
    // relit aussitôt, donc rien n'est perdu en réactivité.
    let timer = null
    let arrete = false

    const relire = async () => {
      if (arrete) return
      // Écran éteint ou application en arrière-plan : ne rien demander.
      if (document.visibilityState !== 'visible') return
      // Un sondage est déjà parti : le suivant attendra son retour. C'est
      // cette règle, et elle seule, qui empêche la file de grossir.
      if (enVol.current) return
      enVol.current = true
      const debut = Date.now()
      try {
        await loadNotifications()
        const duree = Date.now() - debut
        // Le réseau répond vite : on revient à la cadence nominale. Il peine :
        // on double, jusqu'au plafond. La cloche reste utile sans occuper la
        // place des données de la page.
        cadence.current = duree < 1500
          ? CADENCE_MIN
          : Math.min(CADENCE_MAX, Math.max(CADENCE_MIN, cadence.current * 2))
      } catch {
        cadence.current = Math.min(CADENCE_MAX, cadence.current * 2)
      } finally {
        enVol.current = false
      }
    }

    // `setTimeout` réarmé plutôt que `setInterval` : l'intervalle doit pouvoir
    // changer entre deux tours, ce qu'un `setInterval` ne permet pas.
    const programmer = () => {
      timer = setTimeout(async () => { await relire(); if (!arrete) programmer() }, cadence.current)
    }
    programmer()

    // Le retour sur l'application relit tout de suite : rien n'est perdu en
    // réactivité, et la cadence repart de son plancher.
    const auRetour = () => {
      if (document.visibilityState === 'visible') { cadence.current = CADENCE_MIN; relire() }
    }
    document.addEventListener('visibilitychange', auRetour)

    return () => {
      arrete = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [user?.id, role])

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('⚠️ Les notifications push ne sont pas supportées par ce navigateur.')
      return
    }

    try {
      const { registration } = await activerNotificationsPush(user, role || user?.role)
      setPushStatus('granted')
      await registration.showNotification('IDEAL École', {
        body: 'Les notifications sont activées, même lorsque l’application est fermée.',
        icon: '/icons/icon-192.png',
        data: { url: '/' }
      })
      alert('✅ Notifications activées sur cet appareil.')
    } catch (e) {
      console.error('Erreur demande permission push:', e)
      setPushStatus(Notification.permission)
      const messages = {
        connexion_securisee_requise: 'Les notifications nécessitent la version sécurisée HTTPS de l’application.',
        push_non_supporte: 'Ce navigateur ne prend pas en charge les notifications en arrière-plan.',
        permission_refusee: 'La permission a été refusée. Autorisez les notifications dans les réglages du navigateur.',
      }
      alert(`⚠️ ${messages[e?.message] || `Activation impossible : ${e?.message || 'erreur inconnue'}`}`)
    }
  }

  const loadNotifications = async () => {
    try {
      const activeRole = role || user?.role || 'prof'
      const isDirector = activeRole === 'directeur' || activeRole === 'responsable_administratif'

      // Clés écoutées : celle de son propre rôle, la sienne en propre, et le
      // canal général. Auparavant tout rôle autre que la direction lisait
      // `notifs_prof` : le surveillant, la cuisinière et le conseiller
      // recevaient les messages des enseignants et jamais les leurs.
      // Deux façons de nommer un même rôle cohabitent : le libellé court passé
      // par l'écran (« prof », « conseiller ») et le rôle canonique du compte
      // (« professeur », « conseiller_vie_scolaire »). On écoute les deux,
      // sinon un message adressé à l'un serait invisible à l'autre.
      const keysToFetch = [...new Set([
        `notifs_${activeRole}`,
        user?.role ? `notifs_${user.role}` : null,
        'notifs_global',
        user?.id ? `notifs_${user.id}` : null,
        // La direction et l'administratif se relaient mutuellement.
        ...(isDirector ? ['notifs_directeur', 'notifs_responsable_administratif'] : []),
      ].filter(Boolean))]

      let mergedNotifs = []

      // 1. Chargement Supabase app_state
      const { data: rows } = await supabase
        .from('app_state')
        .select('key, value')
        .eq('app', APP_NOTIFS)
        .in('key', keysToFetch)

      if (rows && rows.length > 0) {
        rows.forEach(r => {
          if (r.value && Array.isArray(r.value)) {
            mergedNotifs.push(...r.value)
          }
        })
      }

      // 2. Chargement local complémentaire
      for (const key of keysToFetch) {
        const localData = localStorage.getItem(key)
        if (localData) {
          try {
            const parsed = JSON.parse(localData)
            if (Array.isArray(parsed)) mergedNotifs.push(...parsed)
          } catch (e) {}
        }
      }

      // 3. Pour la Direction & Admin uniquement : intégrer les demandes RH de demandes_rh_global
      if (isDirector) {
        const { data: globalState } = await supabase
          .from('app_state')
          .select('value')
          .eq('app', 'rh')
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
              ref: d.id,
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

      // Déduplication stricte par ID et tri chronologique dégressif
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

      // On applique l'état de lecture propre à cet utilisateur, qui prime sur
      // le `lu` stocké en base — celui-ci est commun à tous les destinataires.
      const lues = lireLues(user)
      const avecLecture = sortedList.map(n => ({ ...n, lu: n.lu || lues.has(String(n.id)) }))

      setNotifications(avecLecture)
      setUnreadCount(avecLecture.filter(n => !n.lu).length)
    } catch (err) {
      console.error('Erreur chargement notifications:', err)
    }
  }

  // On enregistre uniquement l'identifiant lu, pas la liste entière : écrire
  // la liste fusionnée dans la clé de son propre rôle y recopiait les
  // notifications des autres canaux, qui se dupliquaient à chaque relecture.
  const handleMarkAsRead = async (id) => {
    marquerLue(user, [id])
    const updated = notifications.map(n => n.id === id ? { ...n, lu: true } : n)
    setNotifications(updated)
    setUnreadCount(updated.filter(n => !n.lu).length)
  }

  const handleMarkAllRead = async () => {
    marquerLue(user, notifications.map(n => n.id))
    setNotifications(notifications.map(n => ({ ...n, lu: true })))
    setUnreadCount(0)
  }

  const handleNotificationClick = (notif) => {
    handleMarkAsRead(notif.id)
    setOpen(false)

    let target = notif.tabTarget || 'dashboard'
    const activeRole = role || user?.role || 'prof'

    if (activeRole === 'prof') {
      if (target === 'rh' || target === 'demande') target = 'demandes'
    } else if (activeRole === 'directeur' || activeRole === 'responsable_administratif') {
      if (target === 'demandes' || target === 'demande') target = 'rh'
    }

    // La référence part avec la cible : l'écran d'arrivée peut alors dérouler
    // jusqu'à la bonne ligne et la désigner, au lieu de déposer le lecteur en
    // haut d'une page où il doit retrouver de quoi on lui parle.
    if (onNavigateTab && target) {
      onNavigateTab(target, notif.ref || null)
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
                  📲 Autoriser les notifications système sur cet appareil ?
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

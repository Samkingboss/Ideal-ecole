import { supabase } from './supabase'

// `app_state` a une clé primaire composite (app, key). Toutes les
// notifications vivent sous ce même `app`.
export const APP_NOTIFS = 'notifications'

/**
 * Envoie une notification ciblée à un rôle ou un utilisateur spécifique
 * @param {string|string[]} target - Rôle ('directeur', 'responsable_administratif', 'prof') ou ID utilisateur
 * @param {object} notifData - { titre, message, type, tabTarget }
 */
export async function pushNotification(target, notifData) {
  try {
    const targets = Array.isArray(target) ? [...target] : [target]
    
    // Si la cible est le directeur, en informer aussi le responsable administratif
    if (targets.includes('directeur') && !targets.includes('responsable_administratif')) {
      targets.push('responsable_administratif')
    }

    const currentUser = JSON.parse(localStorage.getItem('ideal_user') || '{}')
    const currentRole = currentUser.role || 'prof'
    const currentUserId = currentUser.id || ''

    const newNotif = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      titre: notifData.titre,
      message: notifData.message,
      date: new Date().toISOString(),
      lu: false,
      type: notifData.type || 'info',
      tabTarget: notifData.tabTarget || 'dashboard',
      // Ce que la notification désigne précisément — l'identifiant d'une
      // demande, par exemple. Sans lui, un clic ouvre le bon écran mais laisse
      // le destinataire chercher de quoi on lui parle.
      ref: notifData.ref || null,
    }

    let echec = null
    for (const tgt of targets) {
      if (!tgt) continue
      const userKey = `notifs_${tgt}`
      let currentList = []

      // 1. Récupération Supabase en priorité
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('app', APP_NOTIFS)
        .eq('key', userKey)
        .maybeSingle()

      if (data && data.value && Array.isArray(data.value)) {
        currentList = data.value
      } else {
        const localData = localStorage.getItem(userKey)
        if (localData) {
          try { currentList = JSON.parse(localData) } catch (e) {}
        }
      }

      const updatedList = [newNotif, ...currentList.filter(n => n.id !== newNotif.id)].slice(0, 50)

      // Mettre à jour le localStorage SEULEMENT SI le compte courant est destinataire
      if (tgt === currentRole || tgt === currentUserId || tgt === 'global') {
        localStorage.setItem(userKey, JSON.stringify(updatedList))
      }

      // Upsert Supabase. `app` fait partie de la clé primaire et ne peut être
      // nulle : sans elle, chaque envoi était refusé en 400 et la
      // notification ne quittait jamais l'appareil de l'expéditeur.
      const { error } = await supabase
        .from('app_state')
        .upsert({
          app: APP_NOTIFS,
          key: userKey,
          value: updatedList,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'app,key' })

      // Une notification perdue en silence est pire que pas de notification :
      // l'expéditeur croit avoir prévenu.
      if (error) {
        console.error('Notification non transmise à', tgt, ':', error.message)
        echec = error
      }
    }
    if (echec) return false

    const params = new URLSearchParams()
    if (newNotif.tabTarget) params.set('notificationTab', newNotif.tabTarget)
    if (newNotif.ref) params.set('notificationRef', newNotif.ref)
    const pushUrl = `/?${params.toString()}`

    // La file Supabase déclenche l'Edge Function `send-web-push`. Ainsi le
    // message arrive aussi lorsque l'application n'est pas ouverte.
    const { error: pushError } = await supabase.rpc('emettre_notification_push', {
      p_cibles: targets,
      p_titre: newNotif.titre,
      p_message: newNotif.message,
      p_url: pushUrl,
      p_tag: `ideal-${newNotif.type}-${newNotif.ref || newNotif.id}`,
    })
    if (pushError) {
      console.error('Notification Web Push non mise en file :', pushError.message)
      return false
    }

    // Si le compte courant fait partie des destinataires, déclencher la notification système
    const isRecipient = targets.includes(currentRole) || targets.includes(currentUserId) || targets.includes('global')
    if (isRecipient && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker?.ready
        if (registration) await registration.showNotification(newNotif.titre, {
          body: newNotif.message,
          icon: '/icons/icon-192.png',
          data: { url: pushUrl }
        })
      } catch (e) {
        console.log('Push système error:', e)
      }
    }

    return true
  } catch (err) {
    console.error('Erreur pushNotification:', err)
    return false
  }
}

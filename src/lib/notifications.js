import { supabase } from './supabase'

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
      tabTarget: notifData.tabTarget || 'dashboard'
    }

    for (const tgt of targets) {
      if (!tgt) continue
      const userKey = `notifs_${tgt}`
      let currentList = []

      // 1. Récupération Supabase en priorité
      const { data } = await supabase
        .from('app_state')
        .select('value')
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

      // Upsert Supabase
      await supabase
        .from('app_state')
        .upsert({
          key: userKey,
          value: updatedList,
          updated_at: new Date().toISOString()
        })
    }

    // Si le compte courant fait partie des destinataires, déclencher la notification système
    const isRecipient = targets.includes(currentRole) || targets.includes(currentUserId) || targets.includes('global')
    if (isRecipient && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(newNotif.titre, {
          body: newNotif.message,
          icon: '/logo-ideal.png'
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

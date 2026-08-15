import { supabase } from './supabase'

/**
 * Envoie une notification ciblée aux rôles ou utilisateurs
 * @param {string|string[]} target - Rôle ('directeur', 'responsable_administratif', 'prof') ou ID utilisateur
 * @param {object} notifData - { titre, message, type, tabTarget }
 */
export async function pushNotification(target, notifData) {
  try {
    const targets = Array.isArray(target) ? [...target] : [target]
    
    // Assurer que le directeur et le responsable administratif reçoivent les alertes RH
    if (targets.includes('directeur') && !targets.includes('responsable_administratif')) {
      targets.push('responsable_administratif')
    }
    if (!targets.includes('global')) {
      targets.push('global')
    }

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

      const localData = localStorage.getItem(userKey)
      if (localData) {
        try { currentList = JSON.parse(localData) } catch (e) {}
      }

      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', userKey)
        .maybeSingle()

      if (data && data.value && Array.isArray(data.value)) {
        currentList = data.value
      }

      const updatedList = [newNotif, ...currentList.filter(n => n.id !== newNotif.id)].slice(0, 50)
      localStorage.setItem(userKey, JSON.stringify(updatedList))

      await supabase
        .from('app_state')
        .upsert({
          key: userKey,
          value: updatedList,
          updated_at: new Date().toISOString()
        })
    }

    // Affichage immédiat en notification système si permise sur cet appareil
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(newNotif.titre, {
          body: newNotif.message,
          icon: '/logo-ideal.png',
          badge: '/logo-ideal.png'
        })
      } catch (e) {
        console.log('Notification système local error:', e)
      }
    }

    return true
  } catch (err) {
    console.error('Erreur pushNotification:', err)
    return false
  }
}

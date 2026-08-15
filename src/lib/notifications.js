import { supabase } from './supabase'

/**
 * Envoie une notification à un utilisateur ou à un rôle spécifique
 * @param {string} userId - ID de l'utilisateur ou rôle ('directeur', 'responsable_administratif', 'prof')
 * @param {object} notifData - { titre, message, type, tabTarget }
 */
export async function pushNotification(userId, notifData) {
  try {
    const userKey = `notifs_${userId}`
    let currentList = []

    const localData = localStorage.getItem(userKey)
    if (localData) currentList = JSON.parse(localData)

    const { data } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', userKey)
      .maybeSingle()

    if (data && data.value && Array.isArray(data.value)) {
      currentList = data.value
    }

    const newNotif = {
      id: Date.now(),
      titre: notifData.titre,
      message: notifData.message,
      date: new Date().toISOString(),
      lu: false,
      type: notifData.type || 'info',
      tabTarget: notifData.tabTarget || 'dashboard'
    }

    const updatedList = [newNotif, ...currentList]
    localStorage.setItem(userKey, JSON.stringify(updatedList))

    await supabase
      .from('app_state')
      .upsert({
        key: userKey,
        value: updatedList,
        updated_at: new Date().toISOString()
      })

    return true
  } catch (err) {
    console.error('Erreur pushNotification:', err)
    return false
  }
}

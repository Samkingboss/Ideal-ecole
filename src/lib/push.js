import { supabase } from './supabase'

// Clé publique uniquement : elle est destinée à être embarquée dans le navigateur.
// La clé privée VAPID reste exclusivement dans les secrets de l'Edge Function.
const VAPID_PUBLIC_KEY = 'BJ5ub-KROIJ00zz_MmP0KNsVJhzPUUyUcETBjYzBYzmfDnRBUuOijvYdPorlAR3ZJmt_zWSpCU2UtH9bAH9XVZI'

const base64UrlToUint8Array = (value) => {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

export async function abonnementPushActif() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const registration = await navigator.serviceWorker.ready
  return Boolean(await registration.pushManager.getSubscription())
}

export async function activerNotificationsPush(user, role) {
  if (!window.isSecureContext) throw new Error('connexion_securisee_requise')
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('push_non_supporte')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission_refusee')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.rpc('enregistrer_abonnement_push', {
    p_user_id: String(user?.id || ''),
    p_role: role || user?.role || '',
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh || '',
    p_auth: json.keys?.auth || '',
    p_user_agent: navigator.userAgent,
  })

  if (error) {
    await subscription.unsubscribe().catch(() => {})
    throw error
  }

  return { registration, subscription }
}

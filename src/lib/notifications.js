import { supabase } from './supabase'
import { modifierListePartagee } from './etatPartage'

// `app_state` a une clé primaire composite (app, key). Toutes les
// notifications vivent sous ce même `app`.
export const APP_NOTIFS = 'notifications'

// Raison du dernier échec d'envoi. Conservée jusqu'au prochain appel, pour que
// l'écran qui a déclenché l'envoi puisse dire ce qui s'est passé.
let derniereErreur = null

/**
 * Envoie une notification ciblée à un rôle ou un utilisateur spécifique
 * @param {string|string[]} target - Rôle ('directeur', 'responsable_administratif', 'prof') ou ID utilisateur
 * @param {object} notifData - { titre, message, type, tabTarget }
 */
export async function pushNotification(target, notifData) {
  try {
    const targets = Array.isArray(target) ? [...target] : [target]
    
    // Aucune cible n'est ajoutée d'office.
    //
    // Une règle recopiait ici toute notification adressée au directeur vers le
    // responsable administratif, quel qu'en soit le sujet. Le RA recevait donc
    // le pédagogique — dépôts de préparations, retours de cycle — alors que son
    // interface n'a que trois sessions : élèves, RH, comptabilité. Il recevait
    // des messages ouvrant un onglet qui n'existe pas chez lui.
    //
    // Qui doit être prévenu se décide à l'ENVOI, où l'on sait de quoi il
    // s'agit, et se lit dans l'appel. Une règle implicite ici finissait par
    // rattraper tout ce qu'on ajoutait ailleurs.

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

      // Lire la boîte, y ajouter la notification, réécrire la boîte entière :
      // c'est ce que faisait ce code, et entre la lecture et l'écriture rien
      // n'empêchait un autre appareil de passer. Deux incidents signalés à la
      // même minute, et la direction n'en voyait qu'un — sans erreur, sans
      // trace.
      //
      // L'écriture est désormais conditionnelle à l'horodatage lu : si
      // quelqu'un a écrit entre-temps, on relit et l'on rejoue l'ajout sur la
      // liste à jour. Voir `etatPartage.js`.
      const r = await modifierListePartagee({
        app: APP_NOTIFS,
        cle: userKey,
        client: supabase,
        transformer: liste => [newNotif, ...liste.filter(n => n.id !== newNotif.id)].slice(0, 50),
      })

      // Une notification perdue en silence est pire que pas de notification :
      // l'expéditeur croit avoir prévenu.
      if (!r.ok) {
        console.error('Notification non transmise à', tgt, ':', r.raison, r.message)
        echec = { cible: tgt, message: r.message || r.raison, code: r.raison }
        continue
      }

      // Le miroir local ne sert qu'à l'affichage hors ligne du destinataire.
      // Il ne s'écrit qu'APRÈS l'accord du serveur : l'écrire avant montrait à
      // l'expéditeur une notification que la base avait refusée.
      if (tgt === currentRole || tgt === currentUserId || tgt === 'global') {
        localStorage.setItem(userKey, JSON.stringify(r.valeur))
      }
    }

    // L'écriture en base a échoué : la cloche du destinataire ne montrera
    // rien. C'est le seul cas où l'on peut dire que la notification a échoué.
    if (echec) {
      derniereErreur = { etape: 'enregistrement', ...echec }
      return false
    }

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
    // Le Web Push a échoué, mais la notification EST enregistrée : la cloche
    // du destinataire l'affichera dès qu'il ouvrira l'application.
    //
    // L'ancien code renvoyait `false` ici, ce qui faisait dire à l'expéditeur
    // « la notification a échoué » alors qu'elle était bien partie. Deux
    // pannes très différentes portaient le même message, et celui-ci était
    // faux dans un cas sur deux.
    if (pushError) {
      console.error('Notification Web Push non mise en file :', pushError.message)
      derniereErreur = { etape: 'web-push', message: pushError.message, code: pushError.code }
      return true
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

    derniereErreur = null
    return true
  } catch (err) {
    console.error('Erreur pushNotification:', err)
    derniereErreur = { etape: 'exception', message: String(err?.message || err) }
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PRÉVENIR LA DIRECTION D'UNE PRÉPARATION — SURFACE ÉTROITE
// ═══════════════════════════════════════════════════════════════════════
//
// `pushNotification` écrit directement dans `app_state`. Une session
// authentifiée n'a pas ce droit : la resoumission d'une préparation corrigée
// échouait en 42501, la direction n'était jamais prévenue.
//
// La réponse n'est pas d'ouvrir `app_state` en écriture aux enseignantes —
// l'écriture y REMPLACE la liste entière, ce qui reviendrait à donner le droit
// d'effacer la boîte du directeur. On passe par une surface qui ne laisse
// choisir qu'une chose : de quelle préparation on parle.
//
// Le serveur décide seul de l'auteur, du destinataire, du type, du libellé et
// de la référence. Il distingue lui-même le premier dépôt de la resoumission
// après correction, et refuse une préparation qui n'appartient pas à
// l'appelante.
export async function notifierPreparation(preparationId) {
  if (!preparationId) {
    derniereErreur = { etape: 'enregistrement', message: 'preparation_sans_identifiant' }
    return false
  }
  const { data, error } = await supabase.rpc('notifier_preparation', {
    p_preparation_id: preparationId,
  })
  if (error) {
    console.error('Notification de préparation refusée :', error.message)
    derniereErreur = {
      etape: 'enregistrement',
      message: error.message,
      code: error.code,
      details: error.details,
    }
    return false
  }
  // `cree: false` n'est pas un échec : la direction a déjà été prévenue pour
  // ce cycle. C'est l'idempotence qui joue — double clic, ou renvoi après une
  // réponse perdue.
  derniereErreur = null
  return data || { cree: false }
}

// Retour de la Direction vers l'enseignant propriétaire. Le client ne choisit
// jamais la cible : la RPC la relit dans `preparations.user_id`.
export async function notifierCorrectionPreparation(preparationId) {
  if (!preparationId) {
    derniereErreur = { etape: 'enregistrement', message: 'preparation_sans_identifiant' }
    return false
  }
  const { data, error } = await supabase.rpc('notifier_correction_preparation', {
    p_preparation_id: preparationId,
  })
  if (error) {
    console.error('Notification de correction refusée :', error.message)
    derniereErreur = { etape:'enregistrement', message:error.message, code:error.code, details:error.details }
    return false
  }
  derniereErreur = null
  return data || { cree:false }
}

// ── Pourquoi la dernière notification a échoué ────────────────────────────
//
// Le message « la notification a échoué » ne disait pas pourquoi, et la raison
// n'existait que dans une console que personne n'ouvre. Un enseignant à Bamako
// ne peut pas la lire, et la direction non plus.
//
// La raison est désormais conservée jusqu'au prochain envoi, et l'appelant
// peut la montrer.
export const raisonDernierEchec = () => derniereErreur

export const messageEchecLisible = () => {
  const e = derniereErreur
  if (!e) return null
  if (e.etape === 'web-push') return null   // la cloche a bien reçu : rien à signaler
  const cause = /preparation_sans_identifiant/i.test(e.message || '')
      ? 'la séquence enregistrée n\'a pas été retrouvée pour être signalée'
    : /preparation_d_un_autre_enseignant/i.test(e.message || '')
      ? 'cette préparation n\'est pas la vôtre'
    : /session_non_authentifiee/i.test(e.message || '')
      ? 'vous n\'êtes pas connectée à une session IDEAL'
    : /preparation_introuvable/i.test(e.message || '')
      ? 'la préparation n\'a pas été retrouvée en base'
    : /row-level security|not authorized|permission/i.test(e.message || '')
      ? "votre session n'a pas le droit d'écrire cette notification"
    : /JWT|expired|401/i.test(e.message || '')
      ? 'votre session a expiré'
    : /fetch|network|timeout|réseau/i.test(e.message || '')
      ? 'le serveur n\'a pas répondu'
      : e.message || 'cause inconnue'
  return `${cause} (${e.etape}${e.code ? ' · ' + e.code : ''})`
}

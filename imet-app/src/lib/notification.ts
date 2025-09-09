/* eslint-disable no-console */

// -------------------------------------------------------------
// notification.ts — utilitaires Web Push / Notifications API
// -------------------------------------------------------------
// • Détecte le support navigateur
// • Lit/demande l’autorisation
// • Enregistre le Service Worker
// • (Dé)abonne l’utilisateur au Push (VAPID)
// • Affiche une notification locale en fallback
// -------------------------------------------------------------

export type PermissionState = 'default' | 'denied' | 'granted';

export interface InitOptions {
  /** Identifiant utilisateur côté IMet (UUID) */
  userId: string;
  /** Path vers le service worker (doit être à la racine du domaine pour capter le push) */
  serviceWorkerPath?: string; // default: '/sw.js'
  /** URL pour récupérer la clé publique VAPID */
  vapidPublicKeyUrl?: string; // default: '/api/push/vapidPublicKey'
  /** Endpoint d'abonnement */
  subscribeUrl?: string; // default: '/api/push/subscribe'
  /** Endpoint de désabonnement */
  unsubscribeUrl?: string; // default: '/api/push/unsubscribe'
}

export interface ShowLocalNotificationOptions {
  body?: string;
  tag?: string;
  icon?: string;
  /** URL à ouvrir au clic (sera mise dans notification.data.url) */
  url?: string;
  /** Données additionnelles */
  data?: Record<string, any>;
}

/** Détecte la présence minimale : Notifications + SW */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator;
}

/** Détecte la présence de l’API Push (utilisée pour l’abonnement VAPID) */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'PushManager' in window
    && 'serviceWorker' in navigator;
}

/** Récupère l’état de permission Notification */
export function getNotificationPermission(): PermissionState {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission as PermissionState;
}

/**
 * Demande l’autorisation — à déclencher APRÈS un geste utilisateur (click).
 * Retourne 'granted' | 'denied' | 'default'
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch (e) {
    console.warn('Notification.requestPermission error', e);
    return getNotificationPermission();
  }
}

/** Enregistre (ou récupère) le Service Worker */
export async function registerServiceWorker(serviceWorkerPath = '/sw.js'): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service worker non supporté par ce navigateur.');
  }
  // Important: un SW doit être servi depuis la racine si on veut capter le push sur tout le scope
  const reg = await navigator.serviceWorker.getRegistration(serviceWorkerPath);
  if (reg) return reg;
  return navigator.serviceWorker.register(serviceWorkerPath);
}

/** Utilitaire pour convertir une clé base64-url en Uint8Array attendu par subscribe() */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const outputArray = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) outputArray[i] = raw.charCodeAt(i);
  return outputArray;
}

/** Récupère la clé publique VAPID depuis le backend */
async function fetchVapidPublicKey(vapidPublicKeyUrl = '/api/push/vapidPublicKey'): Promise<string> {
  const res = await fetch(vapidPublicKeyUrl, { method: 'GET' });
  if (!res.ok) throw new Error(`Impossible de récupérer la clé VAPID (${res.status})`);
  return res.text();
}

/** Abonne l’utilisateur au push et synchronise vers le backend */
export async function subscribePush(options: InitOptions): Promise<PushSubscription | null> {
  const {
    userId,
    serviceWorkerPath = '/sw.js',
    vapidPublicKeyUrl = '/api/push/vapidPublicKey',
    subscribeUrl = '/api/push/subscribe',
  } = options;

  if (!isPushSupported()) {
    console.info('[notifications] Push non supporté — on ne souscrit pas.');
    return null;
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    console.info('[notifications] Permission non accordée — on ne souscrit pas.');
    return null;
  }

  const reg = await registerServiceWorker(serviceWorkerPath);
  // Si déjà abonné, on renvoie l’existant
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await syncSubscriptionToServer(subscribeUrl, userId, existing);
    return existing;
  }

  const vapidKey = await fetchVapidPublicKey(vapidPublicKeyUrl);
  const appServerKey = urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer; // <<— conversion propre
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey,
  });

  await syncSubscriptionToServer(subscribeUrl, userId, sub);
  return sub;
}

/** Désabonne l’utilisateur du push et synchronise vers le backend */
export async function unsubscribePush(options: InitOptions): Promise<boolean> {
  const {
    userId,
    serviceWorkerPath = '/sw.js',
    unsubscribeUrl = '/api/push/unsubscribe',
  } = options;

  if (!isPushSupported()) return true;

  const reg = await registerServiceWorker(serviceWorkerPath);
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;

  // Informer le serveur (endpoint sert de clé)
  try {
    await fetch(unsubscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, endpoint: sub.endpoint }),
    });
  } catch (e) {
    console.warn('[notifications] Erreur de synchro unsubscribe', e);
  }

  return sub.unsubscribe();
}

/** Envoie l’abonnement au serveur */
async function syncSubscriptionToServer(subscribeUrl: string, userId: string, subscription: PushSubscription): Promise<void> {
  const body = {
    userId,
    subscription: subscription.toJSON(),
    userAgent: navigator.userAgent,
  };
  const res = await fetch(subscribeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn(`[notifications] Échec de synchro abonnement (${res.status})`);
  }
}

/**
 * Active “complètement” les notifications :
 * - vérifie le support
 * - demande l’autorisation (si besoin)
 * - enregistre le SW
 * - s’abonne au push (si supporté)
 *
 * À appeler APRÈS un clic utilisateur, par ex :
 *   onClick={async () => await enableNotifications({ userId: me.id })}
 */
export async function enableNotifications(options: InitOptions): Promise<{
  permission: PermissionState;
  subscribed: boolean;
}> {
  if (!isNotificationSupported()) {
    return { permission: 'denied', subscribed: false };
  }

  let permission = getNotificationPermission();
  if (permission === 'default') {
    permission = await requestNotificationPermission();
  }

  if (permission !== 'granted') {
    return { permission, subscribed: false };
  }

  try {
    await registerServiceWorker(options.serviceWorkerPath ?? '/sw.js');
  } catch (e) {
    console.warn('[notifications] Échec enregistrement SW', e);
    return { permission, subscribed: false };
  }

  try {
    const sub = await subscribePush(options);
    return { permission, subscribed: !!sub };
  } catch (e) {
    console.warn('[notifications] Échec abonnement push', e);
    return { permission, subscribed: false };
  }
}

/** Désactive (local + serveur) */
export async function disableNotifications(options: InitOptions): Promise<void> {
  try {
    await unsubscribePush(options);
  } catch (e) {
    console.warn('[notifications] disableNotifications error', e);
  }
}

/**
 * Vérifie périodiquement que :
 * - la permission est toujours “granted”
 * - l’abonnement push existe (sinon essaie de le récréer)
 *
 * Utile à appeler à la connexion, puis toutes les X heures (ou au chargement de l’app).
 */
export async function hardenSubscription(options: InitOptions): Promise<void> {
  if (!isNotificationSupported()) return;

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    // Si l’utilisateur a révoqué ou si le navigateur l’a “nettoyé”, on s’arrête.
    return;
  }

  if (!isPushSupported()) return;

  try {
    const reg = await registerServiceWorker(options.serviceWorkerPath ?? '/sw.js');
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      await subscribePush(options); // recrée et resynchronise
    }
  } catch (e) {
    console.warn('[notifications] hardenSubscription error', e);
  }
}

/**
 * Affiche une notification locale (fallback onglet ouvert).
 * • N’implique pas l’API Push : c’est immédiat et local.
 * • Utile quand un INSERT Supabase arrive en temps réel (onglet actif).
 */
export function showLocalNotification(title: string, opts: ShowLocalNotificationOptions = {}): void {
  if (!isNotificationSupported()) return;
  if (getNotificationPermission() !== 'granted') return;

  const { body, tag, icon = '/icon-192x192.png', url, data } = opts;
  const payload: NotificationOptions = {
    body,
    tag,
    icon,
    data: { url, ...(data ?? {}) },
  };

  try {
    const n = new Notification(title, payload);
    n.onclick = () => {
      try {
        if ((n as any)?.data?.url) {
          window.open((n as any).data.url, '_blank');
        }
      } catch { /* noop */ }
    };
  } catch (e) {
    console.warn('[notifications] showLocalNotification error', e);
  }
}

/**
 * Petite aide : indique si on peut proposer le bouton “Activer les notifications”
 * (support + pas déjà “granted”).
 */
export function shouldOfferEnableButton(): boolean {
  if (!isNotificationSupported()) return false;
  const p = getNotificationPermission();
  return p !== 'granted';
}

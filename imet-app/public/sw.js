/* -----------------------------------------------------------
   Service Worker IMet — Notifications & Push (2025)
   - Réception push (JSON)
   - Affichage notification riche + actions
   - Clic: focus/ouverture d’onglet vers l’URL fournie
   - Close: télémétrie éventuelle
   - Install/Activate: skipWaiting + clients.claim
   - Testing: message -> showNotification
   - pushsubscriptionchange: avertit le client
----------------------------------------------------------- */

const SW_VERSION = 'imet-sw-v1.0.0';

// ---- Utils ------------------------------------------------

/** Ouvre une URL : focus sur un client existant si possible, sinon openWindow */
async function openUrl(url) {
  if (!url) return;
  try {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Essaye de trouver un client déjà sur cette URL ou sur le même origin
    const sameOrigin = self.registration.scope?.replace(/\/+$/, '') || self.origin || '';
    const target = new URL(url, sameOrigin).href;

    // 1) Focus si un client affiche déjà la même URL exacte
    for (const client of allClients) {
      if (client.url === target && 'focus' in client) {
        await client.focus();
        return;
      }
    }
    // 2) Sinon, focus le premier client disponible et navigue-le si possible
    if (allClients.length > 0) {
      const client = allClients[0];
      if ('navigate' in client && typeof client.navigate === 'function') {
        await client.focus();
        await client.navigate(target);
        return;
      }
      if ('focus' in client) {
        await client.focus();
        // En dernier recours, ouvre une nouvelle fenêtre
      }
    }
    // 3) Nouvelle fenêtre
    if (clients.openWindow) {
      await clients.openWindow(target);
    }
  } catch (err) {
    // Dernier recours : tente openWindow
    try {
      if (clients.openWindow && url) await clients.openWindow(url);
    } catch (_) {
      // noop
    }
  }
}

/** Construit la définition d’actions en fonction des données métier */
function buildActionsFromData(data) {
  const actions = [];
  // arrival/departure checklist
  if (data?.checklist_url) {
    actions.push({ action: 'open-checklist', title: 'Voir la checklist' });
  }
  // paiement
  if (data?.payment_url) {
    actions.push({ action: 'open-payment', title: 'Payer maintenant' });
  }
  // lien générique
  if (data?.url && actions.length === 0) {
    actions.push({ action: 'open-url', title: 'Ouvrir' });
  }
  // Limite standard: max 2-3 actions
  return actions.slice(0, 3);
}

/** Normalise le payload venant de event.data (texte ou JSON) */
function parsePushData(event) {
  try {
    if (!event.data) return {};
    const maybeText = event.data.text(); // ne consomme pas encore le stream côté SW
    // Certaines implémentations nécessitent json() directement:
    // on essaye JSON d’abord, puis fallback sur text()
    try {
      const j = event.data.json();
      return j || {};
    } catch (_) {
      try {
        return JSON.parse(maybeText);
      } catch (__){
        // Fallback: message direct
        return { title: 'IMet', body: maybeText };
      }
    }
  } catch (e) {
    return {};
  }
}

/** Affiche la notification avec options enrichies */
async function showIMetNotification(payload) {
  const {
    title = 'IMet',
    body = '',
    tag,
    icon = '/icon-192x192.png',
    badge = '/icon-192x192.png',
    image, // facultatif
    data = {},
    requireInteraction = false,
    renotify = false,
    silent = false,
    timestamp, // number (ms)
  } = payload || {};

  const actions = buildActionsFromData(data);

  const options = {
    body,
    tag,
    icon,
    badge,
    data,
    actions,
    renotify,
    requireInteraction,  // utile pour notifs importantes (paiement, départ)
    silent,
  };

  if (image) options.image = image;
  if (timestamp) options.timestamp = timestamp;

  return self.registration.showNotification(title, options);
}

// ---- Lifecycle --------------------------------------------

self.addEventListener('install', (event) => {
  // Nouveau SW prend la main plus vite
  event.waitUntil(self.skipWaiting());
  // Optionnel: télémétrie
  // console.log(`[SW] Installed ${SW_VERSION}`);
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  // console.log(`[SW] Activated ${SW_VERSION}`);
});

// ---- Push handling ----------------------------------------

self.addEventListener('push', (event) => {
  // On parse le payload
  const payload = parsePushData(event) || {};
  // Normalise data.url si non présent mais checklist/payment connus
  if (payload?.data) {
    if (!payload.data.url) {
      payload.data.url = payload.data.checklist_url || payload.data.payment_url || payload.data.link || '/';
    }
  } else {
    payload.data = { url: '/' };
  }

  // Astuce: tag pour regrouper/écraser les notifs identiques
  if (!payload.tag) {
    // Exemple: type+booking_id si fourni
    const t = payload?.type || payload?.data?.type || 'imet';
    const bid = payload?.data?.booking_id || '';
    payload.tag = `imet:${t}:${bid}`;
  }

  event.waitUntil(showIMetNotification(payload));
});

// ---- Click handling ---------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  let targetUrl = data.url || '/';

  // Si l’utilisateur clique sur une action précise
  if (event.action) {
    switch (event.action) {
      case 'open-checklist':
        targetUrl = data.checklist_url || targetUrl;
        break;
      case 'open-payment':
        targetUrl = data.payment_url || targetUrl;
        break;
      case 'open-url':
      default:
        // targetUrl déjà défini
        break;
    }
  }

  event.waitUntil(openUrl(targetUrl));
});

// ---- Close handling (facultatif: métriques) ----------------

self.addEventListener('notificationclose', (event) => {
  // Ici tu peux pinger ton API pour enregistrer "dismiss"
  // const { id } = event.notification.data || {};
  // fetch('/api/notifications/dismiss', { method: 'POST', body: JSON.stringify({ id }) });
});

// ---- Test local & messages depuis la page ------------------

/**
 * Permet d’envoyer depuis la page:
 * navigator.serviceWorker.controller.postMessage({
 *   type: 'TEST_NOTIFY',
 *   payload: { title: 'Test', body: 'Coucou', data: { url: '/' } }
 * });
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (type === 'TEST_NOTIFY') {
    event.waitUntil(showIMetNotification(payload || { title: 'Test IMet', body: 'OK' }));
  }
});

// ---- pushsubscriptionchange (rare mais propre) --------------

/**
 * Peut se produire si les clés changent côté UA. On ne peut pas directement
 * resouscrire ici (il faut la VAPID public key). On prévient donc les clients,
 * qui pourront appeler `enableNotifications()`/`hardenSubscription()` côté front.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
    }
  })());
});

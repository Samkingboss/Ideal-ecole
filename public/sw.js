// Service Worker IDEAL ÉcoleApp
// Stratégie : réseau d'abord (toujours la dernière version),
// cache en secours quand la connexion coupe.
const CACHE = 'ideal-v2';

// Fichiers de base mis en cache dès l'installation
const CORE = [
  '/',
  '/manifest.json',
  '/logo-ideal.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Ne jamais intercepter : autres origines (Supabase, CDN, WhatsApp) et non-GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Réponse fraîche : on la sert et on met à jour le cache
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        // Hors-ligne : version en cache, ou la page d'accueil pour les navigations
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/') : undefined))
      )
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'IDEAL École', {
    body: data.body || 'Une nouvelle information vous attend.',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'ideal-notification',
    renotify: true,
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const page of pages) {
      if ('navigate' in page) await page.navigate(url);
      return page.focus();
    }
    return self.clients.openWindow(url);
  })());
});

// Service Worker IDEAL ÉcoleApp
//
// ── Deux stratégies, parce qu'il y a deux sortes de fichiers ───────────────
//
// L'ancienne version appliquait « réseau d'abord » à tout, sans délai maximal.
// Sur une connexion qui ne répond pas, chaque fichier de l'application
// attendait le temps d'attente par défaut du navigateur avant de se rabattre
// sur le cache. Le cache existait et ne servait pas : l'application mettait
// des minutes à s'afficher alors que tout était déjà sur l'appareil.
//
//   /assets/index-A1b2C3.js   empreinte dans le nom → CACHE D'ABORD.
//                             Le contenu ne peut pas changer sans que le nom
//                             change. Servir depuis le cache est toujours juste,
//                             et instantané.
//
//   index.html, /, le reste   RÉSEAU D'ABORD, mais BORNÉ à 4 secondes.
//                             Passé ce délai, le cache répond et la mise à jour
//                             continue en arrière-plan. C'est ce qui permet
//                             d'ouvrir l'application hors couverture sans
//                             attendre un échec.
//
// La version du cache change à chaque évolution de ce fichier : `activate`
// supprime les anciennes, sans jamais toucher aux données de l'application.
const CACHE = 'ideal-v4';
const DELAI_RESEAU = 4000;

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
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Un fichier dont le nom porte une empreinte de contenu ne change jamais de
// contenu. Vite les émet sous `/assets/nom-EMPREINTE.ext`.
const aUneEmpreinte = (url) => /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(url.pathname);

const mettreEnCache = (req, res) => {
  if (res && res.ok) {
    const copie = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copie));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Ne jamais intercepter : autres origines (Supabase, CDN, WhatsApp) et non-GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // ── Fichiers à empreinte : cache d'abord ────────────────────────────────
  if (aUneEmpreinte(url)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => mettreEnCache(req, res)))
    );
    return;
  }

  // ── Tout le reste : réseau d'abord, mais borné ──────────────────────────
  //
  // `Promise.race` plutôt qu'un `AbortController` : on ne veut pas ANNULER la
  // requête réseau, seulement cesser de l'attendre. Elle continue et met le
  // cache à jour pour la prochaine ouverture.
  e.respondWith((async () => {
    const depuisReseau = fetch(req).then((res) => mettreEnCache(req, res));

    const secours = caches.match(req).then(
      (hit) => hit || (req.mode === 'navigate' ? caches.match('/') : undefined)
    );

    const enCache = await secours;
    if (!enCache) {
      // Rien en cache : il faut bien attendre le réseau.
      try { return await depuisReseau; }
      catch { return Response.error(); }
    }

    // Quelque chose en cache : le réseau a quatre secondes pour faire mieux.
    const limite = new Promise((r) => setTimeout(() => r(null), DELAI_RESEAU));
    const gagnant = await Promise.race([depuisReseau.catch(() => null), limite]);
    return gagnant || enCache;
  })());
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

const CACHE_NAME = 'gymlog-v24';
const IMG_CACHE  = 'gymlog-exercise-images'; /* persisted across version bumps */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        /* keep app shell cache for current version AND the durable image cache */
        keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  /* Cache-first strategy for exercise demo images (wger.de CDN) */
  if (/wger\.de.*\.(jpg|jpeg|png|gif|webp)/i.test(req.url)) {
    e.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(req).then(cached => {
          if (cached) return cached;
          return fetch(req).then(response => {
            if (response.ok) cache.put(req, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  /* Network-first for the HTML shell (page navigations) so a fresh deploy
     shows up immediately when online; fall back to cache when offline. This
     avoids the "I deployed but still see the old version" PWA cache trap. */
  const accept = req.headers.get('accept') || '';
  const isNav = req.mode === 'navigate' ||
    (req.method === 'GET' && accept.indexOf('text/html') !== -1);
  if (isNav) {
    e.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  /* Everything else (manifest, icons, sw assets): cache-first for speed */
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

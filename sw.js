const CACHE_NAME = 'gymlog-v14';
const IMG_CACHE  = 'gymlog-exercise-images'; /* persisted across version bumps */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
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
  /* Cache-first strategy for exercise demo images (wger.de CDN) */
  if (/wger\.de.*\.(jpg|jpeg|png|gif|webp)/i.test(e.request.url)) {
    e.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }
  /* App shell: cache-first */
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

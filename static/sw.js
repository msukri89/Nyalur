const CACHE_NAME = 'nyalur-v0.7.0';
const BASE = '/Nyalur/';
const MANIFEST = BASE + 'manifest.webmanifest';
const STATIC_ASSETS = [
  BASE,
  BASE + 'index.html',
  MANIFEST,
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.includes('peerjs') || request.url.includes('0.peerjs.com')) return;

  // Always fetch the manifest from the network first so Chrome sees the
  // current install metadata instead of a stale cached manifest.
  if (new URL(request.url).pathname === MANIFEST) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(MANIFEST))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

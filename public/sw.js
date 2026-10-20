// Offline shell (FR-14): precache the app shell, network-first for HTML,
// cache-first for hashed assets. The update flow is driven from the page.
const VERSION = '2048-oe-v2.0.0';
const CACHE = '2048-oe-' + VERSION;

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/boot.js',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon-180.png',
];

// The dev/preview server sends `Vary: Origin`; entries stored from string
// URLs carry no Origin header, so real requests (which do) would miss on the
// Vary comparison. Strip Vary before storing — safe for same-origin assets.
function cleanResponse(res) {
  const headers = new Headers(res.headers);
  headers.delete('vary');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function cachePut(cache, key, res) {
  return cache.put(key, cleanResponse(res));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(PRECACHE.map((u) => fetch(u).then((res) => cachePut(cache, u, res)))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((cache) => cachePut(cache, '/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cachePut(cache, req, copy));
          }
          return res;
        }),
    ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'WARM_CACHE') {
    // The first load is not intercepted; cache the current assets explicitly
    // so an offline reload works.
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(
          (event.data.urls || []).map((u) =>
            fetch(u)
              .then((res) => {
                if (res.ok) cachePut(cache, u, res);
              })
              .catch(() => {}),
          ),
        ),
      ),
    );
  }
});

/* Service worker de ProjecTrack.
   - Precache del shell; estrategia stale-while-revalidate para el mismo origen.
   - Todas las rutas son relativas al propio sw.js (la app vive en un subdirectorio).
   - Nunca intercepta peticiones de otros orígenes ni métodos distintos de GET.
   Para publicar cambios: sube el número de VERSION. */
'use strict';

const VERSION = 'v1';
const CACHE = 'projectrack-' + VERSION;
const PREFIX = 'projectrack-';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
  './fonts/fonts.css',
  './fonts/inter-latin-400-normal.woff2',
  './fonts/inter-latin-500-normal.woff2',
  './fonts/inter-latin-600-normal.woff2',
  './fonts/inter-latin-700-normal.woff2',
  './fonts/inter-latin-ext-400-normal.woff2',
  './fonts/inter-latin-ext-500-normal.woff2',
  './fonts/inter-latin-ext-600-normal.woff2',
  './fonts/inter-latin-ext-700-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Tolerante: un recurso que falle no impide instalar el resto.
      Promise.all(SHELL.map((u) =>
        cache.add(new Request(u, { cache: 'reload' })).catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nunca otros orígenes

  event.respondWith(staleWhileRevalidate(event, req, url));
});

async function staleWhileRevalidate(event, req, url) {
  const cache = await caches.open(CACHE);
  // Las navegaciones se resuelven contra index.html (ignora ?query y /).
  const isNav = req.mode === 'navigate';
  const key = isNav ? new Request(new URL('./index.html', self.registration.scope).href) : req;
  const cached = await cache.match(key, { ignoreSearch: isNav });

  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      cache.put(key, copy).catch(() => {});
    }
    return res;
  }).catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  if (res) return res;
  if (isNav) {
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
  }
  return new Response('Sin conexión', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

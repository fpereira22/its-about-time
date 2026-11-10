/* global self, caches, fetch, URL, Response */
// Service worker de la app instalable. El build (plugin "service-worker" de vite.config.ts) completa
// VERSION (hash de los archivos) y PRECACHE (la lista de archivos de esa versión).
//
// - Al instalarse descarga todo el juego: después funciona sin internet.
// - La página (index.html) va primero a la red, para que una versión nueva llegue apenas se publica;
//   sin red usa la guardada.
// - Los archivos con hash en el nombre (assets/) no cambian nunca: se sirven desde el caché.
// - Las fuentes de Google Fonts se guardan la primera vez que se piden.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `its-about-time-${VERSION}`;
const FONTS = 'its-about-time-fuentes';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req, CACHE));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put('./', res.clone());
    return res;
  } catch {
    return (await cache.match('./')) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Las respuestas "opaque" (fuentes sin CORS) tienen ok = false pero sirven igual.
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone());
  return res;
}

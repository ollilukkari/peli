// Change RELEASE for every deployment that changes an app file.
const RELEASE = '2026-09-18.7';
const ROOT = new URL('./', self.location.href);
const CACHE_PREFIX = `ponppu:${encodeURIComponent(ROOT.pathname)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${RELEASE}`;
const APP_FILES = [
  'index.html', 'style.css', 'src/main.js', 'src/game.js', 'src/render.js',
  'src/audio.js', 'src/pwa.js', 'manifest.webmanifest', 'assets/icon.svg',
  'assets/icon-192.png', 'assets/icon-512.png',
].map((file) => new URL(file, ROOT).href);
const APP_URLS = new Set(APP_FILES);
const INDEX_URL = new URL('index.html', ROOT).href;

self.addEventListener('install', (event) => {
  // addAll fails the installation if even one file is missing. The active game
  // therefore keeps its complete old version until a complete update is ready.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(
    APP_FILES.map((url) => new Request(url, { cache: 'reload' })),
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    // Only the menu's explicit update action sends this message.
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === 'GET_OFFLINE_STATUS' && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const files = await Promise.all(APP_FILES.map((url) => cache.match(url)));
      event.ports[0].postMessage({ ready: files.every(Boolean), release: RELEASE });
    })());
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  url.search = '';
  url.hash = '';
  const cacheKey = url.href === ROOT.href ? INDEX_URL : url.href;
  if (!APP_URLS.has(cacheKey)) return;

  // Serve one coherent release for both document and modules. Network-first
  // navigation could combine a new document with old cached modules.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(cacheKey);
    if (response) return response;
    // Do not silently mix versions if browser storage has been removed.
    return new Response('Pelin offline-tiedosto puuttuu. Sulje pelin välilehdet ja avaa peli uudelleen verkossa.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});

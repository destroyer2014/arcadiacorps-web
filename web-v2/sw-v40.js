const CACHE = 'arcadia-web-v40';
const STATIC = [
  './404.html',
  './50x.html',
  './assets/release-v40.css',
  './assets/release-v40.js',
  './assets/images/arcadia-logo-rpg.png'
];

self.addEventListener('install',event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate',event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('arcadia-web-') && key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch',event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // APIs y autenticación nunca se cachean.
  if (
    url.pathname.startsWith('/ai-api/') ||
    url.pathname.startsWith('/nero-api/') ||
    url.pathname.includes('/auth/')
  ) return;

  const isDocument = request.mode === 'navigate';

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request,copy)).catch(()=>{});
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) ||
                 (await caches.match('./404.html'));
        })
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response.ok) {
              caches.open(CACHE)
                .then(cache => cache.put(request,response.clone()))
                .catch(()=>{});
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});

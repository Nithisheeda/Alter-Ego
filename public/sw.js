const CACHE_NAME = 'alter-ego-static-v1'

const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  )
  self.clients.claim()
})

function isApiRequest(url) {
  return url.hostname === 'api.anthropic.com'
}

function isNavigationOrStaticAsset(request, url) {
  if (request.mode === 'navigate') return true
  return ['style', 'script', 'font', 'image'].includes(request.destination) && url.origin === self.location.origin
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache or intercept API calls — always hit the network.
  if (isApiRequest(url)) return

  if (!isNavigationOrStaticAsset(request, url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)

      return cached ?? network
    }),
  )
})

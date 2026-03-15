// KiwiSpeakQuote Service Worker
// Handles app shell caching + dynamic page caching for offline use

const CACHE_NAME = 'ksq-v2'
const DYNAMIC_CACHE = 'ksq-dynamic-v1'

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
]

// Pages worth caching dynamically for offline access
const CACHEABLE_PATHS = [
  '/dashboard',
  '/quotes',
  '/settings',
]

// Install: pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: cache-first for static, stale-while-revalidate for pages, network-only for API
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // API routes & auth callbacks always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // Public quote pages (/q/...) — stale-while-revalidate for offline viewing
  if (url.pathname.startsWith('/q/')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // App pages (dashboard, quotes, settings) — stale-while-revalidate
  if (CACHEABLE_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // App shell & static assets — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request)
        .then((response) => {
          // Cache static assets (JS, CSS, images, fonts)
          if (response.ok && isStaticAsset(url.pathname)) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Navigation requests fall back to offline page
          if (request.mode === 'navigate') {
            return caches.match('/offline')
          }
        })
    })
  )
})

// Stale-while-revalidate: return cached immediately, update in background
function staleWhileRevalidate(request) {
  return caches.open(DYNAMIC_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => {
          // Network failed — if we have cached version, it was already returned
          // If not, fall back to offline page for navigation
          if (!cached && request.mode === 'navigate') {
            return caches.match('/offline')
          }
          return cached
        })

      // Return cached immediately if available, otherwise wait for network
      return cached || networkFetch
    })
  )
}

// Check if a path is a static asset worth caching
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(pathname) ||
    pathname.startsWith('/_next/static/')
}

// Listen for messages from the app (e.g., force cache update)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Pre-cache a specific quote page for offline viewing
  if (event.data && event.data.type === 'CACHE_QUOTE') {
    const quoteUrl = event.data.url
    caches.open(DYNAMIC_CACHE).then((cache) =>
      fetch(quoteUrl).then((response) => {
        if (response.ok) {
          cache.put(quoteUrl, response)
        }
      }).catch(() => {})
    )
  }
})

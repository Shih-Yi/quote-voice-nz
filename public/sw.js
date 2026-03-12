// KiwiSpeakQuote Service Worker
// Hand-written, minimal, no dependencies

const CACHE_NAME = 'ksq-v1'

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: cache-first for static, network-only for API
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // API routes & auth callbacks always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).catch(() => {
        // Navigation requests fall back to offline page
        if (request.mode === 'navigate') {
          return caches.match('/offline')
        }
      })
    })
  )
})

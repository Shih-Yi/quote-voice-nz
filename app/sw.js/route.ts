import { NextResponse } from "next/server";

export const dynamic = "force-static";

const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  String(Date.now());

const SW_SOURCE = `// KiwiSpeakQuote Service Worker (generated)
// Build ID is injected at build time so every deploy invalidates old caches.

const BUILD_ID = ${JSON.stringify(BUILD_ID)};
const CACHE_NAME = 'ksq-shell-' + BUILD_ID;
const DYNAMIC_CACHE = 'ksq-dynamic-' + BUILD_ID;

// Only pre-cache the offline fallback. Never pre-cache real pages —
// that forces stale HTML on next load.
const APP_SHELL = ['/offline', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // Public quote pages — stale-while-revalidate (must work offline)
  if (url.pathname.startsWith('/q/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // HTML navigations — network-first (always latest UI when online,
  // cached copy or /offline when not)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — pass through to network
});

function networkFirst(request) {
  return caches.open(DYNAMIC_CACHE).then((cache) =>
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/offline');
          return Response.error();
        })
      )
  );
}

function staleWhileRevalidate(request) {
  return caches.open(DYNAMIC_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => {
          if (!cached && request.mode === 'navigate') {
            return caches.match('/offline');
          }
          return cached;
        });

      return cached || networkFetch;
    })
  );
}

function isStaticAsset(pathname) {
  return /\\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(pathname) ||
    pathname.startsWith('/_next/static/');
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_QUOTE') {
    const quoteUrl = event.data.url;
    caches.open(DYNAMIC_CACHE).then((cache) =>
      fetch(quoteUrl).then((response) => {
        if (response.ok) {
          cache.put(quoteUrl, response);
        }
      }).catch(() => {})
    );
  }
});
`;

export function GET(): NextResponse {
  return new NextResponse(SW_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

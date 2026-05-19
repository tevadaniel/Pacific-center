/**
 * Forum de la Rentrée 2026 — Service Worker (PWA)
 * Stratégie : network-first pour les pages (PAS de cache HTML pour toujours avoir la dernière version),
 *             cache-first pour les assets statiques.
 * Permet une utilisation hors-ligne basique le jour J sur le terrain.
 *
 * ⚠️ IMPORTANT : à chaque mise à jour majeure du frontend, BUMP la version (v3 → v4 → v5…)
 * pour forcer le rafraîchissement des pages chez les utilisateurs déjà installés (PWA).
 */
const CACHE_VERSION = 'v18';
const CACHE_NAME = `forum2026-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  // Active immédiatement la nouvelle version du SW (pas d'attente de fermeture des onglets)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  // Supprime TOUS les anciens caches (même nom différent) pour repartir propre
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET, skip API calls (always live)
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  // 🆕 Ne JAMAIS cacher les pages HTML (network-only) → toujours la dernière version frontend
  // On cache UNIQUEMENT les assets statiques de Next.js (chunks JS, fonts, images)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      }))
    );
    return;
  }
  // Pages : network-only avec fallback offline (PAS de mise en cache des HTML)
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || new Response(
      '<!doctype html><html><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>Hors ligne</h1><p>Reconnectez-vous pour accéder à la dernière version.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    )))
  );
});

// =====================
// 🔄 Force update message handler
// Permet à l'app de demander explicitement au SW de se mettre à jour
// =====================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// =====================
// Web Push notifications
// =====================
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Forum 2026', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Forum de la Rentrée 2026';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || 'forum2026',
    data: { url: payload.url || '/aracom?tab=validations' },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/aracom';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // Focus an existing tab if any
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

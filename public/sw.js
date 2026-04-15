// Hermes Workspace — Passthrough Service Worker
// No caching. Just satisfies Chrome's PWA install requirement
// while avoiding stale asset issues after deployments.

const CACHE_NAME = 'hermes-sw-v0';

self.addEventListener('install', () => {
  // Activate immediately, don't wait for old SW to die
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately + nuke any old caches
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Passthrough — every request goes straight to the network, no cache involved
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

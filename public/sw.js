// Petasos — Service Worker with App Shell Caching
// Strategies:
//   Navigation (HTML):  Network First → Cache fallback
//   Hashed JS/CSS:      Cache First  → Network fallback (immutable)
//   Images/Fonts:       Stale While Revalidate
//   API (/api/):        Network Only
//
// Cache invalidation: version hash is embedded below at build time.
// Vite's content-hashed filenames (assets/*.hash.js) make assets immutable
// so they are safe to cache aggressively.

// ── Cache version ──────────────────────────────────────────────────
// Bump this manually or inject during CI to force a full cache refresh.
const CACHE_VERSION = 'petasos-v1-20260416';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// ── Install: precache app shell ────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      try {
        // Fetch the root document (SSR-rendered HTML shell).
        // This also lets us discover the hashed JS/CSS bundles it references.
        const response = await fetch('/');
        if (!response || !response.ok) {
          console.warn('[SW] Failed to fetch root page for precaching');
          return;
        }

        const html = await response.text();
        const shellUrls = ['/'];

        // Extract asset URLs from the HTML (<script src=...> and <link href=...>)
        const assetRegex = /(?:src|href)\s*=\s*["']([^"']*(?:\/assets\/|\/favicon|\/hermes-|\/logo|\/manifest)[^"']*)["']/gi;
        let match;
        while ((match = assetRegex.exec(html)) !== null) {
          shellUrls.push(match[1]);
        }

        if (shellUrls.length > 1) {
          const cache = await caches.open(SHELL_CACHE);
          // Cache the HTML + discovered assets
          await cache.addAll(shellUrls);
          console.log(`[SW] Precached ${shellUrls.length} shell resources`);
        } else {
          // Still cache the root page even if we didn't find assets
          const cache = await caches.open(SHELL_CACHE);
          await cache.put('/', response.clone());
          console.log('[SW] Precached root page only');
        }
      } catch (err) {
        // If fetch fails (e.g. offline during install), that's OK —
        // runtime caching will populate on subsequent visits.
        console.warn('[SW] Precache failed, will populate at runtime:', err.message);
      }
    })()
  );
});

// ── Activate: clean old caches + claim clients ─────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Route classification helpers ───────────────────────────────────
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isHashedAsset(url) {
  // Vite outputs all built assets under /assets/ with content hashes in filenames.
  // These are immutable — if the content changes, the hash (and thus the filename) changes.
  return /\/assets\/[^/]+\.(js|css|woff2?|ttf|otf|svg)$/i.test(url.pathname);
}

function isStaticAsset(url) {
  // Images, fonts, and other static files (non-hashed)
  return /\.(png|jpe?g|webp|gif|ico|svg|woff2?|ttf|otf|eot|mp4|webm|ogg)$/i.test(url.pathname);
}

// ── Fetch strategies ───────────────────────────────────────────────

// Cache First — for immutable hashed assets
async function cacheFirst(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;

  try {
    const response = await fetch(event.request);
    if (response && response.ok) {
      // Hashed assets are immutable, safe to cache permanently
      cache.put(event.request, response.clone());
    }
    return response;
  } catch (err) {
    // Last resort: check runtime cache
    const runtimeCached = await caches.match(event.request);
    if (runtimeCached) return runtimeCached;
    return err;
  }
}

// Network First — for navigation (HTML pages)
async function networkFirst(event) {
  try {
    const response = await fetch(event.request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(event.request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    return new Response('Offline — page not cached yet', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// Stale While Revalidate — for images, fonts, etc.
async function staleWhileRevalidate(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);

  const fetchPromise = fetch(event.request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Network Only — for API calls
async function networkOnly(event) {
  return fetch(event.request);
}

// ── Main fetch handler ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests (POST, PUT, etc.)
  if (event.request.method !== 'GET') return;

  let strategy;

  if (isApiRequest(url)) {
    strategy = networkOnly(event);
  } else if (isNavigationRequest(event.request)) {
    strategy = networkFirst(event);
  } else if (isHashedAsset(url)) {
    strategy = cacheFirst(event);
  } else if (isStaticAsset(url)) {
    strategy = staleWhileRevalidate(event);
  } else {
    // Default: network with runtime cache
    strategy = networkFirst(event);
  }

  event.respondWith(strategy);
});

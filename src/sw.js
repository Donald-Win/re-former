/**
 * re-former Service Worker — Workbox.
 *
 * This is a template. vite-plugin-pwa injects the precache manifest (every
 * hashed JS/CSS/HTML file, the form PDFs, fonts and the geoid grid) into
 * self.__WB_MANIFEST at build time.
 *
 * Update flow (user-controlled):
 *   1. A new SW installs and waits (no automatic skipWaiting)
 *   2. App.jsx shows the "Update available" banner
 *   3. The user taps "Update now", which posts SKIP_WAITING
 *   4. The SW activates, and main.jsx reloads the page
 */

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { clientsClaim } from 'workbox-core'

clientsClaim()

// Precache the whole build, including form PDFs, fonts and the geoid grid.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Offline navigation. Any page request (for example, the app opened from the
// home screen) is served the precached app shell.
try {
  const shellUrl = new URL('index.html', self.registration.scope).pathname
  registerRoute(new NavigationRoute(createHandlerBoundToURL(shellUrl)))
} catch (err) {
  console.warn('[re-former SW] app shell is not precached; offline navigation disabled', err)
}

// manifest.json: network first, so install metadata stays current.
registerRoute(
  ({ url }) => url.pathname.endsWith('/manifest.json'),
  new NetworkFirst({ cacheName: 're-former-manifest' })
)

// Remove caches from earlier SW versions. Form PDFs were once cached at runtime
// under 're-former-pdfs'; they are now precached.
const LEGACY_CACHE = /^(re-former-v\d|re-former-pdfs$)/
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => LEGACY_CACHE.test(name))
          .map((name) => caches.delete(name))
      )
    )
  )
})

// App.jsx posts 'SKIP_WAITING' (apply update) or 'CHECK_UPDATE' (check now).
self.addEventListener('message', (event) => {
  const msg = event.data?.type ?? event.data
  if (msg === 'SKIP_WAITING') self.skipWaiting()
  if (msg === 'CHECK_UPDATE') self.registration.update()
})

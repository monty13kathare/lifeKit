/*
 * LifeKit service worker — installability and offline support.
 *
 * - Pages (navigations): network first, so people always get the latest
 *   version online; the last copy seen is served when offline, and /offline
 *   when a page was never visited. LifeKit's data lives in the browser, so the
 *   offline copy works with the user's own tasks, notes and so on.
 * - Content-hashed build assets and icons: cache first (they never change).
 * - API routes (/api/*, e.g. Gemini) and cross-origin requests always go to
 *   the network and are never cached.
 */
const VERSION = "v2"
const STATIC_CACHE = `lifekit-static-${VERSION}`
const PAGE_CACHE = `lifekit-pages-${VERSION}`
const OFFLINE_URL = "/offline"
/** Cached at install so the main tabs open offline even before a visit. */
const PRECACHE_PAGES = [OFFLINE_URL, "/", "/tools", "/my-life", "/learn"]
const PRECACHE_STATIC = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg", "/manifest.webmanifest"]
const MAX_PAGES = 60

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Best effort: a failed pre-cache must not block installation.
      try {
        const statics = await caches.open(STATIC_CACHE)
        await statics.addAll(PRECACHE_STATIC)
      } catch {}
      try {
        const pages = await caches.open(PAGE_CACHE)
        const assets = new Set()
        await Promise.all(
          PRECACHE_PAGES.map(async (url) => {
            const res = await fetch(url, { cache: "no-store" }).catch(() => null)
            if (!res || !res.ok) return
            // Also cache the page's own scripts and styles so it hydrates offline.
            const html = await res.clone().text()
            for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0])
            await pages.put(url, res)
          })
        )
        const statics = await caches.open(STATIC_CACHE)
        await Promise.all([...assets].map((a) => statics.add(a).catch(() => undefined)))
      } catch {}
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE])
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith("lifekit-") && !keep.has(k)).map((k) => caches.delete(k)))
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {})
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event))
    return
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/vendor/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:png|svg|ico|woff2?|webp)$/.test(url.pathname)
  if (isStatic) event.respondWith(cacheFirst(request))
})

async function networkFirstPage(event) {
  const { request } = event
  const url = new URL(request.url)
  const key = url.pathname // ignore query strings and hashes for page copies
  try {
    const res = (await event.preloadResponse) || (await fetch(request))
    if (res.ok && res.type === "basic") {
      const copy = res.clone()
      event.waitUntil(
        caches.open(PAGE_CACHE).then(async (cache) => {
          await cache.put(key, copy)
          await trimCache(cache, MAX_PAGES)
        })
      )
    }
    return res
  } catch {
    const cache = await caches.open(PAGE_CACHE)
    const cached = await cache.match(key)
    if (cached) return cached
    // Redirect (rather than serve the offline page under this URL) so the app hydrates on the right route.
    if (key !== OFFLINE_URL && (await cache.match(OFFLINE_URL))) return Response.redirect(OFFLINE_URL, 302)
    return (
      (await cache.match(OFFLINE_URL)) ||
      new Response("<h1>You're offline</h1><p>Reconnect to open this page.</p>", {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    )
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone()).catch(() => {})
  return res
}

async function trimCache(cache, max) {
  const keys = await cache.keys()
  const protectedUrls = new Set(PRECACHE_PAGES.map((p) => new URL(p, self.location.origin).href))
  const removable = keys.filter((k) => !protectedUrls.has(k.url))
  for (let i = 0; i < removable.length - (max - protectedUrls.size); i++) await cache.delete(removable[i])
}

// Focus the app when a reminder notification is clicked.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/tools/reminders"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c)
      if (existing) {
        existing.navigate(target)
        return existing.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})

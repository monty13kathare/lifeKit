/*
 * LifeKit service worker — installability and basic static-asset caching only.
 * There is intentionally no offline mode: pages and data requests always go
 * to the network. Only immutable, content-hashed build assets and icons are
 * cached to speed up repeat visits.
 */
const CACHE = "lifekit-static-v1"
const PRECACHE = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")
  if (!isStatic) return // Network as normal for everything else.

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
    )
  )
})

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

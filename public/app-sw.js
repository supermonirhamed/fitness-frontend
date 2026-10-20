// The client app's service worker (US-11.01): makes the app installable and keeps the last
// pages it opened for a short offline moment. API calls always go to the network.
const CACHE = 'client-app-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) return
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/app'))),
  )
})

// Web push (US-12.04): show the notification the organization sent; tapping it opens the page it
// is about (or the inbox), reusing an open app window when there is one.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '', {
      body: data.body || '',
      tag: data.tag,
      icon: '/app-icon-192.png',
      badge: '/app-icon-192.png',
      data: { url: data.url || '/app/inbox' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/app/inbox', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin + '/app'))
      if (open) return open.navigate(url).then((w) => (w || open).focus())
      return self.clients.openWindow(url)
    }),
  )
})

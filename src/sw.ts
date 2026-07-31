/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
  new NetworkFirst({
    cacheName: 'live-data',
    networkTimeoutSeconds: 4,
  }),
)

try {
  const handler = createHandlerBoundToURL('index.html')
  registerRoute(new NavigationRoute(handler))
} catch {
  // Dev ortamında navigateFallback olmayabilir
}

const META_CACHE = 'duyuru-meta-v1'
const LAST_ID_URL = 'https://tornuk.local/last-duyuru-id'

async function getLastId(): Promise<string | null> {
  const cache = await caches.open(META_CACHE)
  const hit = await cache.match(LAST_ID_URL)
  return hit ? hit.text() : null
}

async function setLastId(id: string) {
  const cache = await caches.open(META_CACHE)
  await cache.put(LAST_ID_URL, new Response(id, { headers: { 'Content-Type': 'text/plain' } }))
}

async function checkDuyurular() {
  const base = self.registration.scope
  const res = await fetch(`${base}data/duyurular.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return

  const data = (await res.json()) as {
    items: { id: string; title: string; summary: string }[]
  }
  const latest = data.items?.[0]
  if (!latest) return

  const prev = await getLastId()
  if (!prev) {
    await setLastId(latest.id)
    return
  }

  if (prev === latest.id) return

  const knownIndex = data.items.findIndex((item) => item.id === prev)
  const fresh = knownIndex === -1 ? [latest] : data.items.slice(0, knownIndex)

  for (const item of fresh.reverse()) {
    await self.registration.showNotification(item.title, {
      body: item.summary,
      icon: `${base}icons/icon-192.png`,
      badge: `${base}icons/icon-192.png`,
      tag: item.id,
      data: { url: `${base}?tab=duyurular` },
    })
  }

  await setLastId(latest.id)
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_DUYURULAR') {
    event.waitUntil(checkDuyurular())
  }
})

self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }
  if (syncEvent.tag === 'check-duyurular') {
    syncEvent.waitUntil(checkDuyurular())
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          void client.navigate?.(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

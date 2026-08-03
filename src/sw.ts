/// <reference lib="webworker" />
/** tornuk-sw-v2026-08-03c — force update */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

// Yeni SW hemen aktif olsun — eski önbellekli SW takılı kalmasın
void self.skipWaiting()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Duyuru/aidat JSON — yalnızca aynı origin; raw.githubusercontent.com’u yakalama
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.includes('/data/') &&
    url.pathname.endsWith('.json'),
  new NetworkOnly({
    plugins: [
      {
        cacheWillUpdate: async () => null,
      },
    ],
  }),
)

async function purgeDataJsonCaches() {
  await caches.delete('live-data')
  const names = await caches.keys()
  for (const name of names) {
    const cache = await caches.open(name)
    const requests = await cache.keys()
    await Promise.all(
      requests
        .filter((req) => req.url.includes('/data/') && req.url.includes('.json'))
        .map((req) => cache.delete(req)),
    )
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await purgeDataJsonCaches()
      await self.clients.claim()
    })(),
  )
})

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

async function notifyClientsPlaySound() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'PLAY_NOTIFY_SOUND' })
  }
}

async function checkDuyurular() {
  const base = self.registration.scope
  const res = await fetch(
    `https://raw.githubusercontent.com/mustafatemel1986-ops/tornuk-dernegi/gh-pages/data/duyurular.json?t=${Date.now()}`,
    { cache: 'no-store' },
  )
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
    const options = {
      body: item.summary,
      icon: `${base}icons/icon-192.png`,
      badge: `${base}icons/icon-192.png`,
      tag: `duyuru-${item.id}`,
      silent: false,
      data: { url: `${base}?tab=duyurular&r=${Date.now()}` },
      renotify: true,
      vibrate: [200, 80, 200, 80, 400],
    } as NotificationOptions
    await self.registration.showNotification(item.title, options)
  }

  await notifyClientsPlaySound()
  await setLastId(latest.id)
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_DUYURULAR') {
    event.waitUntil(checkDuyurular())
  }
  if (event.data?.type === 'SET_LAST_DUYURU_ID' && typeof event.data.id === 'string') {
    event.waitUntil(setLastId(event.data.id))
  }
  if (event.data?.type === 'PURGE_DATA_CACHE') {
    event.waitUntil(purgeDataJsonCaches())
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
  const target =
    event.notification.data?.url || `${self.registration.scope}?tab=duyurular&r=${Date.now()}`
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

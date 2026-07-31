const STORAGE_KEY = 'tornuk-last-duyuru-id'
const PREF_KEY = 'tornuk-notify-enabled'

export function getNotifyPreference(): boolean {
  return localStorage.getItem(PREF_KEY) === '1'
}

export function setNotifyPreference(enabled: boolean) {
  localStorage.setItem(PREF_KEY, enabled ? '1' : '0')
}

export function getLastSeenDuyuruId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setLastSeenDuyuruId(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export async function registerPeriodicDuyuruCheck() {
  const reg = await navigator.serviceWorker?.ready
  if (!reg) return

  const periodic = reg as ServiceWorkerRegistration & {
    periodicSync?: {
      register: (tag: string, options: { minInterval: number }) => Promise<void>
    }
  }

  if (periodic.periodicSync) {
    try {
      await periodic.periodicSync.register('check-duyurular', {
        minInterval: 60 * 60 * 1000,
      })
    } catch {
      // İzin yoksa veya desteklenmiyorsa sessizce geç
    }
  }
}

export async function askServiceWorkerToCheck() {
  const reg = await navigator.serviceWorker?.ready
  reg?.active?.postMessage({ type: 'CHECK_DUYURULAR' })
}

export type DuyuruLite = {
  id: string
  title: string
  summary: string
}

/** Uygulama açıkken yeni duyuru kontrolü (iPhone dahil). */
export async function checkDuyurularInPage(options?: {
  notify?: boolean
}): Promise<{ latestId: string | null; isNew: boolean; item: DuyuruLite | null }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/duyurular.json?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!res.ok) return { latestId: null, isNew: false, item: null }

  const data = (await res.json()) as { items: DuyuruLite[] }
  const latest = data.items[0]
  if (!latest) return { latestId: null, isNew: false, item: null }

  const prev = getLastSeenDuyuruId()
  const isNew = Boolean(prev && prev !== latest.id)

  if (!prev) {
    setLastSeenDuyuruId(latest.id)
    return { latestId: latest.id, isNew: false, item: latest }
  }

  if (isNew) {
    setLastSeenDuyuruId(latest.id)
    if (options?.notify && getNotifyPreference() && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.ready
      if (reg?.showNotification) {
        await reg.showNotification(latest.title, {
          body: latest.summary,
          icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          tag: latest.id,
          data: { url: `${import.meta.env.BASE_URL}?tab=duyurular` },
        })
      } else {
        new Notification(latest.title, { body: latest.summary })
      }
    }
  }

  return { latestId: latest.id, isNew, item: latest }
}

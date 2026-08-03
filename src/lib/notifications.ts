import { playNotifySound } from './notifySound'

const STORAGE_KEY = 'tornuk-last-duyuru-id'
const PREF_KEY = 'tornuk-notify-enabled'
const ASK_KEY = 'tornuk-ask-notify'

export function getNotifyPreference(): boolean {
  return localStorage.getItem(PREF_KEY) === '1'
}

export function setNotifyPreference(enabled: boolean) {
  localStorage.setItem(PREF_KEY, enabled ? '1' : '0')
}

/** Kurulum sonrası bildirim izni sorulacak mı? */
export function shouldAskNotifyPermission(): boolean {
  if (!('Notification' in window)) return false
  if (getNotifyPreference() && Notification.permission === 'granted') return false
  if (Notification.permission === 'denied') return false
  return localStorage.getItem(ASK_KEY) === '1' || Notification.permission === 'default'
}

export function markAskNotifyPermission() {
  localStorage.setItem(ASK_KEY, '1')
}

export function clearAskNotifyPermission() {
  localStorage.removeItem(ASK_KEY)
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

/** İndirme / ana ekrana ekleme sonrası: izin iste ve bildirimleri aç. */
export async function enableNotificationsAfterInstall(): Promise<'granted' | 'denied' | 'default'> {
  markAskNotifyPermission()
  const permission = await ensureNotificationPermission()
  if (permission === 'granted') {
    setNotifyPreference(true)
    clearAskNotifyPermission()
    await registerPeriodicDuyuruCheck()
    await askServiceWorkerToCheck()
    try {
      await showDuyuruNotification({
        id: `welcome-${Date.now()}`,
        title: 'Törnük Derneği',
        summary: 'Bildirimler açıldı. Yeni duyurularda size haber vereceğiz.',
      })
    } catch {
      // sessiz
    }
  }
  return permission
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
        minInterval: 15 * 60 * 1000,
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

function iconUrl() {
  return `${import.meta.env.BASE_URL}icons/icon-192.png`
}

export async function showDuyuruNotification(
  item: DuyuruLite,
  options?: { playSound?: boolean },
) {
  if (options?.playSound !== false) playNotifySound()

  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const opts: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: item.summary,
    icon: iconUrl(),
    badge: iconUrl(),
    tag: `duyuru-${item.id}`,
    renotify: true,
    silent: false,
    vibrate: [200, 80, 200, 80, 400],
    data: { url: `${import.meta.env.BASE_URL}?tab=duyurular&r=${Date.now()}` },
  }

  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) {
      await reg.showNotification(item.title, opts)
      return
    }
  } catch {
    // fallback aşağıda
  }

  try {
    new Notification(item.title, opts)
  } catch {
    // bazı tarayıcılarda engelli olabilir
  }
}

/** Menüden deneme bildirimi + ses. */
export async function sendTestNotification() {
  const permission = await ensureNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Bildirim izni yok')
  }
  setNotifyPreference(true)
  await showDuyuruNotification({
    id: `test-${Date.now()}`,
    title: 'Törnük Derneği',
    summary: 'Test bildirimi — ses ve uyarı çalışıyor.',
  })
}

/** Uygulama açıkken / öne gelince yeni duyuru kontrolü. */
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
    if (options?.notify && getNotifyPreference()) {
      await showDuyuruNotification(latest)
    }
  }

  return { latestId: latest.id, isNew, item: latest }
}

/** Service worker’dan gelen ses isteğini dinle. */
export function listenForNotifySoundFromSw() {
  if (!('serviceWorker' in navigator)) return () => undefined

  function onMessage(event: MessageEvent) {
    if (event.data?.type === 'PLAY_NOTIFY_SOUND') playNotifySound()
  }

  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}

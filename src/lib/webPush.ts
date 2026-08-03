import { PUBLISH_API_URL } from './publishConfig'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function loadVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/vapid.json?t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { publicKey?: string }
    return data.publicKey || null
  } catch {
    return null
  }
}

/** Kapalı uygulamada da bildirim için Web Push aboneliği. */
export async function subscribeWebPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!('Notification' in window) || Notification.permission !== 'granted') return false

  const publicKey = await loadVapidPublicKey()
  if (!publicKey) return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const payload = sub.toJSON()
  const res = await fetch(`${PUBLISH_API_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: payload }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Abonelik kaydı başarısız (${res.status})`)
  }
  return true
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  try {
    await fetch(`${PUBLISH_API_URL}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
  } catch {
    // Worker engelli olabilir
  }
  await sub.unsubscribe()
}

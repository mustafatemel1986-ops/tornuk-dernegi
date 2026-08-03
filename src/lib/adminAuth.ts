import { clearBridgeGithubToken, unlockBridgeToken } from './bridgeUnlock'
import { clearVapidPrivateJwk, unlockVapidSeal } from './vapidUnlock'

const SESSION_KEY = 'tornuk-admin-session'
const PIN_KEY = 'tornuk-admin-pin'
export const SALT = 'tornuk-admin-v1'

export async function hashPassword(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${pin.trim()}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/admin.json?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!res.ok) return false
  const config = (await res.json()) as { passwordHash: string }
  const hash = await hashPassword(pin)
  return hash === config.passwordHash
}

export function isAdminLoggedIn(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

/** Oturum boyunca yayın için PIN (sekme kapanınca silinir). */
export function getAdminSessionPin(): string | null {
  return sessionStorage.getItem(PIN_KEY)
}

export async function setAdminLoggedIn(value: boolean, pin?: string) {
  if (value) {
    sessionStorage.setItem(SESSION_KEY, '1')
    if (pin) {
      sessionStorage.setItem(PIN_KEY, pin.trim())
      await unlockBridgeToken(pin)
      await unlockVapidSeal(pin)
    }
  } else {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(PIN_KEY)
    clearBridgeGithubToken()
    clearVapidPrivateJwk()
  }
}

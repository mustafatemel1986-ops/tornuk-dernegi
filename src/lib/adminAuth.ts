const SESSION_KEY = 'tornuk-admin-session'
const SALT = 'tornuk-admin-v1'

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

export function setAdminLoggedIn(value: boolean) {
  if (value) sessionStorage.setItem(SESSION_KEY, '1')
  else sessionStorage.removeItem(SESSION_KEY)
}

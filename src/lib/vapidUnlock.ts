/** PIN ile şifreli VAPID private JWK (admin tarayıcısından Web Push). */
const VAPID_JWK_KEY = 'tornuk-vapid-jwk'

export function getVapidPrivateJwk(): JsonWebKey | null {
  try {
    const raw = sessionStorage.getItem(VAPID_JWK_KEY)
    return raw ? (JSON.parse(raw) as JsonWebKey) : null
  } catch {
    return null
  }
}

export function clearVapidPrivateJwk() {
  sessionStorage.removeItem(VAPID_JWK_KEY)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

type SealFile = {
  v: number
  iter: number
  salt: string
  iv: string
  tag: string
  data: string
}

/** Admin girişinde PIN ile vapid-seal.json çözer. */
export async function unlockVapidSeal(pin: string): Promise<boolean> {
  clearVapidPrivateJwk()
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/vapid-seal.json?t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return false
    const seal = (await res.json()) as SealFile
    const salt = b64ToBytes(seal.salt)
    const iv = b64ToBytes(seal.iv)
    const tag = b64ToBytes(seal.tag)
    const data = b64ToBytes(seal.data)

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin.trim()),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toBufferSource(salt),
        iterations: seal.iter || 250000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )

    const cipher = new Uint8Array(data.length + tag.length)
    cipher.set(data)
    cipher.set(tag, data.length)

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      key,
      toBufferSource(cipher),
    )
    const jwk = JSON.parse(new TextDecoder().decode(plain)) as JsonWebKey
    if (jwk.kty !== 'EC' || !jwk.d) return false
    sessionStorage.setItem(VAPID_JWK_KEY, JSON.stringify(jwk))
    return true
  } catch {
    clearVapidPrivateJwk()
    return false
  }
}

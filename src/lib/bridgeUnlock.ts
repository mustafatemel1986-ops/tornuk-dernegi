/** PIN ile şifreli yayın yedeği (Worker engelli ağlarda). */
const BRIDGE_TOKEN_KEY = 'tornuk-bridge-token'

export function getBridgeGithubToken(): string | null {
  return sessionStorage.getItem(BRIDGE_TOKEN_KEY)
}

export function clearBridgeGithubToken() {
  sessionStorage.removeItem(BRIDGE_TOKEN_KEY)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToString(bytes: ArrayBuffer): string {
  return new TextDecoder().decode(bytes)
}

type BridgeFile = {
  v: number
  iter: number
  salt: string
  iv: string
  tag: string
  data: string
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Girişte PIN ile bridge.json çözer; başarısızsa false (yalnızca Worker). */
export async function unlockBridgeToken(pin: string): Promise<boolean> {
  clearBridgeGithubToken()
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/bridge.json?t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return false
    const bridge = (await res.json()) as BridgeFile
    const salt = b64ToBytes(bridge.salt)
    const iv = b64ToBytes(bridge.iv)
    const tag = b64ToBytes(bridge.tag)
    const data = b64ToBytes(bridge.data)

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
        iterations: bridge.iter || 250000,
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
    const token = bytesToString(plain).trim()
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_') && !token.startsWith('gho_')) {
      return false
    }
    sessionStorage.setItem(BRIDGE_TOKEN_KEY, token)
    return true
  } catch {
    clearBridgeGithubToken()
    return false
  }
}

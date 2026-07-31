const COUNTED_KEY = 'tornuk-install-counted'
const NAMESPACE = 'tornuk-dernegi-gumushane'
const KEY = 'app-installs'

/** Karşıya yazılabilir ücretsiz sayaç (GitHub Pages için). */
function counterUrl(action: 'get' | 'up') {
  const base = `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}`
  return action === 'up' ? `${base}/up` : base
}

type CounterResponse = {
  value?: number
  count?: number
}

function readCount(data: CounterResponse): number {
  if (typeof data.value === 'number') return data.value
  if (typeof data.count === 'number') return data.count
  return 0
}

export async function getInstallCount(): Promise<number> {
  try {
    const res = await fetch(counterUrl('get'), { cache: 'no-store' })
    if (!res.ok) throw new Error('Sayaç okunamadı')
    return readCount((await res.json()) as CounterResponse)
  } catch {
    return 0
  }
}

export async function trackAppInstall(): Promise<number | null> {
  if (localStorage.getItem(COUNTED_KEY) === '1') return null

  try {
    const res = await fetch(counterUrl('up'), { cache: 'no-store' })
    if (!res.ok) throw new Error('Sayaç artırılamadı')
    const count = readCount((await res.json()) as CounterResponse)
    localStorage.setItem(COUNTED_KEY, '1')
    return count
  } catch {
    // Ağ yoksa yine de işaretle; tekrar sayılmasın
    localStorage.setItem(COUNTED_KEY, '1')
    return null
  }
}

export function wasInstallCounted(): boolean {
  return localStorage.getItem(COUNTED_KEY) === '1'
}

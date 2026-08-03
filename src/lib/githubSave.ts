/**
 * Admin yayın köprüsü.
 * 1) Cloudflare Worker (tercih)
 * 2) Worker engelliysa PIN ile çözülen yedek → api.github.com
 */
import { getBridgeGithubToken } from './bridgeUnlock'
import { pushAdminDataDirect } from './githubDirect'

export const PUBLISH_API_URL =
  (import.meta.env.VITE_PUBLISH_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://tornuk-publish.tornuk-dernegi.workers.dev'

export type AdminDataFile = { path: string; data: unknown }

let publishQueue: Promise<void> = Promise.resolve()

function isNetworkFetchError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (/failed to fetch/i.test(error.message) ||
        /networkerror/i.test(error.message) ||
        /load failed/i.test(error.message)))
  )
}

async function pushViaWorker(pin: string, files: AdminDataFile[]) {
  const res = await fetch(`${PUBLISH_API_URL}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, files }),
  })

  const text = await res.text()
  let payload: { ok?: boolean; error?: string } = {}
  try {
    payload = JSON.parse(text) as { ok?: boolean; error?: string }
  } catch {
    // İş ağı workers.dev’i HTML engel sayfasıyla cevaplıyor olabilir
    throw new TypeError('Failed to fetch')
  }

  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || `Yayın başarısız (${res.status}).`)
  }
}

async function pushUnlocked(pin: string, files: AdminDataFile[]) {
  try {
    await pushViaWorker(pin, files)
    return
  } catch (error) {
    if (!isNetworkFetchError(error)) throw error
  }

  const token = getBridgeGithubToken()
  if (!token) {
    throw new Error(
      'Yayın sunucusuna ulaşılamadı (ağ engeli). Mobil veri ile deneyin veya çıkış yapıp tekrar giriş yapın.',
    )
  }
  await pushAdminDataDirect(token, files)
}

export async function pushAdminData(
  pin: string,
  filesOrFactory: AdminDataFile[] | (() => AdminDataFile[]),
) {
  if (!pin.trim()) {
    throw new Error('Oturum süresi dolmuş. Yönetim paneline tekrar giriş yapın.')
  }

  const run = publishQueue.catch(() => undefined).then(() => {
    const files = typeof filesOrFactory === 'function' ? filesOrFactory() : filesOrFactory
    return pushUnlocked(pin.trim(), files)
  })
  publishQueue = run.then(
    () => undefined,
    () => undefined,
  )
  await run
}

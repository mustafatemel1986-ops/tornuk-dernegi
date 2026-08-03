import { getBridgeGithubToken } from './bridgeUnlock'
import { pushAdminDataDirect } from './githubDirect'
import { PUBLISH_API_URL } from './publishConfig'

export { PUBLISH_API_URL }

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
    throw new TypeError('Failed to fetch')
  }

  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || `Yayın başarısız (${res.status}).`)
  }
}

async function pushUnlocked(pin: string, files: AdminDataFile[]): Promise<'direct' | 'worker'> {
  const token = getBridgeGithubToken()

  // Telefonda Worker engelli olabilir — token varsa önce doğrudan GitHub
  if (token) {
    try {
      await pushAdminDataDirect(token, files)
      return 'direct'
    } catch (error) {
      // doğrudan yazma başarısızsa Worker dene
      try {
        await pushViaWorker(pin, files)
        return 'worker'
      } catch (workerError) {
        const a = error instanceof Error ? error.message : 'GitHub yazılamadı'
        const b = workerError instanceof Error ? workerError.message : 'Worker başarısız'
        throw new Error(`${a} / ${b}`)
      }
    }
  }

  try {
    await pushViaWorker(pin, files)
    return 'worker'
  } catch (error) {
    if (!isNetworkFetchError(error)) throw error
    throw new Error(
      'Yayın sunucusuna ulaşılamadı. Yönetimden çıkış yapıp PIN ile tekrar giriş yapın, sonra yeniden deneyin.',
    )
  }
}

export async function pushAdminData(
  pin: string,
  filesOrFactory: AdminDataFile[] | (() => AdminDataFile[]),
): Promise<'direct' | 'worker'> {
  if (!pin.trim()) {
    throw new Error('Oturum süresi dolmuş. Yönetim paneline tekrar giriş yapın.')
  }

  // Dosyaları kuyruk beklemeden şimdi al — React re-render dataRef’i eski haline çekmesin
  const files = typeof filesOrFactory === 'function' ? filesOrFactory() : filesOrFactory
  const run = publishQueue.catch(() => undefined).then(() => pushUnlocked(pin.trim(), files))
  publishQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/**
 * Admin yayın köprüsü.
 * GitHub token tarayıcıda yok — Cloudflare Worker yazar.
 *
 * Worker URL: deploy sonrası wrangler çıktısındaki *.workers.dev adresi.
 * VITE_PUBLISH_API_URL ile override edilebilir.
 */
export const PUBLISH_API_URL =
  (import.meta.env.VITE_PUBLISH_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://tornuk-publish.tornuk-dernegi.workers.dev'

export type AdminDataFile = { path: string; data: unknown }

/** Tüm yayınları sıraya al — paralel istek çakışmasını azaltır. */
let publishQueue: Promise<void> = Promise.resolve()

async function pushViaWorker(pin: string, files: AdminDataFile[]) {
  const res = await fetch(`${PUBLISH_API_URL}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, files }),
  })

  let payload: { ok?: boolean; error?: string } = {}
  try {
    payload = (await res.json()) as { ok?: boolean; error?: string }
  } catch {
    // ignore
  }

  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || `Yayın başarısız (${res.status}).`)
  }
}

/**
 * Dosya listesi veya fabrika. Fabrika kuyruk sırası gelince çalışır.
 */
export async function pushAdminData(
  pin: string,
  filesOrFactory: AdminDataFile[] | (() => AdminDataFile[]),
) {
  if (!pin.trim()) {
    throw new Error('Oturum süresi dolmuş. Yönetim paneline tekrar giriş yapın.')
  }
  if (!PUBLISH_API_URL) {
    throw new Error('Yayın sunucusu tanımlı değil.')
  }

  const run = publishQueue.catch(() => undefined).then(() => {
    const files = typeof filesOrFactory === 'function' ? filesOrFactory() : filesOrFactory
    return pushViaWorker(pin.trim(), files)
  })
  publishQueue = run.then(
    () => undefined,
    () => undefined,
  )
  await run
}

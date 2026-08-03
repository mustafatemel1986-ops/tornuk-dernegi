/** Ücretsiz anlık bildirim kanalı (uygulama açıkken EventSource ile). */
export const NTFY_TOPIC = 'tornuk_dernegi_gumushane_duyuru'

export function getNtfySubscribeUrl() {
  return `https://ntfy.sh/${NTFY_TOPIC}`
}

export function getNtfyDeepLink() {
  return `ntfy://ntfy.sh/${NTFY_TOPIC}`
}

async function sleep(ms: number) {
  await new Promise((r) => window.setTimeout(r, ms))
}

/** Canlı raw JSON’da duyuru görünene kadar bekle. */
export async function waitForLiveDuyuru(id: string, timeoutMs = 30000): Promise<boolean> {
  const url =
    'https://raw.githubusercontent.com/mustafatemel1986-ops/tornuk-dernegi/gh-pages/data/duyurular.json'
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { items?: { id: string }[] }
        if (data.items?.some((item) => item.id === id)) return true
      }
    } catch {
      // ağ hatası — tekrar dene
    }
    await sleep(1500)
  }
  return false
}

export async function publishDuyuruToNtfy(item: {
  id?: string
  title: string
  summary: string
}): Promise<void> {
  const click = `https://mustafatemel1986-ops.github.io/tornuk-dernegi/?tab=duyurular&r=${Date.now()}${
    item.id ? `&duyuru=${encodeURIComponent(item.id)}` : ''
  }`
  const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: {
      Title: item.title.slice(0, 100),
      Click: click,
      Priority: 'high',
      Tags: 'loudspeaker,triangular_flag_on_post',
    },
    body: item.summary.slice(0, 500) || item.title,
  })
  if (!res.ok) throw new Error(`Anlık bildirim gönderilemedi (${res.status})`)
}

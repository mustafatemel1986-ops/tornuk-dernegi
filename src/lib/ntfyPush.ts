/** Ücretsiz anlık bildirim kanalı (uygulama kapalıyken de çalışır). */
export const NTFY_TOPIC = 'tornuk_dernegi_gumushane_duyuru'

export function getNtfySubscribeUrl() {
  return `https://ntfy.sh/${NTFY_TOPIC}`
}

export function getNtfyDeepLink() {
  return `ntfy://ntfy.sh/${NTFY_TOPIC}`
}

export async function publishDuyuruToNtfy(item: {
  title: string
  summary: string
}): Promise<void> {
  const click = `https://mustafatemel1986-ops.github.io/tornuk-dernegi/?tab=duyurular`
  const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: {
      Title: item.title.slice(0, 100),
      Click: click,
      Priority: 'high',
      Tags: 'loudspeaker,triangular_flag_on_post',
      Filename: 'duyuru.txt',
    },
    body: item.summary.slice(0, 500) || item.title,
  })
  if (!res.ok) throw new Error(`Anlık bildirim gönderilemedi (${res.status})`)
}

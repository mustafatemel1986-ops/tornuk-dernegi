import { buildPushHTTPRequest } from '@pushforge/builder'

/**
 * @param {object} env
 * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
 * @param {{ title: string, body: string, url?: string, kind?: string, id?: string }} payload
 */
export async function sendOneWebPush(env, subscription, payload) {
  const privateJWK =
    typeof env.VAPID_PRIVATE_JWK === 'string'
      ? JSON.parse(env.VAPID_PRIVATE_JWK)
      : env.VAPID_PRIVATE_JWK
  if (!privateJWK) throw new Error('VAPID_PRIVATE_JWK yok')

  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK,
    subscription: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    },
    message: {
      payload: {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        kind: payload.kind,
        id: payload.id,
      },
      adminContact: env.VAPID_SUBJECT || 'mailto:tornuk-dernegi@users.noreply.github.com',
      options: {
        ttl: 60 * 60 * 24,
        urgency: 'high',
        topic: payload.kind === 'etkinlik' ? 'etkinlik' : 'duyuru',
      },
    },
  })

  const res = await fetch(endpoint, { method: 'POST', headers, body })
  return { ok: res.ok, status: res.status }
}

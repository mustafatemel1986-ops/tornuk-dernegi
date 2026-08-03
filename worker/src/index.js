/**
 * Törnük Derneği — yayın köprüsü (Cloudflare Worker)
 *
 * Yöneticiler sadece PIN ile giriş yapar.
 * GitHub token burada gizli kalır; tarayıcıya hiç inmez.
 */

const SALT = 'tornuk-admin-v1'
const OWNER = 'mustafatemel1986-ops'
const REPO = 'tornuk-dernegi'
const MAIN_BRANCH = 'main'
const LIVE_BRANCH = 'gh-pages'

const ALLOWED_PATHS = new Set([
  'public/data/uyeler.json',
  'public/data/duyurular.json',
  'public/data/etkinlikler.json',
])

function corsHeaders(origin) {
  // PIN ile korunuyor; Origin kısıtı bazı PWA / ağlarda Failed to fetch yapıyordu
  const allow = origin && origin !== 'null' ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  })
}

async function hashPassword(pin) {
  const data = new TextEncoder().encode(`${SALT}:${String(pin).trim()}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tornuk-publish-worker',
  }
}

async function githubJson(url, token, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...githubHeaders(token),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    const error = new Error(`${res.status} ${url}: ${err}`)
    error.status = res.status
    throw error
  }
  return res.json()
}

function isConflictError(error) {
  const text = error instanceof Error ? error.message : String(error)
  return (
    text === 'CONFLICT' ||
    text.includes('"status": "409"') ||
    text.includes(' 409 ') ||
    text.includes(' 422 ') ||
    text.includes('does not match') ||
    text.includes('not a fast-forward')
  )
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

/** Tek dosya: Contents API (daha az tur). */
async function commitSingleFile(token, branch, file, message) {
  const base = `https://api.github.com/repos/${OWNER}/${REPO}`
  const url = `${base}/contents/${file.path}?ref=${encodeURIComponent(branch)}`
  let sha
  const getRes = await fetch(url, { headers: githubHeaders(token) })
  if (getRes.ok) {
    const existing = await getRes.json()
    sha = existing.sha
  } else if (getRes.status !== 404) {
    throw new Error(`${getRes.status} ${url}: ${await getRes.text()}`)
  }

  const put = await fetch(`${base}/contents/${file.path}`, {
    method: 'PUT',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64Utf8(file.content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  })
  if (put.status === 409 || put.status === 422) throw new Error('CONFLICT')
  if (!put.ok) throw new Error(`Dosya yazılamadı (${file.path}): ${await put.text()}`)
}

async function commitFilesOnBranch(token, branch, files, message) {
  if (files.length === 1) {
    await commitSingleFile(token, branch, files[0], message)
    return
  }

  const base = `https://api.github.com/repos/${OWNER}/${REPO}`

  const ref = await githubJson(
    `${base}/git/ref/heads/${encodeURIComponent(branch)}?t=${Date.now()}`,
    token,
  )
  const latestCommitSha = ref.object.sha
  const latestCommit = await githubJson(`${base}/git/commits/${latestCommitSha}`, token)

  // Blob’ları paralel oluştur — sırayla bekleme
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blob = await githubJson(`${base}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({
          content: toBase64Utf8(file.content),
          encoding: 'base64',
        }),
      })
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      }
    }),
  )

  const tree = await githubJson(`${base}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: latestCommit.tree.sha,
      tree: treeItems,
    }),
  })

  const commit = await githubJson(`${base}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [latestCommitSha],
    }),
  })

  const update = await fetch(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),
  })

  if (update.status === 422 || update.status === 409) {
    throw new Error('CONFLICT')
  }
  if (!update.ok) {
    throw new Error(`Dal güncellenemedi (${branch}): ${await update.text()}`)
  }
}

async function commitFilesWithRetry(token, branch, files, message) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await commitFilesOnBranch(token, branch, files, message)
      return
    } catch (error) {
      if (!isConflictError(error)) throw error
      await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 300))
    }
  }
  throw new Error(`Kayıt çakışması (${branch}). Birkaç saniye sonra tekrar deneyin.`)
}

function assertSafeFiles(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > 3) {
    throw new Error('Geçersiz dosya listesi.')
  }
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || !ALLOWED_PATHS.has(file.path)) {
      throw new Error(`İzin verilmeyen dosya: ${file?.path || '?'}`)
    }
    if (file.data == null || typeof file.data !== 'object') {
      throw new Error(`Geçersiz veri: ${file.path}`)
    }
    // Üye listesini yanlışlıkla boş yayınlamayı engelle (duyuru/etkinlik silinebilir)
    if (file.path.includes('uyeler')) {
      const members = file.data.members
      if (Array.isArray(members) && members.length === 0) {
        throw new Error('Boş üye listesi yayınlanamaz (veri koruması).')
      }
    }
  }
}

async function handlePublish(request, env, origin, ctx) {
  if (!env.GITHUB_TOKEN || !env.ADMIN_PIN_HASH) {
    return json({ ok: false, error: 'Sunucu yapılandırması eksik.' }, 500, origin)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Geçersiz istek.' }, 400, origin)
  }

  const pin = typeof body.pin === 'string' ? body.pin : ''
  if (!pin) return json({ ok: false, error: 'PIN gerekli.' }, 401, origin)

  const hash = await hashPassword(pin)
  if (hash !== env.ADMIN_PIN_HASH) {
    return json({ ok: false, error: 'PIN hatalı.' }, 401, origin)
  }

  try {
    assertSafeFiles(body.files)
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : 'Geçersiz veri.' },
      400,
      origin,
    )
  }

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const message = `admin: veri güncellendi (${stamp})`

  const mainFiles = body.files.map((file) => ({
    path: file.path,
    content: `${JSON.stringify(file.data, null, 2)}\n`,
  }))
  const liveFiles = body.files.map((file) => ({
    path: file.path.replace(/^public\//, ''),
    content: `${JSON.stringify(file.data, null, 2)}\n`,
  }))

  try {
    // İkisini de bekle — main arka planda kalırsa dallar ayrışıyor
    await commitFilesWithRetry(env.GITHUB_TOKEN, LIVE_BRANCH, liveFiles, message)
    await commitFilesWithRetry(env.GITHUB_TOKEN, MAIN_BRANCH, mainFiles, message)
    return json({ ok: true }, 200, origin)
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Yayın başarısız.',
      },
      502,
      origin,
    )
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    const url = new URL(request.url)
    if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '/publish')) {
      return handlePublish(request, env, origin, ctx)
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'tornuk-publish' }, 200, origin)
    }

    return json({ ok: false, error: 'Not found' }, 404, origin)
  },
}

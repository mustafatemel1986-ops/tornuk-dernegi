import { toBase64Utf8 } from './download'

export type GithubSettings = {
  owner: string
  repo: string
  branch: string
  token: string
}

const SETTINGS_KEY = 'tornuk-github-settings'

const DEFAULTS: GithubSettings = {
  owner: 'mustafatemel1986-ops',
  repo: 'tornuk-dernegi',
  branch: 'main',
  token: '',
}

/** Tüm GitHub yazımlarını sıraya al — paralel yayın çakışmasını önler. */
let publishQueue: Promise<void> = Promise.resolve()

export function loadGithubSettings(): GithubSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveGithubSettings(settings: GithubSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function apiHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function isConflictError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return (
    text === 'CONFLICT' ||
    text.includes('"status": "409"') ||
    text.includes(' 409 ') ||
    text.includes(' 422 ') ||
    text.includes('does not match') ||
    text.includes('Update is not a fast forward') ||
    text.includes('not a fast-forward')
  )
}

async function sleep(ms: number) {
  await new Promise((r) => window.setTimeout(r, ms))
}

async function githubJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...apiHeaders(token),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status} ${url}: ${err}`)
  }
  return (await res.json()) as T
}

/** Tek commit ile birden fazla dosya yazar. */
async function commitFilesOnBranch(
  settings: GithubSettings,
  branch: string,
  files: { path: string; content: string }[],
  message: string,
) {
  const base = `https://api.github.com/repos/${settings.owner}/${settings.repo}`
  const token = settings.token

  // Her denemede taze SHA al
  const ref = await githubJson<{ object: { sha: string } }>(
    `${base}/git/ref/heads/${encodeURIComponent(branch)}?t=${Date.now()}`,
    token,
  )
  const latestCommitSha = ref.object.sha

  const latestCommit = await githubJson<{ tree: { sha: string } }>(
    `${base}/git/commits/${latestCommitSha}`,
    token,
  )

  const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = []
  for (const file of files) {
    const blob = await githubJson<{ sha: string }>(`${base}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({
        content: toBase64Utf8(file.content),
        encoding: 'base64',
      }),
    })
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    })
  }

  const tree = await githubJson<{ sha: string }>(`${base}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: latestCommit.tree.sha,
      tree: treeItems,
    }),
  })

  const commit = await githubJson<{ sha: string }>(`${base}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [latestCommitSha],
    }),
  })

  const update = await fetch(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: { ...apiHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),
  })

  if (update.status === 422 || update.status === 409) {
    throw new Error('CONFLICT')
  }
  if (!update.ok) {
    throw new Error(`Dal güncellenemedi (${branch}): ${await update.text()}`)
  }
}

async function commitFilesWithRetry(
  settings: GithubSettings,
  branch: string,
  files: { path: string; content: string }[],
  message: string,
) {
  const maxAttempts = 8

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await commitFilesOnBranch(settings, branch, files, message)
      return
    } catch (error) {
      if (!isConflictError(error)) throw error
      const wait = Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 300)
      await sleep(wait)
    }
  }

  throw new Error(
    `Kayıt çakışması (${branch}). Lütfen 5–10 saniye bekleyip aynı işlemi tekrar deneyin.`,
  )
}

async function pushAdminDataUnlocked(
  settings: GithubSettings,
  files: { path: string; data: unknown }[],
) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const message = `admin: veri güncellendi (${stamp})`

  const mainFiles = files.map((file) => ({
    path: file.path,
    content: `${JSON.stringify(file.data, null, 2)}\n`,
  }))

  const liveFiles = files.map((file) => ({
    path: file.path.replace(/^public\//, ''),
    content: `${JSON.stringify(file.data, null, 2)}\n`,
  }))

  await commitFilesWithRetry(settings, settings.branch || 'main', mainFiles, message)
  await commitFilesWithRetry(settings, 'gh-pages', liveFiles, message)
}

export async function pushAdminData(
  settings: GithubSettings,
  files: { path: string; data: unknown }[],
) {
  if (!settings.owner || !settings.repo || !settings.token) {
    throw new Error('GitHub kullanıcı adı, depo adı ve erişim anahtarı gerekli.')
  }

  const run = publishQueue.catch(() => undefined).then(() => pushAdminDataUnlocked(settings, files))
  publishQueue = run.then(
    () => undefined,
    () => undefined,
  )
  await run
}

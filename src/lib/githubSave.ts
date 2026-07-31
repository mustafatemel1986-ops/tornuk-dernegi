import { toBase64Utf8 } from './download'

export type GithubSettings = {
  owner: string
  repo: string
  branch: string
  token: string
}

const SETTINGS_KEY = 'tornuk-github-settings'

export function loadGithubSettings(): GithubSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return { owner: '', repo: 'tornuk-dernegi', branch: 'main', token: '' }
    }
    return { owner: '', repo: 'tornuk-dernegi', branch: 'main', token: '', ...JSON.parse(raw) }
  } catch {
    return { owner: '', repo: 'tornuk-dernegi', branch: 'main', token: '' }
  }
}

export function saveGithubSettings(settings: GithubSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

async function upsertFile(
  settings: GithubSettings,
  path: string,
  content: string,
  message: string,
) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${settings.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const getUrl = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}?ref=${settings.branch}`
  const existing = await fetch(getUrl, { headers })
  let sha: string | undefined
  if (existing.ok) {
    const data = (await existing.json()) as { sha: string }
    sha = data.sha
  } else if (existing.status !== 404) {
    const err = await existing.text()
    throw new Error(`Dosya okunamadı (${path}): ${err}`)
  }

  const putRes = await fetch(
    `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: toBase64Utf8(content),
        branch: settings.branch,
        sha,
      }),
    },
  )

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`Kayıt başarısız (${path}): ${err}`)
  }
}

export async function pushAdminData(
  settings: GithubSettings,
  files: { path: string; data: unknown }[],
) {
  if (!settings.owner || !settings.repo || !settings.token) {
    throw new Error('GitHub kullanıcı adı, depo adı ve erişim anahtarı gerekli.')
  }

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const liveBranch = { ...settings, branch: 'gh-pages' }

  for (const file of files) {
    const content = `${JSON.stringify(file.data, null, 2)}\n`
    const message = `admin: ${file.path} güncellendi (${stamp})`
    // Kaynak dal (main): public/data/...
    await upsertFile(settings, file.path, content, message)
    // Canlı site (gh-pages): data/... — üyelerin hemen görmesi için
    const livePath = file.path.replace(/^public\//, '')
    await upsertFile(liveBranch, livePath, content, message)
  }
}

import { useMemo, useState } from 'react'
import { loadGithubSettings, saveGithubSettings } from '../lib/githubSave'
import type { Announcement, AnnouncementsData } from '../types'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function makeId(title: string) {
  const slug = title
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  return `duyuru-${todayIso()}-${Date.now().toString(36)}-${slug || 'yeni'}`
}

export function DuyurularAdmin({
  data,
  onChange,
  onPublish,
}: {
  data: AnnouncementsData
  onChange: (next: AnnouncementsData) => void
  onPublish?: (next: AnnouncementsData) => Promise<void>
}) {
  const [draft, setDraft] = useState({
    title: '',
    summary: '',
    body: '',
    date: todayIso(),
  })
  const [tokenInput, setTokenInput] = useState(() => loadGithubSettings().token)
  const [setupDone, setSetupDone] = useState(() => Boolean(loadGithubSettings().token))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const hasToken = useMemo(() => setupDone && Boolean(loadGithubSettings().token), [setupDone, busy])

  function updateItem(id: string, patch: Partial<Announcement>) {
    onChange({
      ...data,
      updatedAt: new Date().toISOString(),
      items: data.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  function buildItem(): Announcement | null {
    if (!draft.title.trim() || !draft.summary.trim()) return null
    return {
      id: makeId(draft.title),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      body: draft.body.trim() || draft.summary.trim(),
      date: draft.date || todayIso(),
    }
  }

  function saveTokenOnce() {
    const token = tokenInput.trim()
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      setErr('Geçerli bir GitHub token yapıştırın (genelde ghp_ ile başlar).')
      return
    }
    const settings = loadGithubSettings()
    saveGithubSettings({ ...settings, token })
    setSetupDone(true)
    setErr(null)
    setMsg('Kurulum tamam. Bundan sonra sadece duyuru yazıp Yayınla’ya basmanız yeterli.')
  }

  async function publish(next: AnnouncementsData, successText: string): Promise<boolean> {
    if (!onPublish) return false
    if (!loadGithubSettings().token) {
      setSetupDone(false)
      setErr('Önce aşağıdaki kutuya Access Token’ı bir kez yapıştırın.')
      return false
    }

    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      onChange(next)
      await onPublish(next)
      setMsg(successText)
      return true
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Yayın başarısız.'
      setErr(text)
      if (text.toLowerCase().includes('token') || text.includes('401') || text.includes('Bad credentials')) {
        setSetupDone(false)
      }
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addAndPublish() {
    const item = buildItem()
    if (!item) return
    const next: AnnouncementsData = {
      updatedAt: new Date().toISOString(),
      items: [item, ...data.items],
    }
    const ok = await publish(
      next,
      'Yayınlandı. Üyelerin telefonunda Duyurular birkaç saniye içinde güncellenir.',
    )
    if (ok) setDraft({ title: '', summary: '', body: '', date: todayIso() })
  }

  async function publishCurrent() {
    await publish(
      { ...data, updatedAt: new Date().toISOString() },
      'Mevcut duyurular yayınlandı.',
    )
  }

  function moveTop(id: string) {
    const item = data.items.find((x) => x.id === id)
    if (!item) return
    onChange({
      updatedAt: new Date().toISOString(),
      items: [item, ...data.items.filter((x) => x.id !== id)],
    })
  }

  return (
    <div className="admin-panel">
      <h2>Duyurular</h2>
      <p className="hint">
        Bilgisayar veya telefondan bu paneli açıp duyuru yazın → <strong>Yayınla</strong>. Üyeler
        aynı uygulamada görür. Access Token yalnızca <strong>bu cihazda bir kez</strong> girilir;
        her duyuruda tekrar istenmez.
      </p>

      {!hasToken && (
        <div className="admin-panel" style={{ boxShadow: 'none', border: '1px solid #d8b4a0' }}>
          <h3 className="panel-title">İlk kurulum (bir kez)</h3>
          <ol className="hint" style={{ paddingLeft: '1.2rem' }}>
            <li>
              <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
                Bu linke tıklayın
              </a>{' '}
              → Generate new token (classic)
            </li>
            <li>
              Sadece <code>repo</code> işaretleyin → Generate → <code>ghp_...</code> kodunu kopyalayın
            </li>
            <li>Aşağıya yapıştırıp Kaydet’e basın — bir daha sormaz (bu tarayıcıda)</li>
          </ol>
          <label className="admin-label">
            Access Token
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.trim())}
              placeholder="ghp_..."
              autoComplete="off"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={saveTokenOnce}>
            Token’ı kaydet
          </button>
        </div>
      )}

      <div className="admin-fields">
        <label className="admin-label">
          Başlık
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </label>
        <label className="admin-label">
          Kısa özet
          <input
            value={draft.summary}
            onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
          />
        </label>
        <label className="admin-label">
          Detay
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          />
        </label>
        <label className="admin-label">
          Tarih
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.title.trim() || !draft.summary.trim()}
          onClick={() => void addAndPublish()}
        >
          {busy ? 'Yayınlanıyor…' : 'Yayınla'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void publishCurrent()}
        >
          Listedeki değişiklikleri yayınla
        </button>
        {msg && <p className="admin-msg ok">{msg}</p>}
        {err && <p className="admin-msg err">{err}</p>}
      </div>

      <div className="admin-grid">
        {data.items.map((item, index) => (
          <article key={item.id} className="admin-card">
            <div className="admin-card-head">
              <strong>
                {index === 0 ? 'En yeni · ' : ''}
                {item.title}
              </strong>
              <span className="hint">{item.date}</span>
            </div>
            <div className="admin-fields">
              <label className="admin-label">
                Başlık
                <input
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                />
              </label>
              <label className="admin-label">
                Özet
                <input
                  value={item.summary}
                  onChange={(e) => updateItem(item.id, { summary: e.target.value })}
                />
              </label>
              <label className="admin-label">
                Detay
                <textarea
                  value={item.body}
                  onChange={(e) => updateItem(item.id, { body: e.target.value })}
                />
              </label>
              <label className="admin-label">
                Tarih
                <input
                  type="date"
                  value={item.date}
                  onChange={(e) => updateItem(item.id, { date: e.target.value })}
                />
              </label>
            </div>
            <div className="admin-actions">
              {index > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => moveTop(item.id)}>
                  En üste al
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (confirm('Bu duyuru silinsin mi?')) {
                    onChange({
                      updatedAt: new Date().toISOString(),
                      items: data.items.filter((x) => x.id !== item.id),
                    })
                  }
                }}
              >
                Sil
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

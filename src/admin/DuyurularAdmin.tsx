import { useMemo, useState } from 'react'
import { loadGithubSettings, saveGithubSettings } from '../lib/githubSave'
import { publishDuyuruToNtfy, waitForLiveDuyuru } from '../lib/ntfyPush'
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
  onPublishNow,
}: {
  data: AnnouncementsData
  /** Düzenleme — üst bileşen debounce ile yayınlar */
  onChange: (next: AnnouncementsData) => void
  /** Ekle / sil / sıra — hemen yayın */
  onPublishNow: (next: AnnouncementsData, successText: string) => Promise<void>
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

  async function publishImmediate(next: AnnouncementsData, successText: string): Promise<boolean> {
    if (!loadGithubSettings().token) {
      setSetupDone(false)
      setErr('Önce Access Token’ı bir kez kaydedin (aşağıdaki kutu).')
      return false
    }

    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      await onPublishNow(next, successText)
      setMsg(successText)
      return true
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Yayın başarısız.'
      setErr(text)
      if (
        text.toLowerCase().includes('token') ||
        text.includes('401') ||
        text.includes('Bad credentials')
      ) {
        setSetupDone(false)
      }
      return false
    } finally {
      setBusy(false)
    }
  }

  function saveTokenOnce() {
    const token = tokenInput.trim()
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      setErr('Geçerli bir GitHub token yapıştırın (genelde ghp_ ile başlar).')
      return
    }
    saveGithubSettings({ ...loadGithubSettings(), token })
    setSetupDone(true)
    setErr(null)
    setMsg('Token kaydedildi. Artık “Duyuru ekle” canlıya hemen yayınlar.')
  }

  function updateItem(id: string, patch: Partial<Announcement>) {
    onChange({
      ...data,
      updatedAt: new Date().toISOString(),
      items: data.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  async function addItem() {
    if (!draft.title.trim() || !draft.summary.trim()) return
    const item: Announcement = {
      id: makeId(draft.title),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      body: draft.body.trim() || draft.summary.trim(),
      date: draft.date || todayIso(),
    }
    const next: AnnouncementsData = {
      updatedAt: new Date().toISOString(),
      items: [item, ...data.items],
    }
    const ok = await publishImmediate(next, 'Duyuru eklendi ve canlıya yayınlandı.')
    if (!ok) return

    setDraft({ title: '', summary: '', body: '', date: todayIso() })

    // Bildirim: önce canlı JSON’da görünsün, sonra ntfy (liste–bildirim uyumsuzluğu olmasın)
    try {
      const live = await waitForLiveDuyuru(item.id)
      if (live) {
        await publishDuyuruToNtfy({
          id: item.id,
          title: item.title,
          summary: item.summary,
        })
        setMsg('Duyuru yayınlandı. Üyelere anlık bildirim gönderildi.')
      } else {
        setMsg(
          'Duyuru yayınlandı. Canlı site biraz gecikebilir; üyeler yenileyince görür. Bildirim şimdilik atlandı.',
        )
      }
    } catch {
      setMsg(
        'Duyuru yayınlandı. Anlık bildirim gönderilemedi; üyeler uygulamayı açınca görür.',
      )
    }
  }

  async function removeItem(id: string) {
    if (!confirm('Bu duyuru silinsin mi? Canlı siteden de kalkacak.')) return
    const next: AnnouncementsData = {
      updatedAt: new Date().toISOString(),
      items: data.items.filter((x) => x.id !== id),
    }
    await publishImmediate(next, 'Duyuru silindi ve yayınlandı.')
  }

  async function moveTop(id: string) {
    const item = data.items.find((x) => x.id === id)
    if (!item) return
    const next: AnnouncementsData = {
      updatedAt: new Date().toISOString(),
      items: [item, ...data.items.filter((x) => x.id !== id)],
    }
    await publishImmediate(next, 'Sıra güncellendi ve yayınlandı.')
  }

  return (
    <div className="admin-panel">
      <h2>Duyurular</h2>
      <p className="hint">
        <strong>Duyuru ekle</strong> = hemen canlı siteye ve üye uygulamalarına gider. Kaydet
        menüsüne girmenize gerek yok.
      </p>

      {!hasToken && (
        <div className="admin-panel" style={{ boxShadow: 'none', border: '1px solid #d8b4a0' }}>
          <h3 className="panel-title">İlk kurulum (bir kez)</h3>
          <ol className="hint" style={{ paddingLeft: '1.2rem' }}>
            <li>
              <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
                Token oluşturun
              </a>{' '}
              (classic, sadece <code>repo</code>)
            </li>
            <li>
              <code>ghp_...</code> kodunu yapıştırıp kaydedin — bir daha sormaz
            </li>
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
          onClick={() => void addItem()}
        >
          {busy ? 'Yayınlanıyor…' : 'Duyuru ekle'}
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
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void moveTop(item.id)}
                >
                  En üste al
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void removeItem(item.id)}
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

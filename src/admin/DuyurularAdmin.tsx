import { useState } from 'react'
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
  onChange: (next: AnnouncementsData) => void
  onPublishNow: (next: AnnouncementsData, successText: string) => Promise<void>
}) {
  const [draft, setDraft] = useState({
    title: '',
    summary: '',
    body: '',
    date: todayIso(),
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function publishImmediate(next: AnnouncementsData, successText: string): Promise<boolean> {
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      await onPublishNow(next, successText)
      setMsg(successText)
      return true
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Yayın başarısız.')
      return false
    } finally {
      setBusy(false)
    }
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
      setMsg('Duyuru yayınlandı. Anlık bildirim gönderilemedi; üyeler uygulamayı açınca görür.')
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
        <strong>Duyuru ekle</strong> hemen canlıya yayınlanır. Yalnızca yönetici PIN’i yeterlidir.
      </p>

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

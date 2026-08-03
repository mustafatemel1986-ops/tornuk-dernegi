import { useState } from 'react'
import { publishNotifyToNtfy } from '../lib/ntfyPush'
import type { EventItem, EventsData } from '../types'

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
  return `etk-${todayIso()}-${Date.now().toString(36)}-${slug || 'yeni'}`
}

export function EtkinliklerAdmin({
  data,
  onChange,
  onPublishNow,
}: {
  data: EventsData
  onChange: (next: EventsData) => void
  onPublishNow: (next: EventsData, successText: string) => Promise<'direct' | 'worker' | void>
}) {
  const [draft, setDraft] = useState({
    title: '',
    date: todayIso(),
    time: '14:00',
    place: 'Dernek Lokali',
    description: '',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function publishImmediate(
    next: EventsData,
    successText: string,
  ): Promise<'direct' | 'worker' | false> {
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const via = (await onPublishNow(next, successText)) || 'direct'
      setMsg(successText)
      return via
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Yayın başarısız.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function updateItem(id: string, patch: Partial<EventItem>) {
    onChange({
      ...data,
      updatedAt: new Date().toISOString(),
      items: data.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  async function addItem() {
    if (!draft.title.trim() || !draft.date) return
    const item: EventItem = {
      id: makeId(draft.title),
      title: draft.title.trim(),
      date: draft.date,
      time: draft.time || '14:00',
      place: draft.place.trim() || 'Belirlenecek',
      description: draft.description.trim(),
    }
    // En üste ekle — bildirim sistemi items[0]’ı “yeni” kabul eder (liste UI tarihe göre sıralar)
    const next: EventsData = {
      updatedAt: new Date().toISOString(),
      items: [item, ...data.items],
    }
    const via = await publishImmediate(next, 'Etkinlik eklendi ve canlıya yayınlandı.')
    if (!via) return

    setDraft({
      title: '',
      date: todayIso(),
      time: '14:00',
      place: 'Dernek Lokali',
      description: '',
    })

    const summary = [item.date, item.time, item.place].filter(Boolean).join(' · ')
    void publishNotifyToNtfy({
      kind: 'etkinlik',
      id: item.id,
      title: item.title,
      summary: item.description.trim() || summary,
    })
      .then(() => setMsg('Etkinlik yayınlandı. Üyelere anlık bildirim gönderildi.'))
      .catch(() =>
        setMsg(
          'Etkinlik yayınlandı. Anlık kanal bu ağda kapalı; üyeler uygulama açıksa kısa sürede bildirilir.',
        ),
      )
  }

  const sorted = data.items.slice().sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="admin-panel">
      <h2>Etkinlikler</h2>
      <p className="hint">
        <strong>Etkinlik ekle</strong> hemen canlıya yayınlanır ve üyelere bildirim gider. Yalnızca
        yönetici PIN’i yeterlidir.
      </p>

      <div className="admin-fields">
        <label className="admin-label">
          Başlık
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </label>
        <div className="admin-fields two">
          <label className="admin-label">
            Tarih
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
          </label>
          <label className="admin-label">
            Saat
            <input
              type="time"
              value={draft.time}
              onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
            />
          </label>
        </div>
        <label className="admin-label">
          Yer
          <input
            value={draft.place}
            onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))}
          />
        </label>
        <label className="admin-label">
          Açıklama
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.title.trim() || !draft.date}
          onClick={() => void addItem()}
        >
          {busy ? 'Yayınlanıyor…' : 'Etkinlik ekle'}
        </button>
        {msg && <p className="admin-msg ok">{msg}</p>}
        {err && <p className="admin-msg err">{err}</p>}
      </div>

      <div className="admin-grid">
        {sorted.map((item) => (
          <article key={item.id} className="admin-card">
            <div className="admin-card-head">
              <strong>{item.title}</strong>
              <span className="hint">
                {item.date} · {item.time}
              </span>
            </div>
            <div className="admin-fields">
              <label className="admin-label">
                Başlık
                <input
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                />
              </label>
              <div className="admin-fields two">
                <label className="admin-label">
                  Tarih
                  <input
                    type="date"
                    value={item.date}
                    onChange={(e) => updateItem(item.id, { date: e.target.value })}
                  />
                </label>
                <label className="admin-label">
                  Saat
                  <input
                    type="time"
                    value={item.time}
                    onChange={(e) => updateItem(item.id, { time: e.target.value })}
                  />
                </label>
              </div>
              <label className="admin-label">
                Yer
                <input
                  value={item.place}
                  onChange={(e) => updateItem(item.id, { place: e.target.value })}
                />
              </label>
              <label className="admin-label">
                Açıklama
                <textarea
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                />
              </label>
            </div>
            <div className="admin-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Bu etkinlik silinsin mi? Canlı siteden de kalkacak.')) return
                  void publishImmediate(
                    {
                      updatedAt: new Date().toISOString(),
                      items: data.items.filter((x) => x.id !== item.id),
                    },
                    'Etkinlik silindi ve yayınlandı.',
                  )
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

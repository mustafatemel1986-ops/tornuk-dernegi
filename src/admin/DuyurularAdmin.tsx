import { useState } from 'react'
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
  return `duyuru-${todayIso()}-${slug || 'yeni'}`
}

export function DuyurularAdmin({
  data,
  onChange,
}: {
  data: AnnouncementsData
  onChange: (next: AnnouncementsData) => void
}) {
  const [draft, setDraft] = useState({
    title: '',
    summary: '',
    body: '',
    date: todayIso(),
  })

  function updateItem(id: string, patch: Partial<Announcement>) {
    onChange({
      ...data,
      updatedAt: new Date().toISOString(),
      items: data.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  function addItem() {
    if (!draft.title.trim() || !draft.summary.trim()) return
    const item: Announcement = {
      id: makeId(draft.title),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      body: draft.body.trim() || draft.summary.trim(),
      date: draft.date || todayIso(),
    }
    onChange({
      updatedAt: new Date().toISOString(),
      items: [item, ...data.items],
    })
    setDraft({ title: '', summary: '', body: '', date: todayIso() })
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
        Yeni duyuru listenin en üstüne eklenir. Üyelerin görmesi ve bildirim alması için sonra{' '}
        <strong>Kaydet</strong> sekmesinden “GitHub’a kaydet ve yayınla” yapın.
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
        <button type="button" className="btn btn-primary" onClick={addItem}>
          Duyuru ekle
        </button>
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

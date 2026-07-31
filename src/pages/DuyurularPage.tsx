import { useEffect, useState } from 'react'
import { formatDate } from '../lib/format'
import { DATA_UPDATED_EVENT, loadAnnouncementsData } from '../lib/liveData'
import type { Announcement, AnnouncementsData } from '../types'

export function DuyurularPage() {
  const [data, setData] = useState<AnnouncementsData | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const json = await loadAnnouncementsData()
        if (!cancelled) {
          setData(json)
          if (json.items[0]) setOpenId((prev) => prev ?? json.items[0].id)
        }
      } catch {
        if (!cancelled) setError('Duyurular yüklenemedi.')
      }
    }
    function onUpdate() {
      void load()
    }
    void load()
    window.addEventListener(DATA_UPDATED_EVENT, onUpdate)
    return () => {
      cancelled = true
      window.removeEventListener(DATA_UPDATED_EVENT, onUpdate)
    }
  }, [])

  return (
    <section className="page">
      <header className="page-head">
        <h1>Duyurular</h1>
        <p>Genel kurul, toplantı ve önemli haberler.</p>
      </header>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="hint">Yükleniyor…</p>}

      <div className="stack">
        {data?.items.map((item) => (
          <AnnouncementCard
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
          />
        ))}
      </div>
    </section>
  )
}

function AnnouncementCard({
  item,
  open,
  onToggle,
}: {
  item: Announcement
  open: boolean
  onToggle: () => void
}) {
  return (
    <article className={`content-card ${open ? 'is-open' : ''}`}>
      <button type="button" className="content-card-toggle" onClick={onToggle}>
        <div>
          <h2>{item.title}</h2>
          <time dateTime={item.date}>{formatDate(item.date)}</time>
        </div>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <p className="content-summary">{item.summary}</p>
      {open && <p className="content-body">{item.body}</p>}
    </article>
  )
}

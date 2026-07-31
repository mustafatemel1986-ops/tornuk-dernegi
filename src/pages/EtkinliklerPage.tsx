import { useEffect, useState } from 'react'
import { formatDate } from '../lib/format'
import { DATA_UPDATED_EVENT, loadEventsData } from '../lib/liveData'
import type { EventItem, EventsData } from '../types'

export function EtkinliklerPage() {
  const [data, setData] = useState<EventsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const json = await loadEventsData()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError('Etkinlikler yüklenemedi.')
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

  const upcoming =
    data?.items
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((item) => item.date >= new Date().toISOString().slice(0, 10)) ?? []

  const past =
    data?.items
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((item) => item.date < new Date().toISOString().slice(0, 10)) ?? []

  return (
    <section className="page">
      <header className="page-head">
        <h1>Etkinlikler</h1>
        <p>Yaklaşan buluşmalar ve dernek faaliyetleri.</p>
      </header>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="hint">Yükleniyor…</p>}

      {upcoming.length > 0 && (
        <div className="stack">
          <h2 className="section-label">Yaklaşan</h2>
          {upcoming.map((item) => (
            <EventCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="stack">
          <h2 className="section-label">Geçmiş</h2>
          {past.map((item) => (
            <EventCard key={item.id} item={item} muted />
          ))}
        </div>
      )}
    </section>
  )
}

function EventCard({ item, muted }: { item: EventItem; muted?: boolean }) {
  return (
    <article className={`content-card event-card ${muted ? 'is-muted' : ''}`}>
      <div className="event-date">
        <strong>{formatDate(item.date)}</strong>
        <span>{item.time}</span>
      </div>
      <h2>{item.title}</h2>
      <p className="event-place">{item.place}</p>
      <p className="content-summary">{item.description}</p>
    </article>
  )
}

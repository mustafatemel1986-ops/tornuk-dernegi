import { useEffect, useState } from 'react'
import { BrandMark } from '../components/BrandMark'
import { InstallButton } from '../components/InstallButton'
import { formatDate } from '../lib/format'
import { loadAnnouncementsData, loadEventsData } from '../lib/liveData'
import type { Announcement, AssociationData, EventItem, TabId } from '../types'

export function HomePage({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const [latestDuyuru, setLatestDuyuru] = useState<Announcement | null>(null)
  const [nextEvent, setNextEvent] = useState<EventItem | null>(null)
  const [assoc, setAssoc] = useState<AssociationData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [d, e, aRes] = await Promise.all([
          loadAnnouncementsData(),
          loadEventsData(),
          fetch(`${import.meta.env.BASE_URL}data/dernek.json?t=${Date.now()}`, {
            cache: 'no-store',
          }),
        ])
        if (cancelled) return
        setLatestDuyuru(d.items?.[0] ?? null)
        const today = new Date().toISOString().slice(0, 10)
        const next = e.items
          .filter((item) => item.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))[0]
        setNextEvent(next ?? null)
        if (aRes.ok) setAssoc(await aRes.json())
      } catch {
        // sessiz
      }
    }
    void load()
    function onVisible() {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
    }
  }, [])

  return (
    <section className="page home-page">
      <header className="brand">
        <BrandMark size={88} />
        <h1>Törnük Derneği</h1>
        <p>{assoc?.shortDescription ?? 'Üye aidat, duyuru ve etkinlik uygulaması.'}</p>
        <InstallButton />
      </header>

      <div className="quick-grid">
        <button type="button" className="quick-card" onClick={() => onNavigate('aidat')}>
          <strong>Aidat</strong>
          <span>Borç sorgula</span>
        </button>
        <button type="button" className="quick-card" onClick={() => onNavigate('duyurular')}>
          <strong>Duyurular</strong>
          <span>Son haberler</span>
        </button>
        <button type="button" className="quick-card" onClick={() => onNavigate('etkinlikler')}>
          <strong>Etkinlikler</strong>
          <span>Takvim</span>
        </button>
        <button type="button" className="quick-card" onClick={() => onNavigate('menu')}>
          <strong>Menü</strong>
          <span>IBAN, belgeler</span>
        </button>
      </div>

      {latestDuyuru && (
        <button
          type="button"
          className="content-card teaser-card"
          onClick={() => onNavigate('duyurular')}
        >
          <span className="section-label">Son duyuru</span>
          <h2>{latestDuyuru.title}</h2>
          <p className="content-summary">{latestDuyuru.summary}</p>
          <time dateTime={latestDuyuru.date}>{formatDate(latestDuyuru.date)}</time>
        </button>
      )}

      {nextEvent && (
        <button
          type="button"
          className="content-card teaser-card"
          onClick={() => onNavigate('etkinlikler')}
        >
          <span className="section-label">Sıradaki etkinlik</span>
          <h2>{nextEvent.title}</h2>
          <p className="content-summary">
            {formatDate(nextEvent.date)} · {nextEvent.time} · {nextEvent.place}
          </p>
        </button>
      )}
    </section>
  )
}

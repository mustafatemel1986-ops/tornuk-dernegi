import { useEffect, useState } from 'react'
import { formatDate } from '../lib/format'
import { loadAnnouncementsData } from '../lib/liveData'
import type { Announcement, AnnouncementsData } from '../types'

export function DuyurularPage() {
  const [data, setData] = useState<AnnouncementsData | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Eski SW önbelleğini temizle
        const reg = await navigator.serviceWorker?.ready
        reg?.active?.postMessage({ type: 'PURGE_DATA_CACHE' })

        const json = await loadAnnouncementsData()
        if (cancelled) return
        setData(json)
        setError(null)
        if (json.items[0]) setOpenId(json.items[0].id)
      } catch {
        if (!cancelled) setError('Duyurular yüklenemedi. Yenile’ye basın.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    function onVisible() {
      if (document.visibilityState === 'visible') void load()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(() => void load(), 15 * 1000)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker?.ready
      reg?.active?.postMessage({ type: 'PURGE_DATA_CACHE' })
      await reg?.update()
      const json = await loadAnnouncementsData()
      setData(json)
      if (json.items[0]) setOpenId(json.items[0].id)
    } catch {
      setError('Duyurular yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Duyurular</h1>
        <p>Genel kurul, toplantı ve önemli haberler.</p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: '0.5rem' }}
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? 'Yenileniyor…' : 'Listeyi yenile'}
        </button>
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

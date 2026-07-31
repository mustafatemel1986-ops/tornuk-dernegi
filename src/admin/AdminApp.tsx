import { useEffect, useState } from 'react'
import { isAdminLoggedIn, setAdminLoggedIn } from '../lib/adminAuth'
import {
  getLiveAnnouncements,
  getLiveEvents,
  getLiveMembers,
  setLiveAnnouncements,
  setLiveEvents,
  setLiveMembers,
} from '../lib/liveData'
import type { AnnouncementsData, EventsData, MembershipData } from '../types'
import './admin.css'
import { AdminLogin } from './AdminLogin'
import { AidatAdmin } from './AidatAdmin'
import { DuyurularAdmin } from './DuyurularAdmin'
import { EtkinliklerAdmin } from './EtkinliklerAdmin'
import { SavePanel } from './SavePanel'

type AdminTab = 'aidat' | 'duyurular' | 'etkinlikler' | 'kaydet'

export function AdminApp() {
  const [authed, setAuthed] = useState(() => isAdminLoggedIn())
  const [tab, setTab] = useState<AdminTab>('aidat')
  const [members, setMembers] = useState<MembershipData | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementsData | null>(null)
  const [events, setEvents] = useState<EventsData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!authed) return
    let cancelled = false

    async function load() {
      try {
        setLoadError(null)
        const liveMembers = getLiveMembers()
        const liveDuyuru = getLiveAnnouncements()
        const liveEvents = getLiveEvents()

        const base = import.meta.env.BASE_URL
        const [mRes, dRes, eRes] = await Promise.all([
          fetch(`${base}data/uyeler.json?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`${base}data/duyurular.json?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`${base}data/etkinlikler.json?t=${Date.now()}`, { cache: 'no-store' }),
        ])
        if (!mRes.ok || !dRes.ok || !eRes.ok) throw new Error('Veriler yüklenemedi')
        const [m, d, e] = await Promise.all([mRes.json(), dRes.json(), eRes.json()])
        if (cancelled) return

        setMembers(liveMembers ?? m)
        setAnnouncements(liveDuyuru ?? d)
        setEvents(liveEvents ?? e)
        setDirty(Boolean(liveMembers || liveDuyuru || liveEvents))
      } catch {
        if (!cancelled) setLoadError('Yönetim verileri yüklenemedi.')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authed, reloadToken])

  if (!authed) {
    return (
      <div className="admin-shell">
        <AdminLogin onSuccess={() => setAuthed(true)} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="admin-shell">
        <p className="admin-msg err">{loadError}</p>
      </div>
    )
  }

  if (!members || !announcements || !events) {
    return (
      <div className="admin-shell">
        <p className="hint">Yönetim verileri yükleniyor…</p>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <div>
          <h1>Yönetim paneli</h1>
          <p className="hint">
            Törnük Derneği — değişiklikler bu cihazda hemen geçerli olur; diğer üyeler için Kaydet
            gerekir.
          </p>
        </div>
        <div className="admin-actions">
          {dirty && <span className="admin-dirty">Yayın bekliyor</span>}
          <a
            className="btn btn-ghost"
            href={import.meta.env.BASE_URL}
            onClick={(e) => {
              e.preventDefault()
              window.location.hash = ''
              window.location.href = import.meta.env.BASE_URL
            }}
          >
            Siteye dön
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAdminLoggedIn(false)
              setAuthed(false)
            }}
          >
            Çıkış
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {(
          [
            ['aidat', 'Aidat'],
            ['duyurular', 'Duyurular'],
            ['etkinlikler', 'Etkinlikler'],
            ['kaydet', 'Kaydet'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`admin-tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'aidat' && (
        <AidatAdmin
          data={members}
          onChange={(next) => {
            setMembers(next)
            setLiveMembers(next)
            setDirty(true)
          }}
        />
      )}
      {tab === 'duyurular' && (
        <DuyurularAdmin
          data={announcements}
          onChange={(next) => {
            setAnnouncements(next)
            setLiveAnnouncements(next)
            setDirty(true)
          }}
        />
      )}
      {tab === 'etkinlikler' && (
        <EtkinliklerAdmin
          data={events}
          onChange={(next) => {
            setEvents(next)
            setLiveEvents(next)
            setDirty(true)
          }}
        />
      )}
      {tab === 'kaydet' && (
        <SavePanel
          members={members}
          announcements={announcements}
          events={events}
          dirty={dirty}
          onSaved={() => setDirty(false)}
          onReloadFromServer={() => {
            setMembers(null)
            setAnnouncements(null)
            setEvents(null)
            setReloadToken((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

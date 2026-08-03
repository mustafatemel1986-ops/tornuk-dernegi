import { useCallback, useEffect, useRef, useState } from 'react'
import { isAdminLoggedIn, setAdminLoggedIn } from '../lib/adminAuth'
import { loadGithubSettings, pushAdminData, saveGithubSettings } from '../lib/githubSave'
import {
  clearLiveData,
  getLiveAnnouncements,
  getLiveEvents,
  getLiveMembers,
  pickNewerData,
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
import { InstallStats } from './InstallStats'

type AdminTab = 'aidat' | 'duyurular' | 'etkinlikler' | 'indirenler' | 'ayarlar'

export function AdminApp() {
  const [authed, setAuthed] = useState(() => isAdminLoggedIn())
  const [tab, setTab] = useState<AdminTab>('duyurular')
  const [members, setMembers] = useState<MembershipData | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementsData | null>(null)
  const [events, setEvents] = useState<EventsData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState<string | null>(null)
  const [publishNote, setPublishNote] = useState<string | null>(null)

  const [reloadToken, setReloadToken] = useState(0)
  const dataRef = useRef({ members, announcements, events })
  const aidatTimer = useRef<number | null>(null)
  const publishChain = useRef(Promise.resolve())

  dataRef.current = { members, announcements, events }

  useEffect(() => {
    if (!authed) return
    let cancelled = false

    async function load() {
      try {
        setLoadError(null)
        setDraftNote(null)

        const base = import.meta.env.BASE_URL
        const [mRes, dRes, eRes] = await Promise.all([
          fetch(`${base}data/uyeler.json?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`${base}data/duyurular.json?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`${base}data/etkinlikler.json?t=${Date.now()}`, { cache: 'no-store' }),
        ])
        if (!mRes.ok || !dRes.ok || !eRes.ok) throw new Error('Veriler yüklenemedi')
        const [m, d, e] = await Promise.all([
          mRes.json() as Promise<MembershipData>,
          dRes.json() as Promise<AnnouncementsData>,
          eRes.json() as Promise<EventsData>,
        ])
        if (cancelled) return

        const membersPick = pickNewerData(getLiveMembers(), m)
        const duyuruPick = pickNewerData(getLiveAnnouncements(), d)
        const eventsPick = pickNewerData(getLiveEvents(), e)

        setMembers(membersPick.data)
        setAnnouncements(duyuruPick.data)
        setEvents(eventsPick.data)

        const usingDraft = membersPick.fromLive || duyuruPick.fromLive || eventsPick.fromLive
        setDirty(usingDraft)
        if (usingDraft) {
          setDraftNote(
            'Yayınlanmamış yerel taslak vardı. Aidat/duyuru/etkinlik ekleyince otomatik yayınlanır; veya Ayarlar → sunucudan yükle.',
          )
        }
      } catch {
        if (!cancelled) setLoadError('Yönetim verileri yüklenemedi.')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authed, reloadToken])

  const publishLive = useCallback(
    async (patch?: {
      members?: MembershipData
      announcements?: AnnouncementsData
      events?: EventsData
    }) => {
      const settings = loadGithubSettings()
      if (!settings.token) {
        throw new Error(
          'Access Token yok. Duyurular sekmesindeki “İlk kurulum”dan bir kez token kaydedin.',
        )
      }
      saveGithubSettings(settings)

      const nextMembers = patch?.members ?? dataRef.current.members
      const nextAnnouncements = patch?.announcements ?? dataRef.current.announcements
      const nextEvents = patch?.events ?? dataRef.current.events
      if (!nextMembers || !nextAnnouncements || !nextEvents) {
        throw new Error('Veriler henüz yüklenmedi.')
      }

      const run = async () => {
        await pushAdminData(settings, [
          { path: 'public/data/uyeler.json', data: nextMembers },
          { path: 'public/data/duyurular.json', data: nextAnnouncements },
          { path: 'public/data/etkinlikler.json', data: nextEvents },
        ])
        setMembers(nextMembers)
        setAnnouncements(nextAnnouncements)
        setEvents(nextEvents)
        setLiveMembers(nextMembers)
        setLiveAnnouncements(nextAnnouncements)
        setLiveEvents(nextEvents)
        dataRef.current = {
          members: nextMembers,
          announcements: nextAnnouncements,
          events: nextEvents,
        }
        setDirty(false)
        setDraftNote(null)
        setPublishNote('Canlıya yayınlandı.')
      }

      publishChain.current = publishChain.current
        .catch(() => undefined)
        .then(() => run())
      await publishChain.current
    },
    [],
  )

  function scheduleAidatPublish(next: MembershipData) {
    setMembers(next)
    setLiveMembers(next)
    setDirty(true)
    dataRef.current = { ...dataRef.current, members: next }
    if (aidatTimer.current) window.clearTimeout(aidatTimer.current)
    aidatTimer.current = window.setTimeout(() => {
      void publishLive({ members: next })
        .then(() => setPublishNote('Aidat değişiklikleri otomatik yayınlandı.'))
        .catch((error) =>
          setDraftNote(error instanceof Error ? error.message : 'Aidat yayını başarısız.'),
        )
    }, 1500)
  }

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
            Duyuru / etkinlik / aidat ekleyince <strong>otomatik canlıya yayınlanır</strong>. Kaydet
            menüsüne girmenize gerek yok.
          </p>
        </div>
        <div className="admin-actions">
          {dirty && <span className="admin-dirty">Yayınlanıyor…</span>}
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

      {draftNote && <p className="admin-msg err">{draftNote}</p>}
      {publishNote && <p className="admin-msg ok">{publishNote}</p>}

      <div className="admin-tabs">
        {(
          [
            ['aidat', 'Aidat'],
            ['duyurular', 'Duyurular'],
            ['etkinlikler', 'Etkinlikler'],
            ['indirenler', 'İndirenler'],
            ['ayarlar', 'Ayarlar'],
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
        <AidatAdmin data={members} onChange={(next) => scheduleAidatPublish(next)} />
      )}
      {tab === 'duyurular' && (
        <DuyurularAdmin
          data={announcements}
          onChange={(next) => {
            setAnnouncements(next)
            setLiveAnnouncements(next)
            dataRef.current = { ...dataRef.current, announcements: next }
            setDirty(true)
          }}
          onPublish={async (next) => {
            await publishLive({ announcements: next })
          }}
        />
      )}
      {tab === 'etkinlikler' && (
        <EtkinliklerAdmin
          data={events}
          onChange={(next) => {
            setEvents(next)
            setLiveEvents(next)
            dataRef.current = { ...dataRef.current, events: next }
            setDirty(true)
          }}
          onPublish={async (next) => {
            await publishLive({ events: next })
          }}
        />
      )}
      {tab === 'indirenler' && <InstallStats />}
      {tab === 'ayarlar' && (
        <SavePanel
          members={members}
          announcements={announcements}
          events={events}
          dirty={dirty}
          onSaved={() => {
            setDirty(false)
            setDraftNote(null)
            setPublishNote('Manuel yayın tamam.')
          }}
          onReloadFromServer={() => {
            clearLiveData()
            setMembers(null)
            setAnnouncements(null)
            setEvents(null)
            setDirty(false)
            setDraftNote(null)
            setReloadToken((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

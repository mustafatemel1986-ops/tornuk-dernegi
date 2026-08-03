import { useEffect, useState } from 'react'
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

type AdminTab = 'aidat' | 'duyurular' | 'etkinlikler' | 'indirenler' | 'kaydet'

export function AdminApp() {
  const [authed, setAuthed] = useState(() => isAdminLoggedIn())
  const [tab, setTab] = useState<AdminTab>('duyurular')
  const [members, setMembers] = useState<MembershipData | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementsData | null>(null)
  const [events, setEvents] = useState<EventsData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState<string | null>(null)

  const [reloadToken, setReloadToken] = useState(0)

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
            'Bu tarayıcıda yayınlanmamış taslak var. Üyelerin görmesi için Duyurular → “Ekle ve yayınla” veya Kaydet ile yayınlayın. Taslağı silmek için “Sunucudan yükle”.',
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
            Telefon veya bilgisayardan bu panele girip duyuru/aidat yönetin. Token’ı her cihazda bir
            kez girersiniz; sonra sadece <strong>Yayınla</strong> yeter.
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

      {draftNote && <p className="admin-msg err">{draftNote}</p>}

      <div className="admin-tabs">
        {(
          [
            ['aidat', 'Aidat'],
            ['duyurular', 'Duyurular'],
            ['etkinlikler', 'Etkinlikler'],
            ['indirenler', 'İndirenler'],
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
          onPublish={async (next) => {
            const settings = loadGithubSettings()
            if (!settings.token) {
              throw new Error(
                'Access Token yok. Önce Kaydet sekmesine gidin, token yapıştırıp bir kez kaydedin.',
              )
            }
            saveGithubSettings(settings)
            await pushAdminData(settings, [
              { path: 'public/data/uyeler.json', data: members },
              { path: 'public/data/duyurular.json', data: next },
              { path: 'public/data/etkinlikler.json', data: events },
            ])
            setAnnouncements(next)
            setLiveAnnouncements(next)
            setLiveMembers(members)
            setLiveEvents(events)
            setDirty(false)
            setDraftNote(null)
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
      {tab === 'indirenler' && <InstallStats />}
      {tab === 'kaydet' && (
        <SavePanel
          members={members}
          announcements={announcements}
          events={events}
          dirty={dirty}
          onSaved={() => {
            setDirty(false)
            setDraftNote(null)
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

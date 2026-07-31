import { useState } from 'react'
import { downloadJson } from '../lib/download'
import {
  loadGithubSettings,
  pushAdminData,
  saveGithubSettings,
  type GithubSettings,
} from '../lib/githubSave'
import {
  clearLiveData,
  setLiveAnnouncements,
  setLiveEvents,
  setLiveMembers,
} from '../lib/liveData'
import type { AnnouncementsData, EventsData, MembershipData } from '../types'

export function SavePanel({
  members,
  announcements,
  events,
  dirty,
  onSaved,
  onReloadFromServer,
}: {
  members: MembershipData
  announcements: AnnouncementsData
  events: EventsData
  dirty: boolean
  onSaved: () => void
  onReloadFromServer: () => void
}) {
  const [settings, setSettings] = useState<GithubSettings>(() => loadGithubSettings())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function downloadAll() {
    setLiveMembers(members)
    setLiveAnnouncements(announcements)
    setLiveEvents(events)
    downloadJson('uyeler.json', members)
    downloadJson('duyurular.json', announcements)
    downloadJson('etkinlikler.json', events)
    setMsg(
      'Dosyalar indirildi. Bunları bilgisayarınızdaki public/data klasörüne koyup GitHub’a yükleyin. Bu cihazda aidat sorgusu şimdiden güncel.',
    )
    setErr(null)
    onSaved()
  }

  async function pushGithub() {
    setBusy(true)
    setMsg(null)
    setErr(null)
    saveGithubSettings(settings)
    try {
      await pushAdminData(settings, [
        { path: 'public/data/uyeler.json', data: members },
        { path: 'public/data/duyurular.json', data: announcements },
        { path: 'public/data/etkinlikler.json', data: events },
      ])
      setLiveMembers(members)
      setLiveAnnouncements(announcements)
      setLiveEvents(events)
      setMsg(
        'GitHub’a kaydedildi. Actions açıksa birkaç dakika içinde site güncellenir. Üyeler yeni duyuruları ve aidatları görür.',
      )
      onSaved()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'GitHub kaydı başarısız.')
    } finally {
      setBusy(false)
    }
  }

  function reloadServer() {
    if (
      !confirm(
        'Bu cihazdaki taslak silinip sunucudaki (public/data) dosyalar yüklenecek. Devam edilsin mi?',
      )
    ) {
      return
    }
    clearLiveData()
    onReloadFromServer()
    setMsg('Sunucu verisi yeniden yüklenecek…')
    setErr(null)
  }

  return (
    <div className="admin-panel">
      <h2>Kaydet / Yayınla</h2>
      <p className="hint">
        Üye ekleme ve ödeme işlemleri bu telefonda/bilgisayarda hemen aidat sorgusuna yansır. Diğer
        üyelerin görmesi için aşağıdan yayınlayın.
      </p>
      {dirty ? (
        <span className="admin-dirty">Yayın bekleyen değişiklikler var</span>
      ) : (
        <p className="hint">Yayın bekleyen değişiklik yok.</p>
      )}

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>1) Dosya olarak indir</h2>
        <p className="hint">
          İnternet veya GitHub anahtarı istemez. İndirilen JSON dosyalarını projede
          <code> public/data/ </code>
          altına koyup commit edin.
        </p>
        <button type="button" className="btn btn-ghost" onClick={downloadAll}>
          JSON dosyalarını indir
        </button>
      </div>

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>2) GitHub’a doğrudan kaydet</h2>
        <p className="hint">
          Klasik Personal Access Token gerekir (<code>contents:write</code>). Token yalnızca bu
          tarayıcıda saklanır; GitHub’a yüklenmez.
        </p>
        <div className="admin-fields two">
          <label className="admin-label">
            GitHub kullanıcı / org
            <input
              value={settings.owner}
              onChange={(e) => setSettings((s) => ({ ...s, owner: e.target.value.trim() }))}
              placeholder="ornek-kullanici"
            />
          </label>
          <label className="admin-label">
            Depo adı
            <input
              value={settings.repo}
              onChange={(e) => setSettings((s) => ({ ...s, repo: e.target.value.trim() }))}
              placeholder="tornuk-dernegi"
            />
          </label>
          <label className="admin-label">
            Dal
            <input
              value={settings.branch}
              onChange={(e) => setSettings((s) => ({ ...s, branch: e.target.value.trim() }))}
              placeholder="main"
            />
          </label>
          <label className="admin-label">
            Access Token
            <input
              type="password"
              value={settings.token}
              onChange={(e) => setSettings((s) => ({ ...s, token: e.target.value.trim() }))}
              placeholder="ghp_..."
              autoComplete="off"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void pushGithub()}
        >
          {busy ? 'Kaydediliyor…' : 'GitHub’a kaydet ve yayınla'}
        </button>
      </div>

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>3) Sunucudan yenile</h2>
        <p className="hint">Yerel taslağı siler; public/data dosyalarına döner.</p>
        <button type="button" className="btn btn-ghost" onClick={reloadServer}>
          Sunucudan yeniden yükle
        </button>
      </div>

      {msg && <p className="admin-msg ok">{msg}</p>}
      {err && <p className="admin-msg err">{err}</p>}
    </div>
  )
}

import { useState } from 'react'
import { downloadJson } from '../lib/download'
import { getAdminSessionPin } from '../lib/adminAuth'
import { pushAdminData } from '../lib/githubSave'
import {
  clearLiveData,
  setLiveAnnouncements,
  setLiveEvents,
  setLiveMembers,
} from '../lib/liveData'
import type { AnnouncementsData, AssociationData, EventsData, MembershipData } from '../types'

export function SavePanel({
  members,
  announcements,
  events,
  association,
  dirty,
  onSaved,
  onReloadFromServer,
}: {
  members: MembershipData
  announcements: AnnouncementsData
  events: EventsData
  association: AssociationData
  dirty: boolean
  onSaved: () => void
  onReloadFromServer: () => void
}) {
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
    downloadJson('dernek.json', association)
    setMsg('Yedek dosyalar indirildi.')
    setErr(null)
    onSaved()
  }

  async function pushGithub() {
    const pin = getAdminSessionPin()
    if (!pin) {
      setErr('Oturum süresi dolmuş. Tekrar giriş yapın.')
      return
    }
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      await pushAdminData(pin, [
        { path: 'public/data/uyeler.json', data: members },
        { path: 'public/data/duyurular.json', data: announcements },
        { path: 'public/data/etkinlikler.json', data: events },
        { path: 'public/data/dernek.json', data: association },
      ])
      setLiveMembers(members)
      setLiveAnnouncements(announcements)
      setLiveEvents(events)
      setMsg('Yayınlandı. Canlı site güncellendi.')
      onSaved()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Yayın başarısız.')
    } finally {
      setBusy(false)
    }
  }

  function reloadServer() {
    if (
      !confirm(
        'Bu cihazdaki taslak silinip sunucudaki dosyalar yüklenecek. Devam edilsin mi?',
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
      <h2>Ayarlar / yedek</h2>
      <p className="hint">
        Günlük iş için gerekmez: duyuru ve etkinlik eklerken otomatik yayınlanır. Bu sekme yedek
        indirme veya sunucudan yenileme içindir.
      </p>
      {dirty ? (
        <span className="admin-dirty">Yayın bekleyen değişiklikler var</span>
      ) : (
        <p className="hint">Yayın bekleyen değişiklik yok.</p>
      )}

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>1) Dosya olarak indir</h2>
        <p className="hint">Yedek JSON dosyalarını bilgisayarınıza indirir.</p>
        <button type="button" className="btn btn-ghost" onClick={downloadAll}>
          JSON dosyalarını indir
        </button>
      </div>

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>2) Şimdi yayınla</h2>
        <p className="hint">Bekleyen tüm değişiklikleri canlıya gönderir (PIN oturumu yeterli).</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void pushGithub()}
        >
          {busy ? 'Kaydediliyor…' : 'Canlıya yayınla'}
        </button>
      </div>

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>3) Sunucudan yenile</h2>
        <p className="hint">Yerel taslağı siler; canlı veriyi yeniden yükler.</p>
        <button type="button" className="btn btn-ghost" onClick={reloadServer}>
          Sunucudan yeniden yükle
        </button>
      </div>

      {msg && <p className="admin-msg ok">{msg}</p>}
      {err && <p className="admin-msg err">{err}</p>}
    </div>
  )
}

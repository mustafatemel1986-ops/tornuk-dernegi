import { useEffect, useState } from 'react'
import './App.css'
import { AdminApp } from './admin/AdminApp'
import { BottomNav } from './components/BottomNav'
import { NotifyPermissionGate } from './components/NotifyPermissionGate'
import { isAdminRoute, normalizeAdminUrl } from './lib/adminRoute'
import { isStandalone } from './lib/install'
import { trackAppInstall } from './lib/installStats'
import { NTFY_TOPIC } from './lib/ntfyPush'
import {
  askServiceWorkerToCheck,
  checkDuyurularInPage,
  getNotifyPreference,
  listenForNotifySoundFromSw,
  markAskNotifyPermission,
  NOTIFY_PREF_EVENT,
  registerPeriodicDuyuruCheck,
  setLastSeenDuyuruId,
  shouldAskNotifyPermission,
  showDuyuruNotification,
  syncServiceWorkerLastDuyuruId,
} from './lib/notifications'
import { AidatPage } from './pages/AidatPage'
import { DuyurularPage } from './pages/DuyurularPage'
import { EtkinliklerPage } from './pages/EtkinliklerPage'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import type { TabId } from './types'

function getInitialTab(): TabId {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab')
  if (
    tab === 'ana' ||
    tab === 'aidat' ||
    tab === 'duyurular' ||
    tab === 'etkinlikler' ||
    tab === 'menu'
  ) {
    return tab
  }
  return 'ana'
}

function MemberApp() {
  const [tab, setTab] = useState<TabId>(getInitialTab)
  const [duyuruBadge, setDuyuruBadge] = useState(false)
  const [askNotify, setAskNotify] = useState(false)
  const [notifyReady, setNotifyReady] = useState(() => getNotifyPreference())

  useEffect(() => {
    // Admin hash'ini bozma
    if (isAdminRoute()) return

    const url = new URL(window.location.href)
    if (tab === 'ana') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url)
  }, [tab])

  useEffect(() => {
    if (!isStandalone()) return
    void trackAppInstall()

    const seenKey = 'tornuk-standalone-seen'
    const firstOpen = !localStorage.getItem(seenKey)
    if (firstOpen) localStorage.setItem(seenKey, '1')

    // İlk ana ekran açılışı veya indirme sonrası bekleyen izin
    if (
      (firstOpen || shouldAskNotifyPermission()) &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      markAskNotifyPermission()
      window.setTimeout(() => setAskNotify(true), 600)
    }
  }, [])

  // Menü / kurulum bildirim tercihini dinle
  useEffect(() => {
    function syncPref() {
      setNotifyReady(getNotifyPreference())
    }
    window.addEventListener(NOTIFY_PREF_EVENT, syncPref)
    return () => window.removeEventListener(NOTIFY_PREF_EVENT, syncPref)
  }, [])

  // Uygulama açıkken tek bildirim yolu: ntfy EventSource
  useEffect(() => {
    if (!notifyReady) return
    let source: EventSource | null = null
    try {
      source = new EventSource(`https://ntfy.sh/${NTFY_TOPIC}/sse`)
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            event?: string
            title?: string
            message?: string
            id?: string
          }
          if (data.event && data.event !== 'message') return

          void (async () => {
            // Önce canlı listeyi çek — bildirim ile liste aynı id’yi göstersin
            const result = await checkDuyurularInPage({ notify: false })
            const item = result.item || {
              id: data.id || `ntfy-${Date.now()}`,
              title: data.title || 'Törnük Derneği',
              summary: data.message || 'Yeni duyuru',
            }
            if (result.latestId) {
              setLastSeenDuyuruId(result.latestId)
              await syncServiceWorkerLastDuyuruId(result.latestId)
            }
            setDuyuruBadge(true)
            await showDuyuruNotification(item)
          })()
        } catch {
          // keepalive / parse
        }
      }
    } catch {
      // EventSource yoksa sessiz
    }
    return () => source?.close()
  }, [notifyReady])

  useEffect(() => {
    let cancelled = false
    const stopSoundListener = listenForNotifySoundFromSw()

    async function runCheck() {
      try {
        const preferSw = Boolean(navigator.serviceWorker?.controller)
        const liveChannel = getNotifyPreference()
        if (liveChannel) {
          await registerPeriodicDuyuruCheck()
          // EventSource açıkken SW CHECK gönderme — çift bildirim olmasın
          if (preferSw && document.visibilityState === 'hidden') {
            await askServiceWorkerToCheck()
          }
        }
        // Rozet için liste kontrolü; bildirimi EventSource / SW verir
        const result = await checkDuyurularInPage({ notify: false })
        if (!cancelled && result.isNew) setDuyuruBadge(true)
      } catch {
        // ağ yoksa sessiz geç
      }
    }

    void runCheck()

    function onVisible() {
      if (document.visibilityState === 'visible') void runCheck()
    }

    function onFocus() {
      void runCheck()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => {
      if (getNotifyPreference()) void runCheck()
    }, 30 * 1000)

    return () => {
      cancelled = true
      stopSoundListener()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [])

  function handleTabChange(next: TabId) {
    setTab(next)
    if (next === 'duyurular') setDuyuruBadge(false)
  }

  return (
    <div className="shell">
      <NotifyPermissionGate
        open={askNotify}
        onDone={() => {
          setAskNotify(false)
          setNotifyReady(getNotifyPreference())
        }}
      />
      <main className="app">
        {tab === 'ana' && <HomePage onNavigate={handleTabChange} />}
        {tab === 'aidat' && <AidatPage />}
        {tab === 'duyurular' && <DuyurularPage />}
        {tab === 'etkinlikler' && <EtkinliklerPage />}
        {tab === 'menu' && <MenuPage />}
      </main>
      <BottomNav active={tab} onChange={handleTabChange} duyuruBadge={duyuruBadge} />
    </div>
  )
}

export default function App() {
  const [admin, setAdmin] = useState(() => isAdminRoute())

  useEffect(() => {
    if (admin) normalizeAdminUrl()

    function sync() {
      const next = isAdminRoute()
      setAdmin(next)
      if (next) normalizeAdminUrl()
    }

    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [admin])

  if (admin) return <AdminApp />
  return <MemberApp />
}

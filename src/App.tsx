import { useEffect, useState } from 'react'
import './App.css'
import { AdminApp } from './admin/AdminApp'
import { BottomNav } from './components/BottomNav'
import { isAdminRoute, normalizeAdminUrl } from './lib/adminRoute'
import { isStandalone } from './lib/install'
import { trackAppInstall } from './lib/installStats'
import { NTFY_TOPIC } from './lib/ntfyPush'
import {
  askServiceWorkerToCheck,
  checkDuyurularInPage,
  getNotifyPreference,
  listenForNotifySoundFromSw,
  registerPeriodicDuyuruCheck,
  showDuyuruNotification,
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

  useEffect(() => {
    // Admin hash'ini bozma
    if (isAdminRoute()) return

    const url = new URL(window.location.href)
    if (tab === 'ana') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    window.history.replaceState({}, '', url)
  }, [tab])

  useEffect(() => {
    // Ana ekrana ekli uygulamada indirme sayacını bir kez artır
    if (isStandalone()) void trackAppInstall()
  }, [])

  // Uygulama arka planda (ama öldürülmemişken) ntfy üzerinden anlık duyuru
  useEffect(() => {
    if (!getNotifyPreference()) return
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
          void showDuyuruNotification({
            id: data.id || `ntfy-${Date.now()}`,
            title: data.title || 'Törnük Derneği',
            summary: data.message || 'Yeni duyuru',
          })
        } catch {
          // keepalive / parse
        }
      }
    } catch {
      // EventSource yoksa sessiz
    }
    return () => source?.close()
  }, [])

  useEffect(() => {
    let cancelled = false
    const stopSoundListener = listenForNotifySoundFromSw()

    async function runCheck() {
      try {
        const preferSw = Boolean(navigator.serviceWorker?.controller)
        if (getNotifyPreference()) {
          await registerPeriodicDuyuruCheck()
          if (preferSw) await askServiceWorkerToCheck()
        }
        // SW varken bildirimi SW göstersin (çift ses olmasın); sayfa sadece rozeti günceller
        const result = await checkDuyurularInPage({
          notify: getNotifyPreference() && !preferSw,
        })
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
    // Uygulama açıkken ~15 sn’de bir kontrol (iPhone arka planda çalışmaz)
    const timer = window.setInterval(() => {
      if (getNotifyPreference()) void runCheck()
    }, 15 * 1000)

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

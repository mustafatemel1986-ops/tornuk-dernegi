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
  checkEtkinliklerInPage,
  getLastSeenDuyuruId,
  getLastSeenEtkinlikId,
  getNotifyPreference,
  listenForNotifySoundFromSw,
  markAskNotifyPermission,
  NOTIFY_PREF_EVENT,
  registerPeriodicDuyuruCheck,
  setLastSeenDuyuruId,
  setLastSeenEtkinlikId,
  shouldAskNotifyPermission,
  showDuyuruNotification,
  showEtkinlikNotification,
  syncServiceWorkerLastDuyuruId,
  syncServiceWorkerLastEtkinlikId,
} from './lib/notifications'
import { AidatPage } from './pages/AidatPage'
import { DuyurularPage } from './pages/DuyurularPage'
import { EtkinliklerPage } from './pages/EtkinliklerPage'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { subscribeWebPush } from './lib/webPush'
import type { MenuSectionId, TabId } from './types'

function isMenuSection(value: string | null): value is MenuSectionId {
  return (
    value === 'ozet' ||
    value === 'bilgi' ||
    value === 'belgeler' ||
    value === 'bagis' ||
    value === 'sss'
  )
}

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

function getInitialMenuSection(): MenuSectionId {
  const params = new URLSearchParams(window.location.search)
  const section = params.get('section')
  return isMenuSection(section) ? section : 'ozet'
}

function MemberApp() {
  const [tab, setTab] = useState<TabId>(getInitialTab)
  const [menuSection, setMenuSection] = useState<MenuSectionId>(getInitialMenuSection)
  const [duyuruBadge, setDuyuruBadge] = useState(false)
  const [askNotify, setAskNotify] = useState(false)
  const [notifyReady, setNotifyReady] = useState(() => getNotifyPreference())

  useEffect(() => {
    // Admin hash'ini bozma
    if (isAdminRoute()) return

    const url = new URL(window.location.href)
    if (tab === 'ana') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)

    if (tab === 'menu' && menuSection !== 'ozet') {
      url.searchParams.set('section', menuSection)
    } else {
      url.searchParams.delete('section')
    }
    window.history.replaceState({}, '', url)
  }, [tab, menuSection])

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

  // Bildirim açıkken Web Push aboneliğini yenile (kapalıyken bildirim)
  useEffect(() => {
    if (!notifyReady) return
    void subscribeWebPush().catch(() => undefined)
  }, [notifyReady])

  // Uygulama açıkken anlık bildirim: ntfy EventSource (CDN beklemeden)
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
            tags?: string[] | string
            click?: string
          }
          if (data.event && data.event !== 'message') return
          if (!data.title && !data.message) return

          const tags = Array.isArray(data.tags)
            ? data.tags
            : String(data.tags || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
          const click = data.click || ''
          const isEtkinlik =
            tags.includes('etkinlik') ||
            click.includes('tab=etkinlikler') ||
            /[?&]etkinlik=/.test(click)

          let idFromClick: string | null = null
          try {
            const u = new URL(click)
            idFromClick = u.searchParams.get(isEtkinlik ? 'etkinlik' : 'duyuru')
          } catch {
            // click yok / geçersiz
          }

          void (async () => {
            if (isEtkinlik) {
              const id = idFromClick || `etkinlik-${Date.now()}`
              if (getLastSeenEtkinlikId() === id) return
              setLastSeenEtkinlikId(id)
              await syncServiceWorkerLastEtkinlikId(id)
              await showEtkinlikNotification({
                id,
                title: data.title || 'Yeni etkinlik',
                summary: data.message || data.title || '',
              })
              return
            }

            const id = idFromClick || `duyuru-${Date.now()}`
            if (getLastSeenDuyuruId() === id) return
            setLastSeenDuyuruId(id)
            await syncServiceWorkerLastDuyuruId(id)
            setDuyuruBadge(true)
            await showDuyuruNotification({
              id,
              title: data.title || 'Yeni duyuru',
              summary: data.message || data.title || '',
            })
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
          // Arka planda SW; önde sayfa kontrolü (ntfy engelli ağlarda yedek)
          if (preferSw && document.visibilityState === 'hidden') {
            await askServiceWorkerToCheck()
          }
        }
        const duyuru = await checkDuyurularInPage({
          notify: liveChannel && document.visibilityState === 'visible',
        })
        if (!cancelled && duyuru.isNew) setDuyuruBadge(true)

        await checkEtkinliklerInPage({
          notify: liveChannel && document.visibilityState === 'visible',
        })
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
    }, 15 * 1000)

    return () => {
      cancelled = true
      stopSoundListener()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [])

  function handleTabChange(next: TabId, section?: MenuSectionId) {
    setTab(next)
    if (next === 'menu') setMenuSection(section ?? 'ozet')
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
        {tab === 'menu' && (
          <MenuPage section={menuSection} onSectionChange={setMenuSection} />
        )}
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

import { useEffect, useState } from 'react'
import {
  isAndroid,
  isIos,
  isStandalone,
  type BeforeInstallPromptEvent,
} from '../lib/install'
import { trackAppInstall } from '../lib/installStats'

type GuideKind = 'ios' | 'android' | 'desktop' | null

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [guide, setGuide] = useState<GuideKind>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }

    async function onInstalled() {
      setInstalled(true)
      setDeferred(null)
      setGuide(null)
      await trackAppInstall()
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS / zaten ekli uygulama: ilk açılışta bir kez say
    if (isStandalone()) {
      setInstalled(true)
      void trackAppInstall()
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Yüklü uygulamada indirme butonu hiç görünmesin
  if (installed) return null

  async function handleInstall() {
    if (deferred) {
      setBusy(true)
      try {
        await deferred.prompt()
        const choice = await deferred.userChoice
        if (choice.outcome === 'accepted') {
          setInstalled(true)
          await trackAppInstall()
        }
        setDeferred(null)
      } finally {
        setBusy(false)
      }
      return
    }

    if (isIos()) {
      setGuide('ios')
      return
    }

    if (isAndroid()) {
      setGuide('android')
      return
    }

    setGuide('desktop')
  }

  return (
    <div className="install">
      <button
        type="button"
        className="btn btn-download"
        onClick={() => void handleInstall()}
        disabled={busy}
      >
        <DownloadIcon />
        {busy ? 'Ekleniyor…' : 'Uygulamayı İndir'}
      </button>
      <p className="install-hint">Ana ekrana ekleyin; uygulama gibi açılır.</p>

      {guide && (
        <div className="install-guide" role="dialog" aria-labelledby="install-guide-title">
          <div className="install-guide-card">
            <h2 id="install-guide-title">Ana ekrana ekleme</h2>
            {guide === 'ios' && (
              <ol>
                <li>
                  Alttaki <strong>Paylaş</strong> düğmesine dokunun
                  <ShareGlyph />
                </li>
                <li>
                  <strong>Ana Ekrana Ekle</strong> seçeneğine kaydırın
                </li>
                <li>
                  <strong>Ekle</strong> ile onaylayın
                </li>
              </ol>
            )}
            {guide === 'android' && (
              <ol>
                <li>
                  Tarayıcı menüsünü açın <strong>⋮</strong>
                </li>
                <li>
                  <strong>Ana ekrana ekle</strong> veya <strong>Uygulamayı yükle</strong> seçin
                </li>
                <li>Onaylayın — ikon ana ekranınıza gelir</li>
              </ol>
            )}
            {guide === 'desktop' && (
              <p>
                Telefonda Chrome veya Safari ile siteyi açıp bu düğmeye tekrar dokunun. Masaüstünde
                adres çubuğundaki yükle ikonunu kullanabilirsiniz.
              </p>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setGuide(null)}>
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareGlyph() {
  return (
    <svg className="share-glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 16V4m0 0 4 4m-4-4-4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

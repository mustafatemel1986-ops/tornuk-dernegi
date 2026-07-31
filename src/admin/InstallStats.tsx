import { useEffect, useState } from 'react'
import { getInstallCount } from '../lib/installStats'

export function InstallStats() {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const value = await getInstallCount()
      setCount(value)
    } catch {
      setCount(null)
      setError('Kurulum sayısı okunamadı. İnternet bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="admin-panel">
      <h2>Uygulama indirmeleri</h2>
      <p className="hint">
        Ana ekrana ekleyen üye sayısı. Aynı telefon bir kez sayılır. Sayaç internet üzerinden
        tutulur; yenile ile güncel değeri alın.
      </p>

      <div className="install-stat-card">
        <span>Toplam indirme</span>
        <strong>{loading ? '…' : error ? '—' : (count ?? '—')}</strong>
      </div>

      {error && <p className="admin-msg err">{error}</p>}
      {!loading && !error && count === 0 && (
        <p className="hint">Henüz sayılan kurulum yok. Üye uygulamayı ana ekrandan bir kez açmalı.</p>
      )}

      <button type="button" className="btn btn-ghost" onClick={() => void refresh()} disabled={loading}>
        Yenile
      </button>
    </div>
  )
}

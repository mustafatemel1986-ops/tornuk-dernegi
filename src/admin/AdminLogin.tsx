import { useState, type FormEvent } from 'react'
import { BrandMark } from '../components/BrandMark'
import { setAdminLoggedIn, verifyAdminPin } from '../lib/adminAuth'

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const ok = await verifyAdminPin(pin)
      if (!ok) {
        setError('PIN hatalı.')
        return
      }
      setAdminLoggedIn(true)
      onSuccess()
    } catch {
      setError('Giriş kontrolü yapılamadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin-login" onSubmit={(e) => void onSubmit(e)}>
      <BrandMark size={72} />
      <h1>Yönetim paneli</h1>
      <p>Aidat, duyuru ve etkinlikleri buradan güncelleyebilirsiniz.</p>
      <label className="admin-label">
        Yönetici PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
        />
      </label>
      {error && <p className="admin-msg err">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy || !pin}>
        {busy ? 'Kontrol ediliyor…' : 'Giriş yap'}
      </button>
      <a
        className="hint"
        href={import.meta.env.BASE_URL}
        onClick={(e) => {
          e.preventDefault()
          window.location.hash = ''
          window.location.href = import.meta.env.BASE_URL
        }}
      >
        ← Üye uygulamasına dön
      </a>
    </form>
  )
}

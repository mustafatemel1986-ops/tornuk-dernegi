import { useEffect, useState } from 'react'
import { InstallButton } from '../components/InstallButton'
import { getAdminHref } from '../lib/adminRoute'
import { loadAssociationData } from '../lib/liveData'
import {
  askServiceWorkerToCheck,
  ensureNotificationPermission,
  getNotifyPreference,
  registerPeriodicDuyuruCheck,
  setNotifyPreference,
} from '../lib/notifications'
import { subscribeWebPush, unsubscribeWebPush } from '../lib/webPush'
import type { AssociationData, MenuSectionId } from '../types'

const SECTIONS: { id: MenuSectionId; label: string }[] = [
  { id: 'ozet', label: 'Uygulama' },
  { id: 'bilgi', label: 'Bilgiler' },
  { id: 'belgeler', label: 'Belgeler' },
  { id: 'bagis', label: 'Bağış' },
  { id: 'sss', label: 'SSS' },
]

export function MenuPage({
  section,
  onSectionChange,
}: {
  section: MenuSectionId
  onSectionChange: (section: MenuSectionId) => void
}) {
  const [data, setData] = useState<AssociationData | null>(null)
  const [notifyOn, setNotifyOn] = useState(() => getNotifyPreference())
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const json = await loadAssociationData()
        if (!cancelled) setData(json)
      } catch {
        // sessiz
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleNotify() {
    if (notifyOn) {
      setNotifyPreference(false)
      setNotifyOn(false)
      void unsubscribeWebPush()
      setNotifyMsg('Bildirimler kapatıldı.')
      return
    }

    const permission = await ensureNotificationPermission()
    if (permission !== 'granted') {
      setNotifyMsg('Bildirim izni verilmedi. Telefon ayarlarından izin verebilirsiniz.')
      return
    }

    setNotifyPreference(true)
    setNotifyOn(true)
    await registerPeriodicDuyuruCheck()
    await askServiceWorkerToCheck()
    try {
      await subscribeWebPush()
      setNotifyMsg(
        'Bildirimler açık. Uygulama kapalıyken de duyuru ve etkinlik bildirimi gelebilir (ana ekrana ekli PWA).',
      )
    } catch {
      setNotifyMsg(
        'Bildirimler açık (uygulama açıkken). Kapalıyken bildirim için mobil internette Menüden tekrar açın.',
      )
    }
  }

  async function copyIban() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.donation.iban.replace(/\s/g, ''))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (!data) {
    return (
      <section className="page">
        <p className="hint">Yükleniyor…</p>
      </section>
    )
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Menü</h1>
        <p>Bildirim, indirme ve dernek bilgileri.</p>
      </header>

      <div className="chip-row">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`chip ${section === id ? 'is-active' : ''}`}
            onClick={() => onSectionChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'ozet' && (
        <div className="stack menu-app-stack">
          <div className="panel">
            <h2 className="panel-title">Bildirimler</h2>
            <p className="hint">
              Yeni duyuru ve etkinliklerde telefonunuza uyarı gelsin.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '0.35rem' }}
              onClick={() => void toggleNotify()}
            >
              {notifyOn ? 'Bildirimleri Kapat' : 'Bildirimleri Aç'}
            </button>
            {notifyMsg && <p className="note">{notifyMsg}</p>}
          </div>

          <InstallButton />

          <a className="menu-admin-link" href={getAdminHref()}>
            Yöneticiler için giriş →
          </a>
        </div>
      )}

      {section === 'bilgi' && (
        <div className="stack">
          <article className="content-card">
            <h2>{data.name}</h2>
            <p className="content-summary">{data.shortDescription}</p>
            <dl className="meta">
              <div>
                <dt>Adres</dt>
                <dd className="pre-line">{data.address}</dd>
              </div>
              <div>
                <dt>Telefon</dt>
                <dd>
                  <a href={`tel:${data.phone.replace(/\s/g, '')}`}>{data.phone}</a>
                </dd>
              </div>
              <div>
                <dt>E-posta</dt>
                <dd>
                  <a href={`mailto:${data.email}`}>{data.email}</a>
                </dd>
              </div>
              <div>
                <dt>Çalışma saati</dt>
                <dd>{data.workingHours}</dd>
              </div>
            </dl>
          </article>

          <article className="content-card">
            <h2>Yönetim kurulu</h2>
            <ul className="board-list">
              {data.board.map((member) => (
                <li key={member.role}>
                  <span>{member.role}</span>
                  <strong>{member.name}</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
      )}

      {section === 'belgeler' && (
        <div className="stack">
          {data.documents.map((doc) => (
            <a
              key={doc.id}
              className="content-card link-card"
              href={`${import.meta.env.BASE_URL}${doc.url}`}
              target="_blank"
              rel="noreferrer"
            >
              <h2>{doc.title}</h2>
              <p className="content-summary">{doc.description}</p>
              <span className="link-cta">Görüntüle →</span>
            </a>
          ))}
        </div>
      )}

      {section === 'bagis' && (
        <div className="stack">
          <article className="content-card">
            <h2>Bağış / Aidat ödemesi</h2>
            <dl className="meta">
              <div>
                <dt>Banka</dt>
                <dd>{data.donation.bankName}</dd>
              </div>
              <div>
                <dt>Hesap adı</dt>
                <dd>{data.donation.accountName}</dd>
              </div>
              <div>
                <dt>IBAN</dt>
                <dd className="iban">{data.donation.iban}</dd>
              </div>
            </dl>
            <p className="note">{data.donation.note}</p>
            <button type="button" className="btn btn-primary" onClick={() => void copyIban()}>
              {copied ? 'Kopyalandı' : 'IBAN Kopyala'}
            </button>
          </article>
        </div>
      )}

      {section === 'sss' && (
        <div className="stack">
          {data.faq.map((item) => (
            <details key={item.q} className="content-card faq-card">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

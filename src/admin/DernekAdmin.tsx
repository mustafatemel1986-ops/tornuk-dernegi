import { useState } from 'react'
import type { AssociationData, MenuSectionId } from '../types'

const SECTIONS: { id: MenuSectionId; label: string }[] = [
  { id: 'bilgi', label: 'Bilgiler' },
  { id: 'bagis', label: 'Bağış' },
  { id: 'belgeler', label: 'Belgeler' },
  { id: 'sss', label: 'SSS' },
]

function makeDocId(title: string) {
  const slug = title
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  return `doc-${Date.now().toString(36)}-${slug || 'yeni'}`
}

export function DernekAdmin({
  data,
  onChange,
  onPublishNow,
}: {
  data: AssociationData
  onChange: (next: AssociationData) => void
  onPublishNow: (
    next: AssociationData,
    successText: string,
  ) => Promise<'direct' | 'worker' | void>
}) {
  const [section, setSection] = useState<MenuSectionId>('bilgi')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [faqDraft, setFaqDraft] = useState({ q: '', a: '' })
  const [docDraft, setDocDraft] = useState({
    title: '',
    description: '',
    url: 'belgeler/',
  })
  const [boardDraft, setBoardDraft] = useState({ role: '', name: '' })

  async function publishNow(next: AssociationData, successText: string) {
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      await onPublishNow(next, successText)
      setMsg(successText)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Yayın başarısız.')
    } finally {
      setBusy(false)
    }
  }

  function patch(partial: Partial<AssociationData>) {
    onChange({ ...data, ...partial })
  }

  return (
    <div className="admin-panel">
      <h2>Site içeriği</h2>
      <p className="hint">
        Ana sayfadaki Bağış, SSS, Belgeler ve Bilgiler bölümlerini buradan düzenleyin. Değişiklikler
        otomatik yayınlanır; isterseniz hemen yayınlayın.
      </p>

      <div className="chip-row" style={{ marginBottom: '1rem' }}>
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`chip ${section === id ? 'is-active' : ''}`}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <p className="admin-msg err">{err}</p>}
      {msg && <p className="admin-msg ok">{msg}</p>}

      {section === 'bilgi' && (
        <div className="admin-fields">
          <label className="admin-label">
            Dernek adı
            <input
              value={data.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <label className="admin-label">
            Kısa açıklama
            <textarea
              rows={3}
              value={data.shortDescription}
              onChange={(e) => patch({ shortDescription: e.target.value })}
            />
          </label>
          <label className="admin-label">
            Adres
            <textarea
              rows={3}
              value={data.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
          </label>
          <div className="admin-fields two">
            <label className="admin-label">
              Telefon
              <input
                value={data.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </label>
            <label className="admin-label">
              E-posta
              <input
                value={data.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </label>
          </div>
          <label className="admin-label">
            Çalışma saati
            <input
              value={data.workingHours}
              onChange={(e) => patch({ workingHours: e.target.value })}
            />
          </label>

          <h3 style={{ margin: '0.5rem 0 0' }}>Yönetim kurulu</h3>
          <div className="admin-list">
            {data.board.map((member, index) => (
              <article key={`${member.role}-${index}`} className="admin-list-row is-open">
                <div className="admin-fields two admin-list-edit">
                  <label className="admin-label">
                    Görev
                    <input
                      value={member.role}
                      onChange={(e) => {
                        const board = data.board.map((m, i) =>
                          i === index ? { ...m, role: e.target.value } : m,
                        )
                        patch({ board })
                      }}
                    />
                  </label>
                  <label className="admin-label">
                    Ad soyad
                    <input
                      value={member.name}
                      onChange={(e) => {
                        const board = data.board.map((m, i) =>
                          i === index ? { ...m, name: e.target.value } : m,
                        )
                        patch({ board })
                      }}
                    />
                  </label>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        patch({ board: data.board.filter((_, i) => i !== index) })
                      }
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-fields two">
            <label className="admin-label">
              Yeni görev
              <input
                value={boardDraft.role}
                onChange={(e) => setBoardDraft((d) => ({ ...d, role: e.target.value }))}
                placeholder="Örn. Başkan"
              />
            </label>
            <label className="admin-label">
              Yeni ad soyad
              <input
                value={boardDraft.name}
                onChange={(e) => setBoardDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (!boardDraft.role.trim() || !boardDraft.name.trim()) return
                patch({
                  board: [
                    ...data.board,
                    { role: boardDraft.role.trim(), name: boardDraft.name.trim() },
                  ],
                })
                setBoardDraft({ role: '', name: '' })
              }}
            >
              Kurul üyesi ekle
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void publishNow(data, 'Bilgiler yayınlandı.')}
            >
              Bilgileri yayınla
            </button>
          </div>
        </div>
      )}

      {section === 'bagis' && (
        <div className="admin-fields">
          <label className="admin-label">
            Banka
            <input
              value={data.donation.bankName}
              onChange={(e) =>
                patch({ donation: { ...data.donation, bankName: e.target.value } })
              }
            />
          </label>
          <label className="admin-label">
            Hesap adı
            <input
              value={data.donation.accountName}
              onChange={(e) =>
                patch({ donation: { ...data.donation, accountName: e.target.value } })
              }
            />
          </label>
          <label className="admin-label">
            IBAN
            <input
              value={data.donation.iban}
              onChange={(e) =>
                patch({ donation: { ...data.donation, iban: e.target.value } })
              }
            />
          </label>
          <label className="admin-label">
            Not / açıklama
            <textarea
              rows={3}
              value={data.donation.note}
              onChange={(e) =>
                patch({ donation: { ...data.donation, note: e.target.value } })
              }
            />
          </label>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void publishNow(data, 'Bağış bilgileri yayınlandı.')}
            >
              Bağışı yayınla
            </button>
          </div>
        </div>
      )}

      {section === 'belgeler' && (
        <div className="admin-fields">
          <div className="admin-list">
            {data.documents.map((doc, index) => (
              <article key={doc.id} className="admin-list-row is-open">
                <div className="admin-fields admin-list-edit">
                  <label className="admin-label">
                    Başlık
                    <input
                      value={doc.title}
                      onChange={(e) => {
                        const documents = data.documents.map((d, i) =>
                          i === index ? { ...d, title: e.target.value } : d,
                        )
                        patch({ documents })
                      }}
                    />
                  </label>
                  <label className="admin-label">
                    Açıklama
                    <input
                      value={doc.description}
                      onChange={(e) => {
                        const documents = data.documents.map((d, i) =>
                          i === index ? { ...d, description: e.target.value } : d,
                        )
                        patch({ documents })
                      }}
                    />
                  </label>
                  <label className="admin-label">
                    Dosya yolu / URL
                    <input
                      value={doc.url}
                      onChange={(e) => {
                        const documents = data.documents.map((d, i) =>
                          i === index ? { ...d, url: e.target.value } : d,
                        )
                        patch({ documents })
                      }}
                      placeholder="belgeler/tuzuk.html veya https://..."
                    />
                  </label>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        patch({
                          documents: data.documents.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <h3 style={{ margin: '0.5rem 0 0' }}>Yeni belge</h3>
          <label className="admin-label">
            Başlık
            <input
              value={docDraft.title}
              onChange={(e) => setDocDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>
          <label className="admin-label">
            Açıklama
            <input
              value={docDraft.description}
              onChange={(e) => setDocDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </label>
          <label className="admin-label">
            Dosya yolu / URL
            <input
              value={docDraft.url}
              onChange={(e) => setDocDraft((d) => ({ ...d, url: e.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (!docDraft.title.trim() || !docDraft.url.trim()) return
                patch({
                  documents: [
                    ...data.documents,
                    {
                      id: makeDocId(docDraft.title),
                      title: docDraft.title.trim(),
                      description: docDraft.description.trim(),
                      url: docDraft.url.trim(),
                    },
                  ],
                })
                setDocDraft({ title: '', description: '', url: 'belgeler/' })
              }}
            >
              Belge ekle
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void publishNow(data, 'Belgeler yayınlandı.')}
            >
              Belgeleri yayınla
            </button>
          </div>
        </div>
      )}

      {section === 'sss' && (
        <div className="admin-fields">
          <div className="admin-list">
            {data.faq.map((item, index) => (
              <article key={`${item.q}-${index}`} className="admin-list-row is-open">
                <div className="admin-fields admin-list-edit">
                  <label className="admin-label">
                    Soru
                    <input
                      value={item.q}
                      onChange={(e) => {
                        const faq = data.faq.map((f, i) =>
                          i === index ? { ...f, q: e.target.value } : f,
                        )
                        patch({ faq })
                      }}
                    />
                  </label>
                  <label className="admin-label">
                    Cevap
                    <textarea
                      rows={3}
                      value={item.a}
                      onChange={(e) => {
                        const faq = data.faq.map((f, i) =>
                          i === index ? { ...f, a: e.target.value } : f,
                        )
                        patch({ faq })
                      }}
                    />
                  </label>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => patch({ faq: data.faq.filter((_, i) => i !== index) })}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <h3 style={{ margin: '0.5rem 0 0' }}>Yeni soru</h3>
          <label className="admin-label">
            Soru
            <input
              value={faqDraft.q}
              onChange={(e) => setFaqDraft((d) => ({ ...d, q: e.target.value }))}
            />
          </label>
          <label className="admin-label">
            Cevap
            <textarea
              rows={3}
              value={faqDraft.a}
              onChange={(e) => setFaqDraft((d) => ({ ...d, a: e.target.value }))}
            />
          </label>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (!faqDraft.q.trim() || !faqDraft.a.trim()) return
                patch({
                  faq: [...data.faq, { q: faqDraft.q.trim(), a: faqDraft.a.trim() }],
                })
                setFaqDraft({ q: '', a: '' })
              }}
            >
              Soru ekle
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void publishNow(data, 'SSS yayınlandı.')}
            >
              SSS yayınla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import {
  downloadImportTemplate,
  mergeMembers,
  parseMembersFile,
  type ImportPreview,
} from '../lib/importMembers'
import { formatMoney } from '../lib/format'
import { ensureYearHistory, totalDebtFromHistory } from '../lib/aidatHistory'
import type { MembershipData } from '../types'

type Mode = 'merge' | 'replace'

export function ImportMembers({
  data,
  onChange,
}: {
  data: MembershipData
  onChange: (next: MembershipData) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mode, setMode] = useState<Mode>('merge')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function onFile(file: File | null) {
    if (!file) return
    setBusy(true)
    setError(null)
    setOk(null)
    setPreview(null)
    try {
      const result = await parseMembersFile(file, data.monthlyFee)
      if (result.members.length === 0) {
        throw new Error(
          result.errors[0]?.message ||
            'Aktarılacak geçerli üye bulunamadı. Şablon sütunlarını kontrol edin.',
        )
      }
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dosya okunamadı.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function applyImport() {
    if (!preview) return
    const members =
      mode === 'replace' ? preview.members : mergeMembers(data.members, preview.members)

    onChange({
      ...data,
      updatedAt: new Date().toISOString().slice(0, 10),
      members,
    })

    setOk(
      mode === 'replace'
        ? `${preview.members.length} üye içe aktarıldı (liste yenilendi). Kaydet sekmesinden yayınlayın.`
        : `${preview.members.length} üye birleştirildi. Aynı T.C. olanlar güncellendi. Kaydet sekmesinden yayınlayın.`,
    )
    setPreview(null)
  }

  return (
    <div className="admin-panel" style={{ boxShadow: 'none' }}>
      <h2>Excel / CSV ile içe aktar</h2>
      <p className="hint">
        Mevcut borç listenizi tek tek girmek yerine <strong>.xlsx</strong>, <strong>.xls</strong> veya{' '}
        <strong>.csv</strong> dosyası olarak yükleyin.
      </p>

      <div className="admin-actions">
        <button type="button" className="btn btn-ghost" onClick={downloadImportTemplate}>
          Şablon CSV indir
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Okunuyor…' : 'Dosya seç ve yükle'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="import-help">
        <p className="hint">
          Zorunlu sütunlar: <code>tc</code>, <code>ad_soyad</code>
        </p>
        <p className="hint">
          İsteğe bağlı: <code>borc_tutari</code>, <code>borclu_aylar</code> (2026-05;2026-06),{' '}
          <code>son_odeme</code>, <code>not</code>, <code>yil_gecmis</code>{' '}
          (2025:odendi;2026:borclu:300)
        </p>
      </div>

      {error && <p className="admin-msg err">{error}</p>}
      {ok && <p className="admin-msg ok">{ok}</p>}

      {preview && (
        <div className="import-preview">
          <div className="admin-card-head">
            <strong>{preview.fileName}</strong>
            <span className="hint">
              {preview.members.length} üye hazır
              {preview.errors.length > 0 ? ` · ${preview.errors.length} satır atlandı` : ''}
            </span>
          </div>

          <div className="admin-fields two">
            <label className="admin-label">
              Aktarım tipi
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="merge">Birleştir (aynı T.C. güncellenir, yeniler eklenir)</option>
                <option value="replace">Tüm listeyi bununla değiştir</option>
              </select>
            </label>
          </div>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Borç</th>
                  <th>Yıllar</th>
                </tr>
              </thead>
              <tbody>
                {preview.members.slice(0, 12).map((member) => {
                  const history = ensureYearHistory(member, data.monthlyFee)
                  const debt = totalDebtFromHistory(history)
                  return (
                    <tr key={member.idHash}>
                      <td>{member.displayName}</td>
                      <td>{formatMoney(debt)}</td>
                      <td>
                        {history
                          .slice(0, 3)
                          .map((y) => `${y.year}:${y.status === 'odendi' ? 'ödendi' : 'borçlu'}`)
                          .join(' · ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {preview.members.length > 12 && (
              <p className="hint">… ve {preview.members.length - 12} üye daha</p>
            )}
          </div>

          {preview.errors.length > 0 && (
            <details className="import-errors">
              <summary>{preview.errors.length} satır aktarılmadı</summary>
              <ul>
                {preview.errors.slice(0, 20).map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    Satır {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="admin-actions">
            <button type="button" className="btn btn-primary" onClick={applyImport}>
              {mode === 'replace' ? 'Listeyi değiştir' : 'Üyeleri aktar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

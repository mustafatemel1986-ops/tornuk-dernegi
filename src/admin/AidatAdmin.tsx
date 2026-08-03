import { useMemo, useState } from 'react'
import { YearHistory } from '../components/YearHistory'
import {
  ensureYearHistory,
  markYearsPaid,
  totalDebtFromHistory,
  upsertYear,
  yearsFromMonthKeys,
} from '../lib/aidatHistory'
import { formatMoney } from '../lib/format'
import { hashTc } from '../lib/hash'
import { maskDisplayName } from '../lib/maskName'
import { isValidTc, normalizeTc } from '../lib/tc'
import type { MemberRecord, MembershipData, YearAidat } from '../types'
import { ImportMembers } from './ImportMembers'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function nowIso() {
  return new Date().toISOString()
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentYear() {
  return new Date().getFullYear()
}

export function AidatAdmin({
  data,
  onChange,
}: {
  data: MembershipData
  onChange: (next: MembershipData) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMonths, setPayMonths] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [newTc, setNewTc] = useState('')
  const [newYear, setNewYear] = useState(String(currentYear() - 1))
  const [msg, setMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    return data.members
      .slice()
      .sort((a, b) => {
        const da = totalDebtFromHistory(ensureYearHistory(a, data.monthlyFee))
        const db = totalDebtFromHistory(ensureYearHistory(b, data.monthlyFee))
        return db - da || a.displayName.localeCompare(b.displayName, 'tr')
      })
      .filter((m) => !q || m.displayName.toLocaleLowerCase('tr').includes(q))
  }, [data.members, data.monthlyFee, query])

  const selected = data.members.find((m) => m.idHash === selectedId) ?? null

  function updateMember(idHash: string, patch: Partial<MemberRecord>) {
    onChange({
      ...data,
      updatedAt: nowIso(),
      members: data.members.map((m) => {
        if (m.idHash !== idHash) return m
        const merged = { ...m, ...patch }
        const yearHistory = ensureYearHistory(merged, data.monthlyFee)
        return {
          ...merged,
          yearHistory,
          debtAmount: totalDebtFromHistory(yearHistory),
        }
      }),
    })
  }

  function setMemberHistory(member: MemberRecord, history: YearAidat[]) {
    updateMember(member.idHash, {
      yearHistory: history,
      debtAmount: totalDebtFromHistory(history),
    })
  }

  function applyPayment() {
    if (!selected) return
    const amount = Number(payAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg('Geçerli bir ödeme tutarı girin.')
      return
    }

    const monthsToClear =
      payMonths.length > 0
        ? payMonths
        : selected.debtMonths.slice(
            -Math.max(1, Math.floor(amount / Math.max(data.monthlyFee, 1))),
          )

    const nextMonths = selected.debtMonths.filter((m) => !monthsToClear.includes(m))
    let history = ensureYearHistory(selected, data.monthlyFee)

    const clearedYears = yearsFromMonthKeys(monthsToClear)
    for (const year of clearedYears) {
      const stillDebt = nextMonths.some((m) => Number(m.slice(0, 4)) === year)
      if (!stillDebt) {
        history = upsertYear(history, year, { status: 'odendi', debtAmount: 0 })
      } else {
        const left = nextMonths.filter((m) => Number(m.slice(0, 4)) === year).length
        history = upsertYear(history, year, {
          status: 'borclu',
          debtAmount: left * data.monthlyFee,
        })
      }
    }

    // Aylık seçilmediyse tutarı mevcut borçlu yıldan düş
    if (payMonths.length === 0 && clearedYears.length === 0) {
      const openYear = history.find((y) => y.status === 'borclu')
      if (openYear) {
        const left = Math.max(0, openYear.debtAmount - amount)
        history = upsertYear(history, openYear.year, {
          status: left > 0 ? 'borclu' : 'odendi',
          debtAmount: left,
        })
      }
    }

    updateMember(selected.idHash, {
      debtMonths: nextMonths,
      yearHistory: history,
      lastPayment: todayIso(),
      notes: totalDebtFromHistory(history) === 0 ? 'Güncel' : selected.notes,
    })

    setPayAmount('')
    setPayMonths([])
    setMsg(
      `${selected.displayName} için ${formatMoney(amount)} ödeme işlendi. Kalan borç: ${formatMoney(totalDebtFromHistory(history))}`,
    )
  }

  function markFullyPaid() {
    if (!selected) return
    const history = markYearsPaid(
      ensureYearHistory(selected, data.monthlyFee),
      ensureYearHistory(selected, data.monthlyFee)
        .filter((y) => y.status === 'borclu')
        .map((y) => y.year),
    )
    updateMember(selected.idHash, {
      debtAmount: 0,
      debtMonths: [],
      yearHistory: history,
      lastPayment: todayIso(),
      notes: 'Güncel',
    })
    setMsg(`${selected.displayName} tüm yıllarda ödendi olarak işaretlendi.`)
  }

  async function addMember() {
    const tc = normalizeTc(newTc)
    if (!isValidTc(tc)) {
      setMsg('Yeni üye için geçerli T.C. kimlik no girin.')
      return
    }
    if (!newName.trim()) {
      setMsg('Üye adı soyadı gerekli.')
      return
    }
    const idHash = await hashTc(tc)
    if (data.members.some((m) => m.idHash === idHash)) {
      setMsg('Bu T.C. kimlik no zaten kayıtlı.')
      return
    }

    const year = currentYear()
    onChange({
      ...data,
      updatedAt: nowIso(),
      members: [
        ...data.members,
        {
          idHash,
          displayName: maskDisplayName(newName),
          debtAmount: 0,
          debtMonths: [],
          lastPayment: null,
          notes: '',
          yearHistory: [
            { year, status: 'odendi', debtAmount: 0, note: '' },
            { year: year - 1, status: 'odendi', debtAmount: 0, note: '' },
          ],
        },
      ],
    })
    setNewName('')
    setNewTc('')
    setMsg(
      `Yeni üye eklendi (${maskDisplayName(newName)}). Aidat sekmesinde aynı T.C. ile hemen sorgulanabilir.`,
    )
  }

  function addDebtMonth(member: MemberRecord) {
    const month = currentMonthKey()
    const year = currentYear()
    if (member.debtMonths.includes(month)) {
      setMsg('Bu ay zaten borç listesinde.')
      return
    }
    const debtMonths = [...member.debtMonths, month].sort()
    const yearMonths = debtMonths.filter((m) => Number(m.slice(0, 4)) === year)
    const history = upsertYear(ensureYearHistory(member, data.monthlyFee), year, {
      status: 'borclu',
      debtAmount: yearMonths.length * data.monthlyFee,
      note: `${yearMonths.length} aylık borç`,
    })
    updateMember(member.idHash, {
      debtMonths,
      yearHistory: history,
      notes: member.notes === 'Güncel' ? '' : member.notes,
    })
    setMsg(`${month} aidatı eklendi.`)
  }

  function addYearRow(member: MemberRecord) {
    const year = Number(newYear)
    if (!year || year < 2000 || year > 2100) {
      setMsg('Geçerli bir yıl girin.')
      return
    }
    const history = ensureYearHistory(member, data.monthlyFee)
    if (history.some((y) => y.year === year)) {
      setMsg('Bu yıl zaten listede.')
      return
    }
    setMemberHistory(member, upsertYear(history, year, { status: 'odendi', debtAmount: 0 }))
    setMsg(`${year} yılı eklendi.`)
  }

  return (
    <div className="admin-panel">
      <h2>Aidat yönetimi</h2>
      <p className="hint">
        Her yıl için Ödendi / Borçlu durumunu güncelleyin. Üyeler sorguda geçmiş yılları da görür.
      </p>

      <ImportMembers data={data} onChange={onChange} />

      <div className="admin-fields two">
        <label className="admin-label">
          Aylık aidat (₺)
          <input
            type="number"
            min={0}
            value={data.monthlyFee}
            onChange={(e) =>
              onChange({
                ...data,
                monthlyFee: Number(e.target.value) || 0,
                updatedAt: nowIso(),
              })
            }
          />
        </label>
        <label className="admin-label admin-search">
          Üye ara
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ad soyad"
          />
        </label>
      </div>

      {msg && <p className="admin-msg ok">{msg}</p>}

      <div className="admin-grid">
        {filtered.map((member) => {
          const history = ensureYearHistory(member, data.monthlyFee)
          const debt = totalDebtFromHistory(history)
          return (
            <article
              key={member.idHash}
              className="admin-card"
              style={selectedId === member.idHash ? { borderColor: 'var(--brand)' } : undefined}
            >
              <div className="admin-card-head">
                <strong>{member.displayName}</strong>
                <span className={`badge ${debt > 0 ? 'badge-debt' : 'badge-ok'}`}>
                  {formatMoney(debt)}
                </span>
              </div>

              <YearHistory member={member} monthlyFee={data.monthlyFee} compact />

              <div className="admin-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelectedId(member.idHash)
                    setPayMonths([])
                    setPayAmount('')
                    setMsg(null)
                    // Eksik yearHistory varsa kayda yaz
                    if (!member.yearHistory?.length) {
                      updateMember(member.idHash, {
                        yearHistory: ensureYearHistory(member, data.monthlyFee),
                      })
                    }
                  }}
                >
                  Seç / Düzenle
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => addDebtMonth(member)}>
                  Bu ay borcu ekle
                </button>
              </div>

              {selectedId === member.idHash && (
                <div className="admin-fields">
                  <div className="admin-panel" style={{ padding: '0.85rem', boxShadow: 'none' }}>
                    <strong>Yıllık durum</strong>
                    {history.map((item) => (
                      <div key={item.year} className="admin-fields two" style={{ marginTop: '0.5rem' }}>
                        <label className="admin-label">
                          {item.year} durumu
                          <select
                            value={item.status}
                            onChange={(e) => {
                              const status = e.target.value as 'odendi' | 'borclu'
                              setMemberHistory(
                                member,
                                upsertYear(history, item.year, {
                                  status,
                                  debtAmount:
                                    status === 'odendi'
                                      ? 0
                                      : item.debtAmount || data.monthlyFee,
                                }),
                              )
                            }}
                          >
                            <option value="odendi">Ödendi</option>
                            <option value="borclu">Borçlu</option>
                          </select>
                        </label>
                        <label className="admin-label">
                          Borç tutarı (₺)
                          <input
                            type="number"
                            min={0}
                            disabled={item.status === 'odendi'}
                            value={item.debtAmount}
                            onChange={(e) => {
                              const debtAmount = Number(e.target.value) || 0
                              setMemberHistory(
                                member,
                                upsertYear(history, item.year, {
                                  status: debtAmount > 0 ? 'borclu' : 'odendi',
                                  debtAmount,
                                }),
                              )
                            }}
                          />
                        </label>
                        <label className="admin-label" style={{ gridColumn: '1 / -1' }}>
                          Yıl notu
                          <input
                            value={item.note ?? ''}
                            onChange={(e) =>
                              setMemberHistory(
                                member,
                                upsertYear(history, item.year, { note: e.target.value }),
                              )
                            }
                          />
                        </label>
                      </div>
                    ))}

                    <div className="admin-fields two" style={{ marginTop: '0.75rem' }}>
                      <label className="admin-label">
                        Yıl ekle
                        <input
                          type="number"
                          value={newYear}
                          onChange={(e) => setNewYear(e.target.value)}
                        />
                      </label>
                      <div className="admin-actions" style={{ alignItems: 'end' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => addYearRow(member)}
                        >
                          Yılı listeye ekle
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="admin-label">
                    Son ödeme
                    <input
                      type="date"
                      value={member.lastPayment ?? ''}
                      onChange={(e) =>
                        updateMember(member.idHash, {
                          lastPayment: e.target.value || null,
                        })
                      }
                    />
                  </label>

                  <label className="admin-label">
                    Borçlu aylar (YYYY-AA; ile ayırın)
                    <input
                      value={member.debtMonths.join(';')}
                      onChange={(e) => {
                        const debtMonths = e.target.value
                          .split(';')
                          .map((x) => x.trim())
                          .filter(Boolean)
                        let nextHistory = ensureYearHistory(member, data.monthlyFee)
                        const years = yearsFromMonthKeys(debtMonths)
                        for (const year of years) {
                          const count = debtMonths.filter((m) => Number(m.slice(0, 4)) === year)
                            .length
                          nextHistory = upsertYear(nextHistory, year, {
                            status: 'borclu',
                            debtAmount: count * data.monthlyFee,
                          })
                        }
                        updateMember(member.idHash, {
                          debtMonths,
                          yearHistory: nextHistory,
                        })
                      }}
                    />
                  </label>

                  <label className="admin-label">
                    Not
                    <input
                      value={member.notes}
                      onChange={(e) => updateMember(member.idHash, { notes: e.target.value })}
                    />
                  </label>

                  <div className="admin-panel" style={{ padding: '0.85rem', boxShadow: 'none' }}>
                    <strong>Ödeme kaydet</strong>
                    <label className="admin-label">
                      Ödenen tutar (₺)
                      <input
                        type="number"
                        min={0}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="Örn. 100"
                      />
                    </label>
                    {member.debtMonths.length > 0 && (
                      <div>
                        <p className="hint">Kapatılan aylar (isteğe bağlı)</p>
                        <div className="month-checks">
                          {member.debtMonths.map((month) => (
                            <label key={month}>
                              <input
                                type="checkbox"
                                checked={payMonths.includes(month)}
                                onChange={(e) => {
                                  setPayMonths((prev) =>
                                    e.target.checked
                                      ? [...prev, month]
                                      : prev.filter((m) => m !== month),
                                  )
                                }}
                              />
                              {month}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="admin-actions">
                      <button type="button" className="btn btn-primary" onClick={applyPayment}>
                        Ödemeyi işle
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={markFullyPaid}>
                        Tüm yılları ödendi yap
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          if (confirm('Bu üyeyi listeden silmek istiyor musunuz?')) {
                            onChange({
                              ...data,
                              updatedAt: nowIso(),
                              members: data.members.filter((m) => m.idHash !== member.idHash),
                            })
                            setSelectedId(null)
                            setMsg('Üye silindi.')
                          }
                        }}
                      >
                        Üyeyi sil
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="admin-panel" style={{ boxShadow: 'none' }}>
        <h2>Yeni üye ekle</h2>
        <div className="admin-fields two">
          <label className="admin-label">
            Ad soyad
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="admin-label">
            T.C. kimlik no
            <input
              inputMode="numeric"
              maxLength={11}
              value={newTc}
              onChange={(e) => setNewTc(normalizeTc(e.target.value))}
            />
          </label>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void addMember()}>
          Üye ekle
        </button>
      </div>
    </div>
  )
}

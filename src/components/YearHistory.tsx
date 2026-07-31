import { formatMoney } from '../lib/format'
import { ensureYearHistory } from '../lib/aidatHistory'
import type { MemberRecord } from '../types'

export function YearHistory({
  member,
  monthlyFee,
  compact = false,
}: {
  member: MemberRecord
  monthlyFee: number
  compact?: boolean
}) {
  const history = ensureYearHistory(member, monthlyFee)

  return (
    <div className={`year-history ${compact ? 'is-compact' : ''}`}>
      <h3>Yıllık aidat durumu</h3>
      <ul className="year-history-list">
        {history.map((item) => (
          <li key={item.year} className={`year-row is-${item.status}`}>
            <div className="year-row-main">
              <strong>{item.year}</strong>
              <span className={`badge ${item.status === 'odendi' ? 'badge-ok' : 'badge-debt'}`}>
                {item.status === 'odendi' ? 'Ödendi' : 'Borçlu'}
              </span>
            </div>
            <div className="year-row-meta">
              {item.status === 'borclu' ? (
                <span>{formatMoney(item.debtAmount)} borç</span>
              ) : (
                <span>Aidat tamamlandı</span>
              )}
              {item.note ? <em>{item.note}</em> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

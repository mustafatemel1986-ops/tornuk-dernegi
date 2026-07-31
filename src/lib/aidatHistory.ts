import type { MemberRecord, YearAidat } from '../types'

/** Eski kayıtlarda yearHistory yoksa borçlu aylardan ve örnek geçmişten üretir. */
export function ensureYearHistory(
  member: MemberRecord,
  monthlyFee: number,
): YearAidat[] {
  if (member.yearHistory && member.yearHistory.length > 0) {
    return normalizeHistory(member.yearHistory)
  }

  const byYear = new Map<number, string[]>()
  for (const month of member.debtMonths ?? []) {
    const year = Number(month.slice(0, 4))
    if (!year) continue
    const list = byYear.get(year) ?? []
    list.push(month)
    byYear.set(year, list)
  }

  const history: YearAidat[] = []
  for (const [year, months] of byYear) {
    history.push({
      year,
      status: 'borclu',
      debtAmount: months.length * monthlyFee || member.debtAmount,
      note: `${months.length} aylık borç`,
    })
  }

  // Geçmiş yıllar için ödendi satırları (görünürlük)
  const currentYear = new Date().getFullYear()
  for (let y = currentYear - 1; y >= currentYear - 2; y -= 1) {
    if (!history.some((h) => h.year === y)) {
      history.push({ year: y, status: 'odendi', debtAmount: 0, note: '' })
    }
  }

  if (history.length === 0) {
    history.push({
      year: currentYear,
      status: member.debtAmount > 0 ? 'borclu' : 'odendi',
      debtAmount: member.debtAmount,
      note: '',
    })
  }

  return normalizeHistory(history)
}

export function normalizeHistory(history: YearAidat[]): YearAidat[] {
  const map = new Map<number, YearAidat>()
  for (const item of history) {
    map.set(item.year, {
      year: item.year,
      status: item.status === 'borclu' && item.debtAmount > 0 ? 'borclu' : item.status,
      debtAmount: item.status === 'odendi' ? 0 : Math.max(0, item.debtAmount || 0),
      note: item.note ?? '',
    })
  }
  return [...map.values()].sort((a, b) => b.year - a.year)
}

export function totalDebtFromHistory(history: YearAidat[]): number {
  return history
    .filter((y) => y.status === 'borclu')
    .reduce((sum, y) => sum + (y.debtAmount || 0), 0)
}

export function upsertYear(
  history: YearAidat[],
  year: number,
  patch: Partial<YearAidat>,
): YearAidat[] {
  const list = normalizeHistory(history)
  const existing = list.find((y) => y.year === year)
  if (!existing) {
    return normalizeHistory([
      ...list,
      {
        year,
        status: patch.status ?? 'borclu',
        debtAmount: patch.debtAmount ?? 0,
        note: patch.note ?? '',
      },
    ])
  }
  return normalizeHistory(
    list.map((y) =>
      y.year === year
        ? {
            ...y,
            ...patch,
            debtAmount:
              (patch.status ?? y.status) === 'odendi'
                ? 0
                : (patch.debtAmount ?? y.debtAmount),
          }
        : y,
    ),
  )
}

export function markYearsPaid(history: YearAidat[], years: number[]): YearAidat[] {
  let next = normalizeHistory(history)
  for (const year of years) {
    next = upsertYear(next, year, { status: 'odendi', debtAmount: 0 })
  }
  return next
}

export function yearsFromMonthKeys(months: string[]): number[] {
  return [...new Set(months.map((m) => Number(m.slice(0, 4))).filter(Boolean))]
}

export function withSyncedDebt(member: MemberRecord, monthlyFee: number): MemberRecord {
  const yearHistory = ensureYearHistory(member, monthlyFee)
  return {
    ...member,
    yearHistory,
    debtAmount: totalDebtFromHistory(yearHistory),
  }
}

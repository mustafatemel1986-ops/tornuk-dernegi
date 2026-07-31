const monthFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric',
})

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const moneyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

/** "2026-07" → "Temmuz 2026" */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return monthFormatter.format(new Date(year, month - 1, 1))
}

export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount)
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'Kayıt yok'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFormatter.format(d)
}

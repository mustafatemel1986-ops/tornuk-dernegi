/** T.C. Kimlik No — 11 hane, 0 ile başlamaz (dernek listelerindeki no’lar için yeterli). */
export function isValidTc(raw: string): boolean {
  const tc = raw.trim()
  return /^\d{11}$/.test(tc) && tc[0] !== '0'
}

/** Resmi TC kontrol basamakları (opsiyonel uyarı için). */
export function hasValidTcChecksum(raw: string): boolean {
  const tc = raw.trim()
  if (!isValidTc(tc)) return false

  const d = tc.split('').map(Number)
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8]
  const evenSum = d[1] + d[3] + d[5] + d[7]
  const check10 = (((oddSum * 7 - evenSum) % 10) + 10) % 10
  if (check10 !== d[9]) return false

  const sumFirst10 = d.slice(0, 10).reduce((a, b) => a + b, 0)
  return sumFirst10 % 10 === d[10]
}

export function normalizeTc(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 11)
}

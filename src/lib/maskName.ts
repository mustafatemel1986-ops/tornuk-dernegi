/** "Ahmet Yılmaz" → "Ahmet Y." */
export function maskDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Üye'
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return `${first} ${last[0]}.`
}

/**
 * data/uyeler.csv → public/data/uyeler.json
 *
 * CSV sütunları:
 * tc,ad_soyad,borc_tutari,borclu_aylar,son_odeme,not
 *
 * borclu_aylar: noktalı virgülle ayrılmış YYYY-AA değerleri (örn. 2026-05;2026-06)
 *
 * Kullanım: npm run generate-data
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const SALT = 'tornuk-dernegi-aidat-v1'

function hashTc(tc) {
  return createHash('sha256').update(`${SALT}:${tc.trim()}`).digest('hex')
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error('CSV en az bir başlık ve bir veri satırı içermelidir.')
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const required = ['tc', 'ad_soyad', 'borc_tutari']
  for (const col of required) {
    if (!headers.includes(col)) {
      throw new Error(`CSV'de zorunlu sütun eksik: ${col}`)
    }
  }

  return lines.slice(1).map((line, index) => {
    const cols = splitCsvLine(line)
    const row = Object.fromEntries(headers.map((h, i) => [h, (cols[i] ?? '').trim()]))
    if (!/^\d{11}$/.test(row.tc)) {
      throw new Error(`Satır ${index + 2}: geçersiz TC (${row.tc})`)
    }
    return row
  })
}

function splitCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function maskDisplayName(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Üye'
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return `${first} ${last[0]}.`
}

const csvPath = join(root, 'data', 'uyeler.csv')
const outDir = join(root, 'public', 'data')
const outPath = join(outDir, 'uyeler.json')

const rows = parseCsv(readFileSync(csvPath, 'utf8'))

const currentYear = new Date().getFullYear()

const members = rows.map((row) => {
  const debtAmount = Number(String(row.borc_tutari).replace(',', '.')) || 0
  const debtMonths = (row.borclu_aylar || '')
    .split(';')
    .map((m) => m.trim())
    .filter(Boolean)

  // Opsiyonel: yil_gecmis = 2024:odendi;2025:odendi;2026:borclu:300
  let yearHistory = []
  if (row.yil_gecmis) {
    yearHistory = row.yil_gecmis.split(';').map((part) => {
      const [yearRaw, statusRaw, amountRaw] = part.split(':').map((x) => x.trim())
      const status = statusRaw === 'borclu' ? 'borclu' : 'odendi'
      return {
        year: Number(yearRaw),
        status,
        debtAmount: status === 'borclu' ? Number(amountRaw || debtAmount) || 0 : 0,
        note: '',
      }
    })
  } else {
    const byYear = new Map()
    for (const month of debtMonths) {
      const y = Number(month.slice(0, 4))
      byYear.set(y, (byYear.get(y) || 0) + 1)
    }
    for (const [year, count] of byYear) {
      yearHistory.push({
        year,
        status: 'borclu',
        debtAmount: count * 100,
        note: `${count} aylık borç`,
      })
    }
    for (let y = currentYear - 1; y >= currentYear - 2; y -= 1) {
      if (!yearHistory.some((h) => h.year === y)) {
        yearHistory.push({ year: y, status: 'odendi', debtAmount: 0, note: '' })
      }
    }
    if (yearHistory.length === 0) {
      yearHistory.push({
        year: currentYear,
        status: debtAmount > 0 ? 'borclu' : 'odendi',
        debtAmount,
        note: '',
      })
    }
  }

  yearHistory.sort((a, b) => b.year - a.year)

  return {
    idHash: hashTc(row.tc),
    displayName: maskDisplayName(row.ad_soyad),
    debtAmount:
      yearHistory.filter((y) => y.status === 'borclu').reduce((s, y) => s + y.debtAmount, 0) ||
      debtAmount,
    debtMonths,
    lastPayment: row.son_odeme || null,
    notes: row.not || '',
    yearHistory,
  }
})

const payload = {
  associationName: 'Törnük Derneği',
  updatedAt: new Date().toISOString().slice(0, 10),
  monthlyFee: 100,
  currency: 'TRY',
  members,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`✓ ${members.length} üye yazıldı → public/data/uyeler.json`)
console.log('  Not: TC numaraları hashlenerek saklandı; CSV dosyasını GitHub\'a yüklemeyin.')

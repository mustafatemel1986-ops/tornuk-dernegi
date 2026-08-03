/**
 * Canlı gh-pages data/*.json dosyalarını dist/data içine çeker.
 * Böylece `gh-pages -d dist` admin yayınlarını ezmez.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LIVE =
  'https://raw.githubusercontent.com/mustafatemel1986-ops/tornuk-dernegi/gh-pages/data'
const FILES = ['uyeler.json', 'duyurular.json', 'etkinlikler.json', 'admin.json', 'bridge.json']

const distData = join(process.cwd(), 'dist', 'data')
const publicData = join(process.cwd(), 'public', 'data')

if (!existsSync(distData)) mkdirSync(distData, { recursive: true })

for (const file of FILES) {
  try {
    const res = await fetch(`${LIVE}/${file}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`skip ${file}: HTTP ${res.status}`)
      continue
    }
    const text = await res.text()
    writeFileSync(join(distData, file), text.endsWith('\n') ? text : `${text}\n`)
    writeFileSync(join(publicData, file), text.endsWith('\n') ? text : `${text}\n`)
    console.log(`synced ${file}`)
  } catch (error) {
    console.warn(`skip ${file}:`, error instanceof Error ? error.message : error)
  }
}

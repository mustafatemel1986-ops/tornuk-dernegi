import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const FILES = [
  ['uyeler.json', 'data/uyeler.json', 'public/data/uyeler.json'],
  ['duyurular.json', 'data/duyurular.json', 'public/data/duyurular.json'],
  ['etkinlikler.json', 'data/etkinlikler.json', 'public/data/etkinlikler.json'],
  ['admin.json', 'data/admin.json', 'public/data/admin.json'],
  ['bridge.json', 'data/bridge.json', 'public/data/bridge.json'],
]

const distData = join(process.cwd(), 'dist', 'data')
const publicData = join(process.cwd(), 'public', 'data')
if (!existsSync(distData)) mkdirSync(distData, { recursive: true })

function readViaGh(path, branch) {
  const b64 = execFileSync(
    'gh',
    ['api', `repos/mustafatemel1986-ops/tornuk-dernegi/contents/${path}?ref=${branch}`, '--jq', '.content'],
    { encoding: 'utf8' },
  ).replace(/\s+/g, '')
  return Buffer.from(b64, 'base64').toString('utf8')
}

for (const [name, livePath] of FILES) {
  try {
    const text = readViaGh(livePath, 'gh-pages')
    const out = text.endsWith('\n') ? text : `${text}\n`
    writeFileSync(join(distData, name), out)
    writeFileSync(join(publicData, name), out)
    console.log(`synced ${name}`)
  } catch (error) {
    console.warn(`skip ${name}:`, error instanceof Error ? error.message : error)
  }
}

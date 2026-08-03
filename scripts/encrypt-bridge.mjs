/**
 * GitHub token'ı admin PIN ile şifreler (Worker erişilemezse yedek yayın).
 * Kullanım: node scripts/encrypt-bridge.mjs
 * Token: gh auth veya GITHUB_TOKEN env
 */
import { createHash, pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PIN = process.env.ADMIN_PIN || '240168'
const SALT_LABEL = 'tornuk-admin-v1'

const expectedHash = createHash('sha256').update(`${SALT_LABEL}:${PIN}`).digest('hex')
const adminHash = 'ae95108b090aab691729de4d45fc1c18346f31c6e7ff8958348728e7b6d4c55e'
if (expectedHash !== adminHash) {
  console.error('PIN, admin.json hash ile uyuşmuyor.')
  process.exit(1)
}

let token = process.env.GITHUB_TOKEN || ''
if (!token) {
  try {
    token = execSync('gh auth token', { encoding: 'utf8' }).trim()
  } catch {
    console.error('GITHUB_TOKEN yok ve gh auth token alınamadı.')
    process.exit(1)
  }
}

const salt = randomBytes(16)
const iv = randomBytes(12)
const key = pbkdf2Sync(PIN, salt, 250000, 32, 'sha256')
const cipher = createCipheriv('aes-256-gcm', key, iv)
const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
const tag = cipher.getAuthTag()

const out = {
  v: 1,
  kdf: 'pbkdf2-sha256',
  iter: 250000,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  tag: tag.toString('base64'),
  data: enc.toString('base64'),
}

const path = join(__dirname, '..', 'public', 'data', 'bridge.json')
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`)
console.log('Wrote', path)

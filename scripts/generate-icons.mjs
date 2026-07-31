import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const logoPath = join(root, 'public', 'logo.png')
mkdirSync(outDir, { recursive: true })

async function makeIcon(name, size, { padded = false } = {}) {
  const out = join(outDir, name)
  if (padded) {
    // Maskable: logo ortada, mavi zemin + güvenli kenar boşluğu
    const inner = Math.round(size * 0.72)
    const logo = await sharp(logoPath).resize(inner, inner, { fit: 'contain' }).png().toBuffer()
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 30, g: 90, b: 168, alpha: 1 },
      },
    })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toFile(out)
  } else {
    await sharp(logoPath)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(out)
  }
}

await makeIcon('icon-192.png', 192)
await makeIcon('icon-512.png', 512)
await makeIcon('maskable-512.png', 512, { padded: true })
await makeIcon('apple-touch-icon.png', 180)
await makeIcon('favicon-32.png', 32)

// Ana favicon olarak da kopyala
await sharp(logoPath).resize(64, 64, { fit: 'cover' }).png().toFile(join(root, 'public', 'favicon.png'))

console.log('✓ Logo ikonları üretildi → public/icons/ + favicon.png')

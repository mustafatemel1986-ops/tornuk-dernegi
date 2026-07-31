import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="96" fill="#0F4C5C"/>
  <path d="M256 96c-40 50-100 78-100 146a100 100 0 1 0 200 0c0-68-60-96-100-146Z" stroke="#F3F6F4" stroke-width="28"/>
  <path d="M256 256v64M220 296h72" stroke="#C9A227" stroke-width="28" stroke-linecap="round"/>
</svg>
`

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#0F4C5C"/>
  <path d="M256 128c-34 42-84 66-84 122a84 84 0 1 0 168 0c0-56-50-80-84-122Z" stroke="#F3F6F4" stroke-width="26"/>
  <path d="M256 268v56M224 304h64" stroke="#C9A227" stroke-width="26" stroke-linecap="round"/>
</svg>
`

const sizes = [
  { name: 'icon-192.png', size: 192, source: svg },
  { name: 'icon-512.png', size: 512, source: svg },
  { name: 'maskable-512.png', size: 512, source: maskableSvg },
  { name: 'apple-touch-icon.png', size: 180, source: svg },
]

for (const item of sizes) {
  await sharp(Buffer.from(item.source))
    .resize(item.size, item.size)
    .png()
    .toFile(join(outDir, item.name))
}

console.log('✓ PWA ikonları üretildi → public/icons/')

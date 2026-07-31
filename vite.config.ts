import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages proje adresi:
 * https://KULLANICI.github.io/REPO_ADI/
 *
 * Depo adınız farklıysa aşağıdaki değeri değiştirin.
 */
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'tornuk-dernegi'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'belgeler/*.html'],
      manifest: {
        name: 'Törnük Derneği',
        short_name: 'Törnük',
        description: 'Törnük Derneği üye aidat, duyuru ve etkinlik uygulaması',
        lang: 'tr',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#0f4c5c',
        background_color: '#f3f6f4',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Üye/duyuru JSON dosyaları precache edilmesin; her zaman taze okunsun
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  base: command === 'build' ? `/${repoName}/` : '/',
}))

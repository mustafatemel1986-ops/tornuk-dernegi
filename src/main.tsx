import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    // Periyodik güncelleme — eski SW’nin duyuru listesini tutmasını engeller
    window.setInterval(() => {
      void registration.update()
    }, 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

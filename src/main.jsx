import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Capture beforeinstallprompt BEFORE React mounts.
// The event fires early — if we wait until useEffect it's already gone.
window.__pwaInstallPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
  window.dispatchEvent(new Event('pwaPromptReady'))
})
window.addEventListener('appinstalled', () => {
  window.__pwaInstallPrompt = null
  window.dispatchEvent(new Event('pwaInstalled'))
})

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/re-former/sw.js')
      .then(reg => {
        reg.update()

        // When a new SW installs, skip waiting immediately — don't ask the user
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        // iOS PWA: when app is reopened from home screen, visibilitychange fires.
        // Actively check for updates and skip any waiting SW so the reload happens.
        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState !== 'visible') return
          try {
            await reg.update()
            // Small delay to let the update check complete
            setTimeout(() => {
              if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' })
              }
            }, 500)
          } catch { /* ignore */ }
        })
      })
      .catch(err => console.warn('SW registration failed:', err))

    // When SW controller changes (new SW activated), reload the page
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

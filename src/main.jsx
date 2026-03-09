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
  // Notify App if it's already mounted and listening
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

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(err => console.warn('SW registration failed:', err))

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

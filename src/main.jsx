import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { reportError, describeError, installGlobalErrorHandlers } from './shared/errorLog'
import { CopyDiagnosticsButton } from './shared/CopyDiagnosticsButton'

// Catch uncaught errors and unhandled promise rejections anywhere in the app.
installGlobalErrorHandlers()

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

// ── Render error boundary ────────────────────────────────────────────────────
// Without this, an error thrown while rendering blanks the whole app with no
// message. This shows what failed and the diagnostics to copy. Drafts and
// saved details are stored separately, so they are not lost.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    const stack = (info?.componentStack || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6)
    reportError('render', error, { componentStack: stack.join(' <- ') })
  }

  render() {
    if (!this.state.error) return this.props.children

    const boxStyle = {
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: '#f4f4f8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }

    return (
      <div style={boxStyle}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#111827' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5, margin: '0 0 12px' }}>
            The app stopped while showing this screen. Your saved drafts and My Details are kept.
            Try reloading. If it happens again, send the diagnostics below.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.4,
            background: '#111827', color: '#f9fafb', padding: 10, borderRadius: 8, margin: '0 0 12px',
          }}>{describeError(this.state.error)}</pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 14px', borderRadius: 8, border: '2px solid #4f46e5',
                background: '#fff', color: '#4f46e5', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Reload app
            </button>
            <CopyDiagnosticsButton accent="#4f46e5" />
          </div>
        </div>
      </div>
    )
  }
}

// Register service worker.
// import.meta.env.BASE_URL is Vite's resolved `base` config value (with a
// trailing slash) — '/re-former/' on GitHub Pages, '/' on Netlify.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // On a first visit there's no controller yet, and the new worker claims the
    // page when it activates. That is not an update, so it must not reload.
    const hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(reg => {
        reg.update().catch(err => {
          reportError('service-worker', err, { step: 'update check', scope: import.meta.env.BASE_URL })
        })
        // Update banner logic (including SKIP_WAITING) is handled inside App.jsx.
      })
      .catch(err => {
        reportError('service-worker', err, { step: 'register', script: `${import.meta.env.BASE_URL}sw.js` })
      })

    // When SW controller changes (new SW activated by user choice), reload the page
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  })
} else {
  // Not an error worth filling the log with on every launch. Offline use needs this.
  console.warn('[re-former] Service workers are not supported here, so offline use will not work.')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)

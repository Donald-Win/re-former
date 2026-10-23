/**
 * AuthGate — wraps the entire app and controls access.
 *
 * Drop into App.jsx:
 *   import { AuthGate } from './auth/AuthGate'
 *   return <AuthGate> ... rest of app JSX ... </AuthGate>
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  getDeviceId,
  getCachedResult,
  checkAccessOnline,
  setRevokedCallback,
  addVisibilityListener,
  addOnlineListener,
} from './auth'
import { isCacheExpired, MAX_OFFLINE_MS } from './authPolicy'

// ── LOCK SCREEN ───────────────────────────────────────────────────────────────

function LockScreen({ deviceId }) {
  const subject = encodeURIComponent('re-former Access Request')
  const body = encodeURIComponent(
    `Hi Donald,\n\nPlease grant me access to re-former.\n\nMy Device ID is: ${deviceId}\n\nThanks.`
  )
  const mailtoHref = `mailto:donald.c.win@gmail.com?subject=${subject}&body=${body}`

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '2.5rem 2rem',
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔐</div>

        <h1 style={{
          fontSize: '1.6rem', fontWeight: 900, color: '#111827',
          margin: '0 0 0.75rem',
        }}>
          Access Restricted
        </h1>

        <p style={{
          color: '#6b7280', lineHeight: 1.6,
          margin: '0 0 1.75rem', fontSize: '0.95rem',
        }}>
          Your device isn't authorised to use re&#8209;former.
          Send your Device ID to Donald to request access.
        </p>

        {/* Device ID display */}
        <div style={{
          background: '#f3f4f6', borderRadius: 14,
          padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8,
          }}>
            Your Device ID
          </div>
          <div style={{
            fontSize: '1.3rem', fontWeight: 900, fontFamily: 'monospace',
            letterSpacing: '0.08em', color: '#111827',
            background: 'white', borderRadius: 10, padding: '0.75rem',
            border: '2px solid #e5e7eb',
            userSelect: 'all', WebkitUserSelect: 'all', cursor: 'text',
          }}>
            {deviceId}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            Tap the ID above to select it, then copy
          </div>
        </div>

        {/* Email button */}
        <a
          href={mailtoHref}
          style={{
            display: 'block', background: '#4f46e5', color: 'white',
            textDecoration: 'none', borderRadius: 12,
            padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.95rem',
            marginBottom: '0.75rem', boxSizing: 'border-box',
          }}
        >
          ✉️ Email Access Request
        </a>

        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%', background: 'transparent',
            border: '2px solid #e5e7eb', borderRadius: 12,
            padding: '0.75rem', color: '#6b7280',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        >
          Check Again
        </button>
      </div>
    </div>
  )
}

// ── VERIFY SCREEN ─────────────────────────────────────────────────────────────
// Shown when a device that WAS allowed hasn't been able to confirm that for
// longer than MAX_OFFLINE_MS. Not a block — one successful connection clears it.

function VerifyScreen({ onCheck, checking }) {
  const days = Math.round(MAX_OFFLINE_MS / 86_400_000)
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '2.5rem 2rem',
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📶</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#111827', margin: '0 0 0.75rem' }}>
          Connect to Verify
        </h1>
        <p style={{ color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.75rem', fontSize: '0.95rem' }}>
          This device hasn't been able to check in for over {days} days.
          Connect to the internet once and re&#8209;former will carry on as normal.
          Your saved details and drafts are safe.
        </p>
        <button
          onClick={onCheck}
          disabled={checking}
          style={{
            width: '100%', background: checking ? '#a5b4fc' : '#4f46e5', color: 'white',
            border: 'none', borderRadius: 12,
            padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.95rem',
            cursor: checking ? 'default' : 'pointer', boxSizing: 'border-box',
          }}
        >
          {checking ? 'Checking…' : 'Check Now'}
        </button>
      </div>
    </div>
  )
}

// ── LOADING SCREEN ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f4f4f8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Checking access…</div>
      </div>
    </div>
  )
}

// ── AUTH GATE ─────────────────────────────────────────────────────────────────

export function AuthGate({ children }) {
  const [status, setStatus]       = useState('loading') // loading | allowed | denied | verify
  const [deviceId, setDeviceId]   = useState('')
  const [verifying, setVerifying] = useState(false)

  // Live check behind the "Connect to Verify" screen (button + auto-retry
  // when the network returns).
  const verifyNow = useCallback(async () => {
    setVerifying(true)
    try {
      const result = await checkAccessOnline()
      setStatus(result.allowed ? 'allowed' : 'denied')
    } catch {
      setStatus('verify') // still can't reach the service
    } finally {
      setVerifying(false)
    }
  }, [])

  useEffect(() => {
    const id = getDeviceId()
    setDeviceId(id)

    // Called by the re-check triggers (resume, online, form open) when
    // access is revoked mid-session
    setRevokedCallback((revokedId) => {
      console.warn('[re-former auth] Access revoked — showing lock screen')
      setDeviceId(revokedId)
      setStatus('denied')
    })

    addVisibilityListener()
    addOnlineListener()

    const cached  = getCachedResult()
    const expired = isCacheExpired(cached) // "allowed" but not verified for > MAX_OFFLINE_MS

    if (navigator.onLine) {
      // Show the cached result immediately while the live check runs, to
      // avoid a loading flash on repeat visits. An EXPIRED allow is not
      // shown — the screen stays on "Checking access…" until the live check
      // answers. The live check below always runs and overrides the cache.
      if (cached !== null && !expired) {
        setStatus(cached.allowed ? 'allowed' : 'denied')
      }

      checkAccessOnline()
        .then(result => setStatus(result.allowed ? 'allowed' : 'denied'))
        .catch(() => {
          if (cached === null) {
            // No cache and the check failed — fail open
            console.warn('[re-former auth] No cache and network failed — failing open')
            setStatus('allowed')
          } else if (expired) {
            // Couldn't re-verify and the last verification is too old
            setStatus('verify')
          }
          // Otherwise the cache was already shown — leave it as-is
        })

    } else {
      // Offline — use cache only
      if (cached !== null) {
        console.log('[re-former auth] Offline — using cached result:', cached.allowed ? 'allowed' : 'denied', expired ? '(expired)' : '')
        setStatus(expired ? 'verify' : cached.allowed ? 'allowed' : 'denied')
      } else {
        // No cache, no network (fresh install offline) — fail open
        console.warn('[re-former auth] Offline with no cache — failing open')
        setStatus('allowed')
      }
      // The online listener re-checks as soon as connectivity returns
    }
  }, [])

  // While on the "Connect to Verify" screen, retry automatically the moment
  // the network comes back.
  useEffect(() => {
    if (status !== 'verify') return
    window.addEventListener('online', verifyNow)
    return () => window.removeEventListener('online', verifyNow)
  }, [status, verifyNow])

  if (status === 'loading') return <LoadingScreen />
  if (status === 'denied')  return <LockScreen deviceId={deviceId} />
  if (status === 'verify')  return <VerifyScreen onCheck={verifyNow} checking={verifying} />
  return children
}

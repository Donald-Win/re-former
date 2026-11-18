/**
 * errorLog.js — the one place errors are reported to.
 *
 * reportError(stage, err, detail?) records a plain-text entry (where it
 * failed, the exception name / message / code, and any extra detail), logs
 * it to the console, and keeps the most recent entries in localStorage so
 * they survive a reload.
 *
 * buildDiagnosticsReport() turns the log plus device details into text that
 * a technician can copy and send.
 *
 * Nothing here stores form content, names, signatures or photos — only
 * error text and device/feature details.
 */

const STORAGE_KEY = 're-former-error-log'
const MAX_ENTRIES = 30
const MAX_TEXT    = 600

let appVersion = 'unknown'
let entries    = loadEntries()

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : []
  } catch {
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage full or unavailable — the in-memory log still works this session.
  }
}

const clip = s => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '…' : s)

function safeStringify(obj) {
  try {
    return clip(JSON.stringify(obj))
  } catch {
    return clip(String(obj))
  }
}

/** Set once at startup (App.jsx) so every report says which build produced it. */
export function setAppVersion(v) {
  appVersion = v
}

/**
 * Turn anything thrown into readable text: name, message, DOMException code,
 * HTTP status, and up to three levels of `cause`.
 */
export function describeError(err) {
  if (err === null || err === undefined) return 'no error object was provided'
  if (typeof err === 'string') return clip(err)
  const parts = []
  const name = err.name || err.constructor?.name || 'Error'
  parts.push(`${name}: ${err.message ?? String(err)}`)
  if (typeof err.code === 'number' || typeof err.code === 'string') parts.push(`code=${err.code}`)
  if (err.status !== undefined) parts.push(`status=${err.status}`)
  let cause = err.cause
  let depth = 0
  while (cause && depth < 3) {
    parts.push(`caused by ${cause.name || 'Error'}: ${cause.message ?? String(cause)}`)
    cause = cause.cause
    depth++
  }
  return clip(parts.join(' | '))
}

/**
 * Guarantee an Error object with a `stage` tag, so callers further up can
 * say where a failure happened without losing the original message.
 */
export function withStage(err, stage) {
  const e = err instanceof Error ? err : new Error(String(err ?? 'unknown error'))
  if (!e.stage) e.stage = stage
  return e
}

/**
 * Record an error. `stage` is a short label for where it happened
 * (e.g. 'pdf-preview', 'share', 'uncaught'). `detail` is any small extra
 * context — keep it free of personal details.
 */
export function reportError(stage, err, detail = {}) {
  const entry = {
    at: new Date().toISOString(),
    stage,
    error: describeError(err),
    ...(Object.keys(detail).length ? { detail: safeStringify(detail) } : {}),
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  persist()
  console.error(`[re-former:${stage}] ${entry.error}`, err)
  return entry
}

export function getErrorLog() {
  return [...entries]
}

export function clearErrorLog() {
  entries = []
  persist()
}

/** Device and feature details. Safe to call on the main thread only. */
export function getEnvironment() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const touchMac = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)
  const isIOS = /iPad|iPhone|iPod/.test(ua) || touchMac   // iPadOS in desktop mode reports as Macintosh
  const android = /Android/.test(ua)
  const os = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/)
  const standaloneMedia = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches

  return {
    appVersion,
    platform: isIOS ? 'iPadOS/iOS' : android ? 'Android' : 'other',
    osVersion: os ? `${os[1]}.${os[2]}${os[3] ? '.' + os[3] : ''}` : 'unknown',
    standalone: !!(typeof navigator !== 'undefined' && navigator.standalone) || standaloneMedia,
    online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x` : 'unknown',
    features: {
      promiseWithResolvers: typeof Promise.withResolvers === 'function',
      structuredClone: typeof structuredClone === 'function',
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      clipboardWrite: typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText,
      webShareFiles: typeof navigator !== 'undefined' && typeof navigator.canShare === 'function',
    },
    userAgent: ua,
  }
}

/** Plain-text report: device details, feature support, then recent errors. */
export function buildDiagnosticsReport() {
  const env = getEnvironment()
  const { features, userAgent, ...device } = env
  const lines = [
    're-former diagnostics',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Device',
    ...Object.entries(device).map(([k, v]) => `  ${k}: ${v}`),
    `  features: ${Object.entries(features).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `  userAgent: ${userAgent}`,
    '',
    `Recent errors (${entries.length}, oldest first)`,
  ]
  if (entries.length === 0) lines.push('  none recorded')
  entries.forEach(e => {
    lines.push(`  ${e.at}  [${e.stage}]`)
    lines.push(`    ${e.error}`)
    if (e.detail) lines.push(`    detail: ${e.detail}`)
  })
  return lines.join('\n')
}

let globalHandlersInstalled = false

/**
 * Catch anything nothing else caught: uncaught exceptions and unhandled
 * promise rejections anywhere in the app. Call once at startup.
 */
export function installGlobalErrorHandlers() {
  if (globalHandlersInstalled || typeof window === 'undefined') return
  globalHandlersInstalled = true
  window.addEventListener('error', e => {
    reportError('uncaught', e.error ?? e.message, {
      file: e.filename, line: e.lineno, col: e.colno,
    })
  })
  window.addEventListener('unhandledrejection', e => {
    reportError('unhandled-promise', e.reason)
  })
}

/**
 * authPolicy.js — pure decision logic for the device access check.
 *
 * Kept free of window / localStorage / fetch so it can be unit-tested in
 * plain Node (auth.js touches `window` at import time and can't be).
 */

// How long a cached "allowed" answer is trusted with no successful live
// check. Past this the app asks the tech to connect once to re-verify
// (rather than showing the Access Restricted screen — they haven't been
// blocked, we just haven't been able to confirm they still aren't).
export const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Minimum gap between live checks triggered by opening a form.
export const WIZARD_CHECK_MIN_GAP_MS = 5 * 60 * 1000 // 5 minutes

/**
 * True when a cached result is an "allowed" one that has outlived
 * MAX_OFFLINE_MS. A cached denial never lapses (it stays denied until a
 * live check says otherwise), and a missing cache is not "expired" — the
 * caller handles the no-cache case separately.
 *
 * `cachedAt` is refreshed by every successful live check (see auth.js), so
 * in effect this measures "time since this device was last verified".
 */
export function isCacheExpired(cached, now = Date.now(), maxAgeMs = MAX_OFFLINE_MS) {
  if (!cached || !cached.allowed) return false
  const at = Number(cached.cachedAt)
  if (!Number.isFinite(at) || at <= 0) return true
  return now - at > maxAgeMs
}

/**
 * Throws unless `result` is a trustworthy answer from the access Worker.
 * Anything that isn't a definite allow/deny must NOT be cached or acted on
 * — it is treated exactly like a network error (keep the previous state).
 *
 * In particular the Worker answers `reason: 'kv_unavailable'` (HTTP 200,
 * allowed:false) when its storage has a sustained problem. That is "I don't
 * know", not "blocked", so it must never reach the lock screen or the cache.
 */
export function validateCheckResult(result) {
  if (!result || typeof result.allowed !== 'boolean') {
    throw new Error('Unexpected response from access service')
  }
  if (result.reason === 'kv_unavailable') {
    throw new Error('Access service temporarily unavailable')
  }
  return result
}

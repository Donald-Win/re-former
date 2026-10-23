import { describe, it, expect } from 'vitest'
import { isCacheExpired, validateCheckResult, MAX_OFFLINE_MS } from './authPolicy'

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

describe('isCacheExpired', () => {
  it('is false for a recent allowed result', () => {
    expect(isCacheExpired({ allowed: true, cachedAt: NOW - 2 * DAY }, NOW)).toBe(false)
  })
  it('is true once an allowed result is older than 7 days', () => {
    expect(isCacheExpired({ allowed: true, cachedAt: NOW - 7 * DAY - 1 }, NOW)).toBe(true)
  })
  it('is false exactly at the limit', () => {
    expect(isCacheExpired({ allowed: true, cachedAt: NOW - MAX_OFFLINE_MS }, NOW)).toBe(false)
  })
  it('never expires a cached denial', () => {
    expect(isCacheExpired({ allowed: false, cachedAt: NOW - 30 * DAY }, NOW)).toBe(false)
  })
  it('treats an allowed result with no usable timestamp as expired', () => {
    expect(isCacheExpired({ allowed: true }, NOW)).toBe(true)
    expect(isCacheExpired({ allowed: true, cachedAt: 'junk' }, NOW)).toBe(true)
  })
  it('is false when there is no cache at all', () => {
    expect(isCacheExpired(null, NOW)).toBe(false)
  })
  it('does not expire when the device clock is behind cachedAt', () => {
    expect(isCacheExpired({ allowed: true, cachedAt: NOW + DAY }, NOW)).toBe(false)
  })
})

describe('validateCheckResult', () => {
  it('passes a definite allow or deny through', () => {
    const allow = { allowed: true, openMode: false }
    const deny  = { allowed: false, reason: 'revoked' }
    expect(validateCheckResult(allow)).toBe(allow)
    expect(validateCheckResult(deny)).toBe(deny)
  })
  it('rejects kv_unavailable so it is never cached or shown as a block', () => {
    expect(() => validateCheckResult({ allowed: false, reason: 'kv_unavailable' })).toThrow()
  })
  it('rejects malformed responses', () => {
    expect(() => validateCheckResult(null)).toThrow()
    expect(() => validateCheckResult({})).toThrow()
    expect(() => validateCheckResult({ allowed: 'yes' })).toThrow()
  })
})

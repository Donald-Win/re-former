/**
 * userPrefs — lightweight localStorage wrapper for per-device user preferences.
 *
 * Stored keys:
 *   rf_pref_contractor  — contractor company name
 *   rf_pref_namePrint   — tech's printed name
 *
 * These auto-populate the Contractor and Name (Print) fields in every wizard
 * and update whenever the user edits them.
 */

const KEYS = {
  contractor: 'rf_pref_contractor',
  namePrint:  'rf_pref_namePrint',
}

/** Returns { contractor, namePrint } from localStorage (empty strings if not set). */
export function getUserPrefs() {
  return {
    contractor: localStorage.getItem(KEYS.contractor) || '',
    namePrint:  localStorage.getItem(KEYS.namePrint)  || '',
  }
}

/** Saves a single pref. key must be 'contractor' or 'namePrint'. */
export function saveUserPref(key, value) {
  if (!KEYS[key]) return
  if (value) {
    localStorage.setItem(KEYS[key], value)
  }
}

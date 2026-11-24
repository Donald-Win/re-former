/**
 * userPrefs — lightweight localStorage wrapper for per-device user preferences.
 *
 * Stored keys:
 *   rf_pref_contractor        — contractor company name
 *   rf_pref_namePrint         — tech's printed name
 *   rf_pref_isnId             — ISN ID number
 *   rf_pref_signed            — signature dataURL
 *   rf_pref_certNo            — competency certificate number
 *   rf_pref_dateWorkCompleted — last-used date (YYYY-MM-DD), refreshed to today on each load
 *   rf_pref_defaultView       — which screen the app opens to: 'workType' | 'allForms'
 *   rf_pref_testSets          — JSON list of up to 3 named test sets:
 *                               [{ name, make, model, serial }, ...]
 *
 * Earlier builds stored one test set under rf_pref_testEquipMake/Model/Serial.
 * getTestSets() reads those as a single set named "My test set" until the
 * list is saved, after which the old keys are removed.
 */

const KEYS = {
  contractor:         'rf_pref_contractor',
  namePrint:          'rf_pref_namePrint',
  isnId:              'rf_pref_isnId',
  signed:             'rf_pref_signed',
  certNo:             'rf_pref_certNo',
  dateWorkCompleted:  'rf_pref_dateWorkCompleted',
  defaultView:        'rf_pref_defaultView',
  testSets:           'rf_pref_testSets',
}

// Keys used by the single test set in earlier builds (read for migration only).
const LEGACY_TEST_KEYS = {
  make:   'rf_pref_testEquipMake',
  model:  'rf_pref_testEquipModel',
  serial: 'rf_pref_testEquipSerial',
}

export const MAX_TEST_SETS = 3
const MAX_TEXT = 80

/** Today's date as YYYY-MM-DD (matches HTML date input format). */
function todayString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Returns { contractor, namePrint, isnId, signed, certNo, dateWorkCompleted,
 * defaultView, testSets } from localStorage.
 * dateWorkCompleted always returns today — it's used to pre-fill the field,
 * and the tech can change it if the work was done on a different day.
 * defaultView falls back to 'workType' — the app's original default screen —
 * when nothing has been saved yet.
 */
export function getUserPrefs() {
  return {
    contractor:         localStorage.getItem(KEYS.contractor)        || '',
    namePrint:          localStorage.getItem(KEYS.namePrint)         || '',
    isnId:              localStorage.getItem(KEYS.isnId)             || '',
    signed:             localStorage.getItem(KEYS.signed)            || '',
    certNo:             localStorage.getItem(KEYS.certNo)            || '',
    dateWorkCompleted:  todayString(),
    defaultView:        localStorage.getItem(KEYS.defaultView)       || 'workType',
    testSets:           getTestSets(),
  }
}

/** Saves a single pref. key must be one of the keys defined in KEYS above. */
export function saveUserPref(key, value) {
  if (!KEYS[key]) return
  if (value) {
    localStorage.setItem(KEYS[key], value)
  } else {
    localStorage.removeItem(KEYS[key])
  }
}

// ── Test sets ────────────────────────────────────────────────────────────────

const clean = v => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '')

/** Keep only well-formed sets with a name, trimmed, capped at MAX_TEST_SETS. */
function sanitizeTestSets(list) {
  return (Array.isArray(list) ? list : [])
    .filter(s => s && typeof s === 'object')
    .map(s => ({ name: clean(s.name), make: clean(s.make), model: clean(s.model), serial: clean(s.serial) }))
    .filter(s => s.name)
    .slice(0, MAX_TEST_SETS)
}

/** The saved test sets, in the order they were saved. */
export function getTestSets() {
  let list = []
  try {
    const raw = localStorage.getItem(KEYS.testSets)
    if (raw) list = JSON.parse(raw)
  } catch {
    list = []
  }
  if (!Array.isArray(list) || list.length === 0) {
    // Migrate the single set saved by earlier builds, if there is one.
    const legacy = {
      name:   'My test set',
      make:   localStorage.getItem(LEGACY_TEST_KEYS.make)   || '',
      model:  localStorage.getItem(LEGACY_TEST_KEYS.model)  || '',
      serial: localStorage.getItem(LEGACY_TEST_KEYS.serial) || '',
    }
    if (legacy.make || legacy.model || legacy.serial) list = [legacy]
  }
  return sanitizeTestSets(list)
}

/**
 * Replace the saved test sets. Sets without a name are dropped, and no more
 * than MAX_TEST_SETS are kept. Returns the list that was actually saved.
 */
export function saveTestSets(list) {
  const cleaned = sanitizeTestSets(list)
  localStorage.setItem(KEYS.testSets, JSON.stringify(cleaned))
  localStorage.removeItem(LEGACY_TEST_KEYS.make)
  localStorage.removeItem(LEGACY_TEST_KEYS.model)
  localStorage.removeItem(LEGACY_TEST_KEYS.serial)
  return cleaned
}

/**
 * Returns the common form-state fields that every wizard initialises from
 * user preferences, merged with any form-specific extras.
 *
 * Designed for use as a useState initialiser (function form) so getUserPrefs()
 * is called only once at mount rather than on every render:
 *
 *   const [d, setD] = useState(() => getBaseFormState({ myField: '' }))
 *
 * @param {object} [extras={}]  Form-specific fields to merge in after the base.
 * @returns {object}
 */
export function getBaseFormState(extras = {}) {
  const p = getUserPrefs()
  return {
    npJobNumber:       '',
    projectName:       '',
    pcoWONo:           '',
    ciwrNo:            '',
    streetRoad:        '',
    cityTown:          '',
    district:          '',
    mapNumber:         '',
    contractor:        p.contractor,
    dateWorkCompleted: p.dateWorkCompleted,
    namePrint:         p.namePrint,
    signed:            p.signed,
    ...extras,
  }
}

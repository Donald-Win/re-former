import { describe, it, expect, beforeEach } from 'vitest'

// userPrefs reads localStorage. Node has none, so provide a small in-memory one
// before the module is loaded.
class MemoryStorage {
  constructor() { this.map = new Map() }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
}
globalThis.localStorage = new MemoryStorage()

const { getTestSets, saveTestSets, getUserPrefs, saveUserPref, MAX_TEST_SETS } = await import('./userPrefs')

const LEGACY = {
  make: 'rf_pref_testEquipMake',
  model: 'rf_pref_testEquipModel',
  serial: 'rf_pref_testEquipSerial',
}

beforeEach(() => localStorage.clear())

describe('getTestSets / saveTestSets', () => {
  it('returns an empty list when nothing is saved', () => {
    expect(getTestSets()).toEqual([])
  })

  it('saves and returns sets in the order given', () => {
    saveTestSets([
      { name: 'Megger', make: 'Megger', model: 'MIT1025', serial: '111' },
      { name: 'Van 3 kit', make: 'Fluke', model: '1555', serial: '222' },
    ])
    expect(getTestSets().map(s => s.name)).toEqual(['Megger', 'Van 3 kit'])
    expect(getTestSets()[1]).toEqual({ name: 'Van 3 kit', make: 'Fluke', model: '1555', serial: '222' })
  })

  it('allows at most three sets', () => {
    expect(MAX_TEST_SETS).toBe(3)
    const four = ['A', 'B', 'C', 'D'].map(name => ({ name, make: '', model: '', serial: '' }))
    const kept = saveTestSets(four)
    expect(kept.map(s => s.name)).toEqual(['A', 'B', 'C'])
    expect(getTestSets()).toHaveLength(3)
  })

  it('drops sets without a name', () => {
    saveTestSets([
      { name: '', make: 'Megger', model: '', serial: '' },
      { name: 'Kept', make: '', model: '', serial: '' },
      { name: '   ', make: 'Fluke', model: '', serial: '' },
    ])
    expect(getTestSets().map(s => s.name)).toEqual(['Kept'])
  })

  it('trims text and limits names to 80 characters', () => {
    saveTestSets([{ name: '  ' + 'x'.repeat(120) + '  ', make: '  Megger ', model: '', serial: '' }])
    const [s] = getTestSets()
    expect(s.name).toHaveLength(80)
    expect(s.make).toBe('Megger')
  })

  it('ignores malformed entries', () => {
    saveTestSets([null, 'nope', 42, { name: 'Good', make: '', model: '', serial: '' }])
    expect(getTestSets().map(s => s.name)).toEqual(['Good'])
  })

  it('an empty save clears the list', () => {
    saveTestSets([{ name: 'A', make: '', model: '', serial: '' }])
    saveTestSets([])
    expect(getTestSets()).toEqual([])
  })

  it('recovers from corrupt stored data without throwing', () => {
    localStorage.setItem('rf_pref_testSets', '{not json')
    expect(getTestSets()).toEqual([])
  })
})

describe('legacy single test set migration', () => {
  it('reads the old single set as "My test set"', () => {
    localStorage.setItem(LEGACY.make, 'Megger')
    localStorage.setItem(LEGACY.model, 'MIT1025')
    localStorage.setItem(LEGACY.serial, '999')
    expect(getTestSets()).toEqual([
      { name: 'My test set', make: 'Megger', model: 'MIT1025', serial: '999' },
    ])
  })

  it('ignores an old set that is entirely blank', () => {
    localStorage.setItem(LEGACY.make, '')
    expect(getTestSets()).toEqual([])
  })

  it('removes the old keys once the new list is saved', () => {
    localStorage.setItem(LEGACY.make, 'Megger')
    localStorage.setItem(LEGACY.model, 'MIT1025')
    localStorage.setItem(LEGACY.serial, '999')
    saveTestSets(getTestSets())
    expect(localStorage.getItem(LEGACY.make)).toBeNull()
    expect(localStorage.getItem(LEGACY.model)).toBeNull()
    expect(localStorage.getItem(LEGACY.serial)).toBeNull()
    expect(getTestSets()[0].name).toBe('My test set')
  })

  it('a new list takes priority over the old keys', () => {
    localStorage.setItem(LEGACY.make, 'Old')
    saveTestSets([{ name: 'New', make: 'Fluke', model: '', serial: '' }])
    expect(getTestSets().map(s => s.name)).toEqual(['New'])
  })
})

describe('getUserPrefs', () => {
  it('includes the saved test sets', () => {
    saveTestSets([{ name: 'Megger', make: 'Megger', model: '', serial: '' }])
    expect(getUserPrefs().testSets.map(s => s.name)).toEqual(['Megger'])
  })

  it('defaults to an empty list of test sets', () => {
    expect(getUserPrefs().testSets).toEqual([])
  })
})

describe('saveUserPref', () => {
  it('stores known keys and ignores unknown ones', () => {
    saveUserPref('namePrint', 'Test Tech')
    saveUserPref('notAKey', 'x')
    expect(getUserPrefs().namePrint).toBe('Test Tech')
    expect(localStorage.getItem('rf_pref_notAKey')).toBeNull()
  })
})

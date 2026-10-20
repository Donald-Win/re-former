/**
 * backupData.js — export / import of everything stored on this device.
 *
 * What a backup contains
 * ──────────────────────
 *   prefs     — My Details (contractor, name, ISN ID, cert no, signature,
 *               default view). Only localStorage keys starting 'rf_pref_'.
 *   drafts    — every named draft, photos included (draftStore.js).
 *   projects  — every saved project (projectStore.js).
 *
 * What it deliberately does NOT contain
 * ─────────────────────────────────────
 *   • The device ID / auth cache (auth.js). That ID is what the access
 *     check authorises — restoring it onto a different device would clone
 *     one device's access onto another.
 *   • Crash-recovery autosave slots (useDraft.jsx) — temporary by design.
 *
 * The file is plain JSON; it contains the saved signature image and any
 * photos attached to drafts, so treat it like the forms themselves.
 */
import { listAllDrafts, importDrafts } from './draftStore'
import { listProjects, importProjects } from './projectStore'

const BACKUP_APP     = 're-former-backup'
const BACKUP_VERSION = 1
const PREF_PREFIX    = 'rf_pref_'
// Refreshed to "today" on every load — never worth restoring.
const SKIP_PREFS     = new Set(['rf_pref_dateWorkCompleted'])

function readPrefs() {
  const prefs = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PREF_PREFIX) && !SKIP_PREFS.has(key)) {
      prefs[key] = localStorage.getItem(key)
    }
  }
  return prefs
}

export async function buildBackup() {
  const [drafts, projects] = await Promise.all([listAllDrafts(), listProjects()])
  return {
    app:        BACKUP_APP,
    version:    BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    prefs:      readPrefs(),
    drafts,
    projects,
  }
}

export function backupFilename(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `re-former-backup-${y}-${m}-${d}.json`
}

export function summarise(backup) {
  return {
    prefs:    Object.keys(backup.prefs || {}).length,
    drafts:   (backup.drafts   || []).length,
    projects: (backup.projects || []).length,
  }
}

/**
 * Parse and validate backup file text. Throws an Error with a plain-language
 * message if it isn't a re-former backup.
 */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't a valid backup (couldn't read it).")
  }
  if (!data || data.app !== BACKUP_APP) {
    throw new Error("That file isn't a re-former backup.")
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('That backup was made by a newer version of the app. Update the app and try again.')
  }
  return {
    ...data,
    prefs:    data.prefs && typeof data.prefs === 'object' ? data.prefs : {},
    drafts:   Array.isArray(data.drafts)   ? data.drafts   : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
  }
}

/** Write a parsed backup into this device's storage. Returns counts written. */
export async function applyBackup(backup) {
  let prefs = 0
  for (const [key, value] of Object.entries(backup.prefs || {})) {
    if (!key.startsWith(PREF_PREFIX) || SKIP_PREFS.has(key) || typeof value !== 'string') continue
    localStorage.setItem(key, value)
    prefs += 1
  }
  const drafts   = await importDrafts(backup.drafts)
  const projects = await importProjects(backup.projects)
  return { prefs, drafts, projects }
}

/**
 * Hand the backup to the person: the native share sheet where files can be
 * shared (iPad / Android — lets them save to Files, AirDrop, email…), else a
 * normal download. Returns false if they cancelled the share sheet.
 */
export async function exportBackupFile() {
  const backup = await buildBackup()
  const filename = backupFilename()
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const file = new File([blob], filename, { type: 'application/json' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return { done: true, summary: summarise(backup) }
    } catch (err) {
      if (err.name === 'AbortError') return { done: false, summary: summarise(backup) }
      // any other share failure → fall through to a plain download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { done: true, summary: summarise(backup) }
}

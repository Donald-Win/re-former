/**
 * planTemplateStore — saved plan templates, per form.
 *
 * Storage backend: IndexedDB via idb-keyval, in its own database (same
 * approach as draftStore / projectStore). Plans are small, so there's no
 * limit on how many templates are kept. All functions are async.
 *
 * Rules live in planTemplates.js (pure, unit tested); this file only reads
 * and writes.
 */
import { createStore, get, set, del, keys } from 'idb-keyval'
import { makeTemplate, templatesFor, findByName, cleanImported } from './planTemplates'

const tplIdb = createStore('re-former-plan-templates', 'templates')

async function readAll() {
  const allKeys = await keys(tplIdb)
  const all = await Promise.all(allKeys.map(k => get(k, tplIdb)))
  return all.filter(Boolean)
}

/** Templates for one form, alphabetical. */
export async function listTemplates(formKey) {
  return templatesFor(await readAll(), formKey)
}

/** Every template for every form — used by Backup & Restore. */
export async function listAllTemplates() {
  return readAll()
}

/**
 * Save a template. A template with the same name on the same form is
 * REPLACED (same id) rather than duplicated. Returns { entry, replaced }.
 */
export async function saveTemplate({ formKey, name, plan }) {
  const existing = findByName(await readAll(), formKey, name)
  const entry = makeTemplate({ id: existing?.id, formKey, name, plan })
  await set(entry.id, entry, tplIdb)
  return { entry, replaced: !!existing }
}

export async function deleteTemplate(id) {
  await del(id, tplIdb)
}

/**
 * Writes templates from a backup straight into the store, keyed by their own
 * id (an existing template with the same id is overwritten). Anything that
 * doesn't look like a template is skipped. Returns how many were written.
 */
export async function importTemplates(list) {
  let count = 0
  for (const raw of Array.isArray(list) ? list : []) {
    const t = cleanImported(raw)
    if (!t) continue
    await set(t.id, t, tplIdb)
    count += 1
  }
  return count
}

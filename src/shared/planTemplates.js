/**
 * planTemplates.js — pure helpers for saved plan templates (no storage, no
 * React), so the rules are unit tested. planTemplateStore.js does the
 * IndexedDB reading/writing; PlanTemplatePicker.jsx is the UI.
 *
 * A template is a named snapshot of a plan, belonging to ONE form (formKey,
 * e.g. '360S014EJ') — "OH Tx earthing" on the Earth form is a different list
 * from the one on any other form. Loading a template replaces the current
 * plan with a copy that can then be adjusted like any other plan.
 *
 *   { id, formKey, name, savedAt, plan }
 */
import { normalizePlan } from './planModel'

export const NAME_MAX = 60

/** Collapse whitespace, trim, and cap the length. */
export function cleanTemplateName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
}

/** Names match regardless of case and stray spaces ("OH Tx" = "oh  tx"). */
export function sameTemplateName(a, b) {
  return cleanTemplateName(a).toLowerCase() === cleanTemplateName(b).toLowerCase()
}

export function makeTemplateId() {
  return 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

/** The saved record for a plan — the plan is normalised so only valid data is stored. */
export function makeTemplate({ id, formKey, name, plan, now = new Date() }) {
  return {
    id: id || makeTemplateId(),
    formKey,
    name: cleanTemplateName(name),
    savedAt: now.toISOString(),
    plan: normalizePlan(plan),
  }
}

/** Templates for one form, alphabetical (numbers sort naturally: "Rod 2" before "Rod 10"). */
export function templatesFor(list, formKey) {
  return (Array.isArray(list) ? list : [])
    .filter(t => t && t.formKey === formKey)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
}

/** The template on this form with this name, if there is one. */
export function findByName(list, formKey, name) {
  return (Array.isArray(list) ? list : []).find(t => t && t.formKey === formKey && sameTemplateName(t.name, name)) || null
}

/** Is this stored/imported value a usable template? Returns a cleaned copy, or null. */
export function cleanImported(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || typeof raw.formKey !== 'string') return null
  const name = cleanTemplateName(raw.name)
  if (!name || !raw.plan || typeof raw.plan !== 'object') return null
  return {
    id: raw.id,
    formKey: raw.formKey,
    name,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date(0).toISOString(),
    plan: normalizePlan(raw.plan),
  }
}

/** "3 items · 2 lines · 1 dimension" — a one-line description for the list. */
export function planSummary(plan) {
  const p = normalizePlan(plan)
  const n = t => p.els.filter(e => e.t === t).length
  const parts = [[n('pt'), 'item'], [n('ln'), 'line'], [n('dim'), 'dimension']]
    .filter(([c]) => c > 0)
    .map(([c, w]) => `${c} ${w}${c !== 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : 'Empty'
}

/** Can this plan be saved as a template? (There's something to save.) */
export function isSavablePlan(plan) {
  const p = normalizePlan(plan)
  return p.els.length > 0
}

/**
 * PlanTemplatePicker — bottom sheet for saved plan templates (per form).
 *
 * Two jobs in one sheet:
 *   • Save the current plan under a name ("OH Tx earthing", "End of line
 *     earth"…). Saving under a name that already exists replaces it.
 *   • Load a saved template — it replaces the current plan with a copy that
 *     can then be adjusted like any other plan.
 *
 * Templates belong to ONE form (`formKey`): each form has its own list.
 *
 * Props:
 *   open        bool
 *   onClose     fn()
 *   formKey     string      — e.g. '360S014EJ'
 *   plan        object      — the current plan (what "Save" stores)
 *   onLoad      fn(plan)    — called with a normalised copy of the chosen template
 *   renderThumb fn(plan)    — returns a small read-only drawing of a plan
 *                             (passed in, so this file doesn't import the editor)
 *   accent      string
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, X, Check, FolderOpen } from 'lucide-react'
import { listTemplates, saveTemplate, deleteTemplate } from './planTemplateStore'
import {
  cleanTemplateName, findByName, planSummary, isSavablePlan, NAME_MAX, withoutNorth,
} from './planTemplates'
import { APP_ACCENT } from './constants'
import { layoutFor } from './planLayouts'
import { wInp, wLbl } from './WizardInputs'

export function PlanTemplatePicker({ open, onClose, formKey, plan, onLoad, renderThumb, accent = APP_ACCENT }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(false)
  const [name, setName]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await listTemplates(formKey))
    } catch (err) {
      console.error('[PlanTemplatePicker] Failed to load templates:', err)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [formKey])

  useEffect(() => {
    if (open) {
      setName(''); setSaved(false); setError(''); setConfirmDelete(null)
      refresh()
    }
  }, [open, refresh])

  if (!open) return null

  const cleanName = cleanTemplateName(name)
  const canSave   = isSavablePlan(plan) && cleanName.length > 0 && !saving
  const existing  = cleanName ? findByName(templates, formKey, cleanName) : null

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await saveTemplate({ formKey, name: cleanName, plan })
      await refresh()
      setSaved(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { setSaved(false); setName('') }, 1200)
    } catch (err) {
      console.error('[PlanTemplatePicker] Save failed:', err)
      setError('Could not save the template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = (t) => {
    const hasPlan = isSavablePlan(plan)
    if (hasPlan && !window.confirm(`Replace the current plan with "${t.name}"?`)) return
    onLoad(withoutNorth(t.plan, layoutFor(formKey)))
    onClose()
  }

  const handleDelete = async (id) => {
    try {
      await deleteTemplate(id)
      await refresh()
    } catch (err) {
      console.error('[PlanTemplatePicker] Delete failed:', err)
    }
    setConfirmDelete(null)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: '#fff', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px 8px', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#111827', flex: 1 }}>Plan templates</span>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#666" />
          </button>
        </div>
        <div style={{ height: 1, background: '#f0f0f0', margin: '0 18px' }} />

        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 18px 32px' }}>

          {/* ── Save the current plan ───────────────────────────────────── */}
          <div style={{ background: accent + '0d', border: `1.5px solid ${accent}30`, borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
            <label style={wLbl}>Save this plan as a template</label>
            <input
              type="text" value={name} maxLength={NAME_MAX}
              onChange={e => { setName(e.target.value); setSaved(false) }}
              placeholder="e.g. OH Tx earthing"
              style={{ ...wInp, borderColor: cleanName ? accent : '#ddd', background: '#fff' }}
            />
            {!isSavablePlan(plan) && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Draw something first — there's nothing to save yet.</div>
            )}
            {existing && !saved && (
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>
                A template called "{existing.name}" already exists — saving will replace it.
              </div>
            )}
            {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{error}</div>}
            <button
              onClick={handleSave} disabled={!canSave}
              style={{
                width: '100%', marginTop: 10, padding: '12px', borderRadius: 12, border: 'none',
                background: saved ? '#16a34a' : canSave ? accent : '#d1d5db',
                color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                cursor: canSave ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {saved ? <><Check size={18} /> Saved!</> : saving ? 'Saving…' : existing ? 'Replace template' : 'Save template'}
            </button>
          </div>

          {/* ── Saved templates ─────────────────────────────────────────── */}
          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Saved templates{templates.length ? ` (${templates.length})` : ''}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.4 }}>
            Loading one replaces the current plan with a copy you can then adjust.
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
              <FolderOpen size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>No templates saved for this form yet.</div>
            </div>
          ) : templates.map(t => (
            <div key={t.id} style={{ border: '1px solid #f0f0f0', borderRadius: 12, marginBottom: 10, overflow: 'hidden', background: '#fff' }}>
              {confirmDelete === t.id ? (
                <div style={{ padding: '14px 16px', background: '#fef2f2' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>Delete "{t.name}"?</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleDelete(t.id)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>Delete</button>
                    <button onClick={() => setConfirmDelete(null)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <button onClick={() => handleLoad(t)} style={{
                    flex: 1, padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
                  }}>
                    <div style={{ width: 110, flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', pointerEvents: 'none' }}>
                      {renderThumb ? renderThumb(withoutNorth(t.plan, layoutFor(formKey))) : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{planSummary(t.plan)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        Tap to load · saved {new Date(t.savedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setConfirmDelete(t.id)} style={{
                    padding: '0 14px', background: 'transparent', border: 'none', borderLeft: '1px solid #f0f0f0',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}>
                    <Trash2 size={16} color="#ef4444" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}


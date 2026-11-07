/**
 * useDraftPicker — manages DraftPicker open/mode state and the draft-load
 * handler for all wizard components.
 *
 * Replaces three repeated boilerplate patterns found in every wizard:
 *   1. const [draftPickerOpen, setDraftPickerOpen] = useState(false)
 *   2. const [draftPickerMode, setDraftPickerMode] = useState('menu')
 *   3. const handleDraftLoad = (draft) => { ... }
 *
 * Usage:
 *   const { draftPickerProps, openSave, openLoad } = useDraftPicker({
 *     setD, setPhotos, setStep,
 *     formKey:   '360S014EB',
 *     formLabel: 'Elec Distribution Record',
 *     d, step, photos, accent,
 *   })
 *
 *   // Wire into WizardShell nav bar:
 *   onSaveDraft={openSave}
 *
 *   // Wire into JobDetailsStep:
 *   onOpenDrafts={openLoad}
 *
 *   // Render at the bottom of the wizard return:
 *   <DraftPicker {...draftPickerProps} />
 *
 * openSave / openLoad are stable (useCallback with no deps) because they
 * only close over stable React setState functions — safe to pass as props
 * without causing unnecessary child re-renders.
 */
import { useState, useCallback } from 'react'

// Fields that My Details fills in automatically on every form. They don't count
// as progress when deciding whether a draft load would overwrite real work.
const PREFILLED_FIELDS = new Set([
  'contractor', 'namePrint', 'signed', 'dateWorkCompleted', 'isnId',
  'wtlName', 'wtlSigned', 'wtlCertNo', 'fsSigned',
])

export function useDraftPicker({
  setD,
  setPhotos,
  setStep,
  formKey,
  formLabel,
  d,
  step,
  photos,
  accent,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('menu')

  const openSave = useCallback(() => { setMode('save'); setOpen(true) }, [])
  const openLoad = useCallback(() => { setMode('list'); setOpen(true) }, [])
  const close    = useCallback(() => setOpen(false), [])

  // Identical to the handleDraftLoad found in every wizard — centralised here.
  //
  // Note: draft.data never has a `photos` key — photos are always stored
  // separately on `draft.photos` (see draftStore.js's saveDraft), so there
  // used to be a no-op `const { photos: _, ...formData } = draft.data`
  // destructure here that looked like it was stripping something out but
  // never actually matched anything. Spreading draft.data directly is
  // equivalent and clearer.
  // Loading a draft replaces the photos with the draft's own set (even when
  // that set is empty), as the 2.18.1 changelog promises. If the form already
  // has progress, ask first so it isn't overwritten by accident.
  const handleLoad = useCallback((draft) => {
    // Progress = a later step, any photo, or anything typed on the job details
    // (step 0). Fields pre-filled from My Details don't count.
    const hasProgress = step > 0 || (photos && photos.length > 0) ||
      Object.entries(d || {}).some(([k, v]) =>
        !PREFILLED_FIELDS.has(k) && typeof v === 'string' && v.trim() !== '')
    if (hasProgress && !window.confirm(
      'Replace what is on this form with this saved draft?\n\nAnything not saved in the draft will be lost.'
    )) return false
    setD(prev => ({ ...prev, ...(draft.data || {}) }))
    setPhotos(Array.isArray(draft.photos) ? draft.photos : [])
    setStep(draft.step || 0)
    return true
  }, [setD, setPhotos, setStep, step, photos, d])

  // Pre-assembled props — spread directly onto <DraftPicker>.
  // d, step, photos are current render values so DraftPicker always sees
  // up-to-date form state when the save sheet opens.
  const draftPickerProps = {
    open,
    onClose:     close,
    formKey,
    formLabel,
    d,
    step,
    photos,
    onLoad:      handleLoad,
    accent,
    initialMode: mode,
  }

  return { draftPickerProps, openSave, openLoad }
}


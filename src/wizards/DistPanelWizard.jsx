// 360S014EI — As-built Underground Network Distribution Panel Layout Record
import { useState } from 'react'
import { FileText } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WCB, SectionHead, wLbl } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft, useCrashRecovery } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { CrashRecoveryBanner } from '../shared/CrashRecoveryBanner'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { createWorkerGenerator } from '../shared/pdfWorkerClient'
import {
  POSITION_COUNT, WAY_COUNT, wayLabel, allSlots, rowUsed, usedRowIndexes,
  tapFull, tapA, tapB,
} from '../shared/distPanelRows'

// ── PDF generation runs off the main thread via the shared PDF worker ────────
const generateEiPdf = createWorkerGenerator('DistPanelPdfGenerator', 'generateEiPdf')

const FORM_KEY   = '360S014EI'
const FORM_LABEL = 'Underground Panel Layout Record'
const ACCENT     = APP_ACCENT
const EI_BG      = WIZARD_COLORS.bg
const EI_MID     = WIZARD_COLORS.mid
const EI_BORDER  = WIZARD_COLORS.border

const OWNERSHIP_OPTIONS  = ['Powerco', 'Private', 'Other']
const FUSE_WAY_OPTIONS   = ['3', '3.5', '4', '6', '8', 'Other', 'Street Light Relay']
const LINK_FUSE_OPTIONS  = ['Link', 'Fuse']
const OPEN_CLOSE_OPTIONS = ['Open', 'Closed']

const EI_STEPS = [
  'Job Details',
  'Panel Details',
  'Fuse Rows',
  'Photos',
  'Preview & Print',
]
const PHOTO_STEP   = 3
const PREVIEW_STEP = 4

const emptyWay  = () => ({
  destination: '', manufacturer: '', model: '',
  linkFuse: '', openClose: '',
  fuseSize: '', holderRating: '', cableDesc: '',
})
const emptyWays = () => Array.from({ length: WAY_COUNT }, emptyWay)

// DEV-only sample: odd positions full, position 4 a half, the rest a split pair.
const DEV_SLOTS = Array.from({ length: POSITION_COUNT }, (_, k) => {
  const n = k + 1
  if (n % 2 === 1) return { full: true, a: false, b: false }
  if (n === 4)     return { full: false, a: true, b: false }
  return { full: false, a: true, b: true }
})
const DEV_WAYS = Array.from({ length: WAY_COUNT }, (_, i) => (
  rowUsed(DEV_SLOTS, i)
    ? {
        destination: `Feeder ${i + 1}`,
        manufacturer: 'ABB',
        model: `Model-${i + 1}`,
        linkFuse: i % 2 === 0 ? 'Link' : 'Fuse',
        openClose: i % 3 === 0 ? 'Open' : 'Closed',
        fuseSize: ['100A', '63A', '40A'][i % 3],
        holderRating: ['100A', '63A', '40A'][i % 3],
        cableDesc: `95mm² Cu ${i + 1}`,
      }
    : emptyWay()
))

// ── Visual position grid ──────────────────────────────────────────────────────
// One 16-part grid. Each position takes two parts: the number spans both, and the
// a and b halves take one part each. So the number is exactly as wide as a and b
// together, and every gap is the same size.
// Normally the number is on the top row and the halves below. When a half is
// selected, that column's halves swap up with the number.
function SlotGrid({ slots, onFull, onA, onB, accent }) {
  const cellStyle = (on, fontSize) => ({
    height: 40, padding: 0, borderRadius: 8, minWidth: 0, width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit', fontSize, fontWeight: 700, cursor: 'pointer',
    border: `2px solid ${on ? accent : '#d1d5db'}`,
    background: on ? accent : '#fff',
    color: on ? '#fff' : '#374151',
  })

  const items = []
  slots.forEach((s, k) => {
    const n = k + 1
    const flipped = s.a || s.b
    const numberRow = flipped ? 2 : 1
    const halvesRow = flipped ? 1 : 2
    const first = 2 * k + 1                       // first of this position's two parts
    items.push(
      <button key={`n${n}`} type="button" onClick={() => onFull(n)}
        style={{ ...cellStyle(s.full, 15), gridColumn: `${first} / span 2`, gridRow: numberRow }}>
        {n}
      </button>
    )
    items.push(
      <button key={`a${n}`} type="button" onClick={() => onA(n)}
        style={{ ...cellStyle(s.a, 14), gridColumn: `${first}`, gridRow: halvesRow }}>
        a
      </button>
    )
    items.push(
      <button key={`b${n}`} type="button" onClick={() => onB(n)}
        style={{ ...cellStyle(s.b, 14), gridColumn: `${first + 1}`, gridRow: halvesRow }}>
        b
      </button>
    )
  })

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 4 }}>
        {items}
      </div>

      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, lineHeight: 1.4 }}>
        Tap a <strong>number</strong> for a full-width carrier. Tap <strong>a</strong> or <strong>b</strong> for a
        half-width carrier. Tap a lit button again to clear it.
      </div>
    </div>
  )
}

// ── Two-choice toggle that sits on the same two columns as the fields ─────────
function ToggleRow({ label, options, value, onChange, accent }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={wLbl}>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginTop: 4 }}>
        {options.map(o => {
          const on = value === o
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(on ? '' : o)}
              style={{
                height: 44, borderRadius: 8, fontFamily: 'inherit', fontSize: 15,
                fontWeight: on ? 700 : 400, cursor: 'pointer',
                border: `2px solid ${on ? accent : '#ddd'}`,
                background: on ? accent : '#fff',
                color: on ? '#fff' : '#333',
              }}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── One printed row (a or b) of the panel table ───────────────────────────────
// Every field sits on one of two columns, so the cells line up within the card.
// Destination and cable are full width.
function WayRow({ index, row, onField, onToggle, accent }) {
  const field  = k => v => onField(index, k, v)
  const toggle = k => v => onToggle(index, k, v)
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${EI_BORDER}`,
      borderRadius: 10, padding: '12px 12px 4px', marginBottom: 10,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: accent,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        Row {wayLabel(index)}
      </div>

      <WF label="Destination" v={row.destination} set={field('destination')} accent={accent} />

      <div style={wLbl}>LV Disconnector</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <WF label="Manufacture" v={row.manufacturer} set={field('manufacturer')} accent={accent} />
        <WF label="Model" v={row.model} set={field('model')} accent={accent} />
      </div>

      <ToggleRow label="Link or Fuse" options={LINK_FUSE_OPTIONS} value={row.linkFuse}
        onChange={toggle('linkFuse')} accent={accent} />
      <ToggleRow label="Open or Closed" options={OPEN_CLOSE_OPTIONS} value={row.openClose}
        onChange={toggle('openClose')} accent={accent} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <WF label="Fuse Size (A)" v={row.fuseSize} set={field('fuseSize')} accent={accent} />
        <WF label="Holder Rating" v={row.holderRating} set={field('holderRating')} accent={accent} />
      </div>

      <WF label="Cable(s) Description / Size" v={row.cableDesc} set={field('cableDesc')} accent={accent} />
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────
export default function DistPanelWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    boxTransformerId: '',
    panelManufacturer: '',
    panelMaterial: '',
    ownership: '',
    ownershipOther: '',
    fuseWays: [],
    fuseWayOther: '',
    slots: allSlots(null),
    ways: emptyWays(),
  }))
  const [photos, setPhotos] = useState([])

  const isPreview = step === PREVIEW_STEP
  const slots     = allSlots(d.slots)
  const usedIdx   = usedRowIndexes(slots)

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: FORM_KEY, formLabel: FORM_LABEL,
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEiPdf)

  // Dev fill: the realistic fill can't set the fuse-way choices or the
  // ownership/material options (they're arrays and choice values), so set them
  // here so the ticks and the "Other" text get exercised.
  const { set, handleDevFill } = useWizardSetup(d, setD, step, FORM_KEY, {
    slots: DEV_SLOTS,
    ways: DEV_WAYS,
    ownership: 'Powerco',
    ownershipOther: '',
    panelManufacturer: 'ABB',
    panelMaterial: 'Steel',
    fuseWays: ['3', '6', 'Other'],
    fuseWayOther: 'Test fuse',
  })
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const crashRecovery = useCrashRecovery({
    formKey: FORM_KEY, setD, setStep, setPhotos, maxStep: EI_STEPS.length - 2,
  })

  // ── Grid taps ─────────────────────────────────────────────────────────────
  // Changing a carrier only changes which rows are shown and printed. The
  // details typed into a row are kept, so a mis-tap never deletes them.
  const applySlot = (n, fn) => setD(p => {
    const next = allSlots(p.slots)
    next[n - 1] = fn(next[n - 1])
    return { ...p, slots: next }
  })
  const onFull = n => applySlot(n, tapFull)
  const onA    = n => applySlot(n, tapA)
  const onB    = n => applySlot(n, tapB)

  // ── Row field helpers ─────────────────────────────────────────────────────
  const setWay = (i, field, v) => setD(p => ({
    ...p,
    ways: p.ways.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)),
  }))

  // Tapping the selected option again clears it, so a row can be left empty.
  const toggleWay = (i, field, v) => setD(p => ({
    ...p,
    ways: p.ways.map((r, idx) => (idx === i ? { ...r, [field]: r[field] === v ? '' : v } : r)),
  }))

  const toggleOwnership = v => setD(p => ({ ...p, ownership: p.ownership === v ? '' : v }))

  const toggleFuseWay = v => setD(p => {
    const cur = p.fuseWays || []
    return { ...p, fuseWays: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }
  })

  // Photos are a hard requirement: the wizard does not move past the Photos step
  // until at least one photo is attached.
  const handleNext = () => {
    if (step === PHOTO_STEP && photos.length === 0) return
    const n = step + 1
    setStep(n)
    if (n === PREVIEW_STEP) triggerGenerate(d, photos)
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.boxTransformerId, FORM_LABEL),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'No./Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
    !d.signed     && 'Signature',
    (d.fuseWays || []).length === 0 && 'Fuse Way',
    usedIdx.length === 0 && 'Fuse Rows (tap the grid)',
    photos.length === 0 && 'At least one photo',
  ].filter(Boolean)

  // ─────────────────────────────────────────────────────────────────────────
  // STEP CONTENT
  // ─────────────────────────────────────────────────────────────────────────
  const renderCurrentStep = () => {
    if (isPreview) return null

    if (step === 0) return (
      <JobDetailsStep d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}>
        <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
        <SectionHead label="Box or Transformer" accent={ACCENT} />
        <WF label="Box or Transformer ID" v={d.boxTransformerId} set={set('boxTransformerId')} accent={ACCENT} />
      </JobDetailsStep>
    )

    if (step === 1) return (
      <div>
        <SectionHead label="Distribution Panel" accent={ACCENT} />
        <WF label="Panel Manufacturer / Type" v={d.panelManufacturer} set={set('panelManufacturer')} accent={ACCENT} />
        <WF label="Material" v={d.panelMaterial} set={set('panelMaterial')} accent={ACCENT} />

        <SectionHead label="Ownership" accent={ACCENT} />
        <WCB options={OWNERSHIP_OPTIONS} value={d.ownership} onChange={toggleOwnership} accent={ACCENT} />
        {d.ownership === 'Other' && (
          <WF label="Other — specify" v={d.ownershipOther} set={set('ownershipOther')} accent={ACCENT} />
        )}

        <SectionHead label="Fuse Way" sub="Select every fuse way fitted to the panel" accent={ACCENT} />
        <WCB options={FUSE_WAY_OPTIONS} value={d.fuseWays} onChange={toggleFuseWay} multi accent={ACCENT} />
        {(d.fuseWays || []).includes('Other') && (
          <WF label="Other fuse way — specify" v={d.fuseWayOther} set={set('fuseWayOther')} accent={ACCENT} />
        )}
      </div>
    )

    if (step === 2) return (
      <div>
        <SectionHead label="Fuse Rows" accent={ACCENT}
          sub="Tap the carriers fitted. Details appear for each row in use." />
        <SlotGrid slots={slots} onFull={onFull} onA={onA} onB={onB} accent={ACCENT} />
        {usedIdx.map(i => (
          <WayRow
            key={i}
            index={i}
            row={d.ways[i] || emptyWay()}
            onField={setWay}
            onToggle={toggleWay}
            accent={ACCENT}
          />
        ))}
      </div>
    )

    if (step === PHOTO_STEP) return (
      <div>
        {photos.length === 0 && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10,
            padding: '10px 14px', marginBottom: 12,
            fontSize: 13, color: '#b91c1c', fontWeight: 600, lineHeight: 1.4,
          }}>
            A photo is required. Attach at least one photo to continue.
          </div>
        )}
        <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
      </div>
    )

    return null
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), ACCENT)

  return (
    <>
      <CrashRecoveryBanner recovery={crashRecovery} accent={ACCENT} />

      <WizardShell
        title="Underground Panel Layout Record"
        formNumber={FORM_KEY}
        headerIcon={<FileText size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={EI_STEPS}
        step={step}
        onStepClick={i => { setStep(i); if (i === PREVIEW_STEP) triggerGenerate(d, photos) }}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EI.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 1 : undefined}
        onNext={handleNext}
        accent={ACCENT}
        bg={EI_BG}
        mid={EI_MID}
        border={EI_BORDER}
        isPreview={isPreview}
        onShare={handleShare}
        onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
        missingFields={missingFields}
        previewContent={previewContent}
      >
        {renderCurrentStep()}
      </WizardShell>

      <DraftPicker {...draftPickerProps} />
    </>
  )
}


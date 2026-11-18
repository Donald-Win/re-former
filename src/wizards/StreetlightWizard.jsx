// 360S014EK — As-built Streetlight Alteration/Installation Record
import { useState } from 'react'
import { FileText } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { PlanSketchStep } from '../shared/PlanSketchStep'
import { emptyPlan } from '../shared/planModel'
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

// ── PDF generation runs off the main thread via the shared PDF worker ────────
const generateEkPdf = createWorkerGenerator('StreetlightPdfGenerator', 'generateEkPdf')

const FORM_KEY   = '360S014EK'
const FORM_LABEL = 'Streetlight Record'
const ACCENT     = APP_ACCENT
const EK_BG      = WIZARD_COLORS.bg
const EK_MID     = WIZARD_COLORS.mid
const EK_BORDER  = WIZARD_COLORS.border

const EK_STEPS = [
  'Job Details',
  'Streetlight Pole',
  'Conductor & Lamp',
  'Dimensioned Plan',
  'Photos',
  'Preview & Print',
]
const PREVIEW_STEP = EK_STEPS.length - 1

const CONDUCTOR_OPTIONS      = ['Overhead', 'Underground']
const CABLE_MATERIAL_OPTIONS = ['Cu', 'Al']
const DUSK_OPTIONS           = ['Dusk / Dawn', 'Dusk / Midnight']

const GRID2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }
const GRID3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px' }

const emptyLamp = () => ({ date: '', wattage: '', type: '' })

// One lamp record (light removed, or light installed). onField(field) returns
// the setter for that field, so the same component serves both records.
function LampRow({ label, data = emptyLamp(), onField }) {
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${EK_BORDER}`,
      borderRadius: 10, padding: '12px 12px 4px', marginBottom: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: ACCENT,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>{label}</div>
      <div style={GRID3}>
        <WF label="Date"         v={data.date}    set={onField('date')}    ph="dd/mm/yy"  accent={ACCENT} />
        <WF label="Lamp Wattage" v={data.wattage} set={onField('wattage')} ph="e.g. 150W" accent={ACCENT} />
        <WF label="Lamp Type"    v={data.type}    set={onField('type')}    ph="e.g. LED"  accent={ACCENT} />
      </div>
    </div>
  )
}

export default function StreetlightWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    nameOfOwner: '',
    lightPoleId: '',
    gpsRoverFileNo: '',
    poleManufacturer: '',
    poleMaterial: '',
    poleHeight: '',
    conductorType: '',
    phases: '',
    cableSize: '',
    cableMaterial: '',
    removedLamp: emptyLamp(),
    installedLamp: emptyLamp(),
    duskMode: '',
    plan: emptyPlan(),
  }))
  const [photos, setPhotos] = useState([])

  const isPreview = step === PREVIEW_STEP

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: FORM_KEY, formLabel: FORM_LABEL,
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEkPdf)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const crashRecovery = useCrashRecovery({
    formKey: FORM_KEY, setD, setStep, setPhotos, maxStep: EK_STEPS.length - 2,
  })

  // Tapping the selected option again clears it.
  const tog = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))

  // setLamp('removedLamp')('date')(value) → updates d.removedLamp.date
  const setLamp = which => field => v =>
    setD(p => ({ ...p, [which]: { ...(p[which] || emptyLamp()), [field]: v } }))

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.lightPoleId, FORM_LABEL),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo       && 'PCo W/O No.',
    !d.streetRoad    && 'No./Street/Road',
    !d.contractor    && 'Contractor',
    !d.namePrint     && 'Name (Print)',
    !d.signed        && 'Signature',
    !d.conductorType && 'Conductor (Overhead / Underground)',
  ].filter(Boolean)

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad} />
      )

      case 1: return (
        <div key="s1">
          <SectionHead label="Owner" accent={ACCENT} />
          <WF label="Name of Owner" v={d.nameOfOwner} set={set('nameOfOwner')} accent={ACCENT} />

          <SectionHead label="Light / Pole" accent={ACCENT} />
          <div style={GRID2}>
            <WF label="Light/Pole ID"     v={d.lightPoleId}     set={set('lightPoleId')}     accent={ACCENT} />
            <WF label="GPS Rover File No." v={d.gpsRoverFileNo} set={set('gpsRoverFileNo')} accent={ACCENT} />
          </div>

          <SectionHead label="Pole Details" accent={ACCENT} />
          <div style={GRID2}>
            <WF label="Pole Manufacturer" v={d.poleManufacturer} set={set('poleManufacturer')} accent={ACCENT} />
            <WF label="Pole Material"     v={d.poleMaterial}     set={set('poleMaterial')}     accent={ACCENT} />
          </div>
          <WF label="Pole Height (metres)" v={d.poleHeight} set={set('poleHeight')} accent={ACCENT} />
        </div>
      )

      case 2: return (
        <div key="s2">
          <SectionHead label="Conductor Details" accent={ACCENT} />
          <WCB label="Overhead or Underground" options={CONDUCTOR_OPTIONS}
            value={d.conductorType} onChange={tog('conductorType')} accent={ACCENT} />
          <div style={GRID2}>
            <WF label="Phases"          v={d.phases}    set={set('phases')}    accent={ACCENT} />
            <WF label="Cable Size (mm)" v={d.cableSize} set={set('cableSize')} accent={ACCENT} />
          </div>
          <WCB label="Material (Cu/Al)" options={CABLE_MATERIAL_OPTIONS}
            value={d.cableMaterial} onChange={tog('cableMaterial')} accent={ACCENT} />

          <SectionHead label="Streetlight Lamp Details" accent={ACCENT} />
          <LampRow label="Light Removed"   data={d.removedLamp}   onField={setLamp('removedLamp')} />
          <LampRow label="Light Installed" data={d.installedLamp} onField={setLamp('installedLamp')} />

          <WCB label="Dusk / Dawn or Dusk / Midnight" options={DUSK_OPTIONS}
            value={d.duskMode} onChange={tog('duskMode')} accent={ACCENT} />
        </div>
      )

      case 3: return (
        <div key="s3">
          <SectionHead label="Dimensioned Plan" accent={ACCENT}
            sub="Include the north arrow in the circle. Dimension cables in the road reserve at right angles to known reference points." />
          <PlanSketchStep plan={d.plan} onChange={p => set('plan', p)} formKey={FORM_KEY} accent={ACCENT} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.4 }}>
            Rural areas only: show the number of spans to the nearest Distribution Transformer and the Transformer number.
          </div>
        </div>
      )

      case 4: return (
        <div key="s4">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
        </div>
      )

      default: return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), ACCENT)

  return (
    <>
      <CrashRecoveryBanner recovery={crashRecovery} accent={ACCENT} />

      <WizardShell
        title="AS-Built Streetlight Record"
        formNumber={FORM_KEY}
        headerIcon={<FileText size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={EK_STEPS}
        step={step}
        onStepClick={i => { setStep(i); if (i === PREVIEW_STEP) triggerGenerate(d, photos) }}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EK.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 1 : undefined}
        onNext={() => {
          const n = step + 1
          setStep(n)
          if (n === PREVIEW_STEP) triggerGenerate(d, photos)
        }}
        accent={ACCENT}
        bg={EK_BG}
        mid={EK_MID}
        border={EK_BORDER}
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

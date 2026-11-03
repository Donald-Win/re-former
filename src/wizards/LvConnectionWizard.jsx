
import { useState } from 'react'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { Zap } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { PlanSketchStep } from '../shared/PlanSketchStep'
import { emptyPlan } from '../shared/planModel'
import { LV_SAMPLE_PLAN } from '../shared/planSamples'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft, useCrashRecovery } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { CrashRecoveryBanner } from '../shared/CrashRecoveryBanner'
import { createWorkerGenerator } from '../shared/pdfWorkerClient'

// ── PDF generation now runs off the main thread via the shared PDF worker ────
const generateEaPdf = createWorkerGenerator('LvConnectionPdfGenerator', 'generateEaPdf')

const LV_TEAL   = APP_ACCENT
const LV_BG     = WIZARD_COLORS.bg
const LV_MID    = WIZARD_COLORS.mid
const LV_BORDER = WIZARD_COLORS.border

const LV_STEPS = [
  'Job Details',
  'Connection Point',
  'Conductor Details',
  'Dimensioned Plan',
  'Work Description',
  'Photos',
  'Preview & Print',
]

export default function LvConnectionWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    cocNumber:             '',
    cowShedNumber:         '',
    icpNumber:             '',
    installedService:      '',
    connectedTo:           '',
    connectedToOther:      '',
    poleServiceBoxNumber:  '',
    conductorSize:         '',
    conductorMaterial:     '',
    insulation:            '',
    numberOfCables:        '',
    numberOfCores:         '',
    fuseSize:              '',
    numberOfPhases:        '',
    phaseColours:          '',
    cableDuct:             '',
    cableDuctNewSize:      '',
    cableDuctExistingSize: '',
    workDescription:       '',
    plan: emptyPlan(),
  }))
  const [photos, setPhotos] = useState([])

  const isPreview = step === LV_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: '360S014EA', formLabel: 'LV Connection Record',
    d, step, photos, accent: LV_TEAL,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEaPdf)
  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.icpNumber, 'LV Connection Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo          && 'Powerco W/O Number',
    !d.streetRoad       && 'Physical Address',
    !d.contractor       && 'Contractor',
    !d.installedService && 'Installed Service',
    !d.connectedTo      && 'Conductor Connected To',
    !d.signed           && 'Signature',
  ].filter(Boolean)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, '360S014EA', { plan: LV_SAMPLE_PLAN })
  const { clearDraft: clearFormDraft } = useDraft('360S014EA', d, step, photos)
  const crashRecovery = useCrashRecovery({ formKey: '360S014EA', setD, setStep, setPhotos, maxStep: LV_STEPS.length - 2 })

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        <JobDetailsStep key="s0" d={d} setD={setD} accent={LV_TEAL} onOpenDrafts={openLoad}>
          <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
          <SectionHead label="Connection Identifiers" accent={LV_TEAL} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
            <WF label="C.O.C Number"           v={d.cocNumber}     set={v => set('cocNumber',     v)} accent={LV_TEAL} />
            <WF label="Cow Shed / Dairy No."   v={d.cowShedNumber} set={v => set('cowShedNumber', v)} accent={LV_TEAL} />
            <WF label="ICP Number"             v={d.icpNumber}     set={v => set('icpNumber',     v)} accent={LV_TEAL} />
          </div>
        </JobDetailsStep>
      )

      case 1: return (
        <div key="s1">
          <SectionHead label="Physical Connection Point" accent={LV_TEAL} />
          <WCB label="Installed Service" options={['Overhead line', 'Underground cable']} value={d.installedService} onChange={v => set('installedService', v)} accent={LV_TEAL} />
          <div style={{ marginTop: 14 }}>
            <WCB label="Conductor Connected To" options={['Box', 'Pole', 'Other']} value={d.connectedTo} onChange={v => set('connectedTo', v)} accent={LV_TEAL} />
          </div>
          {d.connectedTo === 'Other' && (
            <div style={{ marginTop: 10 }}>
              <WF label="Other — specify" v={d.connectedToOther} set={v => set('connectedToOther', v)} accent={LV_TEAL} />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <WF label="Pole / Service Box Number" v={d.poleServiceBoxNumber} set={v => set('poleServiceBoxNumber', v)} accent={LV_TEAL} />
          </div>
        </div>
      )

      case 2: return (
        <div key="s2">
          <SectionHead label="Conductor Details" accent={LV_TEAL} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
            <WF label="Conductor Size"     v={d.conductorSize}     set={v => set('conductorSize',     v)} accent={LV_TEAL} />
            <WF label="Conductor Material" v={d.conductorMaterial} set={v => set('conductorMaterial', v)} accent={LV_TEAL} />
            <WF label="Insulation"         v={d.insulation}        set={v => set('insulation',        v)} accent={LV_TEAL} />
            <WF label="Number of Cables"   type="number" v={d.numberOfCables} set={v => set('numberOfCables', v)} accent={LV_TEAL} />
            <WF label="Number of Cores"    type="number" v={d.numberOfCores}  set={v => set('numberOfCores',  v)} accent={LV_TEAL} />
            <WF label="Fuse Size (Amps)"   type="number" v={d.fuseSize}       set={v => set('fuseSize',       v)} accent={LV_TEAL} />
            <WF label="Number of Phases"   type="number" v={d.numberOfPhases} set={v => set('numberOfPhases', v)} accent={LV_TEAL} />
            <WF label="Phase Colour(s)"    v={d.phaseColours}      set={v => set('phaseColours',      v)} accent={LV_TEAL} />
          </div>
          <div style={{ marginTop: 14 }}>
            <WCB label="Cable Duct Used" options={['No', 'New', 'Existing']} value={d.cableDuct} onChange={v => set('cableDuct', v)} accent={LV_TEAL} />
          </div>
          {d.cableDuct === 'New' && (
            <div style={{ marginTop: 10 }}>
              <WF label="New Duct — specify size" v={d.cableDuctNewSize} set={v => set('cableDuctNewSize', v)} accent={LV_TEAL} />
            </div>
          )}
          {d.cableDuct === 'Existing' && (
            <div style={{ marginTop: 10 }}>
              <WF label="Existing Duct — specify size" v={d.cableDuctExistingSize} set={v => set('cableDuctExistingSize', v)} accent={LV_TEAL} />
            </div>
          )}
        </div>
      )

      case 3: return (
        // 3 — Dimensioned Plan
        <div key="s3">
          <SectionHead label="Dimensioned Plan" sub="Include the north arrow in the circle. Show any change in direction and duct ends, and label which side any LV open point connection is made to." accent={LV_TEAL} />
          <PlanSketchStep plan={d.plan} onChange={p => set('plan', p)} formKey="360S014EA" accent={LV_TEAL} />
        </div>
      )

      case 4: return (
        // 4 — Work Description
        <div key="s4">
          <SectionHead label="Work Description" accent={LV_TEAL} />
          <WTA label="Describe the Work Performed" v={d.workDescription} set={v => set('workDescription', v)} accent={LV_TEAL} rows={6} />
        </div>
      )

      case 5: return (
        // 5 — Photos
        <div key="s5">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={LV_TEAL} />
        </div>
      )

      case 6: return null

      default: return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), LV_TEAL)

  return (
    <>
      <CrashRecoveryBanner recovery={crashRecovery} accent={LV_TEAL} />

        <WizardShell
          title="AS-Built LV Connection"
          formNumber="360S014EA"
          headerIcon={<Zap size={20} color="#fff" />}
          steps={LV_STEPS}
          step={step}
          onStepClick={i => { setStep(i); if (i === LV_STEPS.length - 1) triggerGenerate(d, photos) }}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EA.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 1 : undefined}
          onNext={() => { const n = step + 1; setStep(n); if (n === LV_STEPS.length - 1) triggerGenerate(d, photos) }}
          accent={LV_TEAL}
          bg={LV_BG}
          mid={LV_MID}
          border={LV_BORDER}
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


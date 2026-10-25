
// 360S014EJ — AS-Built Earth Installation and Test Record
import { useState } from 'react'
import { Zap } from 'lucide-react'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
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
import { createWorkerGenerator } from '../shared/pdfWorkerClient'

// ── PDF generation runs off the main thread via the shared PDF worker ────────
const generateEjPdf = createWorkerGenerator('EarthTestPdfGenerator', 'generateEjPdf')

const FORM_KEY   = '360S014EJ'
const FORM_LABEL = 'Earth Installation & Test Record'
const ACCENT     = APP_ACCENT
const EJ_BG      = WIZARD_COLORS.bg
const EJ_MID     = WIZARD_COLORS.mid
const EJ_BORDER  = WIZARD_COLORS.border

const EJ_STEPS = [
  'Job Details',
  'Test Type & Results',
  'Conductor & Connection',
  'Comments & Plan',
  'Photos',
  'Preview & Print',
]

const TEST_TYPES = ['New', 'Altered Earth', 'Test Only', 'End of Line Earth']
const SERVICES   = ['Gas', 'Telecom', 'Water', 'Other']

const emptyEarth = () => ({ resistance: '', rods: '', depth: '' })

// ── One column of the Earth Test Results table ───────────────────────────────
// Defined at module level (not inside the wizard) so it keeps its identity
// between renders and inputs never lose focus mid-typing.
function EarthColumn({ title, data, setField }) {
  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${EJ_BORDER}`,
      borderRadius: 10, padding: '12px 12px 4px', marginBottom: 12,
    }}>
      <SectionHead label={title} accent={ACCENT} />
      <WF label="Resistance — Neutral Disconnected (Ω)" v={data.resistance} set={setField('resistance')} ph="e.g. 12.5" accent={ACCENT} />
      {/* Both labels are one line, so the two inputs stay level with each other */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <WF label="Number of Rods" type="number" v={data.rods} set={setField('rods')} ph="e.g. 2" accent={ACCENT} />
        <WF label="Depth of Rods"  v={data.depth} set={setField('depth')} ph="e.g. 1.8m / 3.6m" accent={ACCENT} />
      </div>
    </div>
  )
}

export default function EarthTestWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    siteId: '',
    equipmentEarthed: '',
    contractorJobCostCode: '',
    earthTestType: '',
    earth1: emptyEarth(),
    earth2: emptyEarth(),
    totalMEN: '',
    equipmentNumber: '',
    conductorMaterial: '',
    conductorSize: '',
    belowGroundConnection: '',
    groundConditions: '',
    remarks: '',
    otherServicesInTrench: [],
    otherServicesOther: '',
    comments: '',
  }))
  const [photos, setPhotos] = useState([])

  const isPreview = step === EJ_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: FORM_KEY, formLabel: FORM_LABEL,
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEjPdf)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const crashRecovery = useCrashRecovery({
    formKey: FORM_KEY, setD, setStep, setPhotos, maxStep: EJ_STEPS.length - 2,
  })

  // setEarth('earth1')('resistance') → (value) => updates d.earth1.resistance
  const setEarth = key => field => v =>
    setD(p => ({ ...p, [key]: { ...p[key], [field]: v } }))

  const toggleSingle = (key, v) => set(key, d[key] === v ? '' : v)

  const toggleService = v => setD(p => {
    const cur = p.otherServicesInTrench || []
    return { ...p, otherServicesInTrench: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }
  })

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.siteId, 'Earth Installation and Test Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo        && 'PCo W/O No.',
    !d.streetRoad     && 'No./Street/Road',
    !d.contractor     && 'Contractor',
    !d.namePrint      && 'Name (Print)',
    !d.signed         && 'Signature',
    !d.earthTestType  && 'Earth Test type',
  ].filter(Boolean)

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        // 0 — Job Details
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}>
          <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
          <SectionHead label="Site & Equipment" accent={ACCENT} />
          <WF label="Site ID / Pole ID"    v={d.siteId}           set={set('siteId')}           accent={ACCENT} />
          <WF label="Equipment Earthed"    v={d.equipmentEarthed} set={set('equipmentEarthed')} accent={ACCENT} />
          <WF label="Contractor Job Cost Code" v={d.contractorJobCostCode} set={set('contractorJobCostCode')} accent={ACCENT} />
        </JobDetailsStep>
      )

      case 1: return (
        // 1 — Test Type & Results
        <div key="s1">
          <SectionHead label="Earth Test" accent={ACCENT} />
          <WCB options={TEST_TYPES} value={d.earthTestType}
            onChange={v => toggleSingle('earthTestType', v)} accent={ACCENT} />

          <div style={{ marginTop: 6 }}>
            <SectionHead label="Earth Test Results" sub="Fill in Earth 2 only if a second earth was installed or tested" accent={ACCENT} />
            <EarthColumn title="Earth 1" data={d.earth1} setField={setEarth('earth1')} />
            <EarthColumn title="Earth 2" data={d.earth2} setField={setEarth('earth2')} />
            <div style={{
              background: '#fff', border: `1.5px solid ${EJ_BORDER}`,
              borderRadius: 10, padding: '12px 12px 4px', marginBottom: 12,
            }}>
              <SectionHead label="Total M.E.N & Equipment Number" sub="Single entries — not per earth" accent={ACCENT} />
              <WF label="Total M.E.N — Neutral Connected (Ω)" v={d.totalMEN} set={set('totalMEN')} ph="e.g. 1.8" accent={ACCENT} />
              <WF label="Equipment Number" v={d.equipmentNumber} set={set('equipmentNumber')} accent={ACCENT} />
            </div>
          </div>
        </div>
      )

      case 2: return (
        // 2 — Conductor & Connection
        <div key="s2">
          <SectionHead label="Details of Conductor" accent={ACCENT} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <WF label="Material" v={d.conductorMaterial} set={set('conductorMaterial')} ph="e.g. Copper" accent={ACCENT} />
            <WF label="Size"     v={d.conductorSize}     set={set('conductorSize')}     ph="e.g. 25mm²"  accent={ACCENT} />
          </div>

          <div style={{ marginTop: 6 }}>
            <WCB label="Below Ground Connection Type" options={['Shear Bolt', 'Welded']}
              value={d.belowGroundConnection}
              onChange={v => toggleSingle('belowGroundConnection', v)} accent={ACCENT} />
          </div>

          <WF label="Ground Conditions" v={d.groundConditions} set={set('groundConditions')} ph="e.g. Clay, damp" accent={ACCENT} />
          <WF label="Remarks"           v={d.remarks}          set={set('remarks')}          accent={ACCENT} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -6, marginBottom: 12 }}>
            Ground Conditions and Remarks each get one line on the form — keep them short.
          </div>

          <WCB label="Other Services in Trench" options={SERVICES}
            value={d.otherServicesInTrench} onChange={toggleService} multi accent={ACCENT} />
          {(d.otherServicesInTrench || []).includes('Other') && (
            <WF label="Other — specify" v={d.otherServicesOther} set={set('otherServicesOther')} accent={ACCENT} />
          )}
        </div>
      )

      case 3: return (
        // 3 — Comments & Plan
        <div key="s3">
          <SectionHead label="Dimensioned Plan" accent={ACCENT} />
          <div style={{
            background: EJ_BG, border: `1px solid ${EJ_BORDER}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 14, fontSize: 13, color: ACCENT, lineHeight: 1.5,
          }}>
            <strong>📐 Location plan:</strong> Draw the dimensioned plan manually on the printed form —
            include the north arrow in the circle and the earth wire lengths.
          </div>
          <SectionHead label="Comments" accent={ACCENT} />
          <WTA label="Comments (e.g. boundary unknown etc.)" v={d.comments} set={set('comments')} rows={3} accent={ACCENT} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -6 }}>
            The form has room for about two lines of comments (roughly 150 characters).
          </div>
        </div>
      )

      case 4: return (
        // 4 — Photos
        <div key="s4">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
        </div>
      )

      case 5: return null

      default: return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), ACCENT)

  return (
    <>
      <CrashRecoveryBanner recovery={crashRecovery} accent={ACCENT} />

      <WizardShell
        title="AS-Built Earth Installation & Test"
        formNumber={FORM_KEY}
        headerIcon={<Zap size={20} color="#fff" />}
        steps={EJ_STEPS}
        step={step}
        onStepClick={i => { setStep(i); if (i === EJ_STEPS.length - 1) triggerGenerate(d, photos) }}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EJ.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 1 : undefined}
        onNext={() => { const n = step + 1; setStep(n); if (n === EJ_STEPS.length - 1) triggerGenerate(d, photos) }}
        accent={ACCENT}
        bg={EJ_BG}
        mid={EJ_MID}
        border={EJ_BORDER}
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

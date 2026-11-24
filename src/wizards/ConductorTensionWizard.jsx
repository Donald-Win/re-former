// 360S014EQ — Commissioning Conductor Tensioning Method & Results Per Run Form
import { useState } from 'react'
import { Cable } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WCB, SectionHead } from '../shared/WizardInputs'
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

// ── PDF generation runs off the main thread via the shared PDF worker ────────
const generateCtPdf = createWorkerGenerator('ConductorTensionPdfGenerator', 'generateCtPdf')

const FORM_KEY   = '360S014EQ'
const FORM_LABEL = 'Conductor Tensioning Run Form'
const ACCENT     = APP_ACCENT
const CT_BG      = WIZARD_COLORS.bg
const CT_MID     = WIZARD_COLORS.mid
const CT_BORDER  = WIZARD_COLORS.border

const CT_STEPS = [
  'Job Details',
  'Pole Numbers',
  'Test Conditions',
  'Tensioning Method',
  'Clearance & Comments',
  'Photos',
  'Preview & Print',
]
const PREVIEW_STEP = CT_STEPS.length - 1

const METHOD_OPTIONS    = ['Dynamometer', 'Sight Board', 'Return Waves']
const CLEARANCE_OPTIONS = ['Access Way', 'Road Crossing']

const GRID2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }
const GRID3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px' }

const initState = () => getBaseFormState({
  siteSupervisorName: '',
  irNo: '',
  planPoleA: '',
  planPoleB: '',
  conductorType: '',
  confirmedPoleA: '',
  confirmedPoleB: '',
  noPoleChange: false,
  dateOfTest: '',
  ambientTemp: '',
  timeOfTest: '',
  tensionMethod: '',
  tension: '',
  spanLengthSight: '',
  sag: '',
  waveTime: '',
  spanLengthWaves: '',
  photosIncluded: false,
  clearanceType: '',
  clearanceValue: '',
  comments: '',
})

export default function ConductorTensionWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(initState)
  const [photos, setPhotos] = useState([])

  const isPreview = step === PREVIEW_STEP

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: FORM_KEY, formLabel: FORM_LABEL,
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateCtPdf)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const crashRecovery = useCrashRecovery({
    formKey: FORM_KEY, setD, setStep, setPhotos, maxStep: CT_STEPS.length - 2,
  })

  // Tapping the selected option again clears it.
  const tog = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))

  const goNext = () => {
    const n = step + 1
    setStep(n)
    if (n === PREVIEW_STEP) triggerGenerate(d, photos)
  }

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.planPoleA && d.planPoleB ? `${d.planPoleA}-${d.planPoleB}` : '', FORM_LABEL),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'No./Street/Road',
    !d.contractor && 'Company Name',
    !d.namePrint  && 'Name (Print)',
    !d.signed     && 'Signature',
    !d.tensionMethod && 'Tensioning method',
  ].filter(Boolean)

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}>
          <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
          <SectionHead label="Site Supervisor" accent={ACCENT} />
          <WF label="Site Supervisor Name" v={d.siteSupervisorName} set={set('siteSupervisorName')} accent={ACCENT} />
          <WF label="IR No." v={d.irNo} set={set('irNo')} accent={ACCENT} />
        </JobDetailsStep>
      )

      case 1: return (
        <div key="s1">
          <SectionHead label="Pole Numbers at Planning Stage" accent={ACCENT} />
          <div style={GRID2}>
            <WF label="Between Poles" v={d.planPoleA} set={set('planPoleA')} accent={ACCENT} />
            <WF label="And" v={d.planPoleB} set={set('planPoleB')} accent={ACCENT} />
          </div>
          <WF label="Conductor Type" v={d.conductorType} set={set('conductorType')} accent={ACCENT} />

          <SectionHead label="Pole Numbers After Site Installation" sub="Confirm the pole numbers on site" accent={ACCENT} />
          <button
            type="button"
            onClick={() => set('noPoleChange', !d.noPoleChange)}
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 12,
              border: `2px solid ${d.noPoleChange ? ACCENT : '#e5e7eb'}`,
              background: d.noPoleChange ? ACCENT + '12' : '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 4, flexShrink: 0,
              background: d.noPoleChange ? ACCENT : '#f3f4f6',
              border: `2px solid ${d.noPoleChange ? ACCENT : '#d1d5db'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: d.noPoleChange ? '#fff' : 'transparent', fontWeight: 700,
            }}>✓</span>
            <span style={{ fontSize: 13, color: '#374151' }}>No change to pole numbers</span>
          </button>
          {!d.noPoleChange && (
            <div style={GRID2}>
              <WF label="Between Poles" v={d.confirmedPoleA} set={set('confirmedPoleA')} accent={ACCENT} />
              <WF label="And" v={d.confirmedPoleB} set={set('confirmedPoleB')} accent={ACCENT} />
            </div>
          )}
        </div>
      )

      case 2: return (
        <div key="s2">
          <SectionHead label="Test Conditions" accent={ACCENT} />
          <WF label="Date of Test" type="date" v={d.dateOfTest} set={set('dateOfTest')} accent={ACCENT} />
          <div style={GRID2}>
            <WF label="Ambient Temperature" v={d.ambientTemp} set={set('ambientTemp')} ph="e.g. 18°C" accent={ACCENT} />
            <WF label="Time of Test" v={d.timeOfTest} set={set('timeOfTest')} ph="e.g. 10:30" accent={ACCENT} />
          </div>
        </div>
      )

      case 3: return (
        <div key="s3">
          <SectionHead label="Conductor Tensioning Method" sub="Select the method used. Dynamometer is preferred." accent={ACCENT} />
          <WCB options={METHOD_OPTIONS} value={d.tensionMethod} onChange={tog('tensionMethod')} accent={ACCENT} />

          {d.tensionMethod === 'Dynamometer' && (
            <WF label="Tension" v={d.tension} set={set('tension')} accent={ACCENT} />
          )}
          {d.tensionMethod === 'Sight Board' && (
            <div style={GRID2}>
              <WF label="Span Length" v={d.spanLengthSight} set={set('spanLengthSight')} accent={ACCENT} />
              <WF label="Sag" v={d.sag} set={set('sag')} accent={ACCENT} />
            </div>
          )}
          {d.tensionMethod === 'Return Waves' && (
            <div style={GRID2}>
              <WF label="Time" v={d.waveTime} set={set('waveTime')} accent={ACCENT} />
              <WF label="Span Length" v={d.spanLengthWaves} set={set('spanLengthWaves')} accent={ACCENT} />
            </div>
          )}

          <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
          <button
            type="button"
            onClick={() => set('photosIncluded', !d.photosIncluded)}
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10,
              border: `2px solid ${d.photosIncluded ? ACCENT : '#e5e7eb'}`,
              background: d.photosIncluded ? ACCENT + '12' : '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 4, flexShrink: 0,
              background: d.photosIncluded ? ACCENT : '#f3f4f6',
              border: `2px solid ${d.photosIncluded ? ACCENT : '#d1d5db'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: d.photosIncluded ? '#fff' : 'transparent', fontWeight: 700,
            }}>✓</span>
            <span style={{ fontSize: 13, color: '#374151' }}>Photos included of readings and temperature</span>
          </button>
        </div>
      )

      case 4: return (
        <div key="s4">
          <SectionHead label="Conductor Clearance" sub="Minimum clearance over access way or road crossing (if applicable)" accent={ACCENT} />
          <WCB options={CLEARANCE_OPTIONS} value={d.clearanceType} onChange={tog('clearanceType')} accent={ACCENT} />
          {d.clearanceType && (
            <WF label={`Clearance over ${d.clearanceType}`} v={d.clearanceValue} set={set('clearanceValue')} accent={ACCENT} />
          )}

          <SectionHead label="Comments" accent={ACCENT} />
          <WF label="Comments" v={d.comments} set={set('comments')} accent={ACCENT} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -6, lineHeight: 1.4 }}>
            The form has room for two lines of comments.
          </div>
        </div>
      )

      case 5: return (
        <div key="s5">
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
        title="Conductor Tensioning Run Form"
        formNumber={FORM_KEY}
        headerIcon={<Cable size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={CT_STEPS}
        step={step}
        onStepClick={i => { setStep(i); if (i === PREVIEW_STEP) triggerGenerate(d, photos) }}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EQ.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 2 : undefined}
        onNext={goNext}
        accent={ACCENT}
        bg={CT_BG}
        mid={CT_MID}
        border={CT_BORDER}
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

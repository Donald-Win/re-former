// 360S014EL — As-built Cable Test Report
import { useState } from 'react'
import { Zap } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { PlanSketchStep } from '../shared/PlanSketchStep'
import { emptyPlan } from '../shared/planModel'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState, getUserPrefs, getTestSets, saveTestSets, MAX_TEST_SETS } from '../shared/userPrefs'
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
const generateElPdf = createWorkerGenerator('CableTestPdfGenerator', 'generateElPdf')

const FORM_KEY   = '360S014EL'
const FORM_LABEL = 'Cable Test Report'
const ACCENT     = APP_ACCENT
const EL_BG      = WIZARD_COLORS.bg
const EL_MID     = WIZARD_COLORS.mid
const EL_BORDER  = WIZARD_COLORS.border

const STEPS = [
  'Job Details',
  'Cable Test Details',
  'Schematic',
  'Cable Description',
  'Insulation Tests',
  'Test Equipment',
  'Phase Polarity',
  'Photos',
  'Preview & Print',
]
const PREVIEW_STEP = 8

const VOLTAGE_OPTIONS    = ['66kV', '33kV', '11kV', '230/400', 'Other']
const INSULATION_OPTIONS = ['XLPE', 'PILC', 'Other']
const TEST_VOLTAGES      = ['500V', '1000V', '2500V', '5000V']
const POWER_OPTIONS      = ['Mains', 'Other']

const GRID2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }
const GRID3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 10px' }

// Sample schematic for the DEV-only 🧪 fill button. Kept inside the box.
const DEV_PLAN = {
  v: 1, north: 0, northSet: false,
  els: [
    { id: 's1', t: 'pt', kind: 'rect', x: 80,  y: 60, w: 50, h: 30, color: 'blue', labelPos: 'center', label: 'Feeder' },
    { id: 's2', t: 'pt', kind: 'dot',  x: 300, y: 60, color: 'red', labelPos: 'top', label: 'Joint' },
    { id: 'l1', t: 'ln', pattern: 'dashed', color: 'black', weight: 'normal', x1: 105, y1: 60, x2: 300, y2: 60, label: '11kV cable' },
    { id: 'd1', t: 'dim', color: 'black', orient: 'horizontal', x1: 80, y1: 60, x2: 300, y2: 60, offset: -20, label: '22.0m' },
  ],
}

const initState = () => getBaseFormState({
  siteId: '',
  testedBy: getUserPrefs().namePrint || '',
  feederId: '',
  testType: '',
  voltageClass: '',
  voltageOther: '',
  cableRoute: '',
  plan: emptyPlan(),
  csaType: '',
  csaSize: '',
  phases: '',
  cores: '',
  cables: '',
  insulation: '',
  insulationOther: '',
  armour: '',
  rE: '', yE: '', bE: '',
  rB: '', rY: '', yB: '',
  testMake: '',
  testModel: '',
  testSerial: '',
  testVoltage: '',
  powerSupply: '',
  powerOther: '',
  phaseR: '', phaseY: '', phaseB: '',
  phaseMarkings: '',
  otherTests: '',
})

const btnStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 10,
  border: `2px solid ${ACCENT}`, background: '#fff', color: ACCENT,
  fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  textAlign: 'left',
}

const subLabel = {
  fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export default function CableTestWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(initState)
  const [photos, setPhotos] = useState([])
  const [saveName, setSaveName] = useState('')
  const [equipNote, setEquipNote] = useState('')

  const isPreview = step === PREVIEW_STEP

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: FORM_KEY, formLabel: FORM_LABEL,
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateElPdf)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, FORM_KEY, { plan: DEV_PLAN })
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const crashRecovery = useCrashRecovery({
    formKey: FORM_KEY, setD, setStep, setPhotos, maxStep: STEPS.length - 2,
  })

  // Tapping the selected option again clears it.
  const tog = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))

  // Load one of the saved test sets into the make / model / serial fields.
  // The fields stay editable afterwards, so a set can be adjusted for one job.
  const loadTestSet = s => {
    setD(p => ({ ...p, testMake: s.make, testModel: s.model, testSerial: s.serial }))
    setEquipNote(`Loaded "${s.name}". You can still edit these fields.`)
  }

  // Save the typed make / model / serial as a named set in My Details.
  // Reusing an existing name updates that set. A new name needs a free slot.
  const saveAsNamedSet = () => {
    const name = saveName.trim()
    if (!name) return
    const current = getTestSets()
    const entry = { name, make: d.testMake, model: d.testModel, serial: d.testSerial }
    const idx = current.findIndex(s => s.name.toLowerCase() === name.toLowerCase())
    if (idx < 0 && current.length >= MAX_TEST_SETS) {
      setEquipNote(`All ${MAX_TEST_SETS} test sets are in use. Remove one in My Details to save this.`)
      return
    }
    const next = idx >= 0
      ? current.map((s, i) => (i === idx ? entry : s))
      : [...current, entry]
    saveTestSets(next)
    setSaveName('')
    setEquipNote(idx >= 0 ? `Updated "${name}" in My Details.` : `Saved "${name}" to My Details.`)
  }

  const goNext = () => {
    const n = step + 1
    setStep(n)
    if (n === PREVIEW_STEP) triggerGenerate(d, photos)
  }

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.feederId, FORM_LABEL),
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
    !d.testType   && 'Test type (Installation / Retest)',
  ].filter(Boolean)

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}>
          <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
          <SectionHead label="Site & Testing" accent={ACCENT} />
          <WF label="Site ID"   v={d.siteId}   set={set('siteId')}   accent={ACCENT} />
          <WF label="Tested By" v={d.testedBy} set={set('testedBy')} accent={ACCENT} />
        </JobDetailsStep>
      )

      case 1: return (
        <div key="s1">
          <SectionHead label="Test Type" accent={ACCENT} />
          <WCB options={['Installation', 'Retest']} value={d.testType}
            onChange={tog('testType')} accent={ACCENT} />

          <SectionHead label="Voltage" accent={ACCENT} />
          <WCB options={VOLTAGE_OPTIONS} value={d.voltageClass}
            onChange={tog('voltageClass')} accent={ACCENT} />
          {d.voltageClass === 'Other' && (
            <WF label="Other voltage — specify" v={d.voltageOther} set={set('voltageOther')} accent={ACCENT} />
          )}

          <SectionHead label="Feeder & Route" accent={ACCENT} />
          <WF label="Feeder ID" v={d.feederId} set={set('feederId')} accent={ACCENT} />
          <WTA label="Cable Route" v={d.cableRoute} set={set('cableRoute')} rows={3} accent={ACCENT} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -6, lineHeight: 1.4 }}>
            The route prints on two lines. Keep it short.
          </div>
        </div>
      )

      case 2: return (
        <div key="s2">
          <SectionHead label="Schematic" accent={ACCENT}
            sub="Draw the cable route and test points in the box. Label each item." />
          <PlanSketchStep plan={d.plan} onChange={p => set('plan', p)} formKey={FORM_KEY} accent={ACCENT} />
        </div>
      )

      case 3: return (
        <div key="s3">
          <SectionHead label="Cross Section" accent={ACCENT} />
          <WCB options={['Copper', 'Aluminium']} value={d.csaType}
            onChange={tog('csaType')} accent={ACCENT} />
          <WF label="Size (mm²)" v={d.csaSize} set={set('csaSize')} ph="e.g. 185" accent={ACCENT} />

          <SectionHead label="Cable Count" accent={ACCENT} />
          <div style={GRID3}>
            <WF label="No. of Phases" type="number" v={d.phases} set={set('phases')} accent={ACCENT} />
            <WF label="No. of Cores"  type="number" v={d.cores}  set={set('cores')}  accent={ACCENT} />
            <WF label="No. of Cables" type="number" v={d.cables} set={set('cables')} accent={ACCENT} />
          </div>

          <SectionHead label="Insulation & Armour" accent={ACCENT} />
          <WCB options={INSULATION_OPTIONS} value={d.insulation}
            onChange={tog('insulation')} accent={ACCENT} />
          {d.insulation === 'Other' && (
            <WF label="Other insulation — specify" v={d.insulationOther} set={set('insulationOther')} accent={ACCENT} />
          )}
          <WF label="Armour and Covering" v={d.armour} set={set('armour')} accent={ACCENT} />
        </div>
      )

      case 4: return (
        <div key="s4">
          <SectionHead label="Insulation Tests" accent={ACCENT}
            sub="Enter each reading as it was measured." />
          <div style={GRID2}>
            <WF label="R-E" v={d.rE} set={set('rE')} accent={ACCENT} />
            <WF label="R-B" v={d.rB} set={set('rB')} accent={ACCENT} />
            <WF label="Y-E" v={d.yE} set={set('yE')} accent={ACCENT} />
            <WF label="R-Y" v={d.rY} set={set('rY')} accent={ACCENT} />
            <WF label="B-E" v={d.bE} set={set('bE')} accent={ACCENT} />
            <WF label="Y-B" v={d.yB} set={set('yB')} accent={ACCENT} />
          </div>
        </div>
      )

      case 5: {
        const sets = getTestSets()
        const anyEntered = !!(d.testMake || d.testModel || d.testSerial)
        const setsFull = sets.length >= MAX_TEST_SETS
        return (
          <div key="s5">
            <SectionHead label="Test Set" accent={ACCENT}
              sub="Pick a saved test set, or type in different gear by hand." />

            {sets.length > 0 ? (
              <div style={{ marginBottom: 6 }}>
                <div style={subLabel}>Saved test sets</div>
                {sets.map(s => {
                  // Highlight the set whose details are currently in the fields.
                  const on = d.testMake === s.make && d.testModel === s.model && d.testSerial === s.serial
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => loadTestSet(s)}
                      style={{
                        ...btnStyle,
                        border: `2px solid ${on ? ACCENT : '#d1d5db'}`,
                        background: on ? `${ACCENT}18` : '#fff',
                        color: on ? ACCENT : '#374151',
                      }}
                    >
                      {s.name}
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginTop: 3 }}>
                        {[s.make, s.model, s.serial && `S/N ${s.serial}`].filter(Boolean).join(' · ') || 'No details'}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{
                background: EL_BG, border: `1px solid ${EL_BORDER}`, borderRadius: 10,
                padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#3730a3', lineHeight: 1.4,
              }}>
                No test sets are saved in My Details yet. Type the details in below, then save
                them under a name to reuse next time.
              </div>
            )}

            <div style={{ ...subLabel, marginTop: 12 }}>Details for this job</div>
            <div style={GRID3}>
              <WF label="Make"      v={d.testMake}   set={set('testMake')}   accent={ACCENT} />
              <WF label="Model"     v={d.testModel}  set={set('testModel')}  accent={ACCENT} />
              <WF label="Serial No" v={d.testSerial} set={set('testSerial')} accent={ACCENT} />
            </div>

            {anyEntered && (
              <div style={{
                border: `2px dashed ${ACCENT}`, background: EL_BG, borderRadius: 10,
                padding: '10px 12px', marginBottom: 12,
              }}>
                <div style={subLabel}>Save these to My Details</div>
                {setsFull ? (
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                    All {MAX_TEST_SETS} test sets are in use. Remove one in My Details to save more.
                    Typing an existing set's name below will still update that set.
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: setsFull ? 8 : 0 }}>
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder="Name, e.g. Megger"
                    style={{
                      flex: 1, minWidth: 0, padding: '9px 11px', borderRadius: 8,
                      border: '2px solid #ddd', fontFamily: 'inherit', fontSize: 14,
                      boxSizing: 'border-box', background: '#fff',
                    }}
                  />
                  <button
                    type="button"
                    onClick={saveAsNamedSet}
                    disabled={!saveName.trim()}
                    style={{
                      padding: '9px 14px', borderRadius: 8, border: 'none',
                      background: saveName.trim() ? ACCENT : '#d1d5db', color: '#fff',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      cursor: saveName.trim() ? 'pointer' : 'default', flexShrink: 0,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            {equipNote && (
              <div style={{ fontSize: 12, color: '#166534', marginBottom: 12 }}>{equipNote}</div>
            )}

            <SectionHead label="Test Voltage" accent={ACCENT} />
            <WCB options={TEST_VOLTAGES} value={d.testVoltage}
              onChange={tog('testVoltage')} accent={ACCENT} />

            <SectionHead label="External Power Supply" accent={ACCENT} />
            <WCB options={POWER_OPTIONS} value={d.powerSupply}
              onChange={tog('powerSupply')} accent={ACCENT} />
            {d.powerSupply === 'Other' && (
              <WF label="Other — specify" v={d.powerOther} set={set('powerOther')} accent={ACCENT} />
            )}
          </div>
        )
      }

      case 6: return (
        <div key="s6">
          <SectionHead label="Correct Between Cable Ends" accent={ACCENT} />
          <div style={GRID3}>
            <WF label="R" v={d.phaseR} set={set('phaseR')} accent={ACCENT} />
            <WF label="Y" v={d.phaseY} set={set('phaseY')} accent={ACCENT} />
            <WF label="B" v={d.phaseB} set={set('phaseB')} accent={ACCENT} />
          </div>
          <WF label="Phase Markings" v={d.phaseMarkings} set={set('phaseMarkings')} accent={ACCENT} />

          <SectionHead label="Other Tests" accent={ACCENT} />
          <WTA label="Other Tests (if applicable)" v={d.otherTests} set={set('otherTests')} rows={4} accent={ACCENT} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -6, lineHeight: 1.4 }}>
            Other tests print on three lines. Keep them short.
          </div>
        </div>
      )

      case 7: return (
        <div key="s7">
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
        title="As-built Cable Test Report"
        formNumber={FORM_KEY}
        headerIcon={<Zap size={20} color="#fff" />}
        steps={STEPS}
        step={step}
        onStepClick={i => { setStep(i); if (i === PREVIEW_STEP) triggerGenerate(d, photos) }}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EL.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 2 : undefined}
        onNext={goNext}
        accent={ACCENT}
        bg={EL_BG}
        mid={EL_MID}
        border={EL_BORDER}
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

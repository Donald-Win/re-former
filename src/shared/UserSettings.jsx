/**
 * UserSettings — dedicated settings page for persistent user details.
 *
 * Stores: contractor name, printed name, ISN ID, competency cert no, signature,
 * up to three named test sets (make, model, serial) for the Cable Test Report,
 * and the default view. These are loaded silently into every wizard and written
 * to the PDF without the user being asked each time.
 */
import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, User, Building2, PenLine, Trash2, FileText, Hash, Settings, Briefcase, List, Gauge, Plus, X } from 'lucide-react'
import { getUserPrefs, saveUserPref, getTestSets, saveTestSets, MAX_TEST_SETS } from './userPrefs'
import { SignaturePad } from './SignaturePad'
import { BackupRestore } from './BackupRestore'
import { APP_ACCENT } from './constants'

const blankSet = () => ({ name: '', make: '', model: '', serial: '' })
const isBlank  = s => !s.name.trim() && !s.make.trim() && !s.model.trim() && !s.serial.trim()

export function UserSettings({ onClose }) {
  const [contractor, setContractor] = useState('')
  const [namePrint,  setNamePrint]  = useState('')
  const [isnId,      setIsnId]      = useState('')
  const [certNo,     setCertNo]     = useState('')
  const [signed,     setSigned]     = useState('')
  const [testSets,   setTestSets]   = useState([])
  const [testError,  setTestError]  = useState('')
  const [defaultView, setDefaultView] = useState('workType')
  const [saved,      setSaved]      = useState(false)
  const savedTimerRef = useRef(null)

  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }, [])

  // Load existing prefs on mount
  useEffect(() => {
    const prefs = getUserPrefs()
    setContractor(prefs.contractor || '')
    setNamePrint(prefs.namePrint   || '')
    setIsnId(prefs.isnId           || '')
    setCertNo(prefs.certNo         || '')
    setSigned(prefs.signed         || '')
    setTestSets(getTestSets())
    setDefaultView(prefs.defaultView || 'workType')
  }, [])

  const updateSet = (i, field, value) =>
    setTestSets(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))

  const removeSet = i => setTestSets(prev => prev.filter((_, idx) => idx !== i))

  const addSet = () => setTestSets(prev => (prev.length < MAX_TEST_SETS ? [...prev, blankSet()] : prev))

  const handleSave = () => {
    // A set with details but no name can't be picked in the wizard, so ask for one.
    const unnamed = testSets.some(s => !isBlank(s) && !s.name.trim())
    if (unnamed) {
      setTestError('Give each test set a name, so you can pick it in the wizard.')
      return
    }
    setTestError('')
    saveUserPref('contractor',  contractor)
    saveUserPref('namePrint',   namePrint)
    saveUserPref('isnId',       isnId)
    saveUserPref('certNo',      certNo)
    saveUserPref('signed',      signed)
    const kept = saveTestSets(testSets.filter(s => !isBlank(s)))
    setTestSets(kept)
    saveUserPref('defaultView', defaultView)
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleClearAll = () => {
    if (!window.confirm('Clear all saved user details?')) return
    saveUserPref('contractor', '')
    saveUserPref('namePrint',  '')
    saveUserPref('isnId',      '')
    saveUserPref('certNo',     '')
    saveUserPref('signed',     '')
    saveTestSets([])
    setContractor('')
    setNamePrint('')
    setIsnId('')
    setCertNo('')
    setSigned('')
    setTestSets([])
    setTestError('')
  }

  const inp = {
    width: '100%', padding: '11px 13px',
    border: `2px solid ${APP_ACCENT}40`,
    borderRadius: 10, fontSize: 15,
    fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', background: '#fff',
    color: '#1a1a2e',
    transition: 'border-color 0.15s',
  }

  const smallInp = { ...inp, padding: '9px 11px', fontSize: 14 }

  const lbl = {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 12, fontWeight: 700, color: APP_ACCENT,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 6,
  }

  const subLbl = {
    fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  const section = {
    background: '#fff',
    border: `1px solid ${APP_ACCENT}20`,
    borderRadius: 14,
    padding: '18px 16px',
    marginBottom: 14,
    boxShadow: `0 2px 8px ${APP_ACCENT}10`,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#f4f4f8',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: APP_ACCENT, color: '#fff',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <User size={22} color="#fff" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>My Details</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Pre-filled into every form automatically</div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none',
          borderRadius: 8, padding: '6px 14px',
          color: '#fff', fontFamily: 'inherit',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Done</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 40px' }}>

        <div style={{
          background: `${APP_ACCENT}12`,
          border: `1px solid ${APP_ACCENT}30`,
          borderRadius: 10, padding: '12px 14px',
          marginBottom: 20, fontSize: 13,
          color: APP_ACCENT, lineHeight: 1.5,
        }}>
          <strong>ℹ️ How this works</strong><br />
          Save your details here once. Every form wizard will automatically
          fill in your contractor, name, ISN ID, and signature — you won't be asked again.
        </div>

        {/* Contractor */}
        <div style={section}>
          <label style={lbl}>
            <Building2 size={14} />
            Contractor / Company
          </label>
          <input
            type="text"
            value={contractor}
            onChange={e => setContractor(e.target.value)}
            placeholder="e.g. Downer Group"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* Name */}
        <div style={section}>
          <label style={lbl}>
            <User size={14} />
            Your Name (Print)
          </label>
          <input
            type="text"
            value={namePrint}
            onChange={e => setNamePrint(e.target.value)}
            placeholder="e.g. Donald Win"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* ISN ID */}
        <div style={section}>
          <label style={lbl}>
            <Hash size={14} />
            ISN ID Number
          </label>
          <input
            type="text"
            value={isnId}
            onChange={e => setIsnId(e.target.value)}
            placeholder="e.g. ISN12345"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* Competency Cert No */}
        <div style={section}>
          <label style={lbl}>
            <FileText size={14} />
            Competency Cert No.
          </label>
          <input
            type="text"
            value={certNo}
            onChange={e => setCertNo(e.target.value)}
            placeholder="e.g. EW123456"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* Signature */}
        <div style={section}>
          <label style={lbl}>
            <PenLine size={14} />
            Signature
          </label>
          <SignaturePad value={signed} onChange={setSigned} accent={APP_ACCENT} />
          <div style={{
            marginTop: 8, fontSize: 12,
            color: '#9ca3af', textAlign: 'center',
          }}>
            {signed ? '✓ Signature saved' : 'Draw your signature above'}
          </div>
        </div>

        {/* Test Equipment — up to MAX_TEST_SETS named sets */}
        <div style={section}>
          <label style={lbl}>
            <Gauge size={14} />
            Test Equipment
          </label>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12, lineHeight: 1.4 }}>
            Save up to {MAX_TEST_SETS} test sets and give each a name, such as "Megger" or "Van 3 kit".
            On the Cable Test Report's Test Equipment step, pick the set you are using.
            For other gear, type the details in by hand.
          </div>

          {testSets.length === 0 && (
            <div style={{
              background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 10,
              padding: '12px', marginBottom: 12, fontSize: 12, color: '#6b7280', textAlign: 'center',
            }}>
              No test sets saved yet.
            </div>
          )}

          {testSets.map((set, i) => (
            <div key={i} style={{
              border: `1.5px solid ${APP_ACCENT}30`, borderRadius: 12,
              padding: '12px 12px 10px', marginBottom: 12, background: '#fafaff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: APP_ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Test set {i + 1}
                </span>
                <button
                  onClick={() => removeSet(i)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
                    fontSize: 13, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <X size={14} /> Remove
                </button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={subLbl}>Name</div>
                <input
                  type="text"
                  value={set.name}
                  onChange={e => updateSet(i, 'name', e.target.value)}
                  placeholder="e.g. Megger MIT1025"
                  style={smallInp}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px' }}>
                <div>
                  <div style={subLbl}>Make</div>
                  <input type="text" value={set.make} onChange={e => updateSet(i, 'make', e.target.value)}
                    placeholder="e.g. Megger" style={smallInp} />
                </div>
                <div>
                  <div style={subLbl}>Model</div>
                  <input type="text" value={set.model} onChange={e => updateSet(i, 'model', e.target.value)}
                    placeholder="e.g. MIT1025" style={smallInp} />
                </div>
                <div style={{ gridColumn: '1 / span 2' }}>
                  <div style={subLbl}>Serial No.</div>
                  <input type="text" value={set.serial} onChange={e => updateSet(i, 'serial', e.target.value)}
                    placeholder="e.g. 1234567" style={smallInp} />
                </div>
              </div>
            </div>
          ))}

          {testSets.length < MAX_TEST_SETS && (
            <button
              onClick={addSet}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10,
                border: `2px dashed ${APP_ACCENT}`, background: `${APP_ACCENT}0d`,
                color: APP_ACCENT, fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Plus size={16} /> Add test set ({testSets.length} / {MAX_TEST_SETS})
            </button>
          )}

          {testSets.length >= MAX_TEST_SETS && (
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              You have {MAX_TEST_SETS} test sets. Remove one to add another.
            </div>
          )}

          {testError && (
            <div role="alert" style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
              background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626',
            }}>
              {testError}
            </div>
          )}
        </div>

        {/* Default View */}
        <div style={section}>
          <label style={lbl}>
            <Settings size={14} />
            Default View on Open
          </label>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.4 }}>
            Choose which screen the app shows first when you open it.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: 'workType', label: 'By Work Type',     icon: Briefcase },
              { val: 'allForms', label: 'Browse All Forms', icon: List },
            ].map(({ val, label, icon: Icon }) => {
              const sel = defaultView === val
              return (
                <button
                  key={val}
                  onClick={() => setDefaultView(val)}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10,
                    border: `2px solid ${sel ? APP_ACCENT : '#e5e7eb'}`,
                    background: sel ? APP_ACCENT : '#fff',
                    color: sel ? '#fff' : '#374151',
                    fontFamily: 'inherit', fontSize: 13,
                    fontWeight: sel ? 700 : 600, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 5,
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Backup & Restore */}
        <BackupRestore accent={APP_ACCENT} />

        {/* Save button */}
        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14, border: 'none',
            background: saved ? '#16a34a' : APP_ACCENT,
            color: '#fff',
            fontFamily: 'inherit', fontSize: 16,
            fontWeight: 700, cursor: 'pointer',
            marginBottom: 12,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {saved
            ? <><CheckCircle2 size={20} /> Saved!</>
            : 'Save My Details'
          }
        </button>

        {/* Clear all */}
        <button
          onClick={handleClearAll}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 14,
            border: '2px solid #fca5a5',
            background: '#fff5f5', color: '#dc2626',
            fontFamily: 'inherit', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          <Trash2 size={16} /> Clear All Saved Details
        </button>

      </div>
    </div>
  )
}

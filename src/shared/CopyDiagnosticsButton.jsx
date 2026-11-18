/**
 * CopyDiagnosticsButton — copies the full diagnostics report to the clipboard.
 *
 * If the clipboard isn't available (some iPad home-screen setups refuse it),
 * the report is shown in a read-only box that selects itself on tap, so it
 * can be copied by hand. The reason the clipboard failed is shown too.
 */
import { useEffect, useRef, useState } from 'react'
import { buildDiagnosticsReport, describeError } from './errorLog'

export function CopyDiagnosticsButton({ accent = '#4f46e5', label = 'Copy diagnostics' }) {
  const [state, setState] = useState('idle') // idle | copied | failed
  const [manualText, setManualText] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const flash = next => {
    setState(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setState('idle'), 2500)
  }

  const copy = async () => {
    const text = buildDiagnosticsReport()
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('this browser has no clipboard API')
      }
      await navigator.clipboard.writeText(text)
      setManualText(null)
      flash('copied')
    } catch (err) {
      setManualText(
        `Copying was not possible (${describeError(err)}).\n` +
        'Tap in the box, select all, and copy the text by hand.\n\n' + text,
      )
      flash('failed')
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={copy}
        style={{
          padding: '9px 14px', borderRadius: 8, border: 'none',
          background: state === 'copied' ? '#16a34a' : accent,
          color: '#fff', fontFamily: 'inherit', fontSize: 13,
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        {state === 'copied' ? '✓ Copied' : state === 'failed' ? 'Copy failed — see below' : label}
      </button>
      {manualText && (
        <textarea
          readOnly
          value={manualText}
          onFocus={e => e.target.select()}
          rows={10}
          style={{
            width: '100%', marginTop: 8, boxSizing: 'border-box',
            fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4,
            background: '#0f172a', color: '#e2e8f0',
            border: '1px solid #334155', borderRadius: 6, padding: 8,
          }}
        />
      )}
    </div>
  )
}

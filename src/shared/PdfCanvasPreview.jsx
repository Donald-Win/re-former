/**
 * PdfCanvasPreview
 *
 * Renders every page of a PDF (supplied as Uint8Array) onto stacked <canvas>
 * elements using pdfjs-dist, bundled locally via npm so the service worker
 * can cache it for offline use.
 *
 * Layout-shift fix
 * ────────────────
 * Each canvas gets `aspect-ratio` set from its viewport before rendering
 * begins, so the browser reserves the correct height up front.
 *
 * Error reporting
 * ───────────────
 * Every step is tagged with a stage name (check-data, load-document,
 * load-page, render-page). If anything fails, the stage, the exception, and
 * basic data facts (byte count, first bytes of the file, pdf.js version)
 * are shown on screen and written to the error log, so a failure can be
 * reported without a Mac attached.
 */
import { useEffect, useRef, useState } from 'react'
import { pdfjsLib } from './pdfjsInit'
import { reportError, describeError } from './errorLog'
import { CopyDiagnosticsButton } from './CopyDiagnosticsButton'

// pdfjs-dist v6 removed PDFDocumentProxy.destroy(): the *loading task* owns
// teardown of the document and its worker. Never throws, never leaves an
// unhandled rejection.
const destroyTask = (task) => {
  try { Promise.resolve(task?.destroy()).catch(() => {}) } catch (_) { /* already gone */ }
}

// First bytes of the file as printable text. A saved HTML error page or an
// empty file looks obviously different from a real PDF ("%PDF-1.7").
function headerOf(bytes) {
  try {
    return Array.from(bytes.slice(0, 8), b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
  } catch {
    return '?'
  }
}

const PRE = {
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.4,
  background: 'rgba(0,0,0,0.35)', padding: 8, borderRadius: 6, color: '#f9fafb',
  margin: '8px 0',
}

export function PdfCanvasPreview({ pdfBytes }) {
  const containerRef = useRef(null)
  const [status, setStatus]   = useState('idle')   // idle | rendering | done | error
  const [failure, setFailure] = useState(null)     // { stage, text, info }

  useEffect(() => {
    const container = containerRef.current
    if (!pdfBytes || !container) return

    let cancelled = false
    let pdfDoc    = null
    let task      = null
    let stage     = 'start'
    const info = `bytes=${pdfBytes.byteLength ?? 'unknown'} header="${headerOf(pdfBytes)}" pdfjs=${pdfjsLib.version ?? 'unknown'}`

    // ── Immediately clear any canvases from a previous render ───────────────
    container.innerHTML = ''
    setStatus('rendering')
    setFailure(null)

    ;(async () => {
      try {
        if (!pdfBytes.byteLength) {
          stage = 'check-data'
          throw new Error('the PDF data is empty (0 bytes)')
        }

        stage = 'load-document'
        // Pass a copy so pdf.js can't accidentally transfer/mutate our bytes
        task = pdfjsLib.getDocument({ data: pdfBytes.slice() })
        pdfDoc = await task.promise
        if (cancelled) { destroyTask(task); task = null; return }

        const total = pdfDoc.numPages

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) break

          stage = `load-page ${pageNum} of ${total}`
          const page = await pdfDoc.getPage(pageNum)
          if (cancelled) { page.cleanup(); break }

          // Scale so the canvas width fills the container at ~1x on retina;
          // 1.5 gives a good balance of sharpness vs memory.
          const viewport = page.getViewport({ scale: 1.5 })

          stage = `create-canvas page ${pageNum} of ${total} (${Math.round(viewport.width)}x${Math.round(viewport.height)})`
          const canvas  = document.createElement('canvas')
          canvas.width  = viewport.width
          canvas.height = viewport.height

          // Set aspect-ratio BEFORE appending so the browser reserves the
          // correct height immediately.
          canvas.style.cssText = [
            'width: 100%',
            `aspect-ratio: ${viewport.width} / ${viewport.height}`,
            'display: block',
            'margin-bottom: 8px',
            'border-radius: 4px',
            'box-shadow: 0 1px 6px rgba(0,0,0,0.18)',
          ].join(';')

          if (cancelled) { page.cleanup(); break }
          container.appendChild(canvas)

          stage = `get-2d-context page ${pageNum} of ${total}`
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error(
              `the browser would not give a drawing surface for a ${Math.round(viewport.width)}x${Math.round(viewport.height)} page ` +
              '(the device may be out of canvas memory)',
            )
          }

          stage = `render-page ${pageNum} of ${total}`
          await page.render({ canvasContext: ctx, viewport }).promise

          page.cleanup()
        }

        if (!cancelled) {
          setStatus('done')
          destroyTask(task)
          task = null
          pdfDoc = null
        }

      } catch (err) {
        if (!cancelled) {
          reportError('pdf-preview', err, { stage, info })
          setFailure({ stage, text: describeError(err), info })
          setStatus('error')
        }
      }
    })()

    // ── Cleanup: cancel render, destroy doc, wipe canvases ──────────────────
    return () => {
      cancelled = true
      if (task) {
        destroyTask(task)
        task = null
        pdfDoc = null
      }
      container.innerHTML = ''
    }
  }, [pdfBytes])

  return (
    <div style={{ background: '#d1d5db', padding: '8px', minHeight: 40 }}>
      {status === 'rendering' && (
        <div style={{
          textAlign: 'center', padding: '20px 0',
          color: '#6b7280', fontSize: 13, fontWeight: 600,
        }}>
          Rendering pages…
        </div>
      )}
      {status === 'error' && failure && (
        <div role="alert" style={{ padding: '12px 14px', color: '#fca5a5', fontSize: 13, background: '#111827', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Could not render PDF preview.</div>
          <div style={{ color: '#d1d5db' }}>Stage: {failure.stage}</div>
          <pre style={PRE}>{`${failure.text}\n${failure.info}`}</pre>
          <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 8 }}>
            Send a screenshot of this message, or use the Copy diagnostics button.
          </div>
          <CopyDiagnosticsButton accent="#4f46e5" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}

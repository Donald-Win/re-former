/**
 * usePdfGenerate — shared PDF generation hook for all wizards.
 *
 * Usage:
 *   const { pdfBytes, pdfBlobUrl, pdfGenerating, pdfError,
 *           triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generatorFn)
 *
 * Generator argument — two supported patterns
 * ────────────────────────────────────────────
 * (a) Direct function — called immediately as `fn(d, photos)`. This covers
 *     the worker-backed wrapper every wizard uses (see pdfWorkerClient.js).
 * (b) Zero-argument thunk returning a Promise that resolves to the generator.
 *     Detected by `.length === 0`.
 *
 * Error reporting
 * ───────────────
 * pdfError is an object { stage, text }. `stage` says where the failure
 * happened ('timeout', 'load-generator', 'worker-call', 'worker-crash', …)
 * and `text` is the exception, with name, message and codes. Both are shown
 * on the preview screen and written to the error log.
 *
 * Race-condition guard: genIdRef increments on every trigger and on unmount,
 * so a late result from an older run is discarded.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { PdfCanvasPreview } from './PdfCanvasPreview'
import { CopyDiagnosticsButton } from './CopyDiagnosticsButton'
import { reportError, describeError, withStage } from './errorLog'

const GENERATION_TIMEOUT_MS = 30_000

const PRE = {
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.4,
  background: 'rgba(0,0,0,0.35)', padding: 8, borderRadius: 6, color: '#f9fafb',
  margin: 0, maxWidth: 480,
}

export function usePdfGenerate(generatorFn) {
  const [pdfBytes,      setPdfBytes]      = useState(null)
  const [pdfBlobUrl,    setPdfBlobUrl]    = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError,      setPdfError]      = useState(null)   // { stage, text } | null

  const genIdRef   = useRef(0)
  const blobUrlRef = useRef(null)

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      genIdRef.current += 1
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const triggerGenerate = useCallback((d, photos = []) => {
    const myGenId = ++genIdRef.current

    setPdfBytes(null)
    setPdfBlobUrl(null)
    setPdfGenerating(true)
    setPdfError(null)

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    // ── Timeout race ──────────────────────────────────────────────────────────
    let timeoutId = null
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(withStage(new Error('GENERATION_TIMEOUT'), 'timeout')),
        GENERATION_TIMEOUT_MS,
      )
    })

    // ── Generator resolution ──────────────────────────────────────────────────
    const runGeneration = async () => {
      let fn = generatorFn
      if (typeof generatorFn === 'function' && generatorFn.length === 0) {
        try {
          fn = await generatorFn()
        } catch (err) {
          throw withStage(err, 'load-generator')
        }
      }
      return fn(d, photos)
    }

    Promise.race([runGeneration(), timeoutPromise])
      .then(result => {
        clearTimeout(timeoutId)
        if (myGenId !== genIdRef.current) return

        const bytes = result instanceof Uint8Array ? result : new Uint8Array(result)
        if (bytes.byteLength === 0) {
          const err = withStage(new Error('the generator returned an empty file (0 bytes)'), 'empty-output')
          reportError('pdf-generate', err)
          setPdfError({ stage: 'empty-output', text: describeError(err) })
          setPdfGenerating(false)
          return
        }

        const blob  = new Blob([bytes], { type: 'application/pdf' })
        const url   = URL.createObjectURL(blob)
        blobUrlRef.current = url

        setPdfBytes(bytes)
        setPdfBlobUrl(url)
        setPdfGenerating(false)
      })
      .catch(err => {
        clearTimeout(timeoutId)
        if (myGenId !== genIdRef.current) return

        const stage = err?.stage ?? 'generate'
        const isTimeout = err?.message === 'GENERATION_TIMEOUT'
        const text = isTimeout
          ? `The PDF did not finish within ${GENERATION_TIMEOUT_MS / 1000} seconds.`
          : describeError(err)

        reportError('pdf-generate', err, { stage, photos: photos?.length ?? 0 })
        setPdfError({ stage, text })
        setPdfGenerating(false)
      })
  }, [generatorFn])

  const clearPdf = useCallback(() => {
    genIdRef.current += 1
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setPdfBytes(null)
    setPdfBlobUrl(null)
  }, [])

  /**
   * Returns the standard spinner / error / canvas preview node.
   * Pass onRetry (calls triggerGenerate) and the wizard accent colour.
   */
  const buildPreviewContent = useCallback((onRetry, accent) => {
    if (pdfGenerating) return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#9ca3af',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
      </div>
    )
    if (pdfError) return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '0 16px', gap: 10,
      }}>
        <div style={{ fontSize: 15, color: '#f87171', fontWeight: 700 }}>
          Could not generate the PDF
        </div>
        <pre style={PRE}>{`Stage: ${pdfError.stage}\n${pdfError.text}`}</pre>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onRetry}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: accent, color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Retry
          </button>
          <CopyDiagnosticsButton accent={accent} />
        </div>
      </div>
    )
    if (pdfBytes) return <PdfCanvasPreview pdfBytes={pdfBytes} />
    return null
  }, [pdfGenerating, pdfError, pdfBytes])

  return {
    pdfBytes,
    pdfBlobUrl,
    pdfGenerating,
    pdfError,
    triggerGenerate,
    clearPdf,
    buildPreviewContent,
  }
}

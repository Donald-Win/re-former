/**
 * sharePdf — shared share/save handler for all wizards.
 * buildPdfFilename — sanitised filename builder.
 *
 * Flow
 * ────
 *   1. Try the native share sheet with the PDF as a file.
 *   2. If that fails for any reason other than the user cancelling, open the
 *      PDF in a new tab so it can be printed or saved.
 *   3. onSuccess (which clears the autosave draft) runs after the share sheet
 *      or new-tab attempt, as it always has. A blocked new tab is logged, so
 *      check the error log if a PDF seems to have gone missing.
 *
 * Error reporting
 * ───────────────
 * Each failing step is written to the error log with what was tried, the
 * exception text, and whether the browser can share files at all. The
 * debug overlay (dev builds only) is unchanged.
 */
import { reportError, describeError, getEnvironment } from './errorLog'

function showDebug(lines) {
  // Only expose the debug overlay during local development.
  // import.meta.env.DEV is replaced with a boolean literal at build time,
  // so this entire branch is dead-code-eliminated in production bundles.
  if (!import.meta.env.DEV) return

  const existing = document.getElementById('__sharePdfDebug')
  if (existing) existing.remove()
  const el = document.createElement('div')
  el.id = '__sharePdfDebug'
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:#1e1b4b', 'color:#fff', 'font-family:monospace',
    'font-size:13px', 'padding:16px', 'white-space:pre-wrap',
    'max-height:60vh', 'overflow-y:auto',
  ].join(';')
  el.textContent = lines.join('\n')
  const btn = document.createElement('button')
  btn.textContent = '✕ Dismiss'
  btn.style.cssText = 'display:block;margin-top:12px;padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer'
  btn.onclick = () => el.remove()
  el.appendChild(btn)
  document.body.appendChild(el)
}

/**
 * Build a sanitised PDF filename from the supplied parts.
 *
 * @param {...string} parts  e.g. (d.projectName, d.npJobNumber, d.oldPoleId, 'Pole Record')
 * @returns {string}         e.g. "Pyes Pa Blitz - TC1234567 - Pole Record.pdf"
 */
export function buildPdfFilename(...parts) {
  const sanitise = s => (s || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim()
  return parts.map(sanitise).filter(Boolean).join(' - ') + '.pdf'
}

export async function sharePdf(pdfBytes, filename, blobUrl, onSuccess) {
  if (!pdfBytes) {
    reportError('share', new Error('there is no PDF to share yet (generation has not finished)'), { filename })
    showDebug(['sharePdf: pdfBytes is null — nothing to share'])
    return
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const file = new File([blob], filename, { type: 'application/pdf' })

  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }))
  const log = [
    `sharePdf called — filename: ${filename}`,
    `pdfBytes length: ${pdfBytes.length}`,
    `navigator.share exists: ${!!navigator.share}`,
    `canShare({files}): ${canShareFiles}`,
  ]

  // Only set when THIS function creates its own object URL. A blobUrl passed
  // in by the caller is owned by usePdfGenerate and must never be revoked here.
  let ownBlobUrl = null
  const getUrl = () => blobUrl ?? (ownBlobUrl ??= URL.createObjectURL(blob))
  const releaseOwnUrl = () => {
    if (!ownBlobUrl) return
    const url = ownBlobUrl
    ownBlobUrl = null
    // Give whatever just consumed the URL time to finish reading it.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  try {
    // ── Attempt 1: native share sheet with the file ─────────────────────────
    if (navigator.share) {
      try {
        log.push('Attempting navigator.share({ files })')
        await navigator.share({ files: [file] })
        log.push('SUCCESS — file share')
        onSuccess?.()
        return
      } catch (err) {
        if (err?.name === 'AbortError') {
          // The user dismissed the share sheet. That's a choice, not a fault.
          log.push('Share sheet cancelled by user')
          return
        }
        reportError('share', err, {
          step: 'navigator.share',
          filename,
          bytes: pdfBytes.byteLength,
          canShareFiles,
          standalone: getEnvironment().standalone,
        })
        log.push(`FAILED: ${describeError(err)}`)
      }
    } else {
      log.push('navigator.share is not available in this browser')
    }

    // ── Fallback: open the PDF in a new tab ─────────────────────────────────
    log.push('Falling back to window.open')
    const opened = window.open(getUrl(), '_blank')
    if (!opened) {
      // Popups are blocked, or the app is running as a home-screen app that
      // has no tab to open. The tech still has the PDF in the preview.
      reportError('share', new Error(
        'the PDF could not be opened in a new tab (pop-up blocked, or the app is running from the home screen with no browser tab)',
      ), { step: 'window.open', filename, standalone: getEnvironment().standalone })
      log.push('window.open returned null — new tab was not opened')
    } else {
      log.push('window.open succeeded')
    }

    onSuccess?.()
    showDebug(log)
  } finally {
    releaseOwnUrl()
  }
}

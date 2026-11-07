/**
 * pdfWorkerClient.js — Shared Comlink client for the PDF-generation Web
 * Worker (src/workers/pdfGen.worker.js).
 *
 * One worker is created lazily and reused for every PDF generation across
 * every wizard for the lifetime of the app session. This moves PDF generation
 * off the main thread: the template load, every field draw, and JPEG
 * re-compression of attached photos all run on a background thread.
 *
 * ── Worker crash recovery ─────────────────────────────────────────────────
 * A Web Worker can die silently (most commonly from running out of memory on
 * a large photo batch). When that happens the in-flight call never settles,
 * and every later call to that same instance also hangs.
 *
 * Two layers of recovery:
 *   1. Proactive: the worker's own 'error' and 'messageerror' events tear
 *      that worker down immediately, so the next call starts fresh.
 *   2. Reactive: each call races an internal timeout (shorter than the UI's
 *      30-second timeout in usePdfGenerate). If it fires, the worker that
 *      made the call is torn down, so a retry gets a healthy worker.
 *
 * Teardown is scoped to the instance that failed. Earlier versions tore down
 * whichever worker was current, so a stale timeout could kill a newer worker
 * that another call was relying on.
 *
 * Usage (see any wizard file for a live example):
 *   import { createWorkerGenerator } from '../shared/pdfWorkerClient'
 *   const generatePolePdf = createWorkerGenerator('PolePdfGenerator', 'generatePolePdf')
 *   const { triggerGenerate, ... } = usePdfGenerate(generatePolePdf)
 *
 * createWorkerGenerator returns a two-argument function, so usePdfGenerate
 * calls it directly (it only resolves zero-argument thunks).
 */
import PdfGenWorker from '../workers/pdfGen.worker.js?worker'
import * as Comlink from 'comlink'

// Fires before usePdfGenerate's 30s UI-facing GENERATION_TIMEOUT_MS, so a
// wedged worker is detected and replaced here first.
const WORKER_CALL_TIMEOUT_MS = 25_000

// The shared instance: { worker, api } or null.
let current = null

/**
 * Terminate a specific worker instance and clear it as the shared one only if
 * it is still the current one. Calling this with a stale instance is a no-op
 * for the replacement, which is the point of scoping it.
 */
function destroyInstance(instance) {
  if (!instance) return
  try { instance.worker.terminate() } catch (_) { /* already dead — fine */ }
  if (current === instance) current = null
}

function getInstance() {
  if (current) return current

  const worker = new PdfGenWorker()
  const instance = { worker, api: Comlink.wrap(worker) }

  // Proactive recovery: an uncaught worker error or an undeserialisable
  // message means this instance is no longer trustworthy.
  const onFailure = (event) => {
    console.error('[pdfWorkerClient] PDF worker crashed — it will be recreated on the next request', event)
    destroyInstance(instance)
  }
  worker.addEventListener('error', onFailure)
  worker.addEventListener('messageerror', onFailure)

  current = instance
  return instance
}

/**
 * @param {string} generatorKey - Key in the worker's GENERATORS registry (e.g. 'PolePdfGenerator')
 * @param {string} exportName   - Named export in that module (e.g. 'generatePolePdf')
 * @returns {(d: object, photos: Array) => Promise<Uint8Array>}
 */
export function createWorkerGenerator(generatorKey, exportName) {
  return async (d, photos) => {
    const instance = getInstance()

    let timeoutId = null
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('PDF_WORKER_TIMEOUT')), WORKER_CALL_TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([
        instance.api.generate(generatorKey, exportName, d, photos),
        timeout,
      ])
      clearTimeout(timeoutId)
      return result
    } catch (err) {
      clearTimeout(timeoutId)
      // Whether this was a real rejection or our timeout firing because the
      // worker went silent, this instance can't be trusted: replace it so
      // the next attempt (e.g. the tech tapping Retry) starts clean.
      console.error('[pdfWorkerClient] PDF generation failed or hung — recreating worker', err)
      destroyInstance(instance)
      throw err
    }
  }
}

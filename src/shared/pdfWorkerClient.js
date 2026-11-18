/**
 * pdfWorkerClient.js — Shared Comlink client for the PDF-generation Web
 * Worker (src/workers/pdfGen.worker.js).
 *
 * One worker is created lazily and reused for every PDF generation. If it
 * crashes, wedges, or fails to start, it is torn down and recreated on the
 * next request.
 *
 * Error reporting
 * ───────────────
 * Each failure is tagged with a stage so the message says what happened:
 *   worker-start    the worker could not be created at all
 *   worker-crash    the worker itself stopped (uncaught error in the worker)
 *   worker-timeout  the worker did not answer within WORKER_CALL_TIMEOUT_MS
 *   worker-call     the generator ran and threw (message comes from the generator)
 * Every failure is written to the error log with the generator name and
 * how many photos were involved.
 */
import PdfGenWorker from '../workers/pdfGen.worker.js?worker'
import * as Comlink from 'comlink'
import { reportError, withStage } from './errorLog'

// Fires before usePdfGenerate's 30s UI-facing GENERATION_TIMEOUT_MS, so a
// wedged worker is detected and replaced here first.
const WORKER_CALL_TIMEOUT_MS = 25_000

// The shared instance: { worker, api, createdAt } or null.
let current = null

function destroyInstance(instance) {
  if (!instance) return
  try { instance.worker.terminate() } catch (_) { /* already dead */ }
  if (current === instance) current = null
}

/** Readable text for a worker ErrorEvent or MessageEvent. */
function describeWorkerEvent(event) {
  if (!event) return 'no details were given by the browser'
  if (event.type === 'messageerror') {
    return 'a message from the worker could not be read (messageerror)'
  }
  const where = event.filename ? ` at ${event.filename}:${event.lineno}:${event.colno}` : ''
  return `${event.message || 'unknown error'}${where}`
}

function getInstance() {
  if (current) return current

  let worker
  try {
    worker = new PdfGenWorker()
  } catch (err) {
    throw withStage(err, 'worker-start')
  }

  const instance = { worker, api: Comlink.wrap(worker), createdAt: Date.now() }

  // Proactive recovery: an uncaught worker error or an unreadable message
  // means this instance is no longer trustworthy.
  const onFailure = (event) => {
    const err = withStage(new Error(`the PDF worker stopped: ${describeWorkerEvent(event)}`), 'worker-crash')
    reportError('pdf-worker', err, {
      event: event?.type,
      ageSeconds: Math.round((Date.now() - instance.createdAt) / 1000),
    })
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
    let instance
    try {
      instance = getInstance()
    } catch (err) {
      reportError('pdf-worker', err, { generator: generatorKey, export: exportName })
      throw err
    }

    let timeoutId = null
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(withStage(
          new Error(
            `the PDF worker did not answer within ${WORKER_CALL_TIMEOUT_MS / 1000} seconds ` +
            `(${generatorKey}.${exportName}). It has been restarted, so try again.`,
          ),
          'worker-timeout',
        ))
      }, WORKER_CALL_TIMEOUT_MS)
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
      const stage = err?.stage ?? 'worker-call'
      const wrapped = withStage(err, stage)
      reportError('pdf-worker', wrapped, {
        generator: generatorKey,
        export: exportName,
        stage,
        photos: photos?.length ?? 0,
        workerAgeSeconds: Math.round((Date.now() - instance.createdAt) / 1000),
      })
      // Whether this was a real rejection or a timeout, the instance can't be
      // trusted; replace it so the next attempt starts clean.
      destroyInstance(instance)
      throw wrapped
    }
  }
}

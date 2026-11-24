/**
 * pdfGen.worker.js — Comlink-based Web Worker for off-main-thread PDF generation.
 *
 * Don't call this file directly — go through pdfWorkerClient.js:
 *
 *   import { createWorkerGenerator } from '../shared/pdfWorkerClient'
 *   const generateXPdf = createWorkerGenerator('XPdfGenerator', 'generateXPdf')
 *
 * Every generator must be listed in GENERATORS below with an explicit dynamic
 * import so Vite can split it into its own lazy-loaded chunk.
 */

import * as Comlink from 'comlink'

// ── Generator registry ────────────────────────────────────────────────────────
const GENERATORS = {
  DistributionTransformerPdfGenerator:
    () => import('../wizards/generators/DistributionTransformerPdfGenerator.js'),
  EarthTestPdfGenerator:
    () => import('../wizards/generators/EarthTestPdfGenerator.js'),
  ElecEquipPdfGenerator:
    () => import('../wizards/generators/ElecEquipPdfGenerator.js'),
  ElecDistributionPdfGenerator:
    () => import('../wizards/generators/ElecDistributionPdfGenerator.js'),
  HVInspectionPdfGenerator:
    () => import('../wizards/generators/HVInspectionPdfGenerator.js'),
  LvBoxPdfGenerator:
    () => import('../wizards/generators/LvBoxPdfGenerator.js'),
  LvConnectionPdfGenerator:
    () => import('../wizards/generators/LvConnectionPdfGenerator.js'),
  PolePdfGenerator:
    () => import('../wizards/generators/PolePdfGenerator.js'),
  TransformerPdfGenerator:
    () => import('../wizards/generators/TransformerPdfGenerator.js'),
  ZoneSubPdfGenerator:
    () => import('../wizards/generators/ZoneSubPdfGenerator.js'),
  DistPanelPdfGenerator:
    () => import('../wizards/generators/DistPanelPdfGenerator.js'),
  StreetlightPdfGenerator:
    () => import('../wizards/generators/StreetlightPdfGenerator.js'),
  CableTestPdfGenerator:
    () => import('../wizards/generators/CableTestPdfGenerator.js'),
  ConductorTensionPdfGenerator:
    () => import('../wizards/generators/ConductorTensionPdfGenerator.js'),
}

// ── Exposed API ───────────────────────────────────────────────────────────────

Comlink.expose({
  /**
   * Load a generator module, run it, and return the PDF bytes.
   *
   * @param {string} generatorKey  - Key in GENERATORS (e.g. 'ElecEquipPdfGenerator')
   * @param {string} exportName    - Named export in the module  (e.g. 'generateEEPdf')
   * @param {object} d             - Wizard form state
   * @param {Array}  photos        - Photo attachments [{ dataUrl, name? }]
   * @returns {Promise<Uint8Array>}  Transferred zero-copy to the main thread
   */
  async generate(generatorKey, exportName, d, photos) {
    const loader = GENERATORS[generatorKey]
    if (!loader) {
      throw new Error(`[pdfGen.worker] Unknown generator: "${generatorKey}". ` +
        `Valid keys: ${Object.keys(GENERATORS).join(', ')}`)
    }

    const mod = await loader()
    const fn  = mod[exportName]
    if (typeof fn !== 'function') {
      throw new Error(
        `[pdfGen.worker] Export "${exportName}" is not a function in ${generatorKey}`
      )
    }

    const bytes = await fn(d, photos)

    // Transfer the underlying ArrayBuffer zero-copy back to the main thread.
    return Comlink.transfer(bytes, [bytes.buffer])
  },
})


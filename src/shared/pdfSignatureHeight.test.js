// The field renderer must place a signature using the page's own height, so a
// landscape page doesn't put it where an A4 portrait page would.
import { describe, it, expect } from 'vitest'
import { renderFields } from './pdfFieldRenderer'

function fakePage(height) {
  const calls = []
  return {
    calls,
    getHeight: () => height,
    drawImage: (img, opts) => calls.push(opts),
  }
}

const pdfDoc = {
  embedPng: async () => ({ scale: () => ({ width: 100, height: 20 }) }),
  embedJpg: async () => ({ scale: () => ({ width: 100, height: 20 }) }),
}

// 1x1 transparent PNG as a data URL (only the data: prefix matters to drawSignature's guard).
const SIG = 'data:image/png;base64,iVBORw0KGgo='

describe('signature placement on landscape pages', () => {
  it('uses the page height, not the A4 default', async () => {
    const page = fakePage(595)
    const fields = { sig: { type: 'signature', x: 10, y: 100, maxW: 100, maxH: 20, value: () => SIG } }
    await renderFields({ pdfDoc, page, draw: {} }, fields, {})
    // pdf-lib y = pageHeight - cssY - drawHeight; drawH = 20 here (scale 1 fits 100x20 into 100x20).
    expect(page.calls[0].y).toBe(595 - 100 - 20)
  })
})

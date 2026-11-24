/**
 * ConductorTensionPdfGenerator.js — PDF generator for 360S014EQ
 * (Commissioning Conductor Tensioning Method & Results Per Run Form).
 *
 * Two A4 portrait pages. Page 1 is the run record; page 2 holds the static
 * tensioning explanation and the comments area.
 *
 * Positions are measured from the printed labels on the blank form with
 * pdfplumber. Project standard: a value's baseline sits 2.5pt above the
 * baseline of its printed label, so cssY = labelBaseline − 2.5 − FS. A value
 * starts just after its label text (or leader dots), never on top of it.
 * Checkbox ticks are centred on the printed box (x = centre − 4.5,
 * cssY = centre − 7). All Y values are TOP-ORIGIN.
 *
 * Values that can run long use FIT entries: they start after their label and
 * shrink to fit before the next printed label, so they never overprint it.
 *
 * @param {object} d      - Wizard form state (see ConductorTensionWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument } from 'pdf-lib'
import { embedAppFont, fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EQ.pdf`

const FS = 8.5

// Value on a label's row. `base` is the printed label baseline (top-origin).
const lineY = base => base - 2.5 - FS
const at = (x, base, value) => ({ type: 'text', align: 'left', x, y: lineY(base), size: FS, value })

// Tick centred on a printed checkbox. cx/cy are the box centre.
const box = (cx, cy, value) => ({ type: 'check', x: cx - 4.5, y: cy - 7, value })

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — values that fit their space comfortably. Rendered by renderFields.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  p1: {
    // ── Header ─────────────────────────────────────────────────────────────────
    streetRoad:     at(108, 114.6, d => d.streetRoad),          // after "No./Street/Road" dots
    companyName:    at(412, 116.2, d => d.contractor),          // after "Company Name:"
    cityTown:       at(106, 132.9, d => d.cityTown),            // after "City/ Town:"
    district:       at(262, 132.9, d => d.district),            // after "District:"
    supervisorName: at(432, 132.9, d => d.siteSupervisorName),  // after "Site Supervisor Name:"
    pcoWONo:        at(101, 149.4, d => d.pcoWONo),             // after "PCo W/O No."
    ciwrNo:         at(270, 149.4, d => d.ciwrNo),              // after "CIWR No:" (was over "No:")
    signed:         { type: 'signature', x: 384, y: 150, maxW: 170, maxH: 13, value: d => d.signed },
    jobCostCode:    at(145, 166.1, d => d.npJobNumber),         // after "Contractor Job Cost Code:"
    irNo:           at(259, 166.1, d => d.irNo),                // after "IR No:"
    namePrint:      at(404, 167.5, d => d.namePrint),           // after "Name (Print):"

    // ── Pole numbers — planning stage ──────────────────────────────────────────
    conductorType:  at(409, 223.0, d => d.conductorType),       // after "Conductor Type:" (was over "Type:")

    // ── Pole numbers — after site installation ─────────────────────────────────
    noPoleChange:   box(544.3, 236.3, d => d.noPoleChange),

    // ── Test date / conditions ────────────────────────────────────────────────
    dateOfTest:     at(88,  280.0, d => d.dateOfTest),          // after "Date of Test"
    timeOfTest:     at(396, 280.0, d => d.timeOfTest),          // after "Time of Test:"

    // ── Tensioning method — checkboxes ─────────────────────────────────────────
    methodDynamometer: box(65.5, 334.6, d => d.tensionMethod === 'Dynamometer'),
    methodSightBoard:  box(65.5, 361.0, d => d.tensionMethod === 'Sight Board'),
    methodReturnWaves: box(65.5, 404.2, d => d.tensionMethod === 'Return Waves'),
    photosIncluded:    box(66.1, 449.6, d => d.photosIncluded),

    // ── Tensioning details — by method ─────────────────────────────────────────
    sightSpanLen:  at(329, 366.5, d => (d.tensionMethod === 'Sight Board' ? d.spanLengthSight : '')),
    waveSpanLen:   at(329, 435.0, d => (d.tensionMethod === 'Return Waves' ? d.spanLengthWaves : '')),

    // ── Conductor clearance ───────────────────────────────────────────────────
    clearanceAccessWay:    box(66.4, 537.7, d => d.clearanceType === 'Access Way'),
    clearanceRoadCrossing: box(66.4, 560.4, d => d.clearanceType === 'Road Crossing'),
    clearanceValueAccess:  at(282, 544.7, d => (d.clearanceType === 'Access Way' ? d.clearanceValue : '')),
    clearanceValueRoad:    at(282, 568.8, d => (d.clearanceType === 'Road Crossing' ? d.clearanceValue : '')),
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// FIT — values that must shrink to fit a limited space. Each starts after its
// printed label and stops before the next printed label (maxRight).
// ─────────────────────────────────────────────────────────────────────────────

export const FIT = {
  p1: [
    // Planning pole numbers: after "Between Poles" (label ends ~100), before the "&" (172.9)
    { key: 'planPoleA',      x: 103, base: 223.0, maxRight: 166, value: d => d.planPoleA },
    // After "&" (178.6); leader dots run to 257.5
    { key: 'planPoleB',      x: 186, base: 223.0, maxRight: 256, value: d => d.planPoleB },
    // Confirmed pole numbers, same columns as the planning row
    { key: 'confirmedPoleA', x: 103, base: 256.9, maxRight: 166, value: d => (d.noPoleChange ? '' : d.confirmedPoleA) },
    { key: 'confirmedPoleB', x: 186, base: 256.9, maxRight: 256, value: d => (d.noPoleChange ? '' : d.confirmedPoleB) },
    // After "Temperature" (ends ~240), before "Time of Test" (347.5)
    { key: 'ambientTemp',    x: 243, base: 280.0, maxRight: 344, value: d => d.ambientTemp },
    // After "Tension:" (ends 310.4)
    { key: 'tension',        x: 313, base: 343.4, maxRight: 552, value: d => (d.tensionMethod === 'Dynamometer' ? d.tension : '') },
    // After "Sag:" (ends ~300)
    { key: 'sightSag',       x: 302, base: 389.2, maxRight: 552, value: d => (d.tensionMethod === 'Sight Board' ? d.sag : '') },
    // After "Time:" (ends ~302)
    { key: 'waveTime',       x: 305, base: 412.3, maxRight: 552, value: d => (d.tensionMethod === 'Return Waves' ? d.waveTime : '') },
  ],
}

/**
 * Shrink a font size (down to 5pt) until `text` fits within `maxWidth`.
 */
export function fitSize(font, text, maxWidth) {
  const str = String(text)
  let size = FS
  while (size > 5 && font.widthOfTextAtSize(str, size) > maxWidth) size -= 0.5
  return size
}

/**
 * Split comments across the two printed dotted lines on page 2.
 * Line 1 starts after "Comments:" (x 84, baseline 251.6, width 469).
 * Line 2 runs the full width (x 42.6, baseline 274.3, width 510).
 * Text beyond two lines is not printed, as the form has no room for it.
 */
export const COMMENTS = {
  size: FS,
  line1: { x: 84,   base: 251.6, maxWidth: 469 },
  line2: { x: 42.6, base: 274.3, maxWidth: 510 },
}

export function splitComments(wrap, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return []
  const first = wrap(t, COMMENTS.line1.maxWidth)[0] || ''
  const rest = t.slice(first.length).trim()
  const second = rest ? (wrap(rest, COMMENTS.line2.maxWidth)[0] || '') : ''
  return [first, second].filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCtPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await embedAppFont(pdfDoc)
  const [p1, p2]      = pdfDoc.getPages()
  const draw1         = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2         = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)

  // ── Fit-to-space values (calibration mode prints the key, as renderFields does)
  for (const item of FIT.p1) {
    const raw = d.__calibrate ? item.key : item.value(d)
    if (raw === undefined || raw === null || raw === '') continue
    const size = fitSize(font, raw, item.maxRight - item.x)
    draw1.t(item.x, item.base - 2.5 - size, raw, size)
  }

  // ── Page 2: comments across the two printed lines ───────────────────────────
  const wrap2 = (t, w) => draw2.wrapText(t, w, COMMENTS.size)
  const lines = d.__calibrate ? ['comments'] : splitComments(wrap2, d.comments)
  if (lines[0]) draw2.t(COMMENTS.line1.x, lineY(COMMENTS.line1.base), lines[0], COMMENTS.size)
  if (lines[1]) draw2.t(COMMENTS.line2.x, lineY(COMMENTS.line2.base), lines[1], COMMENTS.size)

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}

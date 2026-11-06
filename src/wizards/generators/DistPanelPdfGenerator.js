/**
 * DistPanelPdfGenerator.js — PDF generator for 360S014EI
 * (As-built Underground Network Distribution Panel Layout Record).
 *
 * Single landscape page. Positions are taken from the template's own field
 * rectangles (widget boxes) and printed word positions, so values sit inside
 * their boxes. All Y values are TOP-ORIGIN.
 *
 * Printed selectors
 * ─────────────────
 * The Link/Fuse and Open/Close choice fields are removed from the generated
 * PDF, and the static "Link/Fuse" and "Open/Close" words printed in the
 * template are painted over in white. A row the tech hasn't touched therefore
 * prints blank. A chosen value is drawn as plain text in the same cell.
 *
 * @param {object} d      - Wizard form state (see DistPanelWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, rgb } from 'pdf-lib'
import { embedAppFont, fetchPdfTemplate, createPageDrawer, drawSignature, DEFAULT_INK } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EI.pdf`

// Choice widgets that print "Link/Fuse" and "Open/Close" by default.
export const PRINTED_SELECTOR_FIELDS = Array.from({ length: 8 }, (_, k) => k + 1).flatMap(n =>
  ['a', 'b'].flatMap(letter => [
    `FuseLink_${n}${letter}_14EI`,
    `OpenClose_${n}${letter}_14EI`,
  ]),
)

// Static words printed in the template for every row. Found by text
// extraction; top is the top of the word in top-origin points.
export const PRINTED_WORDS = {
  height: 7,
  linkX: [246.9, 275.2],
  openX: [300.9, 336.7],
  tops: [256.5, 274.9, 292.8, 311.1, 329.0, 347.5, 365.4, 383.7,
         401.6, 420.1, 438.0, 456.4, 474.2, 492.7, 510.6, 529.0],
}

function removePrintedSelectors(pdfDoc) {
  const form = pdfDoc.getForm()
  for (const name of PRINTED_SELECTOR_FIELDS) {
    const field = form.getFieldMaybe(name)
    if (field) form.removeField(field)
  }
}

function coverPrintedWords(page, pageHeight) {
  const pad = 0.6
  const h = PRINTED_WORDS.height + pad * 2
  for (const top of PRINTED_WORDS.tops) {
    for (const [x0, x1] of [PRINTED_WORDS.linkX, PRINTED_WORDS.openX]) {
      page.drawRectangle({
        x: x0 - pad,
        y: pageHeight - (top - pad) - h,
        width: (x1 - x0) + pad * 2,
        height: h,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      })
    }
  }
}

const hasFuseWay = (d, v) => (d.fuseWays || []).includes(v)

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — header, panel details and fuse-way ticks.
// Text: x = field left + 2, cssY = field vertical centre − 5.5 (8.5pt).
// Ticks: x = box centre − 4.5, cssY = box centre − 7 (matches ck() geometry).
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  streetRoad:            { type: 'text', align: 'left', x:  92.0, y: 68.8,  value: d => d.streetRoad },
  contractor:            { type: 'text', align: 'left', x: 450.7, y: 68.8,  value: d => d.contractor },
  cityTown:              { type: 'text', align: 'left', x:  83.8, y: 84.9,  value: d => d.cityTown },
  district:              { type: 'text', align: 'left', x: 252.6, y: 83.8,  value: d => d.district },
  dateWorkCompleted:     { type: 'text', align: 'left', x: 487.5, y: 86.1,  value: d => d.dateWorkCompleted },
  boxTransformerId:      { type: 'text', align: 'left', x: 111.6, y: 99.9,  value: d => d.boxTransformerId },
  namePrint:             { type: 'text', align: 'left', x: 663.1, y: 99.6,  value: d => d.namePrint },
  ciwrNo:                { type: 'text', align: 'left', x:  78.5, y: 115.3, value: d => d.ciwrNo },
  pcoWONo:               { type: 'text', align: 'left', x: 252.6, y: 116.1, value: d => d.pcoWONo },
  // The job cost code is the NP Job Number, as on the Earth Test record.
  contractorJobCostCode: { type: 'text', align: 'left', x: 495.7, y: 113.9, value: d => d.npJobNumber },

  // ── Panel details ──────────────────────────────────────────────────────────
  panelManufacturer: { type: 'text', align: 'left', x: 119.1, y: 155.9, value: d => d.panelManufacturer },
  panelMaterial:     { type: 'text', align: 'left', x: 280.4, y: 155.2, value: d => d.panelMaterial },

  ownershipPowerco:   { type: 'check', x: 469.7, y: 155.9, value: d => d.ownership === 'Powerco' },
  ownershipPrivate:   { type: 'check', x: 547.8, y: 155.2, value: d => d.ownership === 'Private' },
  ownershipOther:     { type: 'check', x: 625.9, y: 154.4, value: d => d.ownership === 'Other' },
  ownershipOtherText: {
    type: 'text', align: 'left', x: 701.3, y: 153.3,
    value: d => (d.ownership === 'Other' ? d.ownershipOther : ''),
  },

  // ── Fuse ways (multi-select) ───────────────────────────────────────────────
  fuseWay3:     { type: 'check', x: 108.1, y: 181.1, value: d => hasFuseWay(d, '3') },
  fuseWay3_5:   { type: 'check', x: 163.6, y: 180.0, value: d => hasFuseWay(d, '3.5') },
  fuseWay4:     { type: 'check', x: 226.6, y: 180.7, value: d => hasFuseWay(d, '4') },
  fuseWay6:     { type: 'check', x: 292.7, y: 180.3, value: d => hasFuseWay(d, '6') },
  fuseWay8:     { type: 'check', x: 355.7, y: 181.1, value: d => hasFuseWay(d, '8') },
  fuseWayOther: { type: 'check', x: 419.0, y: 179.9, value: d => hasFuseWay(d, 'Other') },
  fuseWaySLR:   { type: 'check', x: 627.0, y: 180.0, value: d => hasFuseWay(d, 'Street Light Relay') },
  fuseWayOtherText: {
    type: 'text', align: 'left', x: 465.7, y: 177.0,
    value: d => (hasFuseWay(d, 'Other') ? d.fuseWayOther : ''),
  },
}

// Signature sits on the "Signed:" line (widget 438–590 × 100–112 top-origin).
// Drawn directly in the generator because renderFields does not pass this
// landscape page's height to drawSignature.
export const SIGNATURE = { x: 439.5, y: 99.8, maxW: 150, maxH: 12 }

// Photo Attached tick — shown when at least one photo is attached.
export const PHOTO_TICK = { x: 547.0, y: 138.6 }

// Printed position markers on the right of the table: the number for each
// position, and the a and b label for each row. Centres from text extraction.
// Used carriers are circled.
export const POSITION_MARKS = {
  numberX: 590.8,
  letterX: 555.4,
  // Digits: visual centre of the number (baseline minus half the cap height).
  // a and b: centre of each half-row box, from the template's row rules.
  number: [268.6, 305.0, 341.3, 377.6, 413.9, 450.3, 486.5, 522.9],
  a:      [258.57, 294.97, 331.22, 367.57, 403.82, 440.18, 476.47, 512.77],
  b:      [276.72, 313.12, 349.37, 385.72, 421.97, 458.32, 494.62, 530.93],
  numberRadius: { rx: 9.0, ry: 9.5 },
  letterRadius: { rx: 6.0, ry: 7.0 },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — the 16-row panel table (1a to 8b).
// rowY is the vertical centre of each row's Destination box, less 4.9 (7.5pt).
// Columns use the widget boxes: centred cells take the box left edge and width.
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  ways: {
    size: 7.5,
    rowY: [254.2, 273.0, 291.05, 308.8, 326.8, 344.3, 362.3, 381.8,
           400.3, 418.05, 435.55, 455.1, 472.9, 490.4, 509.65, 527.4],
    cols: {
      destination:  { x:  32.5, align: 'left' },
      manufacturer: { x: 122.1, align: 'center', width: 56.0 },
      model:        { x: 179.1, align: 'center', width: 56.0 },
      linkFuse:     { x: 241.6, align: 'center', width: 48.0 },
      openClose:    { x: 297.1, align: 'center', width: 56.6 },
      fuseSize:     { x: 410.7, align: 'left' },
      holderRating: { x: 497.2, align: 'left' },
      cableDesc:    { x: 626.3, align: 'left' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEiPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await embedAppFont(pdfDoc)

  removePrintedSelectors(pdfDoc)

  const [p1]       = pdfDoc.getPages()
  const { height } = p1.getSize()
  const draw       = createPageDrawer(p1, font, DEFAULT_INK, height)

  coverPrintedWords(p1, height)

  await renderFields({ pdfDoc, page: p1, draw }, FIELDS, d)

  const { rowY, cols, size } = GRIDS.ways
  ;(d.ways || []).slice(0, rowY.length).forEach((row, i) => {
    renderGridRow(draw, cols, rowY[i], row, size)
  })

  // Circle the printed number for a full-width carrier, and the a or b label for a half.
  ;(d.slots || []).forEach((s, k) => {
    if (!s) return
    if (s.full) draw.circ(POSITION_MARKS.numberX, POSITION_MARKS.number[k],
      POSITION_MARKS.numberRadius.rx, POSITION_MARKS.numberRadius.ry, true, 0.9)
    if (s.a) draw.circ(POSITION_MARKS.letterX, POSITION_MARKS.a[k],
      POSITION_MARKS.letterRadius.rx, POSITION_MARKS.letterRadius.ry, true, 0.9)
    if (s.b) draw.circ(POSITION_MARKS.letterX, POSITION_MARKS.b[k],
      POSITION_MARKS.letterRadius.rx, POSITION_MARKS.letterRadius.ry, true, 0.9)
  })

  if ((photos || []).length > 0) draw.ck(PHOTO_TICK.x, PHOTO_TICK.y, true)

  if (!d.__calibrate && d.signed) {
    await drawSignature(pdfDoc, p1, d.signed, SIGNATURE.x, SIGNATURE.y, SIGNATURE.maxW, SIGNATURE.maxH, height)
  }

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}

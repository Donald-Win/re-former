/**
 * EarthTestPdfGenerator.js — PDF generator for 360S014EJ
 * (AS-Built Earth Installation and Test Record).
 *
 * Single A4 portrait page. Every field is a named entry in FIELDS (see
 * DistributionTransformerPdfGenerator.js for the pattern). The Earth 1 /
 * Earth 2 results table is two mirrored columns, so each cell is simply a
 * pair of fields at mirrored x positions (same approach as the Transformer
 * record's Issued / Removed pairs).
 *
 * Comments are the one thing that isn't a plain field: the form gives two
 * dotted lines of different lengths (the first starts after the printed
 * "Comments" label, the second runs the full width), so the text is split
 * across them by splitComments() below. Anything beyond two lines is not
 * drawn — there is no more room on the form.
 *
 * The dimensioned plan (grid + north-arrow circle) is drawn by hand on the
 * printed form, same as the other forms that carry a plan.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d      - Wizard form state (see EarthTestWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument } from 'pdf-lib'
import { embedAppFont, fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EJ.pdf`

const FS = 10

// Safe accessors for the two earth columns
const e1 = d => d.earth1 || {}
const e2 = d => d.earth2 || {}

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {

  // ── Header — left block ─────────────────────────────────────────────────────
  streetRoad:            { type: 'text', align: 'left', x: 106, y:  89, size: FS, value: d => d.streetRoad },
  cityTown:              { type: 'text', align: 'left', x:  92, y: 107, size: FS, value: d => d.cityTown },
  district:              { type: 'text', align: 'left', x: 232, y: 107, size: FS, value: d => d.district },
  pcoWONo:               { type: 'text', align: 'left', x:  99, y: 124, size: FS, value: d => d.pcoWONo },
  ciwrNo:                { type: 'text', align: 'left', x: 238, y: 124, size: FS, value: d => d.ciwrNo },
  siteId:                { type: 'text', align: 'left', x: 106, y: 140, size: FS, value: d => d.siteId },
  equipmentEarthed:      { type: 'text', align: 'left', x: 120, y: 160, size: FS, value: d => d.equipmentEarthed },

  // ── Header — right block ────────────────────────────────────────────────────
  installedTestedBy:     { type: 'text', align: 'left', x: 425, y:  91, size: FS, value: d => d.contractor },
  dateInstalledTested:   { type: 'text', align: 'left', x: 434, y: 107, size: FS, value: d => d.dateWorkCompleted },
  signed:                { type: 'signature', x: 384, y: 113, maxW: 120, maxH: 20, value: d => d.signed },
  namePrint:             { type: 'text', align: 'left', x: 403, y: 142, size: FS, value: d => d.namePrint },
  contractorJobCostCode: { type: 'text', align: 'left', x: 447, y: 162, size: FS, value: d => d.contractorJobCostCode },

  // ── Earth test type ─────────────────────────────────────────────────────────
  testTypeNew:       { type: 'check', x: 102, y: 198, value: d => d.earthTestType === 'New' },
  testTypeAltered:   { type: 'check', x: 154, y: 198, value: d => d.earthTestType === 'Altered Earth' },
  testTypeTestOnly:  { type: 'check', x: 244, y: 198, value: d => d.earthTestType === 'Test Only' },
  testTypeEndOfLine: { type: 'check', x: 350, y: 198, value: d => d.earthTestType === 'End of Line Earth' },

  // ── Earth test results — Earth 1 (cell 241–400) / Earth 2 (cell 400–558) ────
  // Resistance is right-aligned so it finishes just before the printed Ω.
  earth1Resistance: { type: 'text', align: 'right', x: 372, y: 243, size: FS, value: d => e1(d).resistance },
  earth2Resistance: { type: 'text', align: 'right', x: 529, y: 243, size: FS, value: d => e2(d).resistance },
  // Total M.E.N is ONE combined value for the whole installation (not per
  // earth). It sits in the Earth 1 cell, finishing just before that cell's Ω.
  totalMEN:         { type: 'text', align: 'right', x: 372, y: 260, size: FS, value: d => d.totalMEN },
  // Rods / depth / equipment number are centred in their cells.
  earth1Rods:       { type: 'text', align: 'center', x: 241, width: 159, y: 277, size: FS, value: d => e1(d).rods },
  earth2Rods:       { type: 'text', align: 'center', x: 400, width: 158, y: 277, size: FS, value: d => e2(d).rods },
  earth1Depth:      { type: 'text', align: 'center', x: 241, width: 159, y: 294, size: FS, value: d => e1(d).depth },
  earth2Depth:      { type: 'text', align: 'center', x: 400, width: 158, y: 294, size: FS, value: d => e2(d).depth },

  // Conductor details — one conductor, Material in the Earth 1 cell, Size in the Earth 2 cell
  conductorMaterial: { type: 'text', align: 'left', x: 280, y: 311, size: FS, value: d => d.conductorMaterial },
  conductorSize:     { type: 'text', align: 'left', x: 425, y: 311, size: FS, value: d => d.conductorSize },

  // Equipment Number is ONE value for the installation (not per earth). It is
  // centred in the Earth 1 cell — move x/width here if it should sit elsewhere.
  equipmentNumber:  { type: 'text', align: 'center', x: 241, width: 159, y: 329, size: FS, value: d => d.equipmentNumber },

  // ── Below ground connection type ────────────────────────────────────────────
  connShearBolt: { type: 'check', x: 201, y: 354, value: d => d.belowGroundConnection === 'Shear Bolt' },
  connWelded:    { type: 'check', x: 279, y: 354, value: d => d.belowGroundConnection === 'Welded' },

  groundConditions: { type: 'text', align: 'left', x: 117, y: 370, size: FS, value: d => d.groundConditions },
  remarks:          { type: 'text', align: 'left', x:  81, y: 383, size: FS, value: d => d.remarks },

  // ── Other services in trench ────────────────────────────────────────────────
  servicesGas:     { type: 'check', x: 153, y: 405, value: d => (d.otherServicesInTrench || []).includes('Gas') },
  servicesTelecom: { type: 'check', x: 208, y: 405, value: d => (d.otherServicesInTrench || []).includes('Telecom') },
  servicesWater:   { type: 'check', x: 279, y: 405, value: d => (d.otherServicesInTrench || []).includes('Water') },
  // Only drawn while "Other" is ticked, so a stale value never bleeds onto the PDF.
  servicesOtherText: {
    type: 'text', align: 'left', x: 405, y: 406, size: FS,
    value: d => ((d.otherServicesInTrench || []).includes('Other') ? d.otherServicesOther : ''),
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS — two dotted lines of different lengths (see file header)
// ─────────────────────────────────────────────────────────────────────────────

export const COMMENTS = {
  size: 9,
  line1: { x: 204, y: 729, maxWidth: 349 },  // starts after the printed "Comments" label
  line2: { x:  46, y: 742, maxWidth: 506 },  // full-width second line
}

/**
 * Split `text` across the two comment lines. `wrap(text, maxWidth)` is the
 * page drawer's pure word-wrap helper (returns an array of lines). Line 2
 * keeps only its first wrapped line — the form has no third line.
 */
export function splitComments(wrap, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return []
  const first = wrap(t, COMMENTS.line1.maxWidth)[0] || ''
  const rest  = t.slice(first.length).trim()
  const second = rest ? (wrap(rest, COMMENTS.line2.maxWidth)[0] || '') : ''
  return [first, second].filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEjPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await embedAppFont(pdfDoc)
  const [p1]          = pdfDoc.getPages()
  const draw          = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw }, FIELDS, d)

  // ── Comments (split across the two dotted lines) ──────────────────────────
  const wrap = (text, maxWidth) => draw.wrapText(text, maxWidth, COMMENTS.size)
  const [c1, c2] = splitComments(wrap, d.comments)
  if (c1) draw.t(COMMENTS.line1.x, COMMENTS.line1.y, c1, COMMENTS.size)
  if (c2) draw.t(COMMENTS.line2.x, COMMENTS.line2.y, c2, COMMENTS.size)

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}

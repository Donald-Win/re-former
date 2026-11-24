/**
 * CableTestPdfGenerator.js — PDF generator for 360S014EL
 * (As-built Cable Test Report).
 *
 * Two A4 portrait pages. The blank form has no editable fields, so every
 * position was measured from the blank PDF with pdfplumber:
 *   - each value's baseline sits 2.5pt above the printed label's baseline;
 *   - a value starts just after its label's text (or its colon);
 *   - checkbox ticks are centred on the printed box.
 * All Y values are TOP-ORIGIN.
 *
 * The schematic is the plan drawn in the SCHEMATIC box on page 1 (see
 * CABLE_TEST_LAYOUT in planLayouts.js), printed by the shared plan drawer.
 *
 * @param {object} d      - Wizard form state (see CableTestWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument } from 'pdf-lib'
import { embedAppFont, fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'
import { drawPlan } from '../../shared/planPdf'
import { CABLE_TEST_LAYOUT } from '../../shared/planLayouts'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EL.pdf`

const FS = 8.5

// draw.t takes the top of the text box, so cssY = labelBaseline − 2.5 − FS.
const lineY = base => base - 2.5 - FS

// A value on a label's row. `base` is the label baseline measured from the form.
const at = (x, base, value) => ({ type: 'text', align: 'left', x, y: lineY(base), size: FS, value })

// A tick centred on a printed checkbox. cx/cy are the box centre.
const box = (cx, cy, value) => ({ type: 'check', x: cx - 4.5, y: cy - 7, value })

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  p1: {
    // ── Header ─────────────────────────────────────────────────────────────────
    siteId:                at(76,  92.18,  d => d.siteId),
    streetRoad:            at(107, 112.34, d => d.streetRoad),
    cityTown:              at(101, 130.46, d => d.cityTown),
    district:              at(229, 130.46, d => d.district),
    pcoWONo:               at(108, 147.14, d => d.pcoWONo),
    ciwrNo:                at(242, 147.14, d => d.ciwrNo),
    contractorJobCostCode: at(141, 163.82, d => d.npJobNumber),
    testedBy:              at(392, 113.90, d => d.testedBy),
    dateTested:            at(400, 130.46, d => d.dateWorkCompleted),
    signed:                { type: 'signature', x: 384, y: 134, maxW: 130, maxH: 13, value: d => d.signed },
    namePrint:             at(402, 165.26, d => d.namePrint),

    // ── Cable test details ─────────────────────────────────────────────────────
    feederId:         at(84, 213.50, d => d.feederId),
    testInstallation: box(55.99,  234.16, d => d.testType === 'Installation'),
    testRetest:       box(134.72, 234.16, d => d.testType === 'Retest'),
    volt66kV:         box(198.59, 234.16, d => d.voltageClass === '66kV'),
    volt33kV:         box(255.29, 234.16, d => d.voltageClass === '33kV'),
    volt11kV:         box(312.00, 234.16, d => d.voltageClass === '11kV'),
    volt230400:       box(375.79, 234.16, d => d.voltageClass === '230/400'),
    voltOtherText:    at(462.7, 237.53, d => (d.voltageClass === 'Other' ? d.voltageOther : '')),

    // ── Cable description ──────────────────────────────────────────────────────
    csaCopper:        box(141.86, 485.47, d => d.csaType === 'Copper'),
    csaAluminium:     box(141.86, 509.77, d => d.csaType === 'Aluminium'),
    csaCopperSize:    at(183, 488.83, d => (d.csaType === 'Copper' ? d.csaSize : '')),
    csaAluminiumSize: at(194, 513.07, d => (d.csaType === 'Aluminium' ? d.csaSize : '')),
    phasesTick:       box(304.86, 485.47, d => !!d.phases),
    phases:           at(369, 488.83, d => d.phases),
    coresTick:        box(304.86, 509.77, d => !!d.cores),
    cores:            at(365, 513.07, d => d.cores),
    cablesTick:       box(432.56, 509.77, d => !!d.cables),
    cables:           at(494, 513.07, d => d.cables),

    insulationXLPE:      box(141.86, 534.09, d => d.insulation === 'XLPE'),
    insulationPILC:      box(212.81, 534.09, d => d.insulation === 'PILC'),
    insulationOther:     box(283.67, 534.09, d => d.insulation === 'Other'),
    insulationOtherText: at(355, 537.31, d => (d.insulation === 'Other' ? d.insulationOther : '')),
    armour:              at(122, 561.10, d => d.armour),

    // ── Insulation tests (left column: R-E, Y-E, B-E / right: R-B, R-Y, Y-B) ──
    rE: at(59,  616.18, d => d.rE),
    yE: at(59,  639.46, d => d.yE),
    bE: at(59,  662.74, d => d.bE),
    rB: at(310, 616.18, d => d.rB),
    rY: at(310, 639.46, d => d.rY),
    yB: at(310, 662.74, d => d.yB),

    // ── Test equipment ─────────────────────────────────────────────────────────
    testMake:    at(177, 717.84, d => d.testMake),
    testModel:   at(308, 717.84, d => d.testModel),
    testSerial:  at(449, 717.84, d => d.testSerial),
    test500V:    box(155.60, 738.36, d => d.testVoltage === '500V'),
    test1000V:   box(226.97, 738.36, d => d.testVoltage === '1000V'),
    test2500V:   box(297.83, 738.36, d => d.testVoltage === '2500V'),
    test5000V:   box(368.71, 738.36, d => d.testVoltage === '5000V'),
    powerMains:  box(155.60, 762.60, d => d.powerSupply === 'Mains'),
    powerOther:  box(226.97, 762.60, d => d.powerSupply === 'Other'),
    powerOtherText: at(264, 765.96, d => (d.powerSupply === 'Other' ? d.powerOther : '')),
  },

  p2: {
    // ── Phase polarity ─────────────────────────────────────────────────────────
    phaseR:        at(178, 129.62, d => d.phaseR),
    phaseY:        at(292, 129.62, d => d.phaseY),
    phaseB:        at(420, 129.62, d => d.phaseB),
    phaseMarkings: at(101, 152.90, d => d.phaseMarkings),
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOWED TEXT — text that runs over a few ruled lines (route, other tests).
// Each line has its own start x, baseline and width. Text that does not fit
// the last line is not printed, because the form has no room for more.
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_LINES = [
  { x: 89,   base: 263.45, maxWidth: 463 },
  { x: 42.6, base: 280.0,  maxWidth: 510 },
]

export const OTHER_TESTS_LINES = [
  { x: 135,  base: 176.18, maxWidth: 417 },
  { x: 42.6, base: 190.82, maxWidth: 510 },
  { x: 42.6, base: 205.46, maxWidth: 510 },
]

/**
 * Split `text` across `lines`. `wrap(text, maxWidth)` returns wrapped lines
 * (the page drawer's wrapText). Returns [{ x, base, maxWidth, text }].
 */
export function flowText(wrap, text, lines) {
  let rest = String(text || '').replace(/\s+/g, ' ').trim()
  const out = []
  for (const ln of lines) {
    if (!rest) break
    const first = wrap(rest, ln.maxWidth)[0] || ''
    if (!first) break
    out.push({ ...ln, text: first })
    rest = rest.slice(first.length).trim()
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateElPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await embedAppFont(pdfDoc)
  const [p1, p2]      = pdfDoc.getPages()
  const draw1         = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2         = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)
  await renderFields({ pdfDoc, page: p2, draw: draw2 }, FIELDS.p2, d)

  // ── Schematic — page 1, inside the SCHEMATIC box ──────────────────────────
  drawPlan({ page: p1, draw: draw1, font, plan: d.plan, layout: CABLE_TEST_LAYOUT, pageHeight: A4_HEIGHT })

  const wrap1 = (t, w) => draw1.wrapText(t, w, FS)
  flowText(wrap1, d.cableRoute, ROUTE_LINES)
    .forEach(l => draw1.t(l.x, lineY(l.base), l.text, FS))

  const wrap2 = (t, w) => draw2.wrapText(t, w, FS)
  flowText(wrap2, d.otherTests, OTHER_TESTS_LINES)
    .forEach(l => draw2.t(l.x, lineY(l.base), l.text, FS))

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}

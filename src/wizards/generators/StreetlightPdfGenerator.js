/**
 * StreetlightPdfGenerator.js — PDF generator for 360S014EK
 * (As-built Streetlight Alteration/Installation Record).
 *
 * Single A4 portrait page. Positions come from the widget rectangles of the
 * blank form's own editable fields (the template is an AcroForm with one
 * text/checkbox widget per value), so every value sits inside its field box.
 *
 *   Text (left):    x = widget left + 2,   cssY = widget bottom − 3.5 − size
 *   Text (centred): x = widget left, width = widget width, same cssY rule
 *                   (lamp cells use the centre of the widget, see below)
 *   Checkbox:       ck() draws a tick spanning (x..x+9, top+3..top+11), so
 *                   x = box centre − 4.5 and cssY = box centre − 7
 *
 * All Y values are TOP-ORIGIN.
 *
 * @param {object} d      - Wizard form state (see StreetlightWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument } from 'pdf-lib'
import { embedAppFont, fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'
import { drawPlan } from '../../shared/planPdf'
import { STREETLIGHT_LAYOUT } from '../../shared/planLayouts'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EK.pdf`

const FS = 9

// Lamp table: the widgets are the value cells. Text is centred in each cell
// (x and width from the widget), baseline placed on the cell's vertical centre.
const lampField = (which, field, x, width, cssY) => ({
  type: 'text', align: 'center', x, width, y: cssY, size: FS,
  value: d => (d[which] || {})[field],
})

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  p1: {
    // ── Header (widgets: StreetRoad, Contractor, Town, District, DateCompleted,
    //    PCo_WO, CIWR_No, ContractorCostCode, Signed, SignedName) ────────────
    streetRoad:        { type: 'text', align: 'left', x: 116.9, y:  87.4, size: FS, value: d => d.streetRoad },
    contractor:        { type: 'text', align: 'left', x: 402.0, y:  89.0, size: FS, value: d => d.contractor },
    cityTown:          { type: 'text', align: 'left', x:  97.3, y: 105.6, size: FS, value: d => d.cityTown },
    district:          { type: 'text', align: 'left', x: 235.5, y: 105.6, size: FS, value: d => d.district },
    dateWorkCompleted: { type: 'text', align: 'left', x: 445.7, y: 105.6, size: FS, value: d => d.dateWorkCompleted },
    pcoWONo:           { type: 'text', align: 'left', x: 103.4, y: 122.2, size: FS, value: d => d.pcoWONo },
    ciwrNo:            { type: 'text', align: 'left', x: 240.0, y: 122.2, size: FS, value: d => d.ciwrNo },
    signed:            { type: 'signature', x: 386.4, y: 121.6, maxW: 170, maxH: 11, value: d => d.signed },
    jobCostCode:       { type: 'text', align: 'left', x: 149.9, y: 138.9, size: FS, value: d => d.npJobNumber },
    namePrint:         { type: 'text', align: 'left', x: 406.6, y: 140.3, size: FS, value: d => d.namePrint },

    // ── Streetlight pole details (widgets: PoleOwner, PoleID, GPSfileNo) ─────
    nameOfOwner:    { type: 'text', align: 'center', x:  45.04, width: 151.64, y: 207.4, size: FS, value: d => d.nameOfOwner },
    lightPoleId:    { type: 'text', align: 'center', x: 231.97, width: 147.14, y: 207.4, size: FS, value: d => d.lightPoleId },
    gpsRoverFileNo: { type: 'text', align: 'center', x: 408.39, width: 147.14, y: 207.4, size: FS, value: d => d.gpsRoverFileNo },

    poleManufacturer: { type: 'text', align: 'left', x: 119.9, y: 229.1, size: FS, value: d => d.poleManufacturer },
    poleMaterial:     { type: 'text', align: 'left', x: 286.5, y: 229.1, size: FS, value: d => d.poleMaterial },
    poleHeight:       { type: 'text', align: 'left', x: 490.0, y: 229.1, size: FS, value: d => d.poleHeight },

    // ── Conductor details (widgets: Cond_OH, Cond_UG, Phase, CableSize, Material)
    conductorOverhead:    { type: 'check', x: 42.8,  y: 278.15, value: d => d.conductorType === 'Overhead' },
    conductorUnderground: { type: 'check', x: 133.6, y: 277.4,  value: d => d.conductorType === 'Underground' },
    phases:        { type: 'text', align: 'left', x: 263.3, y: 276.2, size: FS, value: d => d.phases },
    cableSize:     { type: 'text', align: 'left', x: 396.0, y: 276.2, size: FS, value: d => d.cableSize },
    cableMaterial: { type: 'text', align: 'left', x: 514.7, y: 276.2, size: FS, value: d => d.cableMaterial },

    // ── Lamp details (widgets: DateLightRemoved … LightInstalledType) ───────
    removedDate:      lampField('removedLamp',   'date',    146.39, 129.12, 341.7),
    removedWattage:   lampField('removedLamp',   'wattage', 289.03, 127.62, 341.7),
    removedType:      lampField('removedLamp',   'type',    425.66, 129.87, 341.7),
    installedDate:    lampField('installedLamp', 'date',    146.39, 128.37, 364.9),
    installedWattage: lampField('installedLamp', 'wattage', 287.52, 127.62, 364.9),
    installedType:    lampField('installedLamp', 'type',    425.66, 128.37, 364.9),

    // ── Dusk / Dawn setting (widgets: Light_DuskDawn, Light_DuskMidnight) ────
    duskDawn:     { type: 'check', x: 43.55,  y: 398.2, value: d => d.duskMode === 'Dusk / Dawn' },
    duskMidnight: { type: 'check', x: 147.1,  y: 396.7, value: d => d.duskMode === 'Dusk / Midnight' },
  },
}

// Plan box and printed north circle are in planLayouts.js (STREETLIGHT_LAYOUT),
// measured from the blank form's plan grid and circle.

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEkPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await embedAppFont(pdfDoc)
  const [p1]          = pdfDoc.getPages()
  const draw          = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw }, FIELDS.p1, d)

  // ── Dimensioned plan — page 1, in the "Dimensioned PLAN" grid ─────────────
  drawPlan({ page: p1, draw, font, plan: d.plan, layout: STREETLIGHT_LAYOUT, pageHeight: A4_HEIGHT })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}

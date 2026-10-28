/**
 * planPdf.js — prints a structured plan (see planModel.js) onto a form page
 * as crisp vector lines, shapes and text. No canvas is involved, so it runs
 * fine inside the PDF Web Worker.
 *
 * Text is drawn with the page's embedded app font (macrons etc.) directly via
 * drawText so it can be coloured and rotated — line and dimension labels turn
 * to follow their line. If no `font` is supplied it falls back to the page
 * drawer, which can only do horizontal ink-coloured text.
 *
 * Coordinates: plan units are points from the top-left of `box`; they're
 * converted to pdf-lib's bottom-origin space with `pageHeight`.
 */
import { rgb, degrees } from 'pdf-lib'
import { A4_HEIGHT } from './pdfDrawUtils'
import {
  PLAN_BOX, LABEL_SIZE, INK_RGB,
  lineWidth, lineDash, colorOf, labelRgb, pointKind, pointSize, labelLayout,
  dimGeometry, northGeometry, normalizePlan,
} from './planModel'

export function drawPlan({ page, draw, font, plan, box = PLAN_BOX, pageHeight = A4_HEIGHT }) {
  if (!plan) return
  const p = normalizePlan(plan)
  if (p.els.length === 0 && !p.northSet) return

  const X = lx => box.x + lx
  const Y = ly => pageHeight - (box.y + ly)
  const pt = (x, y) => ({ x: X(x), y: Y(y) })
  const ink = rgb(...INK_RGB)

  // Label text. (lx, cy) is the point the text is anchored to, in plan units:
  // its centre for 'middle', its left end for 'start', its right end for 'end'
  // (cy is always the vertical centre).
  // `angle` is degrees clockwise on the page. The baseline sits 0.35·size
  // below the visual centre (perpendicular to the text direction), and pdf-lib
  // rotates about the baseline start, so that point is worked out here.
  const drawLabel = (text, lx, cy, anchor, angle, color, size = LABEL_SIZE) => {
    const str = String(text)
    if (!font) {
      const top = box.y + cy - size * 0.65
      if (anchor === 'middle') draw.tc(X(lx) - 100, 200, top, str, size)
      else if (anchor === 'end') draw.tr(X(lx), top, str, size)
      else draw.t(X(lx), top, str, size)
      return
    }
    const w  = font.widthOfTextAtSize(str, size)
    const th = (angle || 0) * Math.PI / 180
    const u  = { x: Math.cos(th),  y: Math.sin(th) }      // along the text
    const d  = { x: -Math.sin(th), y: Math.cos(th) }      // towards the bottom of the text
    const along = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0
    const sx = lx + d.x * 0.35 * size + u.x * along
    const sy = cy + d.y * 0.35 * size + u.y * along
    page.drawText(str, {
      x: X(sx), y: Y(sy), size, font, color: rgb(...color),
      ...(angle ? { rotate: degrees(-angle) } : {}),      // pdf-lib turns counter-clockwise
    })
  }

  // 1 — lines
  for (const e of p.els) {
    if (e.t !== 'ln') continue
    const dash = lineDash(e)
    page.drawLine({
      start: pt(e.x1, e.y1),
      end:   pt(e.x2, e.y2),
      thickness: lineWidth(e),
      color: rgb(...colorOf(e.color).rgb),
      ...(dash ? { dashArray: dash, dashPhase: 0 } : {}),
    })
  }

  // 2 — dimensions (extension lines, dimension line, arrowheads)
  for (const e of p.els) {
    if (e.t !== 'dim') continue
    const c = rgb(...colorOf(e.color).rgb)
    const g = dimGeometry(e)
    for (const s of g.ext) page.drawLine({ start: pt(s.x1, s.y1), end: pt(s.x2, s.y2), thickness: 0.6, color: c })
    page.drawLine({ start: pt(g.a.x, g.a.y), end: pt(g.b.x, g.b.y), thickness: 0.8, color: c })
    for (const ar of g.arrows) {
      for (const w of ar.wings) page.drawLine({ start: pt(ar.tip.x, ar.tip.y), end: pt(w.x, w.y), thickness: 0.8, color: c })
    }
  }

  // 3 — shapes
  for (const e of p.els) {
    if (e.t !== 'pt') continue
    const k = pointKind(e.kind)
    const c = rgb(...colorOf(e.color).rgb)
    const { w, h } = pointSize(e)
    // Fill opacity is per kind: a light tint (rectangle, circle) or solid
    // (dot). pdf-lib fills black unless told otherwise, so the colour is
    // always passed explicitly (same idea as circ() in pdfDrawUtils).
    if (k.shape === 'circle') {
      page.drawCircle({
        x: X(e.x), y: Y(e.y), size: w / 2,
        borderColor: c, borderWidth: 1.2, color: c,
        opacity: k.fillOpacity, borderOpacity: 1,
      })
    } else if (k.shape === 'square') {
      page.drawRectangle({
        x: X(e.x) - w / 2, y: Y(e.y) - h / 2, width: w, height: h,
        borderColor: c, borderWidth: 1.2, color: c,
        opacity: k.fillOpacity, borderOpacity: 1,
      })
    }
  }

  // 4 — labels
  for (const e of p.els) {
    const lay = labelLayout(e)
    if (lay) drawLabel(e.label, lay.x, lay.y, lay.anchor, lay.angle, labelRgb(e))
  }

  // 5 — north arrow (only once the tech has set it)
  if (p.northSet) {
    const g = northGeometry(p.north)
    page.drawLine({ start: pt(g.tail.x, g.tail.y), end: pt(g.head.x, g.head.y), thickness: 1.4, color: ink })
    for (const w of g.wings) {
      page.drawLine({ start: pt(g.head.x, g.head.y), end: pt(w.x, w.y), thickness: 1.4, color: ink })
    }
    drawLabel('N', g.label.x, g.label.y, 'middle', 0, INK_RGB, 8)
  }
}

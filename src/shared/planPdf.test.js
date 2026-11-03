import { describe, it, expect } from 'vitest'
import { drawPlan } from './planPdf'
import { EARTH_LAYOUT, POLE_LAYOUT } from './planLayouts'
import { emptyPlan, addPoint } from './planModel'
import { POLE_SAMPLE_PLAN } from './planSamples'

// Stand-in font: width only, which is all drawPlan asks for.
const font = { widthOfTextAtSize: s => s.length * 4 }

function fakePage() {
  const calls = []
  const rec = name => args => { calls.push({ name, args }) }
  return {
    calls,
    drawCircle: rec('circle'),
    drawRectangle: rec('rect'),
    drawLine: rec('line'),
    drawText: rec('text'),
  }
}

describe('drawPlan geometry', () => {
  it('prints the pole box origin at the right PDF position (top-origin converted)', () => {
    const page = fakePage()
    const plan = addPoint(emptyPlan(), 'dot', 0, 0, '', 'a', {}, POLE_LAYOUT).plan
    drawPlan({ page, font, plan, layout: POLE_LAYOUT, pageHeight: 842 })
    const c = page.calls.find(c => c.name === 'circle')
    expect(c.args.x).toBeCloseTo(42.5, 6)
    expect(c.args.y).toBeCloseTo(842 - 138, 6)
  })

  it('defaults to the Earth box when no layout is given', () => {
    const page = fakePage()
    const plan = addPoint(emptyPlan(), 'dot', 0, 0, '', 'a', {}, EARTH_LAYOUT).plan
    drawPlan({ page, font, plan, pageHeight: 842 })
    const c = page.calls.find(c => c.name === 'circle')
    expect(c.args.x).toBeCloseTo(40, 6)
    expect(c.args.y).toBeCloseTo(842 - 458, 6)
  })

  it('prints no north arrow on a form that has none', () => {
    const page = fakePage()
    drawPlan({ page, font, plan: { v: 1, north: 90, northSet: true, els: [] }, layout: POLE_LAYOUT, pageHeight: 842 })
    expect(page.calls.length).toBe(0)
  })

  it('the pole sample stays inside the box in PDF space', () => {
    const page = fakePage()
    drawPlan({ page, font, plan: POLE_SAMPLE_PLAN, layout: POLE_LAYOUT, pageHeight: 842 })
    const xs = [], ys = []
    for (const c of page.calls) {
      if (c.name === 'text') continue
      if (c.name === 'circle' || c.name === 'rect') { xs.push(c.args.x); ys.push(c.args.y) }
      if (c.name === 'line') { xs.push(c.args.start.x, c.args.end.x); ys.push(c.args.start.y, c.args.end.y) }
    }
    expect(Math.min(...xs) >= 42.5 - 0.01).toBe(true)
    expect(Math.max(...xs) <= 553.0 + 0.01).toBe(true)
    expect(Math.min(...ys) >= 842 - 506 - 0.01).toBe(true)
    expect(Math.max(...ys) <= 842 - 138 + 0.01).toBe(true)
  })
})

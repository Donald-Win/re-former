import { describe, it, expect } from 'vitest'
import { EARTH_LAYOUT, POLE_LAYOUT, layoutFor } from './planLayouts'
import { emptyPlan, normalizePlan, addPoint, snapPoint, hitTest, setPointSize, pointSize, sizeLimits } from './planModel'
import { makeTemplate, cleanImported } from './planTemplates'
import { POLE_SAMPLE_PLAN } from './planSamples'

const pointsOf = e => {
  if (e.t === 'pt') return [[e.x, e.y]]
  if (e.t === 'ln') return [[e.x1, e.y1], [e.x2, e.y2]]
  return [[e.x1, e.y1], [e.x2, e.y2]]
}

describe('layoutFor', () => {
  it('maps each form to its own layout, unknown codes to the Earth layout', () => {
    expect(layoutFor('360S014EC')).toBe(POLE_LAYOUT)
    expect(layoutFor('360S014EJ')).toBe(EARTH_LAYOUT)
    expect(layoutFor('SOMETHING-ELSE')).toBe(EARTH_LAYOUT)
  })
})

describe('pole layout', () => {
  it('uses the measured work-plan box and prints no north circle', () => {
    expect(POLE_LAYOUT.box).toEqual({ x: 42.5, y: 138, w: 510.5, h: 368 })
    expect(POLE_LAYOUT.north).toBe(null)
  })

  it('keeps points lower than the Earth box would allow', () => {
    const p = normalizePlan({ els: [{ id: 'a', t: 'pt', kind: 'dot', x: 100, y: 300 }] }, POLE_LAYOUT)
    expect(p.els[0].y).toBe(300)
  })

  it('clamps new points to the pole box, not the Earth box', () => {
    const p = addPoint(emptyPlan(), 'dot', 900, 900, '', 'a', {}, POLE_LAYOUT).plan
    expect([p.els[0].x, p.els[0].y]).toEqual([510.5, 368])
  })

  it('never keeps a north setting', () => {
    const p = normalizePlan({ north: 90, northSet: true, els: [] }, POLE_LAYOUT)
    expect([p.north, p.northSet]).toEqual([0, false])
  })

  it('snapping stays inside the pole box', () => {
    const s = snapPoint(emptyPlan(), 600, 400, { step: 8, tol: 4, layout: POLE_LAYOUT })
    expect(s.x).toBeLessThanOrEqual(510.5)
    expect(s.y).toBeLessThanOrEqual(368)
  })

  it('a tap where the Earth north circle sits is not a north hit on this form', () => {
    expect(hitTest(emptyPlan(), 31.75, 32.5, { tol: 10, layout: POLE_LAYOUT })).toBe(null)
    expect(hitTest(emptyPlan(), 31.75, 32.5, { tol: 10 })).toEqual({ type: 'north' })
  })

  it('saved pole templates keep points below the Earth height and drop north', () => {
    const plan = normalizePlan({ north: 40, northSet: true, els: [{ id: 'a', t: 'pt', kind: 'dot', x: 120, y: 300 }] }, POLE_LAYOUT)
    const t = makeTemplate({ formKey: '360S014EC', name: 'Pole', plan })
    expect(t.plan.els[0].y).toBe(300)
    expect(t.plan.northSet).toBe(false)
  })

  it('imported pole templates are cleaned against the pole box', () => {
    const t = cleanImported({ id: 'x', formKey: '360S014EC', name: 'Imported', plan: { v: 1, els: [{ id: 'a', t: 'pt', kind: 'dot', x: 120, y: 300 }] } })
    expect(t.plan.els[0].y).toBe(300)
  })

  it('the pole sample plan fits inside the pole box unchanged', () => {
    const p = normalizePlan(POLE_SAMPLE_PLAN, POLE_LAYOUT)
    expect(p.els.length).toBe(POLE_SAMPLE_PLAN.els.length)
    POLE_SAMPLE_PLAN.els.forEach((raw, i) => {
      const before = pointsOf(raw)
      const after = pointsOf(p.els[i])
      expect(after).toEqual(before)
      for (const [x, y] of after) {
        expect(x >= 0 && x <= 510.5).toBe(true)
        expect(y >= 0 && y <= 368).toBe(true)
      }
    })
  })
})

describe('Earth layout is the default and is unchanged', () => {
  it('an unlisted layout argument behaves exactly like the Earth form', () => {
    const p = normalizePlan({ els: [{ id: 'a', t: 'pt', kind: 'dot', x: 600, y: 300 }] })
    expect([p.els[0].x, p.els[0].y]).toEqual([513, 242])
  })
})

describe('shape sizes are limited by the form box, not a fixed cap', () => {
  const rectAt = (layout) => addPoint(emptyPlan(), 'rect', 100, 100, '', 'r1', {}, layout).plan
  const circleAt = (layout) => addPoint(emptyPlan(), 'circle', 100, 100, '', 'c1', {}, layout).plan

  it('limits are the box size (circle: shorter side)', () => {
    expect(sizeLimits('rect', EARTH_LAYOUT)).toEqual({ w: 513, h: 242 })
    expect(sizeLimits('circle', EARTH_LAYOUT)).toEqual({ w: 242, h: 242 })
    expect(sizeLimits('rect', POLE_LAYOUT)).toEqual({ w: 510.5, h: 368 })
    expect(sizeLimits('circle', POLE_LAYOUT)).toEqual({ w: 368, h: 368 })
  })

  it('a rectangle can be bigger than the old 120 cap on the Earth form', () => {
    const p = setPointSize(rectAt(EARTH_LAYOUT), 'r1', 200, 200, EARTH_LAYOUT)
    expect(pointSize(p.els[0])).toEqual({ w: 200, h: 200 })
  })

  it('a rectangle reaches the full height of the Earth box, and no further', () => {
    const p = setPointSize(rectAt(EARTH_LAYOUT), 'r1', 400, 400, EARTH_LAYOUT)
    expect(pointSize(p.els[0])).toEqual({ w: 400, h: 242 })
  })

  it('a circle is capped by the shorter side of the box', () => {
    const p = setPointSize(circleAt(EARTH_LAYOUT), 'c1', 400, 400, EARTH_LAYOUT)
    expect(pointSize(p.els[0])).toEqual({ w: 242, h: 242 })
  })

  it('on the pole form a tall rectangle keeps its full height', () => {
    const p = setPointSize(rectAt(POLE_LAYOUT), 'r1', 300, 350, POLE_LAYOUT)
    expect(pointSize(p.els[0])).toEqual({ w: 300, h: 350 })
  })

  it('saved sizes above the old cap survive loading on the pole form', () => {
    const p = normalizePlan({ els: [{ id: 'a', t: 'pt', kind: 'rect', x: 100, y: 200, w: 300, h: 350 }] }, POLE_LAYOUT)
    expect(pointSize(p.els[0])).toEqual({ w: 300, h: 350 })
  })

  it('the dot stays one fixed size and cannot be resized', () => {
    const p = addPoint(emptyPlan(), 'dot', 100, 100, '', 'd1', {}, POLE_LAYOUT).plan
    const after = setPointSize(p, 'd1', 60, 60, POLE_LAYOUT)
    expect(pointSize(after.els[0])).toEqual({ w: 7.5, h: 7.5 })
  })
})

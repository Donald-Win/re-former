import { describe, it, expect } from 'vitest'
import { clampZoom, snapStepForZoom, zoomFromPinch, scrollForAnchor, ZOOM_MIN, ZOOM_MAX } from './planView'
import { PLAN_W, PLAN_H } from './planModel'

describe('zoom limits', () => {
  it('clamps to the allowed range', () => {
    expect(clampZoom(0.2)).toBe(ZOOM_MIN)
    expect(clampZoom(99)).toBe(ZOOM_MAX)
    expect(clampZoom(2.5)).toBe(2.5)
  })
})

describe('snap step', () => {
  it('gets finer as you zoom in, and never coarser', () => {
    expect(snapStepForZoom(1)).toBe(8)
    expect(snapStepForZoom(2)).toBe(4)
    expect(snapStepForZoom(3)).toBe(2)
    expect(snapStepForZoom(5)).toBe(1)
    expect(snapStepForZoom(6)).toBe(1)
    let last = Infinity
    for (let z = 1; z <= 6; z += 0.25) {
      const s = snapStepForZoom(z)
      expect(s <= last).toBe(true)
      last = s
    }
  })
})

describe('pinch', () => {
  it('spreading the fingers zooms in, pinching zooms out, in proportion', () => {
    expect(zoomFromPinch(2, 100, 200)).toBe(4)
    expect(zoomFromPinch(2, 100, 50)).toBe(1)
    expect(zoomFromPinch(2, 100, 100)).toBe(2)
  })
  it('is clamped, and ignores nonsense distances', () => {
    expect(zoomFromPinch(2, 100, 10000)).toBe(ZOOM_MAX)
    expect(zoomFromPinch(2, 100, 1)).toBe(ZOOM_MIN)
    expect(zoomFromPinch(3, 0, 50)).toBe(3)
    expect(zoomFromPinch(3, 50, 0)).toBe(3)
  })
})

describe('scrollForAnchor', () => {
  const base = { contentW: 400, pad: 6, viewLeft: 0, viewTop: 100 }

  it('at zoom 1 with the plan origin under the top-left of the view, nothing needs scrolling', () => {
    const s = scrollForAnchor({ ...base, px: 0, py: 0, zoom: 1, clientX: 6, clientY: 106 })
    expect(s.left).toBe(0)
    expect(s.top).toBe(0)
  })
  it('the plan point stays under the fingers: after zooming, its screen position is unchanged', () => {
    // Plan point (300, 100) sits under the screen point (250, 190).
    const zoom = 3
    const s = scrollForAnchor({ ...base, px: 300, py: 100, zoom, clientX: 250, clientY: 190 })
    // Where that plan point lands on screen with this scroll:
    const svgW = base.contentW * zoom, svgH = svgW * (PLAN_H / PLAN_W)
    const screenX = base.viewLeft + base.pad + (300 / PLAN_W) * svgW - s.left
    const screenY = base.viewTop  + base.pad + (100 / PLAN_H) * svgH - s.top
    expect(Math.round(screenX)).toBe(250)
    expect(Math.round(screenY)).toBe(190)
  })
  it('moving the fingers (a two-finger pan) scrolls the opposite way', () => {
    const a = scrollForAnchor({ ...base, px: 200, py: 100, zoom: 3, clientX: 200, clientY: 200 })
    const b = scrollForAnchor({ ...base, px: 200, py: 100, zoom: 3, clientX: 150, clientY: 170 })
    expect(b.left - a.left).toBe(50)    // fingers moved 50px left → content scrolls 50px further right
    expect(b.top - a.top).toBe(30)
  })
  it('zooming in around the middle of the plan pushes the scroll position out proportionally', () => {
    const z2 = scrollForAnchor({ ...base, px: PLAN_W / 2, py: PLAN_H / 2, zoom: 2, clientX: 206, clientY: 106 + 100 })
    const z4 = scrollForAnchor({ ...base, px: PLAN_W / 2, py: PLAN_H / 2, zoom: 4, clientX: 206, clientY: 106 + 100 })
    expect(z4.left).toBeGreaterThan(z2.left)
    expect(z4.top).toBeGreaterThan(z2.top)
  })
})

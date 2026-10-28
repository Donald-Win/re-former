import { describe, it, expect } from 'vitest'
import {
  emptyPlan, normalizePlan, addPoint, addLine, addDim, removeEl, updateEl, setNorth,
  snapPoint, vertexRefs, dragRefs, moveVertex, hitTest, labelLayout,
  angleFromNorthCentre, northGeometry, distToSegment, PLAN_W, PLAN_H, NORTH,
  pointSize, setPointSize, resizeHandle, sizeFromHandle, SIZE_MIN, SIZE_MAX,
  lineDash, lineWidth, dimGeometry, dimHandle, clampOffset, setDimOffset, offsetFromPoint,
  labelColor, colorOf, DIM_DEFAULT_OFFSET, snapTargets, LABEL_POSITIONS,
} from './planModel'

// A circle at (200,100), a dot at (300,100) and a green solid line between them.
function sample() {
  let p = emptyPlan()
  p = addPoint(p, 'circle', 200, 100, 'Pole', 'c1').plan
  p = addPoint(p, 'dot', 300, 100, '', 'd1').plan
  p = addLine(p, 'solid', 'green', 'normal', 200, 100, 300, 100, '3.2m', 'wire1').plan
  return p
}

describe('normalizePlan', () => {
  it('turns junk into an empty plan', () => {
    expect(normalizePlan(null)).toEqual(emptyPlan())
    expect(normalizePlan('x')).toEqual(emptyPlan())
    expect(normalizePlan({ els: 5 })).toEqual(emptyPlan())
  })
  it('drops unknown kinds and bad numbers, clamps into the box', () => {
    const p = normalizePlan({
      north: -90, northSet: 1,
      els: [
        { id: 'a', t: 'pt', kind: 'dot', x: 9999, y: -5, label: 'ok' },
        { id: 'b', t: 'pt', kind: 'spaceship', x: 1, y: 1 },
        { id: 'c', t: 'ln', pattern: 'solid', color: 'green', x1: 1, y1: 1, x2: 'NaN', y2: 2 },
        { id: 'd', t: 'ln', pattern: 'dashed', color: 'red', weight: 'heavy', x1: 0, y1: 0, x2: 10, y2: 10 },
        { t: 'pt', kind: 'dot', x: 1, y: 1 },
      ],
    })
    expect(p.els.map(e => e.id)).toEqual(['a', 'd'])
    expect(p.els[0].x).toBe(PLAN_W)
    expect(p.els[0].y).toBe(0)
    expect(p.els[0].label).toBe('ok')
    expect(p.north).toBe(270)
    expect(p.northSet).toBe(true)
  })
  it('defaults a line with bad pattern / colour / weight', () => {
    const p = normalizePlan({ els: [{ id: 'a', t: 'ln', pattern: 'wavy', color: 'purple', weight: 'huge', x1: 0, y1: 0, x2: 5, y2: 5 }] })
    expect([p.els[0].pattern, p.els[0].color, p.els[0].weight]).toEqual(['solid', 'blue', 'normal'])
  })
  it('loads plans saved by earlier builds (named kinds, line "style")', () => {
    const p = normalizePlan({ els: [
      { id: 'a', t: 'pt', kind: 'pole', x: 5, y: 5 },
      { id: 'b', t: 'pt', kind: 'tx',   x: 5, y: 5 },
      { id: 'c', t: 'pt', kind: 'rod',  x: 5, y: 5 },
      { id: 'd', t: 'ln', style: 'dashed', color: 'red', x1: 0, y1: 0, x2: 5, y2: 5 },
      { id: 'e', t: 'ln', style: 'thick',  color: 'blue', x1: 0, y1: 0, x2: 5, y2: 5 },
    ] })
    expect(p.els.map(e => e.kind)).toEqual(['circle', 'rect', 'dot', undefined, undefined])
    expect([p.els[3].pattern, p.els[3].weight]).toEqual(['dashed', 'normal'])
    expect([p.els[4].pattern, p.els[4].weight]).toEqual(['solid', 'thick'])
  })
  it('text gets a valid colour; dimensions get an in-box offset', () => {
    const p = normalizePlan({ els: [
      { id: 't', t: 'pt', kind: 'text', x: 5, y: 5, color: 'nope', label: 'hi' },
      { id: 'm', t: 'dim', x1: 0, y1: 100, x2: 100, y2: 100, offset: 99999 },
    ] })
    expect(p.els[0].color).toBe('blue')
    const g = dimGeometry(p.els[1])
    expect(g.a.y >= 0 && g.a.y <= PLAN_H).toBe(true)
  })
})

describe('shape colours', () => {
  it('shapes keep a valid colour and default to blue', () => {
    const p = normalizePlan({ els: [
      { id: 'a', t: 'pt', kind: 'rect',   x: 5, y: 5, color: 'red' },
      { id: 'b', t: 'pt', kind: 'dot',    x: 5, y: 5, color: 'purple' },
      { id: 'c', t: 'pt', kind: 'circle', x: 5, y: 5 },
    ] })
    expect(p.els.map(e => e.color)).toEqual(['red', 'blue', 'blue'])
  })
  it('addPoint carries a shape colour', () => {
    const el = addPoint(emptyPlan(), 'rect', 5, 5, '', undefined, { color: 'green' }).plan.els[0]
    expect(el.color).toBe('green')
  })
  it('a shape\'s label stays ink blue whatever its colour', () => {
    expect(labelColor({ t: 'pt', kind: 'rect', color: 'red' })).toBe(colorOf('blue').hex)
  })
})

describe('edits are immutable', () => {
  it('add / update / remove do not mutate the original', () => {
    const p = sample()
    const before = JSON.stringify(p)
    updateEl(p, 'wire1', { label: 'x' })
    removeEl(p, 'wire1')
    setNorth(p, 40)
    expect(JSON.stringify(p)).toBe(before)
    expect(removeEl(p, 'wire1').els.length).toBe(2)
    expect(updateEl(p, 'wire1', { label: 'x' }).els[2].label).toBe('x')
  })
  it('setNorth normalises and marks the north point as set', () => {
    const p = setNorth(emptyPlan(), -30)
    expect(p.north).toBe(330)
    expect(p.northSet).toBe(true)
  })
  it('addLine stores pattern, colour and weight', () => {
    const el = addLine(emptyPlan(), 'dotted', 'red', 'heavy', 0, 0, 10, 0, 'x', 'z').plan.els[0]
    expect([el.pattern, el.color, el.weight]).toEqual(['dotted', 'red', 'heavy'])
  })
  it('addPoint can carry extras (text colour)', () => {
    const el = addPoint(emptyPlan(), 'text', 5, 5, '', undefined, { color: 'red' }).plan.els[0]
    expect(el.color).toBe('red')
  })
})

describe('line weight and pattern', () => {
  it('weights give widths; dashes scale with the width', () => {
    expect(lineWidth({ weight: 'fine' })).toBe(0.8)
    expect(lineWidth({ weight: 'heavy' })).toBe(3.6)
    expect(lineWidth({ weight: undefined })).toBe(1.4)
    expect(lineDash({ pattern: 'solid', weight: 'normal' })).toBe(null)
    const thin  = lineDash({ pattern: 'dashed', weight: 'fine' })
    const thick = lineDash({ pattern: 'dashed', weight: 'heavy' })
    expect(thick[0] / thin[0]).toBeCloseTo(4.5, 5)
  })
})

describe('snapPoint', () => {
  it('snaps onto an existing vertex so a wire joins a shape', () => {
    const s = snapPoint(sample(), 203, 98, { step: 8, tol: 8 })
    expect(s.snapped).toBe(true)
    expect(s.x).toBe(200)
    expect(s.y).toBe(100)
  })
  it('otherwise snaps to the grid and stays inside the box', () => {
    const s = snapPoint(sample(), 51, 53, { step: 8, tol: 4 })
    expect(s.snapped).toBe(false)
    expect(s.x).toBe(48)
    expect(s.y).toBe(56)
    expect(snapPoint(emptyPlan(), 99999, 99999, { step: 8 }).x).toBe(PLAN_W)
    expect(snapPoint(emptyPlan(), 99999, 99999, { step: 8 }).y).toBe(PLAN_H)
  })
  it('ignores excluded vertices (the ones being dragged)', () => {
    const p = sample()
    const refs = vertexRefs(p, 200, 100)
    expect(snapPoint(p, 201, 101, { step: 8, tol: 8, exclude: refs }).snapped).toBe(false)
  })
  it('tol 0 never snaps onto a vertex (used for placing text)', () => {
    expect(snapPoint(sample(), 201, 101, { step: 8, tol: 0 }).snapped).toBe(false)
  })
})

describe('dragging moves only the item that was grabbed', () => {
  // The scenario from the bug report: a dot where two wires meet, with a
  // dimension on each wire ending at the dot.
  function joint() {
    let p = emptyPlan()
    p = addPoint(p, 'dot', 200, 100, '', 'dot').plan
    p = addLine(p, 'solid', 'green', 'normal', 200, 100, 300, 60,  '', 'w1').plan
    p = addLine(p, 'solid', 'green', 'normal', 200, 100, 300, 140, '', 'w2').plan
    p = addDim(p, 'black', 'aligned', 200, 100, 300, 60,  14, '', 'd1').plan
    p = addDim(p, 'black', 'aligned', 200, 100, 300, 140, 14, '', 'd2').plan
    return p
  }
  const at = (p, id) => p.els.find(e => e.id === id)

  it('dragRefs names just the grabbed point, or just the grabbed line end', () => {
    expect(dragRefs({ type: 'pt', id: 'dot' })).toEqual([{ id: 'dot', end: 'p' }])
    expect(dragRefs({ type: 'end', id: 'w1', end: 2 })).toEqual([{ id: 'w1', end: 2 }])
  })
  it('moving the dot leaves both wires and both dimensions exactly where they were', () => {
    const p = joint()
    const q = moveVertex(p, dragRefs({ type: 'pt', id: 'dot' }), 230, 130)
    expect([at(q, 'dot').x, at(q, 'dot').y]).toEqual([230, 130])
    for (const id of ['w1', 'w2']) expect(at(q, id)).toEqual(at(p, id))
    for (const id of ['d1', 'd2']) expect(at(q, id)).toEqual(at(p, id))
  })
  it('moving one wire end leaves the dot, the other wire and the dimensions alone', () => {
    const p = joint()
    const q = moveVertex(p, dragRefs({ type: 'end', id: 'w1', end: 1 }), 180, 90)
    expect([at(q, 'w1').x1, at(q, 'w1').y1]).toEqual([180, 90])
    expect([at(q, 'w1').x2, at(q, 'w1').y2]).toEqual([300, 60])
    expect(at(q, 'dot')).toEqual(at(p, 'dot'))
    expect(at(q, 'w2')).toEqual(at(p, 'w2'))
    expect(at(q, 'd1')).toEqual(at(p, 'd1'))
  })
  it('moving one dimension end moves only that end', () => {
    const p = joint()
    const q = moveVertex(p, dragRefs({ type: 'end', id: 'd1', end: 1 }), 210, 110)
    expect([at(q, 'd1').x1, at(q, 'd1').y1]).toEqual([210, 110])
    expect([at(q, 'd1').x2, at(q, 'd1').y2]).toEqual([300, 60])
    expect(at(q, 'dot')).toEqual(at(p, 'dot'))
    expect(at(q, 'w1')).toEqual(at(p, 'w1'))
    expect(at(q, 'd2')).toEqual(at(p, 'd2'))
  })
  it('the dragged item can snap back onto what it left, to rejoin it', () => {
    const p = joint()
    const refs = dragRefs({ type: 'pt', id: 'dot' })
    const s = snapPoint(p, 202, 101, { step: 8, tol: 8, exclude: refs })
    expect(s.snapped).toBe(true)                       // snaps to a wire / dimension end still at (200,100)
    expect([s.x, s.y]).toEqual([200, 100])
  })
  it('a dragged dimension keeps its offset valid after the move', () => {
    const p = addDim(emptyPlan(), 'black', 'aligned', 100, 100, 200, 100, 14, '', 'd').plan
    const q = moveVertex(p, dragRefs({ type: 'end', id: 'd', end: 2 }), 200, 5)
    const g = dimGeometry(at(q, 'd'))
    expect(g.a.y >= 0 && g.b.y >= 0 && g.a.y <= PLAN_H && g.b.y <= PLAN_H).toBe(true)
  })
  it('vertexRefs still reports everything that meets at a spot (for inspection, not dragging)', () => {
    expect(vertexRefs(joint(), 200, 100).length).toBe(5)
  })
})

describe('hitTest', () => {
  it('the north circle wins over everything', () => {
    expect(hitTest(sample(), NORTH.cx, NORTH.cy).type).toBe('north')
  })
  it('points beat lines; lines are hit along their length', () => {
    const p = sample()
    expect(hitTest(p, 201, 101, { tol: 10 })).toEqual({ type: 'pt', id: 'c1' })
    expect(hitTest(p, 250, 103, { tol: 10 })).toEqual({ type: 'ln', id: 'wire1' })
    expect(hitTest(p, 250, 160, { tol: 10 })).toBe(null)
  })
  it('only the selected line exposes end handles', () => {
    const w = addLine(emptyPlan(), 'solid', 'black', 'thick', 100, 100, 200, 100, '', 'k').plan
    expect(hitTest(w, 101, 100, { tol: 10 }).type).toBe('ln')
    expect(hitTest(w, 101, 100, { tol: 10, selectedId: 'k' })).toEqual({ type: 'end', id: 'k', end: 1 })
    expect(hitTest(w, 199, 100, { tol: 10, selectedId: 'k' })).toEqual({ type: 'end', id: 'k', end: 2 })
  })
})

describe('labelLayout', () => {
  it('no label → null', () => {
    expect(labelLayout(sample().els[1])).toBe(null)
  })
  it('a horizontal line label is level, centred and lifted above the line', () => {
    const lay = labelLayout(sample().els[2])
    expect(lay.anchor).toBe('middle')
    expect(lay.angle).toBe(0)
    expect(lay.x).toBe(250)
    expect(lay.y).toBeLessThan(100)
  })
  it('a label follows the angle of its line', () => {
    const ln = (x2, y2) => ({ t: 'ln', pattern: 'solid', color: 'black', weight: 'normal', x1: 100, y1: 100, x2, y2, label: 'L' })
    expect(labelLayout(ln(200, 200)).angle).toBe(45)      // down-right → reads down-right
    expect(labelLayout(ln(200, 0)).angle).toBe(-45)       // up-right → reads up-right
    expect(labelLayout(ln(0, 0)).angle).toBe(45)          // up-left is flipped so it isn't upside down
    expect(labelLayout(ln(0, 200)).angle).toBe(-45)
  })
  it('text is never upside down, and a vertical line reads bottom-to-top', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const r = (deg * Math.PI) / 180
      const lay = labelLayout({ t: 'ln', pattern: 'solid', color: 'black', weight: 'normal',
        x1: 200, y1: 100, x2: 200 + 50 * Math.cos(r), y2: 100 + 50 * Math.sin(r), label: 'L' })
      expect(lay.angle >= -90 && lay.angle < 90).toBe(true)
    }
    const v = labelLayout({ t: 'ln', pattern: 'solid', color: 'black', weight: 'thick', x1: 100, y1: 20, x2: 100, y2: 120, label: 'Kerb' })
    expect(v.angle).toBe(-90)
    expect(v.y).toBeCloseTo(70, 5)
    expect(v.x).toBeLessThan(100)                          // sits to the left of the line
  })
  it('the label is lifted clear of a heavy line by more than a fine one', () => {
    const mk = weight => labelLayout({ t: 'ln', pattern: 'solid', color: 'black', weight, x1: 100, y1: 100, x2: 200, y2: 100, label: 'L' })
    expect(mk('heavy').y).toBeLessThan(mk('fine').y)
  })
  it('shape labels sit beside the shape — clear of a resized one; text is centred', () => {
    expect(labelLayout({ t: 'pt', kind: 'dot', x: 10, y: 20, label: 'P' })).toEqual({ x: 16.75, y: 20, anchor: 'start', angle: 0 })
    expect(labelLayout({ t: 'pt', kind: 'rect', x: 100, y: 20, w: 40, h: 10, label: 'B' })).toEqual({ x: 123, y: 20, anchor: 'start', angle: 0 })
    expect(labelLayout({ t: 'pt', kind: 'text', x: 10, y: 20, label: 'Hi' })).toEqual({ x: 10, y: 20, anchor: 'middle', angle: 0 })
  })
})

describe('shape label position', () => {
  const rect = pos => ({ t: 'pt', kind: 'rect', x: 100, y: 50, w: 40, h: 20, labelPos: pos, label: 'L' })

  it('lists top, bottom, left, right and centre', () => {
    expect(LABEL_POSITIONS.map(o => o.id)).toEqual(['top', 'bottom', 'left', 'right', 'center'])
  })
  it('right (the default), left, top, bottom and centre', () => {
    expect(labelLayout(rect('right'))).toEqual({ x: 123, y: 50, anchor: 'start', angle: 0 })
    expect(labelLayout(rect(undefined))).toEqual({ x: 123, y: 50, anchor: 'start', angle: 0 })
    expect(labelLayout(rect('left'))).toEqual({ x: 77, y: 50, anchor: 'end', angle: 0 })
    expect(labelLayout(rect('top'))).toEqual({ x: 100, y: 34, anchor: 'middle', angle: 0 })
    expect(labelLayout(rect('bottom'))).toEqual({ x: 100, y: 66, anchor: 'middle', angle: 0 })
    expect(labelLayout(rect('center'))).toEqual({ x: 100, y: 50, anchor: 'middle', angle: 0 })
  })
  it('an unknown position falls back to right', () => {
    expect(labelLayout(rect('diagonal')).anchor).toBe('start')
  })
  it('positions follow the shape\'s size, for circles and dots too', () => {
    const c = { t: 'pt', kind: 'circle', x: 100, y: 50, w: 30, labelPos: 'top', label: 'L' }
    expect(labelLayout(c).y).toBe(29)                         // 50 − 15 − 6
    const dot = { t: 'pt', kind: 'dot', x: 100, y: 50, labelPos: 'left', label: 'L' }
    expect(labelLayout(dot).x).toBe(93.25)                    // 100 − 3.75 − 3
  })
  it('normalizePlan keeps a valid position, defaults the rest, and ignores it for text', () => {
    const p = normalizePlan({ els: [
      { id: 'a', t: 'pt', kind: 'rect', x: 1, y: 1, labelPos: 'top' },
      { id: 'b', t: 'pt', kind: 'rect', x: 1, y: 1, labelPos: 'sideways' },
      { id: 'c', t: 'pt', kind: 'dot',  x: 1, y: 1 },
      { id: 'd', t: 'pt', kind: 'text', x: 1, y: 1, labelPos: 'top' },
    ] })
    expect(p.els.map(e => e.labelPos)).toEqual(['top', 'right', 'right', undefined])
  })
})

describe('north', () => {
  it('angle follows the pointer around the circle, snapped to 5°', () => {
    expect(angleFromNorthCentre(NORTH.cx, NORTH.cy - 10)).toBe(0)
    expect(angleFromNorthCentre(NORTH.cx + 10, NORTH.cy)).toBe(90)
    expect(angleFromNorthCentre(NORTH.cx, NORTH.cy + 10)).toBe(180)
    expect(angleFromNorthCentre(NORTH.cx - 10, NORTH.cy)).toBe(270)
    expect(angleFromNorthCentre(NORTH.cx + 10, NORTH.cy - 9)).toBe(50)
  })
  it('arrow points the way the angle says', () => {
    const up = northGeometry(0)
    expect(up.head.y).toBeLessThan(NORTH.cy)
    expect(Math.abs(up.head.x - NORTH.cx) < 0.001).toBe(true)
    expect(northGeometry(90).head.x).toBeGreaterThan(NORTH.cx)
  })
})

describe('distToSegment', () => {
  it('measures to the segment, not the infinite line', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3)
    expect(distToSegment(15, 0, 0, 0, 10, 0)).toBe(5)
  })
})

describe('shape sizes', () => {
  it('defaults: circle/rect 12, dot 7.5, text none; circles are round', () => {
    expect(pointSize({ kind: 'rect' })).toEqual({ w: 12, h: 12 })
    expect(pointSize({ kind: 'circle' })).toEqual({ w: 12, h: 12 })
    expect(pointSize({ kind: 'dot' })).toEqual({ w: 7.5, h: 7.5 })
    expect(pointSize({ kind: 'text' })).toEqual({ w: 0, h: 0 })
    expect(pointSize({ kind: 'circle', w: 20, h: 5 })).toEqual({ w: 20, h: 20 })
  })
  it('rectangles can be any width × height', () => {
    const p = addPoint(emptyPlan(), 'rect', 100, 100, '', 'r1').plan
    expect(pointSize(setPointSize(p, 'r1', 40, 20).els[0])).toEqual({ w: 40, h: 20 })
  })
  it('sizes are rounded and clamped; circles keep w = h', () => {
    let p = addPoint(emptyPlan(), 'rect', 100, 100, '', 'r1').plan
    p = addPoint(p, 'circle', 50, 50, '', 'c1').plan
    expect(pointSize(setPointSize(p, 'r1', 1, 9999).els[0])).toEqual({ w: SIZE_MIN, h: SIZE_MAX })
    expect(pointSize(setPointSize(p, 'c1', 12.4, 99).els[1])).toEqual({ w: 12, h: 12 })
  })
  it('normalizePlan keeps and clamps stored sizes', () => {
    const p = normalizePlan({ els: [{ id: 'a', t: 'pt', kind: 'rect', x: 10, y: 10, w: 40, h: 9999 }] })
    expect(pointSize(p.els[0])).toEqual({ w: 40, h: SIZE_MAX })
  })
})

describe('the dot has one fixed size', () => {
  const dotPlan = () => addPoint(emptyPlan(), 'dot', 100, 100, '', 'd1').plan

  it('is 150% of the original 5-unit dot, whatever size is stored', () => {
    expect(pointSize({ kind: 'dot' })).toEqual({ w: 7.5, h: 7.5 })
    expect(pointSize({ kind: 'dot', w: 50, h: 50 })).toEqual({ w: 7.5, h: 7.5 })
  })
  it('cannot be resized', () => {
    const p = dotPlan()
    expect(setPointSize(p, 'd1', 40, 40)).toEqual(p)
    expect(resizeHandle(p.els[0], 6)).toBe(null)
  })
  it('a stored size is dropped when loading', () => {
    const p = normalizePlan({ els: [{ id: 'a', t: 'pt', kind: 'dot', x: 5, y: 5, w: 30, h: 30 }] })
    expect(p.els[0].w).toBe(undefined)
    expect(p.els[0].h).toBe(undefined)
  })
  it('selecting a dot never offers a resize handle — dragging it can only move it', () => {
    const p = dotPlan()
    for (const [x, y] of [[100, 100], [103, 103], [106, 106], [100, 108]]) {
      expect(hitTest(p, x, y, { tol: 10, handleOff: 6, selectedId: 'd1' })).toEqual({ type: 'pt', id: 'd1' })
    }
  })
  it('turning a dot into a rectangle gives a normal default rectangle', () => {
    const p = updateEl(dotPlan(), 'd1', { kind: 'rect' })
    expect(pointSize(p.els[0])).toEqual({ w: 12, h: 12 })
  })
})

describe('resize handle', () => {
  it('sits outside the corner and round-trips through sizeFromHandle', () => {
    const rect = { t: 'pt', kind: 'rect', x: 100, y: 100, w: 40, h: 20 }
    const hr = resizeHandle(rect, 6)
    expect(hr).toEqual({ x: 126, y: 116 })
    expect(sizeFromHandle(rect, hr.x, hr.y, 6)).toEqual({ w: 40, h: 20 })
    const circ = { t: 'pt', kind: 'circle', x: 100, y: 100, w: 20 }
    const hc = resizeHandle(circ, 6)
    expect(Math.round(sizeFromHandle(circ, hc.x, hc.y, 6).w)).toBe(20)
    expect(resizeHandle({ t: 'pt', kind: 'text', x: 1, y: 1 }, 6)).toBe(null)
  })
  it('only the selected shape exposes it', () => {
    let p = addPoint(emptyPlan(), 'rect', 200, 100, '', 'r1').plan
    p = setPointSize(p, 'r1', 40, 20)
    const h = resizeHandle(p.els[0], 4)
    expect(hitTest(p, h.x, h.y, { tol: 8, handleOff: 4 })).toBe(null)
    expect(hitTest(p, h.x, h.y, { tol: 8, handleOff: 4, selectedId: 'r1' })).toEqual({ type: 'resize', id: 'r1' })
  })
})

describe('hitting the body of a big shape', () => {
  it('selects a large rectangle by tapping inside it', () => {
    let p = addPoint(emptyPlan(), 'rect', 200, 100, '', 'b1').plan
    p = setPointSize(p, 'b1', 60, 40)
    expect(hitTest(p, 225, 112, { tol: 10 })).toEqual({ type: 'pt', id: 'b1' })
    expect(hitTest(p, 260, 112, { tol: 10 })).toBe(null)
  })
  it('does not steal taps from a wire or dot drawn over it', () => {
    let p = addPoint(emptyPlan(), 'rect', 200, 100, '', 'b1').plan
    p = setPointSize(p, 'b1', 80, 60)
    p = addLine(p, 'solid', 'green', 'normal', 160, 130, 240, 130, '', 'w1').plan
    p = addPoint(p, 'dot', 215, 100, '', 'dt').plan
    expect(hitTest(p, 200, 130, { tol: 10 }).id).toBe('w1')
    expect(hitTest(p, 216, 100, { tol: 10 }).id).toBe('dt')
  })
})

describe('dimension lines', () => {
  const dim = (extra = {}) => ({ id: 'm', t: 'dim', color: 'black', x1: 100, y1: 100, x2: 200, y2: 100, offset: 14, label: '', ...extra })

  it('a positive offset puts the dimension line above a left→right pair', () => {
    const g = dimGeometry(dim())
    expect([g.a.x, g.a.y, g.b.x, g.b.y]).toEqual([100, 86, 200, 86])
  })
  it('a negative offset puts it below; swapping the points flips the side', () => {
    expect(dimGeometry(dim({ offset: -14 })).a.y).toBe(114)
    expect(dimGeometry(dim({ x1: 200, x2: 100 })).a.y).toBe(114)
  })
  it('has extension lines back to the points, and an arrowhead at each end', () => {
    const g = dimGeometry(dim())
    expect(g.ext.length).toBe(2)
    expect(g.ext[0].y1).toBe(98)            // starts a small gap off the measured point
    expect(g.ext[0].y2).toBe(83)            // and runs a little past the dimension line
    expect(g.arrows.length).toBe(2)
    expect(g.arrows[0].tip).toEqual(g.a)
    expect(g.arrows[0].wings[0].x).toBeGreaterThan(g.a.x)   // wings point inwards
    expect(g.arrows[1].wings[0].x).toBeLessThan(g.b.x)
  })
  it('a tiny offset has no extension lines', () => {
    expect(dimGeometry(dim({ offset: 2 })).ext.length).toBe(0)
    expect(dimGeometry(dim({ offset: 0 })).ext.length).toBe(0)
  })
  it('offset handle sits in the middle of the dimension line', () => {
    expect(dimHandle(dim())).toEqual({ x: 150, y: 86 })
  })
  it('dragging the handle sets the offset (signed), keeps the line inside the box', () => {
    const el = dim()
    expect(offsetFromPoint(el, 150, 70)).toBe(30)
    expect(offsetFromPoint(el, 150, 130)).toBe(-30)
    expect(clampOffset(el, 9999)).toBe(100)   // y can't go above 0
    expect(clampOffset(el, -9999)).toBe(-(PLAN_H - 100))
    const p = addDim(emptyPlan(), 'black', 'aligned', 100, 100, 200, 100, 14, '', 'm').plan
    expect(setDimOffset(p, 'm', 25).els[0].offset).toBe(25)
  })
  it('addDim defaults the offset; label sits above the dimension line', () => {
    const p = addDim(emptyPlan(), 'red', 'aligned', 100, 100, 200, 100, undefined, '3.2m', 'm').plan
    expect(p.els[0].offset).toBe(DIM_DEFAULT_OFFSET)
    const lay = labelLayout(p.els[0])
    expect(lay.anchor).toBe('middle')
    expect(lay.y).toBeLessThan(100 - DIM_DEFAULT_OFFSET)
  })
  it('hit-testing finds a dimension by its line; selected dimension exposes handle + ends', () => {
    const p = addDim(emptyPlan(), 'black', 'aligned', 100, 100, 200, 100, 14, '', 'm').plan
    expect(hitTest(p, 150, 86, { tol: 10 })).toEqual({ type: 'ln', id: 'm' })
    expect(hitTest(p, 150, 86, { tol: 10, selectedId: 'm' })).toEqual({ type: 'offset', id: 'm' })
    expect(hitTest(p, 101, 100, { tol: 10, selectedId: 'm' })).toEqual({ type: 'end', id: 'm', end: 1 })
  })
})

describe('colours', () => {
  it('text and dimensions label in their own colour, everything else in ink', () => {
    expect(labelColor({ t: 'pt', kind: 'text', color: 'red' })).toBe(colorOf('red').hex)
    expect(labelColor({ t: 'dim', color: 'black' })).toBe(colorOf('black').hex)
    expect(labelColor({ t: 'ln', color: 'red' })).toBe(colorOf('blue').hex)
    expect(labelColor({ t: 'pt', kind: 'rect' })).toBe(colorOf('blue').hex)
  })
})

describe('dimension orientation', () => {
  // two points that are NOT level or plumb: (100,100) and (180,160)
  const dm = (orient, extra = {}) => ({ id: 'm', t: 'dim', color: 'black', orient, x1: 100, y1: 100, x2: 180, y2: 160, offset: 14, label: '', ...extra })

  it('defaults to aligned and normalizePlan fills it in', () => {
    const p = normalizePlan({ els: [
      { id: 'a', t: 'dim', x1: 0, y1: 0, x2: 50, y2: 0 },
      { id: 'b', t: 'dim', orient: 'diagonal', x1: 0, y1: 0, x2: 50, y2: 0 },
      { id: 'c', t: 'dim', orient: 'vertical', x1: 0, y1: 0, x2: 50, y2: 0 },
    ] })
    expect(p.els.map(e => e.orient)).toEqual(['aligned', 'aligned', 'vertical'])
  })
  it('aligned is parallel to the measured line', () => {
    const g = dimGeometry(dm('aligned'))
    expect((g.b.y - g.a.y) / (g.b.x - g.a.x)).toBeCloseTo(60 / 80, 5)
  })
  it('horizontal: a level line spanning the two x positions, above the higher point', () => {
    const g = dimGeometry(dm('horizontal'))
    expect(g.a).toEqual({ x: 100, y: 86 })
    expect(g.b).toEqual({ x: 180, y: 86 })
    // extension lines are plumb, and the farther point's is longer
    expect(g.ext[0].x1).toBe(100); expect(g.ext[0].x2).toBe(100)
    expect(g.ext[1].x1).toBe(180); expect(g.ext[1].x2).toBe(180)
    expect(Math.abs(g.ext[1].y1 - g.ext[1].y2)).toBeGreaterThan(Math.abs(g.ext[0].y1 - g.ext[0].y2))
  })
  it('horizontal with a negative offset goes below the lower point', () => {
    const g = dimGeometry(dm('horizontal', { offset: -14 }))
    expect(g.a.y).toBe(174)
    expect(g.b.y).toBe(174)
  })
  it('vertical: a plumb line spanning the two y positions, right of the right-hand point', () => {
    const g = dimGeometry(dm('vertical'))
    expect(g.a).toEqual({ x: 194, y: 100 })
    expect(g.b).toEqual({ x: 194, y: 160 })
    expect(g.ext[0].y1).toBe(100); expect(g.ext[0].y2).toBe(100)   // extension lines are level
  })
  it('vertical with a negative offset goes left of the left-hand point', () => {
    expect(dimGeometry(dm('vertical', { offset: -14 })).a.x).toBe(86)
  })
  it('arrowheads point along the dimension line', () => {
    const g = dimGeometry(dm('horizontal'))
    expect(g.arrows[0].wings[0].x).toBeGreaterThan(g.a.x)   // inwards
    expect(g.arrows[1].wings[0].x).toBeLessThan(g.b.x)
    expect(Math.abs(g.arrows[0].wings[0].y - g.a.y)).toBeLessThan(3)
  })
  it('dragging the handle sets the offset for each orientation', () => {
    expect(offsetFromPoint(dm('horizontal'), 140, 70)).toBe(30)     // 30 above the higher point
    expect(offsetFromPoint(dm('horizontal'), 140, 190)).toBe(-30)   // 30 below the lower point
    expect(offsetFromPoint(dm('horizontal'), 140, 130)).toBe(0)     // between the points
    expect(offsetFromPoint(dm('vertical'), 220, 130)).toBe(40)
    expect(offsetFromPoint(dm('vertical'), 60, 130)).toBe(-40)
  })
  it('labels follow the dimension line: level, plumb (reads upward) or aligned', () => {
    expect(labelLayout(dm('horizontal', { label: 'x' })).angle).toBe(0)
    expect(labelLayout(dm('vertical', { label: 'x' })).angle).toBe(-90)
    expect(labelLayout(dm('aligned', { label: 'x' })).angle).toBeCloseTo(36.87, 1)
  })
  it('the offset is kept inside the box for every orientation', () => {
    expect(clampOffset(dm('horizontal'), 9999)).toBe(100)             // top point is at y=100
    expect(clampOffset(dm('vertical'), 9999)).toBe(PLAN_W - 180)
  })
})

describe('snapping to centres, corners and midpoints', () => {
  // a 40×20 rectangle centred at (200,100): corners at x 180/220, y 90/110
  function rectPlan() {
    let p = addPoint(emptyPlan(), 'rect', 200, 100, '', 'r1').plan
    return setPointSize(p, 'r1', 40, 20)
  }
  const near = (p, x, y) => snapPoint(p, x, y, { step: 8, tol: 6 })

  it('snaps to each corner of a rectangle', () => {
    const p = rectPlan()
    for (const [cx, cy] of [[180, 90], [220, 90], [180, 110], [220, 110]]) {
      const s = near(p, cx + 2, cy - 2)
      expect([s.x, s.y, s.kind]).toEqual([cx, cy, 'corner'])
    }
  })
  it('snaps to the middle of each edge, and to the centre', () => {
    const p = rectPlan()
    for (const [mx, my] of [[200, 90], [200, 110], [180, 100], [220, 100]]) {
      const s = near(p, mx + 1, my + 1)
      expect([s.x, s.y]).toEqual([mx, my])
    }
    expect(near(p, 201, 101).kind).toBe('vertex')
    expect([near(p, 201, 101).x, near(p, 201, 101).y]).toEqual([200, 100])
  })
  it('snaps to the midpoint of a line', () => {
    let p = addLine(emptyPlan(), 'solid', 'black', 'normal', 100, 60, 200, 60, '', 'l1').plan
    const s = near(p, 151, 62)
    expect([s.x, s.y, s.kind]).toEqual([150, 60, 'mid'])
  })
  it('snaps to the top / bottom / left / right of a circle, but a dot just has its centre', () => {
    let p = addPoint(emptyPlan(), 'circle', 200, 100, '', 'c1').plan
    p = setPointSize(p, 'c1', 20, 20)
    expect(near(p, 211, 101).x).toBe(210)
    expect(near(p, 201, 89).y).toBe(90)
    const dot = addPoint(emptyPlan(), 'dot', 200, 100, '', 'd1').plan
    expect(snapTargets(dot).length).toBe(1)
  })
  it('falls back to the grid when nothing is close enough', () => {
    const s = near(rectPlan(), 300, 51)
    expect(s.snapped).toBe(false)
    expect(s.kind).toBe('grid')
  })
  it('a corner is not a draggable vertex — only centres and line ends are', () => {
    const p = rectPlan()
    expect(vertexRefs(p, 180, 90).length).toBe(0)
    expect(vertexRefs(p, 200, 100).length).toBe(1)
  })
  it('dragging a shape never snaps to its own corners or midpoints', () => {
    const p = rectPlan()
    const refs = vertexRefs(p, 200, 100)
    expect(snapPoint(p, 181, 91, { step: 8, tol: 6, exclude: refs }).snapped).toBe(false)
  })
  it('dragging a line end never snaps to that line\'s own midpoint', () => {
    const p = addLine(emptyPlan(), 'solid', 'black', 'normal', 100, 60, 200, 60, '', 'l1').plan
    const refs = vertexRefs(p, 100, 60)
    expect(snapPoint(p, 151, 61, { step: 8, tol: 6, exclude: refs }).snapped).toBe(false)
  })
  it('a wire snapped to a corner can then be measured from there', () => {
    let p = rectPlan()
    const s = near(p, 181, 91)
    p = addDim(p, 'black', 'horizontal', s.x, s.y, 300, 91, 14, '8m', 'dm').plan
    expect([p.els[1].x1, p.els[1].y1]).toEqual([180, 90])
  })
})

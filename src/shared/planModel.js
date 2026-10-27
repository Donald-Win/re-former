/**
 * planModel.js — data model + pure geometry for the structured "Dimensioned
 * PLAN" sketch (used by PlanSketchStep.jsx for editing and planPdf.js for
 * printing onto the form).
 *
 * Everything here is plain data and maths — no React, no pdf-lib — so it is
 * shared by the editor and the PDF generator (which runs inside a Web
 * Worker) and is unit tested (planModel.test.js).
 *
 * ── Coordinate space ────────────────────────────────────────────────────────
 * Plan coordinates are PDF points measured from the top-left of the form's
 * plan box (PLAN_BOX below). The editor's SVG viewBox is exactly
 * 0 0 PLAN_W PLAN_H, so what you see in the editor IS the layout that is
 * printed — a label that fits on screen fits on the form.
 *
 * ── Shape of a plan (stored in wizard state as d.plan) ──────────────────────
 *   {
 *     v: 1,
 *     north: 0,          // degrees clockwise from "up"
 *     northSet: false,   // false until the tech taps/rotates the north point;
 *                        // the arrow is only printed once it has been set
 *     els: [
 *       // A SHAPE — rectangle | circle | dot — or free TEXT. Shapes have no
 *       // built-in meaning: the label says what they are (pole, box, rod…).
 *       // labelPos: where the label sits — 'top' | 'bottom' | 'left' | 'right' (default) | 'center'
 *       { id, t:'pt', kind:'rect', x, y, w?, h?, color, label, labelPos },
 *       { id, t:'pt', kind:'text', x, y, color, label },
 *       // A LINE: any pattern, colour and weight.
 *       { id, t:'ln', pattern:'dashed', color:'green', weight:'normal',
 *                     x1, y1, x2, y2, label },
 *       // A DIMENSION between two points, drawn `offset` units to one side.
 *       // orient: 'aligned' (parallel to the measured line), 'horizontal'
 *       // or 'vertical' (measures only the horizontal / vertical distance).
 *       { id, t:'dim', color:'black', orient:'aligned', x1, y1, x2, y2, offset, label },
 *     ]
 *   }
 * Elements are independent records; two things "join" simply by having a
 * vertex at the same coordinates. moveVertex() drags everything that shares
 * a vertex together, so joins (and the points a dimension measures) survive
 * editing.
 */

// ── Layout of the printed plan box on 360S014EJ (A4 portrait) ───────────────
// Measured from the form's light-blue grid. `x`/`y` are the box's top-left
// in top-origin PDF points; NORTH is the printed circle ("Include North arrow
// in circle"), relative to the box.
export const PLAN_BOX = { x: 40, y: 458, w: 513, h: 242 }
export const PLAN_W = PLAN_BOX.w
export const PLAN_H = PLAN_BOX.h
export const NORTH = { cx: 31.75, cy: 32.5, r: 23 }

export const LABEL_SIZE = 8

export const INK     = '#0014a0'
export const INK_RGB = [0, 20 / 255, 160 / 255]

// ── Colours (shapes, lines, text and dimensions) ────────────────────────────────────
// `rgb` is 0–1 for pdf-lib's rgb().
export const COLORS = [
  { id: 'red',    label: 'Red',    hex: '#dc2626', rgb: [0.86, 0.15, 0.15] },
  { id: 'yellow', label: 'Yellow', hex: '#e0a800', rgb: [0.88, 0.66, 0.0] },
  { id: 'blue',   label: 'Blue',   hex: INK,       rgb: INK_RGB },
  { id: 'green',  label: 'Green',  hex: '#15803d', rgb: [0.08, 0.5, 0.22] },
  { id: 'black',  label: 'Black',  hex: '#111111', rgb: [0.07, 0.07, 0.07] },
]

// ── Line patterns and weights ───────────────────────────────────────────────
// `dash` is in multiples of the line's width, so a thick dashed line gets
// proportionally longer dashes instead of turning into a smear.
export const LINE_PATTERNS = [
  { id: 'solid',   label: 'Solid',    dash: null },
  { id: 'dashed',  label: 'Dashed',   dash: [5, 2.2] },
  { id: 'dotted',  label: 'Dotted',   dash: [1, 2.2] },
  { id: 'dashdot', label: 'Dash-dot', dash: [6.5, 2.2, 1.2, 2.2] },
]

export const LINE_WEIGHTS = [
  { id: 'fine',   label: 'Fine',   width: 0.8 },
  { id: 'normal', label: 'Normal', width: 1.4 },
  { id: 'thick',  label: 'Thick',  width: 2.4 },
  { id: 'heavy',  label: 'Heavy',  width: 3.6 },
]

// ── Shapes ──────────────────────────────────────────────────────────────────
// Generic on purpose. `r` is the DEFAULT radius / half-width — the real size
// can be changed per element (see pointSize). fillOpacity: a light tint for
// rectangle and circle; the dot is solid (it's a marker, not an area).
export const POINT_KINDS = [
  { id: 'rect',   label: 'Rectangle', shape: 'square', r: 6,   fillOpacity: 0.2 },
  { id: 'circle', label: 'Circle',    shape: 'circle', r: 6,   fillOpacity: 0.2 },
  { id: 'dot',    label: 'Dot',       shape: 'circle', r: 2.5, fillOpacity: 1 },
  { id: 'text',   label: 'Text',      shape: 'none',   r: 0,   fillOpacity: 0 },
]

// Where a shape's label sits relative to the shape.
export const LABEL_POSITIONS = [
  { id: 'top',    label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left',   label: 'Left' },
  { id: 'right',  label: 'Right' },
  { id: 'center', label: 'Center' },
]
const LABEL_POS_IDS = new Set(LABEL_POSITIONS.map(o => o.id))

export const SIZE_MIN = 3
export const SIZE_MAX = 120

export const DIM_ORIENTS = [
  { id: 'aligned',    label: 'Aligned' },
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'vertical',   label: 'Vertical' },
]
const ORIENT_IDS = new Set(DIM_ORIENTS.map(o => o.id))

export const DIM_DEFAULT_OFFSET = 14
const DIM_EXT_GAP  = 2      // gap between a measured point and its extension line
const DIM_EXT_OVER = 3      // how far an extension line runs past the dimension line
const DIM_ARROW    = 5      // arrowhead length

const PATTERN_IDS = new Set(LINE_PATTERNS.map(k => k.id))
const WEIGHT_IDS  = new Set(LINE_WEIGHTS.map(k => k.id))
const COLOR_IDS   = new Set(COLORS.map(k => k.id))
const POINT_IDS   = new Set(POINT_KINDS.map(k => k.id))

export const linePattern = id => LINE_PATTERNS.find(k => k.id === id) || LINE_PATTERNS[0]
export const lineWeight  = id => LINE_WEIGHTS.find(k => k.id === id)  || LINE_WEIGHTS[1]
export const colorOf     = id => COLORS.find(k => k.id === id)        || COLORS[2]
export const pointKind   = id => POINT_KINDS.find(k => k.id === id)   || POINT_KINDS[0]

/** Stroke width (plan units) of a line element. */
export const lineWidth = el => lineWeight(el.weight).width

/** Dash array (plan units) for a line element, or null when solid. */
export function lineDash(el) {
  const p = linePattern(el.pattern)
  if (!p.dash) return null
  const w = lineWidth(el)
  return p.dash.map(m => Math.round(m * w * 100) / 100)
}

/**
 * Colour used for an element's label: text and dimensions use their own;
 * labels on shapes and lines stay ink blue so they read consistently.
 */
export function labelColor(el) {
  return (el.t === 'dim' || (el.t === 'pt' && el.kind === 'text')) ? colorOf(el.color).hex : INK
}
export function labelRgb(el) {
  return (el.t === 'dim' || (el.t === 'pt' && el.kind === 'text')) ? colorOf(el.color).rgb : INK_RGB
}

// ── Small helpers ───────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const cx_ = x => clamp(x, 0, PLAN_W)
const cy_ = y => clamp(y, 0, PLAN_H)
const isNum = v => typeof v === 'number' && Number.isFinite(v)
const inBox = (x, y) => x >= 0 && x <= PLAN_W && y >= 0 && y <= PLAN_H

export function newId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function emptyPlan() {
  return { v: 1, north: 0, northSet: false, els: [] }
}

// Plans saved while the editor was still being built used named kinds
// (pole / tx / box / rod). Anything unrecognised just falls back to a default.
const LEGACY_POINT = { pole: 'circle', tx: 'rect', box: 'rect', rod: 'dot' }

/**
 * Make any stored value safe to use: wrong shapes become an empty plan,
 * unknown kinds / non-numeric coordinates are dropped, coordinates are
 * clamped into the box. Used when loading drafts and crash-recovery data.
 */
export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') return emptyPlan()
  const els = []
  for (const e of Array.isArray(raw.els) ? raw.els : []) {
    if (!e || typeof e.id !== 'string') continue
    const label = typeof e.label === 'string' ? e.label : ''

    if (e.t === 'pt' && isNum(e.x) && isNum(e.y)) {
      const kind = POINT_IDS.has(e.kind) ? e.kind : LEGACY_POINT[e.kind]
      if (!kind) continue
      const el = { id: e.id, t: 'pt', kind, x: cx_(e.x), y: cy_(e.y), label }
      if (isNum(e.w)) el.w = clamp(e.w, SIZE_MIN, SIZE_MAX)
      if (isNum(e.h)) el.h = clamp(e.h, SIZE_MIN, SIZE_MAX)
      el.color = COLOR_IDS.has(e.color) ? e.color : 'blue'
      if (kind !== 'text') el.labelPos = LABEL_POS_IDS.has(e.labelPos) ? e.labelPos : 'right'
      els.push(el)
    } else if (e.t === 'ln' && isNum(e.x1) && isNum(e.y1) && isNum(e.x2) && isNum(e.y2)) {
      // `style` was this field's earlier name; 'thick' used to be a style.
      const patternRaw = e.pattern ?? e.style
      els.push({
        id: e.id, t: 'ln',
        pattern: PATTERN_IDS.has(patternRaw) ? patternRaw : 'solid',
        color:   COLOR_IDS.has(e.color) ? e.color : 'blue',
        weight:  WEIGHT_IDS.has(e.weight) ? e.weight : (e.style === 'thick' ? 'thick' : 'normal'),
        x1: cx_(e.x1), y1: cy_(e.y1), x2: cx_(e.x2), y2: cy_(e.y2), label,
      })
    } else if (e.t === 'dim' && isNum(e.x1) && isNum(e.y1) && isNum(e.x2) && isNum(e.y2)) {
      const el = {
        id: e.id, t: 'dim',
        color: COLOR_IDS.has(e.color) ? e.color : 'black',
        orient: ORIENT_IDS.has(e.orient) ? e.orient : 'aligned',
        x1: cx_(e.x1), y1: cy_(e.y1), x2: cx_(e.x2), y2: cy_(e.y2),
        offset: isNum(e.offset) ? e.offset : DIM_DEFAULT_OFFSET, label,
      }
      el.offset = clampOffset(el, el.offset)
      els.push(el)
    }
  }
  const north = isNum(raw.north) ? ((raw.north % 360) + 360) % 360 : 0
  return { v: 1, north, northSet: !!raw.northSet, els }
}

// ── Edits (all return a NEW plan; nothing mutates) ──────────────────────────
export function addPoint(plan, kind, x, y, label = '', id = newId(), extra = {}) {
  const el = { id, t: 'pt', kind, x: cx_(x), y: cy_(y), label, ...extra }
  return { plan: { ...plan, els: [...plan.els, el] }, id }
}

export function addLine(plan, pattern, color, weight, x1, y1, x2, y2, label = '', id = newId()) {
  const el = { id, t: 'ln', pattern, color, weight, x1: cx_(x1), y1: cy_(y1), x2: cx_(x2), y2: cy_(y2), label }
  return { plan: { ...plan, els: [...plan.els, el] }, id }
}

export function addDim(plan, color, orient, x1, y1, x2, y2, offset = DIM_DEFAULT_OFFSET, label = '', id = newId()) {
  const el = { id, t: 'dim', color, orient, x1: cx_(x1), y1: cy_(y1), x2: cx_(x2), y2: cy_(y2), offset, label }
  el.offset = clampOffset(el, offset)
  return { plan: { ...plan, els: [...plan.els, el] }, id }
}

export function updateEl(plan, id, patch) {
  return { ...plan, els: plan.els.map(e => (e.id === id ? { ...e, ...patch } : e)) }
}

export function removeEl(plan, id) {
  return { ...plan, els: plan.els.filter(e => e.id !== id) }
}

export function setNorth(plan, deg) {
  return { ...plan, north: ((deg % 360) + 360) % 360, northSet: true }
}

// ── Point sizes ─────────────────────────────────────────────────────────────
/** Effective { w, h } of a shape (circles and dots are always round: h === w). */
export function pointSize(el) {
  const k = pointKind(el.kind)
  if (k.shape === 'none') return { w: 0, h: 0 }
  const def = k.r * 2
  const w = isNum(el.w) ? clamp(el.w, SIZE_MIN, SIZE_MAX) : def
  const h = k.shape === 'circle' ? w : (isNum(el.h) ? clamp(el.h, SIZE_MIN, SIZE_MAX) : def)
  return { w, h }
}

export function setPointSize(plan, id, w, h) {
  return {
    ...plan,
    els: plan.els.map(e => {
      if (e.id !== id || e.t !== 'pt') return e
      const ww = clamp(Math.round(w), SIZE_MIN, SIZE_MAX)
      const hh = pointKind(e.kind).shape === 'circle' ? ww : clamp(Math.round(h), SIZE_MIN, SIZE_MAX)
      return { ...e, w: ww, h: hh }
    }),
  }
}

const DIAG = Math.SQRT1_2

/**
 * The drag handle for resizing a shape, sitting just outside its
 * bottom-right corner (`off` pushes it clear of the shape so it can be
 * grabbed even on a tiny one). null for shapeless points (text).
 */
export function resizeHandle(el, off = 0) {
  if (el.t !== 'pt') return null
  const k = pointKind(el.kind)
  if (k.shape === 'none') return null
  const { w, h } = pointSize(el)
  if (k.shape === 'circle') {
    const d = (w / 2 + off) * DIAG
    return { x: el.x + d, y: el.y + d }
  }
  return { x: el.x + w / 2 + off, y: el.y + h / 2 + off }
}

/** Inverse of resizeHandle: the size that puts the handle at (px, py). */
export function sizeFromHandle(el, px, py, off = 0) {
  const k = pointKind(el.kind)
  if (k.shape === 'circle') {
    const w = 2 * (Math.hypot(px - el.x, py - el.y) - off)
    return { w, h: w }
  }
  return { w: 2 * (px - el.x - off), h: 2 * (py - el.y - off) }
}

// ── Dimension lines ─────────────────────────────────────────────────────────
const rot = (v, th) => ({ x: v.x * Math.cos(th) - v.y * Math.sin(th), y: v.x * Math.sin(th) + v.y * Math.cos(th) })

/**
 * The dimension line's two ends for a given offset.
 *   aligned    parallel to the measured line, `offset` units along its normal
 *              (for a left→right pair, positive = above)
 *   horizontal measures only the horizontal distance: a horizontal line,
 *              positive offset = above the higher point, negative = below
 *              the lower one
 *   vertical   measures only the vertical distance: a vertical line,
 *              positive offset = right of the right-hand point, negative =
 *              left of the left-hand one
 */
function dimEnds(el, offset) {
  const orient = el.orient || 'aligned'
  if (orient === 'horizontal') {
    const yRef = offset >= 0 ? Math.min(el.y1, el.y2) : Math.max(el.y1, el.y2)
    const yd = yRef - offset
    return { a: { x: el.x1, y: yd }, b: { x: el.x2, y: yd } }
  }
  if (orient === 'vertical') {
    const xRef = offset >= 0 ? Math.max(el.x1, el.x2) : Math.min(el.x1, el.x2)
    const xd = xRef + offset
    return { a: { x: xd, y: el.y1 }, b: { x: xd, y: el.y2 } }
  }
  const dx = el.x2 - el.x1, dy = el.y2 - el.y1
  const len = Math.hypot(dx, dy) || 1
  const n = { x: dy / len, y: -dx / len }              // for p1→p2 pointing right, n points UP
  return {
    a: { x: el.x1 + n.x * offset, y: el.y1 + n.y * offset },
    b: { x: el.x2 + n.x * offset, y: el.y2 + n.y * offset },
  }
}

/**
 * Everything needed to draw a dimension: the dimension line a→b, two
 * extension lines back to the measured points, and an arrowhead at each end
 * (tip on the extension line, wings pointing inwards).
 */
export function dimGeometry(el) {
  const { a, b } = dimEnds(el, el.offset || 0)
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const u = len > 0.001 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 }

  const ext = []
  for (const [P, A] of [[{ x: el.x1, y: el.y1 }, a], [{ x: el.x2, y: el.y2 }, b]]) {
    const dist = Math.hypot(A.x - P.x, A.y - P.y)
    if (dist <= DIM_EXT_GAP + 1) continue              // dimension line is (almost) on the point
    const dir = { x: (A.x - P.x) / dist, y: (A.y - P.y) / dist }
    ext.push({
      x1: P.x + dir.x * DIM_EXT_GAP, y1: P.y + dir.y * DIM_EXT_GAP,
      x2: A.x + dir.x * DIM_EXT_OVER, y2: A.y + dir.y * DIM_EXT_OVER,
    })
  }

  const th = (22 * Math.PI) / 180
  const wings = (tip, dir) => [th, -th].map(t => {
    const r = rot(dir, t)
    return { x: tip.x + r.x * DIM_ARROW, y: tip.y + r.y * DIM_ARROW }
  })
  return {
    a, b, ext,
    arrows: [
      { tip: a, wings: wings(a, u) },
      { tip: b, wings: wings(b, { x: -u.x, y: -u.y }) },
    ],
  }
}

/** Keep a dimension line inside the plan box, and round to a whole unit. */
export function clampOffset(el, off) {
  let o = Math.round(off)
  const fits = v => {
    const { a, b } = dimEnds(el, v)
    return inBox(a.x, a.y) && inBox(b.x, b.y)
  }
  while (o !== 0 && !fits(o)) o -= Math.sign(o)
  return o
}

export function setDimOffset(plan, id, off) {
  return {
    ...plan,
    els: plan.els.map(e => (e.id === id && e.t === 'dim' ? { ...e, offset: clampOffset(e, off) } : e)),
  }
}

/** The offset that places the dimension line under the point (px, py). */
export function offsetFromPoint(el, px, py) {
  const orient = el.orient || 'aligned'
  if (orient === 'horizontal') {
    const lo = Math.min(el.y1, el.y2), hi = Math.max(el.y1, el.y2)
    return py < lo ? lo - py : py > hi ? -(py - hi) : 0
  }
  if (orient === 'vertical') {
    const lo = Math.min(el.x1, el.x2), hi = Math.max(el.x1, el.x2)
    return px > hi ? px - hi : px < lo ? -(lo - px) : 0
  }
  const dx = el.x2 - el.x1, dy = el.y2 - el.y1
  const len = Math.hypot(dx, dy) || 1
  const mx = (el.x1 + el.x2) / 2, my = (el.y1 + el.y2) / 2
  return (px - mx) * (dy / len) + (py - my) * (-dx / len)
}

/** Where the offset handle sits: the middle of the dimension line. */
export function dimHandle(el) {
  const { a, b } = dimGeometry(el)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// ── Geometry ────────────────────────────────────────────────────────────────
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1)
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function lineLength(el) {
  return Math.hypot(el.x2 - el.x1, el.y2 - el.y1)
}

// Every draggable vertex: points, and both ends of every line / dimension.
// A "ref" is { id, end } where end is 'p' (point) or 1 / 2 (line end).
const refKey = r => `${r.id}:${r.end}`

function vertices(plan) {
  const out = []
  for (const e of plan.els) {
    if (e.t === 'pt') out.push({ ref: { id: e.id, end: 'p' }, x: e.x, y: e.y })
    else {
      out.push({ ref: { id: e.id, end: 1 }, x: e.x1, y: e.y1 })
      out.push({ ref: { id: e.id, end: 2 }, x: e.x2, y: e.y2 })
    }
  }
  return out
}

/**
 * Everything a tap can snap onto.
 *   vertex — the centre of a shape / text, both ends of a line or dimension
 *            (these carry a `ref`, and are what moveVertex drags)
 *   corner — the four corners of a rectangle
 *   mid    — the middle of a line, the middle of each edge of a rectangle,
 *            and the top / bottom / left / right of a circle
 * Corners and midpoints are derived from their element (`id`), so they move
 * when it does but can't be dragged themselves.
 */
export function snapTargets(plan) {
  const out = []
  for (const v of vertices(plan)) out.push({ x: v.x, y: v.y, kind: 'vertex', ref: v.ref, id: v.ref.id })
  for (const e of plan.els) {
    if (e.t === 'ln') {
      out.push({ x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2, kind: 'mid', id: e.id })
    } else if (e.t === 'pt') {
      const k = pointKind(e.kind)
      const { w, h } = pointSize(e)
      if (k.shape === 'square') {
        const l = e.x - w / 2, r = e.x + w / 2, t = e.y - h / 2, b = e.y + h / 2
        for (const [x, y] of [[l, t], [r, t], [l, b], [r, b]]) out.push({ x, y, kind: 'corner', id: e.id })
        for (const [x, y] of [[e.x, t], [e.x, b], [l, e.y], [r, e.y]]) out.push({ x, y, kind: 'mid', id: e.id })
      } else if (k.shape === 'circle' && w >= 8) {      // a dot is too small to have separate edge points
        for (const [x, y] of [[e.x - w / 2, e.y], [e.x + w / 2, e.y], [e.x, e.y - w / 2], [e.x, e.y + w / 2]]) {
          out.push({ x, y, kind: 'mid', id: e.id })
        }
      }
    }
  }
  return out
}

/**
 * Snap a tapped/dragged position: onto the nearest snap target within `tol`
 * (centres, line ends, rectangle corners, edge and line midpoints — this is
 * what joins a wire to a shape, or pins a dimension to what it measures),
 * otherwise onto the grid. `exclude` is a list of vertex refs being dragged:
 * those vertices, and the corners/midpoints of the elements they belong to,
 * are ignored so a shape can't snap to itself. Returns { x, y, snapped, kind }.
 */
export function snapPoint(plan, x, y, { step = 8, tol = 8, exclude = [] } = {}) {
  const skipRefs = new Set(exclude.map(refKey))
  const skipIds  = new Set(exclude.map(r => r.id))
  // Corners / midpoints count as slightly further away than they are, so on a
  // small shape a tap that's about as close to the centre as to an edge
  // picks the centre (and line ends beat midpoints).
  const DERIVED_PENALTY = 1.5
  let best = null, bd = Infinity
  for (const t of snapTargets(plan)) {
    if (t.ref ? skipRefs.has(refKey(t.ref)) : skipIds.has(t.id)) continue
    const d = Math.hypot(x - t.x, y - t.y)
    if (d > tol) continue
    const eff = d + (t.ref ? 0 : DERIVED_PENALTY)
    if (eff < bd) { best = t; bd = eff }
  }
  if (best) return { x: cx_(best.x), y: cy_(best.y), snapped: true, kind: best.kind }
  return {
    x: cx_(Math.round(x / step) * step),
    y: cy_(Math.round(y / step) * step),
    snapped: false,
    kind: 'grid',
  }
}

/** Every vertex sitting (within eps) at x,y — the cluster that moves together. */
export function vertexRefs(plan, x, y, eps = 0.6) {
  return vertices(plan)
    .filter(v => Math.abs(v.x - x) <= eps && Math.abs(v.y - y) <= eps)
    .map(v => v.ref)
}

export function moveVertex(plan, refs, x, y) {
  const nx = cx_(x), ny = cy_(y)
  const byId = new Map()
  for (const r of refs) byId.set(r.id, [...(byId.get(r.id) || []), r.end])
  return {
    ...plan,
    els: plan.els.map(e => {
      const ends = byId.get(e.id)
      if (!ends) return e
      if (e.t === 'pt') return { ...e, x: nx, y: ny }
      let next = e
      if (ends.includes(1)) next = { ...next, x1: nx, y1: ny }
      if (ends.includes(2)) next = { ...next, x2: nx, y2: ny }
      if (next.t === 'dim') next = { ...next, offset: clampOffset(next, next.offset) }
      return next
    }),
  }
}

/** Segments that make up a line-like element's clickable body. */
function bodySegments(e) {
  if (e.t === 'ln') return [[e.x1, e.y1, e.x2, e.y2]]
  const g = dimGeometry(e)
  return [[g.a.x, g.a.y, g.b.x, g.b.y], ...g.ext.map(s => [s.x1, s.y1, s.x2, s.y2])]
}

/**
 * What did a tap/press at (x,y) land on?  `tol` is in plan units.
 * Priority: north circle → ends of the SELECTED line/dimension → the offset
 * handle of the SELECTED dimension → the resize handle of the SELECTED shape
 * → point centres (and text) → lines and dimensions → shape bodies.
 * Bodies come last so a big rectangle never blocks the wires and points
 * drawn over it.
 * Returns { type:'north' } | { type:'end', id, end } | { type:'offset', id } |
 * { type:'resize', id } | { type:'pt', id } | { type:'ln', id } | null.
 * (Lines and dimensions both report 'ln'; look the element up for its `t`.)
 */
export function hitTest(plan, x, y, { tol = 10, selectedId = null, handleOff = 0 } = {}) {
  if (Math.hypot(x - NORTH.cx, y - NORTH.cy) <= NORTH.r) return { type: 'north' }

  const sel = plan.els.find(e => e.id === selectedId)
  if (sel && sel.t === 'dim') {
    const h = dimHandle(sel)
    if (Math.hypot(x - h.x, y - h.y) <= tol) return { type: 'offset', id: sel.id }
  }
  if (sel && (sel.t === 'ln' || sel.t === 'dim')) {
    const d1 = Math.hypot(x - sel.x1, y - sel.y1)
    const d2 = Math.hypot(x - sel.x2, y - sel.y2)
    if (Math.min(d1, d2) <= tol) return { type: 'end', id: sel.id, end: d1 <= d2 ? 1 : 2 }
  }
  if (sel && sel.t === 'pt') {
    const hnd = resizeHandle(sel, handleOff)
    if (hnd && Math.hypot(x - hnd.x, y - hnd.y) <= tol) return { type: 'resize', id: sel.id }
  }

  let best = null, bd = Infinity
  for (const e of plan.els) {
    if (e.t !== 'pt') continue
    let d = Math.hypot(x - e.x, y - e.y)
    // Free text has no marker, so its printed text is the target.
    if (e.kind === 'text' && e.label) {
      const halfW = (e.label.length * LABEL_SIZE * 0.55) / 2
      if (Math.abs(x - e.x) <= halfW && Math.abs(y - e.y) <= LABEL_SIZE * 0.8) d = 0
    }
    if (d <= tol && d < bd) { best = e; bd = d }
  }
  if (best) return { type: 'pt', id: best.id }

  best = null; bd = Infinity
  for (const e of plan.els) {
    if (e.t === 'pt') continue
    for (const s of bodySegments(e)) {
      const d = distToSegment(x, y, s[0], s[1], s[2], s[3])
      if (d <= tol * 0.8 && d < bd) { best = e; bd = d }
    }
  }
  if (best) return { type: 'ln', id: best.id }

  // Shape bodies (smallest first, so a small shape inside a big one wins)
  best = null; bd = Infinity
  for (const e of plan.els) {
    if (e.t !== 'pt') continue
    const k = pointKind(e.kind)
    if (k.shape === 'none') continue
    const { w, h } = pointSize(e)
    const slack = tol * 0.3
    const inside = k.shape === 'circle'
      ? Math.hypot(x - e.x, y - e.y) <= w / 2 + slack
      : Math.abs(x - e.x) <= w / 2 + slack && Math.abs(y - e.y) <= h / 2 + slack
    const area = w * h
    if (inside && area < bd) { best = e; bd = area }
  }
  return best ? { type: 'pt', id: best.id } : null
}

// Label for a straight segment: centred on it, rotated to follow it, and
// lifted off it on the "up" side of the text. Angles are folded into
// [-90, 90) so text is never upside down: a vertical line reads bottom-to-top.
function segmentLabel(x1, y1, x2, y2, clearance) {
  let a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  if (a >= 90) a -= 180
  if (a < -90) a += 180
  const th = (a * Math.PI) / 180
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return {
    x: mx + Math.sin(th) * clearance,
    y: my - Math.cos(th) * clearance,
    anchor: 'middle',
    angle: Math.round(a * 100) / 100,
  }
}

/**
 * Where an element's label goes: { x, y, anchor, angle } with y the vertical
 * CENTRE of the text, anchor 'start' | 'middle' | 'end', and angle in degrees
 * clockwise (0 = horizontal). Line and dimension labels follow the line.
 * Used by both the editor and the PDF so they always agree. Returns null
 * when there's no label.
 */
export function labelLayout(el) {
  if (!el.label) return null
  if (el.t === 'pt') {
    if (el.kind === 'text') return { x: el.x, y: el.y, anchor: 'middle', angle: 0 }
    const { w, h } = pointSize(el)
    switch (LABEL_POS_IDS.has(el.labelPos) ? el.labelPos : 'right') {
      case 'left':   return { x: el.x - w / 2 - 3, y: el.y, anchor: 'end', angle: 0 }
      case 'top':    return { x: el.x, y: el.y - h / 2 - 6, anchor: 'middle', angle: 0 }
      case 'bottom': return { x: el.x, y: el.y + h / 2 + 6, anchor: 'middle', angle: 0 }
      case 'center': return { x: el.x, y: el.y, anchor: 'middle', angle: 0 }
      default:       return { x: el.x + w / 2 + 3, y: el.y, anchor: 'start', angle: 0 }
    }
  }
  if (el.t === 'dim') {
    const { a, b } = dimGeometry(el)
    return segmentLabel(a.x, a.y, b.x, b.y, 6)
  }
  return segmentLabel(el.x1, el.y1, el.x2, el.y2, 5.5 + lineWidth(el) / 2)
}

// ── North arrow ─────────────────────────────────────────────────────────────
/** Angle (degrees clockwise from up, snapped to 5°) of (x,y) around the north circle. */
export function angleFromNorthCentre(x, y) {
  const deg = (Math.atan2(x - NORTH.cx, -(y - NORTH.cy)) * 180) / Math.PI
  return ((Math.round(deg / 5) * 5) % 360 + 360) % 360
}

/** Points for drawing the arrow inside the printed circle, in plan coordinates. */
export function northGeometry(deg) {
  const a = (deg * Math.PI) / 180
  const dir = { x: Math.sin(a), y: -Math.cos(a) }
  const at = (k) => ({ x: NORTH.cx + dir.x * k, y: NORTH.cy + dir.y * k })
  const head = at(NORTH.r * 0.78)
  const tail = at(-NORTH.r * 0.5)
  const wing = (theta) => {
    const c = Math.cos(theta), s = Math.sin(theta)
    return { x: head.x + (dir.x * c - dir.y * s) * 5.5, y: head.y + (dir.x * s + dir.y * c) * 5.5 }
  }
  const rad150 = (150 * Math.PI) / 180
  return { head, tail, wings: [wing(rad150), wing(-rad150)], label: at(NORTH.r + 7) }
}

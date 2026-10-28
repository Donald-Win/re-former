/**
 * PlanSketchStep — structured "Dimensioned PLAN" editor for forms that carry
 * a hand-drawn plan (first used by 360S014EJ).
 *
 * The wizard step shows a thumbnail of the plan and an "Edit plan" button;
 * the editor itself opens full-screen over the wizard.
 *
 * Editing model (all finger-friendly — taps and drags, no fine drawing).
 * Once something has been drawn the editor goes straight back to Select with
 * the new item selected, so it can be labelled / adjusted immediately; pick
 * a tool again to draw the next one (its settings are remembered).
 *   • Select — tap an item to edit it (label, colour, pattern, size…) or
 *     delete it; drag a shape, or a selected line/dimension's end handle, to
 *     move it. Only the item you grab moves — a wire or dimension that ends on
 *     the same spot stays put (snapping makes it easy to rejoin).
 *   • Shape  — rectangle, circle or dot, in any colour. Shapes mean nothing by
 *     themselves: give them a label (pole, box, rod…) and choose where it sits
 *     (top, bottom, left, right or centre). A selected shape can be resized
 *     (the dot is the exception: one fixed size, for joints and earth rods)
 *     (drag the corner handle or use the size buttons); rectangles can be
 *     any width × height.
 *   • Line   — tap start then end. Choose pattern, colour and weight.
 *   • Dim    — tap two points; a dimension line with arrowheads is drawn
 *     beside them, aligned with the measured line or strictly horizontal /
 *     vertical. Drag its centre handle (or use the buttons) to change how
 *     far it sits from the points. Type the dimension as its label.
 *   • Text   — free text with a choice of colour.
 *   • Drag the printed north circle (top-left) to rotate the north arrow.
 *   • Zoom — pinch with two fingers (the plan stays under your fingers, and
 *     moving them pans), or use the − / + / Fit bar. Dragging empty canvas
 *     scrolls with one finger. Ctrl + mouse wheel zooms on a desktop.
 *
 * Positions snap to centres, line ends, rectangle corners and the midpoints
 * of lines and edges (so wires join shapes, and dimensions pin to what they
 * measure) and otherwise to a grid that gets finer as you zoom. While a
 * line / dimension / shape tool is active the available corner and
 * midpoint targets are shown as small diamonds, and a ring marks the target
 * you're snapped to while dragging. All data and geometry live in planModel.js (unit tested); this file
 * is UI. What you see is what prints: the SVG viewBox is the plan box in PDF
 * points.
 */
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId } from 'react'
import { WF, SectionHead } from './WizardInputs'
import { APP_ACCENT } from './constants'
import {
  PLAN_W, PLAN_H, NORTH, LABEL_SIZE, INK,
  COLORS, LINE_PATTERNS, LINE_WEIGHTS, POINT_KINDS, DIM_ORIENTS, LABEL_POSITIONS,
  colorOf, linePattern, lineWeight, lineDash, lineWidth, pointKind, labelColor,
  normalizePlan, emptyPlan, addPoint, addLine, addDim, updateEl, removeEl, setNorth,
  pointSize, setPointSize, resizeHandle, sizeFromHandle, SIZE_MIN, SIZE_MAX,
  dimGeometry, dimHandle, offsetFromPoint, setDimOffset,
  snapPoint, snapTargets, dragRefs, moveVertex, hitTest, labelLayout,
  angleFromNorthCentre, northGeometry,
} from './planModel'
import { ZOOM_MIN, ZOOM_MAX, clampZoom, snapStepForZoom, zoomFromPinch, scrollForAnchor } from './planView'

const PAD = 6                                  // padding of the scrollable canvas area (px)
const FONT = "'Segoe UI', system-ui, sans-serif"
const SHAPE_KINDS = POINT_KINDS.filter(k => k.id !== 'text')
const SHAPE_GLYPH = { rect: '▭', circle: '◯', dot: '●' }

// ── Rendering (shared by the thumbnail and the editor) ───────────────────────
export function PlanSvg({
  plan, selectedId = null, pending = null, ppu = 1, editing = false,
  snapMarks = null, snapHint = null,
  svgRef = null, style, ...rest
}) {
  const uid  = useId().replace(/:/g, '')
  const hr   = 7 / ppu                        // handle radius ≈ 7 screen px
  const hOff = 6 / ppu                        // resize handle sits this far outside the corner
  const hw   = 1.6 / Math.max(ppu, 0.5)       // handle outline width
  const north = northGeometry(plan.north)
  const northOpacity = plan.northSet ? 1 : 0.35
  const sel = plan.els.find(e => e.id === selectedId) || null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
      style={{ display: 'block', width: '100%', background: '#fff', ...style }}
      {...rest}
    >
      <defs>
        <pattern id={`g${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="#cfe3f5" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width={PLAN_W} height={PLAN_H} fill={`url(#g${uid})`} />

      {/* printed north circle + arrow */}
      <circle cx={NORTH.cx} cy={NORTH.cy} r={NORTH.r} fill="#fff" stroke="#111" strokeWidth="1.2" />
      <g opacity={northOpacity} stroke={INK} strokeWidth="1.4" strokeLinecap="round">
        <line x1={north.tail.x} y1={north.tail.y} x2={north.head.x} y2={north.head.y} />
        <line x1={north.head.x} y1={north.head.y} x2={north.wings[0].x} y2={north.wings[0].y} />
        <line x1={north.head.x} y1={north.head.y} x2={north.wings[1].x} y2={north.wings[1].y} />
        <text x={north.label.x} y={north.label.y} dy=".35em" textAnchor="middle"
          fontSize="8" fill={INK} stroke="none" fontFamily={FONT}>N</text>
      </g>

      {/* lines */}
      {plan.els.filter(e => e.t === 'ln').map(e => {
        const dash = lineDash(e)
        return (
          <g key={e.id}>
            {e.id === selectedId && (
              <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke="#fbbf24" strokeWidth={lineWidth(e) + 5} opacity="0.55" strokeLinecap="round" />
            )}
            <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={colorOf(e.color).hex} strokeWidth={lineWidth(e)}
              strokeDasharray={dash ? dash.join(' ') : undefined} />
          </g>
        )
      })}

      {/* dimensions */}
      {plan.els.filter(e => e.t === 'dim').map(e => {
        const g = dimGeometry(e)
        const c = colorOf(e.color).hex
        return (
          <g key={e.id} stroke={c} fill="none" strokeLinecap="round">
            {e.id === selectedId && (
              <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y}
                stroke="#fbbf24" strokeWidth="6" opacity="0.55" />
            )}
            {g.ext.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth="0.6" />
            ))}
            <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} strokeWidth="0.8" />
            {g.arrows.map((ar, i) => ar.wings.map((w, j) => (
              <line key={`${i}-${j}`} x1={ar.tip.x} y1={ar.tip.y} x2={w.x} y2={w.y} strokeWidth="0.8" />
            )))}
          </g>
        )
      })}

      {/* shapes + text */}
      {plan.els.filter(e => e.t === 'pt').map(e => {
        const k = pointKind(e.kind)
        const isSel = e.id === selectedId
        const { w, h } = pointSize(e)
        const hnd = isSel ? resizeHandle(e, hOff) : null
        return (
          <g key={e.id}>
            {isSel && k.shape === 'circle' && (
              <circle cx={e.x} cy={e.y} r={w / 2 + 4} fill="none"
                stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="3 2" />
            )}
            {isSel && k.shape === 'square' && (
              <rect x={e.x - w / 2 - 4} y={e.y - h / 2 - 4} width={w + 8} height={h + 8} fill="none"
                stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="3 2" />
            )}
            {isSel && k.shape === 'none' && (
              <circle cx={e.x} cy={e.y} r="6" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="3 2" />
            )}
            {k.shape === 'circle' && (
              <circle cx={e.x} cy={e.y} r={w / 2} fill={colorOf(e.color).hex} fillOpacity={k.fillOpacity}
                stroke={colorOf(e.color).hex} strokeWidth="1.2" />
            )}
            {k.shape === 'square' && (
              <rect x={e.x - w / 2} y={e.y - h / 2} width={w} height={h} fill={colorOf(e.color).hex} fillOpacity={k.fillOpacity}
                stroke={colorOf(e.color).hex} strokeWidth="1.2" />
            )}
            {/* free text with nothing typed yet: show a faint anchor while editing */}
            {k.shape === 'none' && editing && !e.label && (
              <circle cx={e.x} cy={e.y} r="3" fill="none" stroke="#9ca3af" strokeDasharray="2 2" />
            )}
            {hnd && (
              <rect x={hnd.x - hr * 0.85} y={hnd.y - hr * 0.85} width={hr * 1.7} height={hr * 1.7}
                fill="#fff" stroke="#f59e0b" strokeWidth={hw} />
            )}
          </g>
        )
      })}

      {/* handles for the selected line / dimension */}
      {sel && (sel.t === 'ln' || sel.t === 'dim') && (
        <g fill="#fff" stroke="#f59e0b" strokeWidth={hw}>
          <circle cx={sel.x1} cy={sel.y1} r={hr} />
          <circle cx={sel.x2} cy={sel.y2} r={hr} />
          {sel.t === 'dim' && (() => {
            const m = dimHandle(sel)
            return <rect x={m.x - hr} y={m.y - hr} width={hr * 2} height={hr * 2}
              transform={`rotate(45 ${m.x} ${m.y})`} />
          })()}
        </g>
      )}

      {/* snap targets (corners / midpoints) while a placement tool is active */}
      {snapMarks && snapMarks.map((t, i) => (
        <rect key={`sm-${i}`} x={t.x - hr * 0.45} y={t.y - hr * 0.45} width={hr * 0.9} height={hr * 0.9}
          transform={`rotate(45 ${t.x} ${t.y})`}
          fill="rgba(245,158,11,0.18)" stroke="#f59e0b" strokeWidth={hw * 0.6} style={{ pointerEvents: 'none' }} />
      ))}

      {/* labels — line and dimension labels turn to follow their line */}
      {plan.els.map(e => {
        const lay = labelLayout(e)
        if (!lay) return null
        return (
          <text key={`l-${e.id}`} x={lay.x} y={lay.y} dy=".35em" textAnchor={lay.anchor}
            transform={lay.angle ? `rotate(${lay.angle} ${lay.x} ${lay.y})` : undefined}
            fontSize={LABEL_SIZE} fontFamily={FONT} fill={labelColor(e)}
            stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" paintOrder="stroke"
            style={{ pointerEvents: 'none' }}>
            {e.label}
          </text>
        )
      })}

      {/* what a drag is currently snapped to */}
      {snapHint && (
        <circle cx={snapHint.x} cy={snapHint.y} r={hr * 1.3} fill="none"
          stroke="#16a34a" strokeWidth={hw * 1.3} style={{ pointerEvents: 'none' }} />
      )}

      {/* line / dimension start marker */}
      {pending && (
        <circle cx={pending.x} cy={pending.y} r={hr * 1.1} fill="rgba(245,158,11,0.25)"
          stroke="#f59e0b" strokeWidth={hw} />
      )}
    </svg>
  )
}

// ── Small UI atoms ───────────────────────────────────────────────────────────
const btn = (active, accent, extra = {}) => ({
  padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  border: `2px solid ${active ? accent : '#d1d5db'}`,
  background: active ? accent : '#fff', color: active ? '#fff' : '#374151',
  ...extra,
})
const chipBtn = (active, accent) => btn(active, accent, { padding: '7px 10px', fontSize: 12 })
const chipRow = { display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0', marginBottom: 4 }

function ShapeChips({ value, onPick, accent }) {
  return (
    <div style={chipRow}>
      {SHAPE_KINDS.map(k => (
        <button key={k.id} onClick={() => onPick(k.id)} style={chipBtn(value === k.id, accent)}>
          <span style={{ marginRight: 6 }}>{SHAPE_GLYPH[k.id]}</span>{k.label}
        </button>
      ))}
    </div>
  )
}

// Pattern chips show a sample of the stroke so the pattern is obvious.
function PatternChips({ value, weight, onPick, accent }) {
  return (
    <div style={chipRow}>
      {LINE_PATTERNS.map(pt => {
        const w = lineWeight(weight).width
        const dash = pt.dash ? pt.dash.map(m => m * w).join(' ') : undefined
        return (
          <button key={pt.id} onClick={() => onPick(pt.id)} style={chipBtn(value === pt.id, accent)}>
            <svg width="28" height="8" style={{ marginRight: 6, verticalAlign: 'middle' }}>
              <line x1="1" y1="4" x2="27" y2="4" stroke="currentColor" strokeWidth={w} strokeDasharray={dash} />
            </svg>
            {pt.label}
          </button>
        )
      })}
    </div>
  )
}

function WeightChips({ value, onPick, accent }) {
  return (
    <div style={chipRow}>
      {LINE_WEIGHTS.map(wt => (
        <button key={wt.id} onClick={() => onPick(wt.id)} style={chipBtn(value === wt.id, accent)}>
          <svg width="22" height="8" style={{ marginRight: 6, verticalAlign: 'middle' }}>
            <line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth={wt.width} />
          </svg>
          {wt.label}
        </button>
      ))}
    </div>
  )
}

function LabelPosChips({ value, onPick, accent }) {
  return (
    <div style={chipRow}>
      {LABEL_POSITIONS.map(o => (
        <button key={o.id} onClick={() => onPick(o.id)} style={chipBtn((value || 'right') === o.id, accent)}>{o.label}</button>
      ))}
    </div>
  )
}

function OrientChips({ value, onPick, accent }) {
  return (
    <div style={chipRow}>
      {DIM_ORIENTS.map(o => (
        <button key={o.id} onClick={() => onPick(o.id)} style={chipBtn(value === o.id, accent)}>{o.label}</button>
      ))}
    </div>
  )
}

function ColorDots({ value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 2px' }}>
      {COLORS.map(c => (
        <button key={c.id} onClick={() => onPick(c.id)} aria-label={c.label} title={c.label} style={{
          width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', padding: 0,
          background: c.hex,
          border: value === c.id ? '3px solid #f59e0b' : '2px solid #fff',
          boxShadow: value === c.id ? '0 0 0 2px #111' : '0 0 0 1px #9ca3af',
        }} />
      ))}
    </div>
  )
}

// − value + control. `min`/`max` bound it; step is 2 units.
function Stepper({ label, value, onChange, accent, min = SIZE_MIN, max = SIZE_MAX }) {
  const bump = d => onChange(Math.min(max, Math.max(min, Math.round(value + d))))
  const sb = { ...btn(false, accent), padding: '6px 14px', fontSize: 16, lineHeight: 1 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 62, fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{label}</div>
      <button onClick={() => bump(-2)} style={sb}>−</button>
      <div style={{ minWidth: 34, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{Math.round(value)}</div>
      <button onClick={() => bump(2)} style={sb}>+</button>
    </div>
  )
}

// ── The full-screen editor ───────────────────────────────────────────────────
function PlanEditor({ plan, onChange, onClose, accent }) {
  const [tool, setTool]       = useState('select')       // select | shape | line | dim | text
  const [shapeKind, setShapeKind] = useState('rect')
  const [shapeColor, setShapeColor] = useState('blue')
  const [lnPattern, setLnPattern] = useState('solid')
  const [lnWeight, setLnWeight]   = useState('normal')
  const [lnColor, setLnColor]     = useState('blue')
  const [dmColor, setDmColor]     = useState('black')
  const [dmOrient, setDmOrient]   = useState('aligned')
  const [snapHint, setSnapHint]   = useState(null)         // snap target during a drag
  const [txColor, setTxColor]     = useState('blue')
  const [selId, setSelId]     = useState(null)
  const [pending, setPending] = useState(null)           // line / dim start awaiting its end
  const [zoom, setZoom]       = useState(1)
  const [cw, setCw]           = useState(348)              // width available to the plan at zoom 1, in px
  const [histLen, setHistLen] = useState(0)

  const planRef  = useRef(plan);  planRef.current = plan
  const hist     = useRef([])
  const svgRef   = useRef(null)
  const scrollRef = useRef(null)
  const gest     = useRef(null)
  const labelHistId = useRef(null)

  const ppu  = (cw * zoom) / PLAN_W                      // screen px per plan unit
  const step = snapStepForZoom(zoom)                     // grid snap gets finer as you zoom
  const sel  = plan.els.find(e => e.id === selId) || null
  // Corners / midpoints are shown while placing, so you can see what you can snap to.
  const snapMarks = useMemo(
    () => (tool === 'line' || tool === 'dim' || tool === 'shape' ? snapTargets(plan).filter(t => !t.ref) : null),
    [plan, tool],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setCw(Math.max(1, (el.clientWidth || 360 + 2 * PAD) - 2 * PAD))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { labelHistId.current = null }, [selId])

  // ── history ───────────────────────────────────────────────────────────────
  const pushHistory = (p) => {
    hist.current.push(p)
    if (hist.current.length > 60) hist.current.shift()
    setHistLen(hist.current.length)
  }
  const commit = (next, from = planRef.current) => { pushHistory(from); onChange(next) }
  const undo = () => {
    const prev = hist.current.pop()
    setHistLen(hist.current.length)
    if (!prev) return
    onChange(prev)
    setPending(null)
    if (selId && !prev.els.some(e => e.id === selId)) setSelId(null)
  }

  const pickTool = (t) => { setTool(t); setPending(null) }

  // ── zoom ──────────────────────────────────────────────────────────────────
  // Zooming always keeps one spot on the plan under one spot on the screen:
  // under the midpoint of the two fingers for a pinch, under the middle of the
  // visible plan for the − / + buttons, under the cursor for Ctrl+wheel. The
  // new scroll position is applied in a layout effect, once the plan has been
  // resized for the new zoom.
  const pointers = useRef(new Map())                     // active pointers → client position
  const pinch    = useRef(null)                          // { d0, z0, anchor } while two fingers are down
  const pendingScroll = useRef(null)
  const zoomRef  = useRef(zoom); zoomRef.current = zoom

  const clientToPlan = (cx, cy) => {
    const r = svgRef.current.getBoundingClientRect()
    return { x: ((cx - r.left) / r.width) * PLAN_W, y: ((cy - r.top) / r.height) * PLAN_H }
  }
  const toPlan = (e) => clientToPlan(e.clientX, e.clientY)

  const setZoomAt = (zNew, planPt, client) => {
    const el = scrollRef.current
    const cr = el.getBoundingClientRect()
    const z  = clampZoom(zNew)
    const pos = scrollForAnchor({
      px: planPt.x, py: planPt.y, zoom: z,
      contentW: el.clientWidth - 2 * PAD, pad: PAD,
      clientX: client.x, clientY: client.y, viewLeft: cr.left, viewTop: cr.top,
    })
    if (z === zoomRef.current) {                         // nothing will resize — just move
      el.scrollLeft = pos.left
      el.scrollTop  = pos.top
    } else {
      pendingScroll.current = pos
      setZoom(z)
    }
  }

  useLayoutEffect(() => {
    const p = pendingScroll.current
    if (p && scrollRef.current) {
      scrollRef.current.scrollLeft = p.left
      scrollRef.current.scrollTop  = p.top
      pendingScroll.current = null
    }
  }, [zoom])

  // Middle of the part of the plan that's actually on screen.
  const viewCentre = () => {
    const cr = scrollRef.current.getBoundingClientRect()
    const sr = svgRef.current.getBoundingClientRect()
    return {
      x: (Math.max(cr.left, sr.left) + Math.min(cr.right, sr.right)) / 2,
      y: (Math.max(cr.top, sr.top) + Math.min(cr.bottom, sr.bottom)) / 2,
    }
  }
  const zoomBy = (factor) => {
    const c = viewCentre()
    setZoomAt(zoomRef.current * factor, clientToPlan(c.x, c.y), c)
  }
  const zoomFit = () => {
    if (zoomRef.current === 1) { scrollRef.current.scrollLeft = 0; scrollRef.current.scrollTop = 0; return }
    pendingScroll.current = { left: 0, top: 0 }
    setZoom(1)
  }

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()]
    const d0 = Math.hypot(a.x - b.x, a.y - b.y)
    if (d0 < 10) return                                  // fingers too close to tell
    pinch.current = {
      d0, z0: zoomRef.current,
      anchor: clientToPlan((a.x + b.x) / 2, (a.y + b.y) / 2),
    }
  }
  const movePinch = () => {
    const [a, b] = [...pointers.current.values()]
    const p = pinch.current
    setZoomAt(
      zoomFromPinch(p.z0, p.d0, Math.hypot(a.x - b.x, a.y - b.y)),
      p.anchor,
      { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    )
  }

  // Ctrl + wheel (or a trackpad pinch) zooms on a desktop. Needs a native,
  // non-passive listener so the page itself doesn't zoom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return             // a plain wheel just scrolls
      ev.preventDefault()
      const client = { x: ev.clientX, y: ev.clientY }
      setZoomAt(zoomRef.current * Math.exp(-ev.deltaY * 0.01), clientToPlan(client.x, client.y), client)
    }
    // Safari fires its own gesture events for a pinch and would zoom the whole
    // page; the plan handles pinching itself, so swallow them.
    const swallow = (ev) => ev.preventDefault()
    const GESTURES = ['gesturestart', 'gesturechange', 'gestureend']
    el.addEventListener('wheel', onWheel, { passive: false })
    GESTURES.forEach(t => el.addEventListener(t, swallow))
    return () => {
      el.removeEventListener('wheel', onWheel)
      GESTURES.forEach(t => el.removeEventListener(t, swallow))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── pointer handling ──────────────────────────────────────────────────────

  const onDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) {                // second finger: pinch / two-finger pan
      gest.current = null                            // abandon whatever the first finger started
      setSnapHint(null)
      if (!pinch.current) startPinch()
      return
    }
    if (pinch.current || gest.current) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const cur = planRef.current
    const p   = toPlan(e)
    const hit = hitTest(cur, p.x, p.y, { tol: 16 / ppu, selectedId: selId, handleOff: 6 / ppu })
    const g = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, pushed: false,
      hit, base: cur, kind: 'pan',
      scroll: { l: scrollRef.current.scrollLeft, t: scrollRef.current.scrollTop },
    }
    if (hit?.type === 'north') {
      g.kind = 'north'
    } else if (tool === 'select' && hit?.type === 'resize') {
      g.kind = 'resize'
    } else if (tool === 'select' && hit?.type === 'offset') {
      g.kind = 'offset'
    } else if (tool === 'select' && (hit?.type === 'pt' || hit?.type === 'end')) {
      g.kind = 'vertex'
      g.refs = dragRefs(hit)                         // just the grabbed item, not what else meets there
    }
    gest.current = g
  }

  const onMove = (e) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current) {
      if (pointers.current.size >= 2) movePinch()
      return
    }
    const g = gest.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy
    if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true
    if (!g.moved) return

    if (g.kind === 'pan') {
      scrollRef.current.scrollLeft = g.scroll.l - dx
      scrollRef.current.scrollTop  = g.scroll.t - dy
    } else if (g.kind === 'north') {
      const p = toPlan(e)
      if (!g.pushed) { pushHistory(g.base); g.pushed = true }
      onChange(setNorth(g.base, angleFromNorthCentre(p.x, p.y)))
    } else if (g.kind === 'resize') {
      const p  = toPlan(e)
      const el = g.base.els.find(x => x.id === g.hit.id)
      const sz = sizeFromHandle(el, p.x, p.y, 6 / ppu)
      if (!g.pushed) { pushHistory(g.base); g.pushed = true }
      onChange(setPointSize(g.base, el.id, sz.w, sz.h))
    } else if (g.kind === 'offset') {
      const p  = toPlan(e)
      const el = g.base.els.find(x => x.id === g.hit.id)
      if (!g.pushed) { pushHistory(g.base); g.pushed = true }
      onChange(setDimOffset(g.base, el.id, offsetFromPoint(el, p.x, p.y)))
    } else if (g.kind === 'vertex') {
      const p = toPlan(e)
      const s = snapPoint(g.base, p.x, p.y, { step, tol: 10 / ppu, exclude: g.refs })
      if (!g.pushed) { pushHistory(g.base); g.pushed = true }
      if (selId !== g.hit.id) setSelId(g.hit.id)
      setSnapHint(s.snapped ? { x: s.x, y: s.y } : null)
      onChange(moveVertex(g.base, g.refs, s.x, s.y))
    }
  }

  // A finger left the screen (or the browser took it over).
  const endPointer = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null   // the remaining finger does nothing until it lifts
  }
  const onCancel = (e) => {
    endPointer(e)
    gest.current = null
    setSnapHint(null)
  }

  const onUp = (e) => {
    endPointer(e)
    const g = gest.current
    if (!g || g.id !== e.pointerId) return
    gest.current = null
    setSnapHint(null)
    if (g.moved) return
    handleTap(g, toPlan(e))
  }

  const handleTap = (g, p) => {
    const cur = planRef.current
    if (g.kind === 'north') {                         // a tap confirms the current direction
      commit(setNorth(cur, cur.north))
      return
    }
    if (tool === 'select') {
      let id = g.hit ? g.hit.id : null
      // A selected line/dimension's end handle sits on top of anything else at
      // that spot. A tap there selects the shape underneath instead, so every
      // item at a joint can be reached (a drag still moves the selected end).
      if (g.hit?.type === 'end') {
        const under = hitTest(cur, p.x, p.y, { tol: 16 / ppu, selectedId: null, handleOff: 6 / ppu })
        if (under?.type === 'pt') id = under.id
      }
      setSelId(id)
    } else if (tool === 'shape') {
      const s = snapPoint(cur, p.x, p.y, { step, tol: 10 / ppu })
      const r = addPoint(cur, shapeKind, s.x, s.y, '', undefined, { color: shapeColor, labelPos: 'right' })
      commit(r.plan, cur)
      setSelId(r.id)
      setTool('select')
    } else if (tool === 'text') {
      // Text snaps to the grid only — not onto a nearby shape's centre.
      const s = snapPoint(cur, p.x, p.y, { step, tol: 0 })
      const r = addPoint(cur, 'text', s.x, s.y, '', undefined, { color: txColor })
      commit(r.plan, cur)
      setSelId(r.id)
      setTool('select')
    } else if (tool === 'line') {
      const s = snapPoint(cur, p.x, p.y, { step, tol: 10 / ppu })
      if (!pending) { setPending({ x: s.x, y: s.y }); return }
      if (Math.hypot(s.x - pending.x, s.y - pending.y) < 2) { setPending(null); return }
      const r = addLine(cur, lnPattern, lnColor, lnWeight, pending.x, pending.y, s.x, s.y)
      commit(r.plan, cur)
      setSelId(r.id)
      setPending(null)
      setTool('select')
    } else if (tool === 'dim') {
      const s = snapPoint(cur, p.x, p.y, { step, tol: 10 / ppu })
      if (!pending) { setPending({ x: s.x, y: s.y }); return }
      if (Math.hypot(s.x - pending.x, s.y - pending.y) < 4) { setPending(null); return }
      const r = addDim(cur, dmColor, dmOrient, pending.x, pending.y, s.x, s.y)
      commit(r.plan, cur)
      setSelId(r.id)
      setPending(null)
      setTool('select')
    }
  }

  // ── selected-item edits ───────────────────────────────────────────────────
  const updateLabel = (id, v) => {
    const cur = planRef.current
    if (labelHistId.current !== id) { pushHistory(cur); labelHistId.current = id }
    onChange(updateEl(cur, id, { label: v }))
  }
  const changeProp = (id, patch) => commit(updateEl(planRef.current, id, patch))
  const resizeSel  = (id, w, h) => commit(setPointSize(planRef.current, id, w, h))
  const offsetSel  = (id, off) => commit(setDimOffset(planRef.current, id, off))
  const deleteSel  = () => { commit(removeEl(planRef.current, selId)); setSelId(null) }

  const hint =
    tool === 'select' ? 'Tap an item to edit it. Drag to move. Drag the N circle to turn north.'
    : tool === 'shape' ? `Tap the plan to place a ${pointKind(shapeKind).label.toLowerCase()}`
    : tool === 'text'  ? 'Tap where the text goes, then type it in the panel below'
    : tool === 'line'  ? (pending ? 'Tap the end point of the line' : 'Tap the start point of the line')
                       : (pending ? 'Tap the second point to measure to' : 'Tap the first point to measure from')

  const selTitle = !sel ? '' :
    sel.t === 'ln'  ? `Line — ${colorOf(sel.color).label} ${linePattern(sel.pattern).label.toLowerCase()}`
    : sel.t === 'dim' ? 'Dimension'
    : sel.kind === 'text' ? 'Text'
    : pointKind(sel.kind).label

  const toolBtn = (id, text) => (
    <button key={id} onClick={() => pickTool(id)}
      style={{ ...btn(tool === id, accent), flex: 1, padding: '9px 2px', fontSize: 12 }}>{text}</button>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#f4f4f8',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      {/* header */}
      <div style={{
        background: accent, color: '#fff', padding: '10px 12px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Dimensioned Plan</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>Landscape gives more room</div>
        </div>
        <button onClick={undo} disabled={histLen === 0} style={{
          ...btn(false, accent), padding: '7px 10px', opacity: histLen === 0 ? 0.45 : 1,
        }}>↩ Undo</button>
        <button onClick={onClose} style={{
          padding: '8px 14px', borderRadius: 9, border: 'none', background: '#fff', color: accent,
          fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer',
        }}>Done</button>
      </div>

      {/* zoom bar */}
      <div style={{
        background: '#e0e7ff', padding: '6px 12px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button onClick={() => zoomBy(1 / 1.4)} disabled={zoom <= ZOOM_MIN + 0.001}
          style={{ ...btn(false, accent), padding: '4px 13px', fontSize: 16, opacity: zoom <= ZOOM_MIN + 0.001 ? 0.45 : 1 }}>−</button>
        <div style={{ minWidth: 44, textAlign: 'center', fontWeight: 700, fontSize: 13, color: accent }}>
          {Math.round(zoom * 100)}%
        </div>
        <button onClick={() => zoomBy(1.4)} disabled={zoom >= ZOOM_MAX - 0.001}
          style={{ ...btn(false, accent), padding: '4px 13px', fontSize: 16, opacity: zoom >= ZOOM_MAX - 0.001 ? 0.45 : 1 }}>+</button>
        <button onClick={zoomFit} disabled={zoom === 1}
          style={{ ...btn(false, accent), padding: '5px 11px', fontSize: 12, opacity: zoom === 1 ? 0.45 : 1 }}>Fit</button>
        <div style={{ flex: 1, textAlign: 'right', fontSize: 11, color: '#6b7280', lineHeight: 1.3 }}>
          Pinch to zoom · two fingers to move
        </div>
      </div>

      {/* canvas */}
      <div ref={scrollRef} style={{
        flexShrink: 0, overflow: 'auto', background: '#e5e7eb', padding: PAD,
        maxHeight: '48vh', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: `${zoom * 100}%`, boxShadow: '0 1px 6px rgba(0,0,0,0.2)' }}>
          <PlanSvg
            plan={plan} selectedId={selId} pending={pending} ppu={ppu} editing
            snapMarks={snapMarks} snapHint={snapHint}
            svgRef={svgRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            onPointerCancel={onCancel} onLostPointerCapture={endPointer}
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          />
        </div>
      </div>

      {/* tools + selection */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {toolBtn('select', '☝ Select')}
          {toolBtn('shape',  '▭ Shape')}
          {toolBtn('line',   '╱ Line')}
          {toolBtn('dim',    '↔ Dim')}
          {toolBtn('text',   'A Text')}
        </div>

        {tool === 'shape' && (
          <>
            <ShapeChips value={shapeKind} onPick={setShapeKind} accent={accent} />
            <ColorDots value={shapeColor} onPick={setShapeColor} />
          </>
        )}
        {tool === 'line' && (
          <>
            <PatternChips value={lnPattern} weight={lnWeight} onPick={setLnPattern} accent={accent} />
            <WeightChips value={lnWeight} onPick={setLnWeight} accent={accent} />
            <ColorDots value={lnColor} onPick={setLnColor} />
          </>
        )}
        {tool === 'dim' && (
          <>
            <OrientChips value={dmOrient} onPick={setDmOrient} accent={accent} />
            <ColorDots value={dmColor} onPick={setDmColor} />
          </>
        )}
        {tool === 'text' && <ColorDots value={txColor} onPick={setTxColor} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', minHeight: 30 }}>
          <div style={{ flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{hint}</div>
          {(tool === 'line' || tool === 'dim') && pending && (
            <button onClick={() => setPending(null)} style={{ ...btn(false, accent), padding: '6px 12px' }}>Cancel</button>
          )}
        </div>

        {sel && (
          <div style={{
            background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '12px 12px 4px',
          }}>
            <SectionHead label={selTitle} accent={accent} />
            <WF key={sel.id}
              label={sel.kind === 'text' ? 'Text' : sel.t === 'dim' ? 'Dimension' : 'Label'}
              v={sel.label} set={v => updateLabel(sel.id, v)}
              ph={sel.t === 'dim' ? 'e.g. 3.2m' : sel.t === 'ln' ? 'e.g. Earth wire' : sel.kind === 'text' ? 'Type here' : 'e.g. Pole'}
              accent={accent} />

            {sel.t === 'ln' && (
              <div style={{ marginBottom: 10 }}>
                <PatternChips value={sel.pattern} weight={sel.weight} onPick={v => changeProp(sel.id, { pattern: v })} accent={accent} />
                <WeightChips value={sel.weight} onPick={v => changeProp(sel.id, { weight: v })} accent={accent} />
                <ColorDots value={sel.color} onPick={c => changeProp(sel.id, { color: c })} />
              </div>
            )}

            {sel.t === 'dim' && (
              <div style={{ marginBottom: 10 }}>
                <OrientChips value={sel.orient || 'aligned'}
                  onPick={o => commit(setDimOffset(updateEl(planRef.current, sel.id, { orient: o }), sel.id, sel.offset))}
                  accent={accent} />
                <ColorDots value={sel.color} onPick={c => changeProp(sel.id, { color: c })} />
                <div style={{ marginTop: 8 }}>
                  <Stepper label="Offset" value={sel.offset} accent={accent} min={-PLAN_H} max={PLAN_H}
                    onChange={v => offsetSel(sel.id, v)} />
                  <button onClick={() => offsetSel(sel.id, -sel.offset)}
                    style={{ ...btn(false, accent), padding: '6px 12px', fontSize: 12 }}>Flip to other side</button>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    You can also drag the diamond handle in the middle of the dimension line.
                  </div>
                </div>
              </div>
            )}

            {sel.t === 'pt' && sel.kind === 'text' && (
              <div style={{ marginBottom: 10 }}>
                <ColorDots value={sel.color} onPick={c => changeProp(sel.id, { color: c })} />
              </div>
            )}

            {sel.t === 'pt' && sel.kind !== 'text' && (() => {
              const { w, h } = pointSize(sel)
              const round = pointKind(sel.kind).shape === 'circle'
              const fixed = !!pointKind(sel.kind).fixed         // the dot has one size
              return (
                <div style={{ marginBottom: 10 }}>
                  <ShapeChips value={sel.kind} onPick={k => changeProp(sel.id, { kind: k })} accent={accent} />
                  <ColorDots value={sel.color} onPick={c => changeProp(sel.id, { color: c })} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', margin: '8px 0 2px' }}>
                    Label position
                  </div>
                  <LabelPosChips value={sel.labelPos} onPick={o => changeProp(sel.id, { labelPos: o })} accent={accent} />
                  {!fixed && <div style={{ marginTop: 8 }}>
                    {round ? (
                      <Stepper label="Size" value={w} accent={accent} onChange={v => resizeSel(sel.id, v, v)} />
                    ) : (
                      <>
                        <Stepper label="Width"  value={w} accent={accent} onChange={v => resizeSel(sel.id, v, h)} />
                        <Stepper label="Height" value={h} accent={accent} onChange={v => resizeSel(sel.id, w, v)} />
                        <button onClick={() => resizeSel(sel.id, w, w)} style={{ ...btn(false, accent), padding: '6px 12px', fontSize: 12 }}>
                          Make square
                        </button>
                      </>
                    )}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                      You can also drag the square handle at the corner of the shape.
                    </div>
                  </div>}
                </div>
              )
            })()}

            <button onClick={deleteSel} style={{
              width: '100%', padding: '10px 0', marginBottom: 12, borderRadius: 9,
              border: '2px solid #fca5a5', background: '#fff5f5', color: '#dc2626',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Delete this {sel.t === 'ln' ? 'line' : sel.t === 'dim' ? 'dimension' : sel.kind === 'text' ? 'text' : 'shape'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── The wizard step: thumbnail + "Edit plan" ─────────────────────────────────
export function PlanSketchStep({ plan: rawPlan, onChange, accent = APP_ACCENT }) {
  const [editing, setEditing] = useState(false)
  const plan = useMemo(() => normalizePlan(rawPlan), [rawPlan])

  const n = t => plan.els.filter(e => e.t === t).length
  const counts = [
    [n('pt'), 'item'], [n('ln'), 'line'], [n('dim'), 'dimension'],
  ].filter(([c]) => c > 0).map(([c, w]) => `${c} ${w}${c !== 1 ? 's' : ''}`)
  const empty = plan.els.length === 0 && !plan.northSet

  const clearPlan = () => {
    if (window.confirm('Clear the whole plan?')) onChange(emptyPlan())
  }

  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
        Build the plan from shapes, lines, dimensions and text — label things as whatever they
        are (pole, kerb, earth wire…). It prints in the plan box on the form.
      </p>

      <div style={{ border: `1.5px solid ${accent}40`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
        <PlanSvg plan={plan} />
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
        {empty ? 'Nothing drawn yet.'
          : [...counts, plan.northSet ? 'north set' : 'north not set'].join(' · ')}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(true)} style={{
          flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: accent, color: '#fff',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>{empty ? '✏️ Draw plan' : '✏️ Edit plan'}</button>
        {!empty && (
          <button onClick={clearPlan} style={{
            padding: '13px 16px', borderRadius: 12, border: '2px solid #fca5a5', background: '#fff5f5',
            color: '#dc2626', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Clear</button>
        )}
      </div>

      {editing && (
        <PlanEditor plan={plan} onChange={onChange} onClose={() => setEditing(false)} accent={accent} />
      )}
    </div>
  )
}

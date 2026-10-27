/**
 * planView.js — pure zoom / scroll maths for the plan editor
 * (PlanSketchStep.jsx), kept separate so it can be unit tested.
 *
 * The plan is drawn in an SVG whose on-screen width is `contentW × zoom`
 * (zoom 1 = fits the screen width), inside a scrollable container with
 * `pad` px of padding. "Zooming around a point" means: change the zoom, then
 * set the scroll position so the same spot on the plan stays under the same
 * spot on the screen — under the fingers during a pinch, or under the centre
 * of the view for the +/− buttons.
 */
import { PLAN_W, PLAN_H } from './planModel'

export const ZOOM_MIN = 1
export const ZOOM_MAX = 6

export const clampZoom = z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/** Grid snap step (plan units) — finer as you zoom in, so zooming in lets you place things more precisely. */
export function snapStepForZoom(z) {
  return z >= 5 ? 1 : z >= 3 ? 2 : z >= 2 ? 4 : 8
}

/** New zoom for a pinch that started at distance d0 with zoom z0 and is now at distance d. */
export function zoomFromPinch(z0, d0, d) {
  if (!(d0 > 0) || !(d > 0)) return clampZoom(z0)
  return clampZoom(z0 * (d / d0))
}

/**
 * Scroll position that puts plan point (px, py) under screen point
 * (clientX, clientY) at the given zoom.
 *   contentW   inner width of the scroll container available to the plan (px)
 *   pad        padding of the scroll container (px)
 *   viewLeft/Top  the scroll container's position on screen
 * The browser clamps scrollLeft/Top to what's scrollable, so out-of-range
 * values are harmless.
 */
export function scrollForAnchor({ px, py, zoom, contentW, pad, clientX, clientY, viewLeft, viewTop }) {
  const svgW = contentW * zoom
  const svgH = svgW * (PLAN_H / PLAN_W)
  return {
    left: pad + (px / PLAN_W) * svgW - (clientX - viewLeft),
    top:  pad + (py / PLAN_H) * svgH - (clientY - viewTop),
  }
}

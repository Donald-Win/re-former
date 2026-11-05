/**
 * planLayouts.js — where the plan box sits on each form, and whether the
 * form prints a north circle. Pure data (no imports), so the editor and the
 * PDF worker share it.
 *
 *   box   — top-left and size of the printed plan box, PDF points, top-origin
 *   north — printed north circle { cx, cy, r } relative to the box, or null
 *           when the form prints none (the editor then hides the north control)
 *
 * Any form not listed falls back to EARTH_LAYOUT, so existing plans keep
 * working. Add every new plan-enabled form to BY_FORM.
 */

// 360S014EJ — Earth Installation and Test Record (measured earlier)
export const EARTH_LAYOUT = Object.freeze({
  box: Object.freeze({ x: 40, y: 458, w: 513, h: 242 }),
  north: Object.freeze({ cx: 31.75, cy: 32.5, r: 23 }),
})

// 360S014EC — Pole Record, page 3 "WORK PLAN AND DESCRIPTION" box.
// Measured from a 144 dpi raster of the form (1 px = 0.5 pt): the box is
// bounded by rules at x 42.5 and 553.0 and y 138.0 and 506.0. No printed grid
// and no printed north circle.
export const POLE_LAYOUT = Object.freeze({
  box: Object.freeze({ x: 42.5, y: 138, w: 510.5, h: 368 }),
  north: null,
})

// 360S014EB — Electrical Distribution Record, page 1 "Dimensioned PLAN" box.
// Measured from a 144 dpi raster (1 px = 0.5 pt). The box is the printed light-blue
// grid, x 42.5–565.0 pt and y 426.0–664.0 pt (no dark border). The top edge is the
// outer edge of the grid, which has a short strip of vertical rules above the first
// full horizontal rule (437.25 pt). The printed north circle is centred at
// (76.25, 459.0) pt with radius 22.75 pt, i.e. (33.75, 33.0) relative to the box.
// The box top is unconfirmed: check it on the first test print.
export const EB_LAYOUT = Object.freeze({
  box: Object.freeze({ x: 42.5, y: 426, w: 522.5, h: 238 }),
  north: Object.freeze({ cx: 33.75, cy: 33, r: 22.75 }),
})

// 360S014EA — LV Connection Record, page 1 "WORK PLAN AND DESCRIPTION" box.
// Measured from a 144 dpi raster (1 px = 0.5 pt): plain white box, no printed grid,
// bounded by solid rules at x 42.5–553.0 pt and y 455.5–722.0 pt. The printed north
// circle is centred at (78.5, 492.5) pt with radius 27.0 pt, i.e. (36.0, 37.0)
// relative to the box.
export const LV_CONNECTION_LAYOUT = Object.freeze({
  box: Object.freeze({ x: 42.5, y: 455.5, w: 510.5, h: 266.5 }),
  north: Object.freeze({ cx: 36, cy: 37, r: 27 }),
})

const BY_FORM = {
  '360S014EJ': EARTH_LAYOUT,
  '360S014EC': POLE_LAYOUT,
  '360S014EB': EB_LAYOUT,
  '360S014EA': LV_CONNECTION_LAYOUT,
}

/** The layout for a form code. Unknown codes get the Earth layout. */
export function layoutFor(formKey) {
  return BY_FORM[formKey] || EARTH_LAYOUT
}

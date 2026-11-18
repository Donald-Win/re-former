/**
 * distPanelRows.js — fuse-row rules for the Underground Panel Layout Record
 * (360S014EI). Shared by the wizard (which shows the rows) and the PDF
 * generator (which must print exactly the same rows).
 *
 * The panel has 8 numbered positions. Each position takes:
 *   full — the number: one full-width carrier, on row "a"
 *   a / b — the half under the number: half-width carriers, rows "a" and "b"
 * Rows are a flat list of 16: index 0 = 1a, 1 = 1b, 2 = 2a … 15 = 8b.
 *
 * A row is "in use" when its carrier is selected. Data typed into a row is
 * kept when its carrier is deselected, so a mis-tap never deletes details.
 * Unused rows are simply hidden in the wizard and not printed.
 */

export const POSITION_COUNT = 8
export const WAY_COUNT      = 16

export const wayLabel  = i => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? 'a' : 'b'}`
export const blankSlot = () => ({ full: false, a: false, b: false })
export const slotAt    = (slots, n) => (slots && slots[n - 1]) || blankSlot()

/** Always returns POSITION_COUNT complete slots. */
export const allSlots  = raw => Array.from({ length: POSITION_COUNT }, (_, k) => slotAt(raw, k + 1))

/** Whether a row (flat index) is in use. A full-width carrier uses row "a". */
export function rowUsed(slots, i) {
  const s = slotAt(slots, Math.floor(i / 2) + 1)
  return i % 2 === 0 ? (s.full || s.a) : s.b
}

export const usedRowIndexes = slots =>
  Array.from({ length: WAY_COUNT }, (_, i) => i).filter(i => rowUsed(slots, i))

// Tap transitions. Each cell toggles on its own. A full-width carrier and a
// half carrier in the same position replace each other.
export const tapFull = s => (s.full ? { ...s, full: false } : { full: true, a: false, b: false })
export const tapA    = s => (s.a ? { ...s, a: false } : { full: false, a: true, b: s.b })
export const tapB    = s => (s.b ? { ...s, b: false } : { full: false, a: s.a, b: true })

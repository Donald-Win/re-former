import { describe, it, expect } from 'vitest'
import {
  renderFields, renderGridRow, renderMatrixRow, isCalibrationMode,
} from './pdfFieldRenderer'

// A fake page drawer that records every call instead of drawing anything.
function recorder() {
  const calls = []
  const rec = name => (...args) => { calls.push([name, ...args]) }
  return {
    calls,
    draw: { t: rec('t'), tc: rec('tc'), tr: rec('tr'), ck: rec('ck'), circ: rec('circ'), tWrap: rec('tWrap') },
  }
}

const FIELDS = {
  left:   { type: 'text', align: 'left',   x: 10, y: 20, size: 9, value: d => d.name },
  centre: { type: 'text', align: 'center', x: 30, width: 100, y: 40, value: d => d.name },
  right:  { type: 'text', align: 'right',  x: 50, y: 60, value: d => d.name },
  tick:   { type: 'check', x: 70, y: 80, value: d => d.on },
  ring:   { type: 'ellipse', cx: 90, cy: 100, rx: 5, ry: 3, value: d => d.on },
  para:   { type: 'wrap', x: 11, y: 12, maxWidth: 200, lineHeight: 14, maxLines: 3, value: d => d.name },
}

describe('renderFields', () => {
  it('dispatches each field type to the matching draw primitive', async () => {
    const { calls, draw } = recorder()
    await renderFields({ draw }, FIELDS, { name: 'Māngere', on: true })
    expect(calls).toEqual([
      ['t',  10, 20, 'Māngere', 9],
      ['tc', 30, 100, 40, 'Māngere', undefined],
      ['tr', 50, 60, 'Māngere', undefined],
      ['ck', 70, 80, true, undefined],
      ['circ', 90, 100, 5, 3, true, undefined],
      ['tWrap', 11, 12, 'Māngere', 200, undefined, 14, 3],
    ])
    expect(isCalibrationMode()).toBe(false)
  })

  it('skips a field with no value() function', async () => {
    const { calls, draw } = recorder()
    await renderFields({ draw }, { bad: { type: 'text', x: 1, y: 1 } }, {})
    expect(calls.length).toBe(0)
  })

  it('calibration mode forces every option on and prints field names', async () => {
    const { calls, draw } = recorder()
    await renderFields({ draw }, FIELDS, { name: 'ignored', on: false, __calibrate: true })
    expect(isCalibrationMode()).toBe(true)
    expect(calls[0]).toEqual(['t', 10, 20, 'left', 9])
    expect(calls[3]).toEqual(['ck', 70, 80, true, undefined])
    expect(calls[4]).toEqual(['circ', 90, 100, 5, 3, true, undefined])
  })

  it('calibration mode switches off again on the next normal call', async () => {
    const { draw } = recorder()
    await renderFields({ draw }, FIELDS, { __calibrate: true })
    await renderFields({ draw }, FIELDS, { name: 'x' })
    expect(isCalibrationMode()).toBe(false)
  })
})

describe('renderGridRow', () => {
  const cols = {
    voltage: { x: 55, align: 'left' },
    phase:   { x: 125, align: 'right' },
    open:    { x: 200, type: 'check', value: row => row.state === 'Open' },
  }
  it('reads row[key] by default, supports computed value(), and per-column alignment', () => {
    const { calls, draw } = recorder()
    renderGridRow(draw, cols, 233, { voltage: '11kV', phase: 'Three', state: 'Open' }, 8)
    expect(calls).toEqual([
      ['t',  55, 233, '11kV', 8],
      ['tr', 125, 233, 'Three', 8],
      ['ck', 200, 233, true, undefined],
    ])
  })
})

describe('renderMatrixRow', () => {
  it('draws values at their column positions and skips undefined columns', () => {
    const { calls, draw } = recorder()
    renderMatrixRow(draw, [10, undefined, 30], 50, ['a', 'b', 'c'], { size: 7 })
    expect(calls).toEqual([
      ['t', 10, 50, 'a', 7],
      ['t', 30, 50, 'c', 7],
    ])
  })
  it('supports check rows', () => {
    const { calls, draw } = recorder()
    renderMatrixRow(draw, [10, 20], 5, [true, false], { type: 'check' })
    expect(calls).toEqual([['ck', 10, 5, true, undefined], ['ck', 20, 5, false, undefined]])
  })
})

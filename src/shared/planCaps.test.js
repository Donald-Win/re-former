import { describe, it, expect } from 'vitest'
import { capGeometry, normalizePlan } from './planModel'

const line = extra => ({ id: 'l', t: 'ln', pattern: 'solid', color: 'black', weight: 'normal',
  x1: 0, y1: 0, x2: 10, y2: 0, label: '', ...extra })

describe('line caps', () => {
  it('a plain line has no caps', () => {
    expect(capGeometry(line({ cap: 'none' }))).toEqual([])
    expect(capGeometry(line({}))).toEqual([])
  })

  it('an arrow at the end has two wings starting at the tip and swept back', () => {
    const [c] = capGeometry(line({ cap: 'arrow', capEnds: 'end' }))
    expect(c.lines.length).toBe(2)
    for (const l of c.lines) {
      expect([l[0], l[1]]).toEqual([10, 0])
      expect(l[2]).toBeLessThan(10)
    }
    expect(c.lines[0][3]).toBeCloseTo(-c.lines[1][3], 6)   // symmetric either side
  })

  it('"both" puts a cap at each end, the start one pointing the other way', () => {
    const caps = capGeometry(line({ cap: 'arrow', capEnds: 'both' }))
    expect(caps.length).toBe(2)
    expect(caps[1].lines[0][0]).toBe(0)
    expect(caps[1].lines[0][2]).toBeGreaterThan(0)
  })

  it('a bar is perpendicular to the line and centred on the tip', () => {
    const [c] = capGeometry(line({ cap: 'bar', capEnds: 'end' }))
    const [x1, y1, x2, y2] = c.lines[0]
    expect(x1).toBe(10); expect(x2).toBe(10)
    expect(y1).toBeCloseTo(-y2, 6)
  })

  it('a dot is centred on the tip and grows with line weight', () => {
    const [fine] = capGeometry(line({ cap: 'dot', capEnds: 'end', weight: 'fine' }))
    const [heavy] = capGeometry(line({ cap: 'dot', capEnds: 'end', weight: 'heavy' }))
    expect([fine.dot.x, fine.dot.y]).toEqual([10, 0])
    expect(heavy.dot.r).toBeGreaterThan(fine.dot.r)
  })

  it('normalizePlan keeps valid cap values and defaults invalid ones', () => {
    const p = normalizePlan({ els: [
      line({ id: 'a', cap: 'arrow', capEnds: 'both' }),
      line({ id: 'b', cap: 'star', capEnds: 'middle' }),
    ] })
    expect([p.els[0].cap, p.els[0].capEnds]).toEqual(['arrow', 'both'])
    expect([p.els[1].cap, p.els[1].capEnds]).toEqual(['none', 'end'])
  })
})

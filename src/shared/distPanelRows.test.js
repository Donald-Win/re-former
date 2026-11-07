import { describe, it, expect } from 'vitest'
import { allSlots, rowUsed, usedRowIndexes, tapFull, tapA, tapB } from './distPanelRows'

describe('fuse rows', () => {
  it('a full-width carrier uses the "a" row only', () => {
    const slots = allSlots([{ full: true, a: false, b: false }])
    expect(usedRowIndexes(slots)).toEqual([0])
  })

  it('a half carrier uses its own row', () => {
    const slots = allSlots([{ full: false, a: false, b: true }])
    expect(usedRowIndexes(slots)).toEqual([1])
  })

  it('a full carrier and a half carrier replace each other', () => {
    const half = tapA({ full: false, a: false, b: false })
    expect(half).toEqual({ full: false, a: true, b: false })
    expect(tapFull(half)).toEqual({ full: true, a: false, b: false })
    expect(tapB(tapFull({ full: true, a: false, b: false }))).toEqual({ full: false, a: false, b: true })
  })

  it('tapping a lit cell turns it off', () => {
    expect(tapA({ full: false, a: true, b: false })).toEqual({ full: false, a: false, b: false })
    expect(tapFull({ full: true, a: false, b: false })).toEqual({ full: false, a: false, b: false })
  })

  it('a position with both halves uses both rows', () => {
    const slots = allSlots([{ full: false, a: true, b: true }])
    expect(usedRowIndexes(slots)).toEqual([0, 1])
    expect(rowUsed(slots, 3)).toBe(false)
  })
})

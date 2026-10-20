import { describe, it, expect } from 'vitest'
import {
  voltRange, phasingRange, earthRange, loopRange,
  voltRowStatus, phasingRowStatus,
} from './DistributionTransformerLimits'

describe('earthRange — "N Ω or less" (boundary is a PASS)', () => {
  it('passes exactly at the limit', () => {
    expect(earthRange('earthLeg1', '25')).toBe(true)
    expect(earthRange('menUrban', '5')).toBe(true)
    expect(earthRange('menRural', '25')).toBe(true)
  })
  it('fails just over the limit', () => {
    expect(earthRange('earthLeg1', '25.1')).toBe(false)
    expect(earthRange('menUrban', '5.01')).toBe(false)
  })
  it('returns null when empty and false when not a number', () => {
    expect(earthRange('earthLeg1', '')).toBe(null)
    expect(earthRange('earthLeg1', undefined)).toBe(null)
    expect(earthRange('earthLeg1', 'abc')).toBe(false)
  })
})

describe('voltRange', () => {
  it('line-to-line 412–422 V inclusive', () => {
    expect(voltRange('rw', '412')).toBe(true)
    expect(voltRange('rw', '422')).toBe(true)
    expect(voltRange('rw', '411.9')).toBe(false)
    expect(voltRange('rw', '422.1')).toBe(false)
  })
  it('line-to-neutral 238–244 V inclusive', () => {
    expect(voltRange('rn', '238')).toBe(true)
    expect(voltRange('bn', '244')).toBe(true)
    expect(voltRange('wn', '237')).toBe(false)
  })
  it('empty is null', () => {
    expect(voltRange('rw', '')).toBe(null)
  })
})

describe('phasingRange / loopRange — strictly below the limit', () => {
  it('phasing is < 10 V', () => {
    expect(phasingRange('9.99')).toBe(true)
    expect(phasingRange('10')).toBe(false)
  })
  it('loop impedance is < 0.2 Ω', () => {
    expect(loopRange('0.19')).toBe(true)
    expect(loopRange('0.2')).toBe(false)
    expect(loopRange('')).toBe(null)
  })
})

describe('row status across circuits', () => {
  it('empty when no circuit has a value', () => {
    expect(voltRowStatus([{ rw: '' }, { rw: '' }], 'rw')).toBe('empty')
  })
  it('confirmed when every entered value is in range (blanks ignored)', () => {
    expect(voltRowStatus([{ rw: '415' }, { rw: '' }, { rw: '420' }], 'rw')).toBe('confirmed')
  })
  it('failed when any entered value is out of range', () => {
    expect(voltRowStatus([{ rw: '415' }, { rw: '430' }], 'rw')).toBe('failed')
    expect(phasingRowStatus([{ r1r2: '2' }, { r1r2: '12' }], 'r1r2')).toBe('failed')
    expect(phasingRowStatus([{ r1r2: '2' }, { r1r2: '3' }], 'r1r2')).toBe('confirmed')
  })
})

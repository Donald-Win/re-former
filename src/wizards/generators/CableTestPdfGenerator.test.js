import { describe, it, expect } from 'vitest'
import { flowText, ROUTE_LINES, OTHER_TESTS_LINES } from './CableTestPdfGenerator'

// Stand-in for the page drawer's wrapText: about 10pt per character, breaking on spaces.
// Words longer than a line are split, as the real helper does.
function fakeWrap(text, maxWidth) {
  const perLine = Math.max(1, Math.floor(maxWidth / 10))
  const words = String(text || '').split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w
    if (cand.length <= perLine) {
      cur = cand
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

describe('flowText', () => {
  it('returns nothing for empty or missing text', () => {
    expect(flowText(fakeWrap, '', ROUTE_LINES)).toEqual([])
    expect(flowText(fakeWrap, undefined, ROUTE_LINES)).toEqual([])
    expect(flowText(fakeWrap, '   ', ROUTE_LINES)).toEqual([])
  })

  it('puts short text on the first line only, with that line’s position', () => {
    const out = flowText(fakeWrap, 'Feeder 3 to pole 12', ROUTE_LINES)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ x: ROUTE_LINES[0].x, base: ROUTE_LINES[0].base, text: 'Feeder 3 to pole 12' })
  })

  it('flows long text onto the second line, using that line’s x and baseline', () => {
    const text = 'Cable runs from the zone substation along the kerb line then crosses the road to pole twelve'
    const out = flowText(fakeWrap, text, ROUTE_LINES)
    expect(out).toHaveLength(2)
    expect(out[1].x).toBe(ROUTE_LINES[1].x)
    expect(out[1].base).toBe(ROUTE_LINES[1].base)
  })

  it('prints the words in order and loses none that fit', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    const out = flowText(fakeWrap, text, OTHER_TESTS_LINES)
    const printed = out.map(l => l.text).join(' ')
    expect(text.startsWith(printed)).toBe(true)
  })

  it('drops text that does not fit on the last line, rather than printing past it', () => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')
    const out = flowText(fakeWrap, long, OTHER_TESTS_LINES)
    expect(out.length).toBe(OTHER_TESTS_LINES.length)
    const printed = out.map(l => l.text).join(' ')
    expect(printed.length).toBeLessThan(long.length)
  })

  it('collapses runs of whitespace and newlines', () => {
    const out = flowText(fakeWrap, '  Line   one\n\nline two  ', ROUTE_LINES)
    expect(out[0].text).toBe('Line one line two')
  })
})

describe('line definitions', () => {
  it('each route line has a start x, baseline and width', () => {
    for (const l of ROUTE_LINES) {
      expect(typeof l.x).toBe('number')
      expect(typeof l.base).toBe('number')
      expect(l.maxWidth).toBeGreaterThan(0)
    }
  })

  it('other tests has three lines and the first starts after its label', () => {
    expect(OTHER_TESTS_LINES).toHaveLength(3)
    expect(OTHER_TESTS_LINES[0].x).toBeGreaterThan(OTHER_TESTS_LINES[1].x)
  })
})

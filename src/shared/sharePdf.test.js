import { describe, it, expect } from 'vitest'
import { buildPdfFilename } from './sharePdf'

describe('buildPdfFilename', () => {
  it('joins parts with " - " and appends .pdf', () => {
    expect(buildPdfFilename('Pyes Pa Blitz', 'TC1234567', 'Pole Record'))
      .toBe('Pyes Pa Blitz - TC1234567 - Pole Record.pdf')
  })
  it('keeps macrons and other letters', () => {
    expect(buildPdfFilename('Māngere Rd', 'Ōtāhuhu', 'Pole Record'))
      .toBe('Māngere Rd - Ōtāhuhu - Pole Record.pdf')
  })
  it('strips characters that are unsafe in filenames', () => {
    expect(buildPdfFilename('a/b:c*d?', 'Pole Record')).toBe('abcd - Pole Record.pdf')
  })
  it('drops empty / missing parts', () => {
    expect(buildPdfFilename('', undefined, null, 'Pole Record')).toBe('Pole Record.pdf')
  })
})

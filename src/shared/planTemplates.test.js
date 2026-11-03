import { describe, it, expect } from 'vitest'
import {
  cleanTemplateName, sameTemplateName, makeTemplate, templatesFor, findByName,
  cleanImported, planSummary, isSavablePlan, NAME_MAX,
} from './planTemplates'
import { emptyPlan, addPoint, addLine, addDim } from './planModel'

function samplePlan() {
  let p = emptyPlan()
  p = addPoint(p, 'dot', 100, 100, 'Rod', 'a').plan
  p = addPoint(p, 'rect', 150, 100, 'TX', 'b').plan
  p = addLine(p, 'solid', 'green', 'normal', 100, 100, 150, 100, 'Earth wire', 'c').plan
  p = addDim(p, 'black', 'aligned', 100, 100, 150, 100, 14, '2m', 'd').plan
  return p
}

describe('template names', () => {
  it('are trimmed, single-spaced and capped', () => {
    expect(cleanTemplateName('  OH   Tx  earthing ')).toBe('OH Tx earthing')
    expect(cleanTemplateName(null)).toBe('')
    expect(cleanTemplateName('x'.repeat(200)).length).toBe(NAME_MAX)
  })
  it('match regardless of case and spacing', () => {
    expect(sameTemplateName('OH Tx earthing', ' oh  TX Earthing')).toBe(true)
    expect(sameTemplateName('OH Tx', 'UG Tx')).toBe(false)
  })
})

describe('makeTemplate', () => {
  it('stores a cleaned name and a normalised copy of the plan', () => {
    const t = makeTemplate({ formKey: '360S014EJ', name: ' End of line  earth ', plan: samplePlan(), now: new Date('2026-10-30T00:00:00Z') })
    expect(t.name).toBe('End of line earth')
    expect(t.formKey).toBe('360S014EJ')
    expect(t.savedAt).toBe('2026-10-30T00:00:00.000Z')
    expect(t.plan.els.length).toBe(4)
    expect(typeof t.id).toBe('string')
  })
  it('keeps a given id (used when replacing a template of the same name)', () => {
    expect(makeTemplate({ id: 'keep', formKey: 'F', name: 'x', plan: emptyPlan() }).id).toBe('keep')
  })
})

describe('listing and finding', () => {
  const list = [
    { id: '1', formKey: 'A', name: 'Rod 10', plan: emptyPlan() },
    { id: '2', formKey: 'A', name: 'rod 2', plan: emptyPlan() },
    { id: '3', formKey: 'B', name: 'Other form', plan: emptyPlan() },
    { id: '4', formKey: 'A', name: 'Alpha', plan: emptyPlan() },
  ]
  it('only returns the templates for the form, alphabetical with natural number order', () => {
    expect(templatesFor(list, 'A').map(t => t.name)).toEqual(['Alpha', 'rod 2', 'Rod 10'])
    expect(templatesFor(list, 'B').map(t => t.name)).toEqual(['Other form'])
    expect(templatesFor(list, 'Z')).toEqual([])
    expect(templatesFor(null, 'A')).toEqual([])
  })
  it('finds a template by name on the same form only', () => {
    expect(findByName(list, 'A', 'ALPHA').id).toBe('4')
    expect(findByName(list, 'B', 'Alpha')).toBe(null)
  })
})

describe('cleanImported', () => {
  it('accepts a good template and cleans it', () => {
    const t = cleanImported({ id: 'x', formKey: 'F', name: '  A  b ', savedAt: '2026-01-01T00:00:00.000Z', plan: samplePlan() })
    expect(t.name).toBe('A b')
    expect(t.plan.els.length).toBe(4)
  })
  it('rejects junk', () => {
    expect(cleanImported(null)).toBe(null)
    expect(cleanImported({ id: 'x', formKey: 'F', name: '', plan: {} })).toBe(null)
    expect(cleanImported({ id: 'x', formKey: 'F', name: 'n' })).toBe(null)
    expect(cleanImported({ formKey: 'F', name: 'n', plan: {} })).toBe(null)
  })
})

describe('planSummary / isSavablePlan', () => {
  it('describes what is in a plan', () => {
    expect(planSummary(samplePlan())).toBe('2 items · 1 line · 1 dimension')
    expect(planSummary(emptyPlan())).toBe('Empty')
  })
  it('an empty plan cannot be saved as a template', () => {
    expect(isSavablePlan(emptyPlan())).toBe(false)
    expect(isSavablePlan(samplePlan())).toBe(true)
  })
})

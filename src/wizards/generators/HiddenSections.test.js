// A value entered for a section that is now hidden must never print. Each
// test checks the generator's own FIELDS value function for a gated field.
import { describe, it, expect } from 'vitest'
import { FIELDS as POLE } from './PolePdfGenerator'
import { FIELDS as EE } from './ElecEquipPdfGenerator'
import { FIELDS as EB } from './ElecDistributionPdfGenerator'

const val = (field, d) => field.value(d)
const p1 = POLE.p1

describe('Pole Record — values follow the visible step', () => {
  const newPole = { poleActivity: 'New', newPoleId: 'WKT-1', manufacturerPoleId: 'GP-1',
    poleCode: '12m (12kN) Goldpine', gpsRequired: 'Yes', gpsNorth: '5812345', gpsEast: '1832456',
    altitude: '45m', poleType: '1 Pole', manufacturedDate: '01-01-22', reasonForRemoval: 'x' }

  it('prints new-pole details for a New pole', () => {
    expect(val(p1.newPoleId, newPole)).toBe('WKT-1')
    expect(val(p1.gpsNorth, newPole)).toBe('5812345')
    expect(val(p1.reasonForRemoval, newPole)).toBe('')
  })

  it('hides new-pole details for a Removed pole', () => {
    const d = { ...newPole, poleActivity: 'Removed' }
    expect(val(p1.newPoleId, d)).toBe('')
    expect(val(p1.manufacturerPoleId, d)).toBe('')
    expect(val(p1.gpsNorth, d)).toBe('')
    expect(val(p1.altitude, d)).toBe('')
    expect(val(p1.poleCodeGoldpine12m12kN, d)).toBe('')
    expect(val(p1.poleType1, d)).toBe('')
  })

  it('prints the removal reason only for Removed or Replaced', () => {
    expect(val(p1.reasonForRemoval, { poleActivity: 'Removed', reasonForRemoval: 'End of life' })).toBe('End of life')
    expect(val(p1.reasonForRemoval, { poleActivity: 'Replaced', reasonForRemoval: 'Faulty' })).toBe('Faulty')
    expect(val(p1.reasonForRemoval, { poleActivity: 'New', reasonForRemoval: 'Faulty' })).toBe('')
  })

  it('prints GPS only when GPS is required on a new pole', () => {
    expect(val(p1.gpsNorth, { ...newPole, gpsRequired: 'No' })).toBe('')
    expect(val(p1.altitude, { ...newPole, gpsRequired: '' })).toBe('')
  })

  it('does not ask for a manufacturer pole ID for a Busck code', () => {
    expect(val(p1.manufacturerPoleId, { ...newPole, poleCode: 'B12.5 (Busck)' })).toBe('')
    expect(val(p1.manufacturerPoleId, newPole)).toBe('GP-1')
  })

  it('a stale custom code only prints while its own code is selected', () => {
    const d = { ...newPole, poleCode: 'IUP', dulhuntyCode: 'D300 8kN 12m', iupCode: '12kN 11m' }
    expect(val(p1.dulhuntyText, d)).toBe('')
    expect(val(p1.iupText, d)).toBe('12kN 11m')
  })
})

describe('Electrical Equipment — reason for removal', () => {
  it('prints only when the equipment is Removed or Replaced', () => {
    const base = { reasonForRemoval: 'Faulty' }
    expect(val(EE.p1.reasonForRemoval, { ...base, typeOfChange: 'New' })).toBe('')
    expect(val(EE.p1.reasonForRemoval, { ...base, typeOfChange: 'Removed' })).toBe('Faulty')
    expect(val(EE.p1.reasonForRemoval, { ...base, typeOfChange: 'Replaced' })).toBe('Faulty')
  })
})

describe('Electrical Distribution — underground and duct details', () => {
  const ug = { distributionMain: 'Underground', cableDuctUsed: 'Yes', cableDuctType: 'New',
    numberOfDucts: '2', ductSize: '100', capped: 'Yes', drawWire: 'Yes',
    otherServicesInTrench: ['Gas', 'Other'], otherServicesOther: 'Fibre', gpsRequired: 'Yes', gpsFiles: 'a.gpx' }

  it('prints duct and service details for an underground main', () => {
    expect(val(EB.numberOfDucts, ug)).toBe('2')
    expect(val(EB.otherServicesGas, ug)).toBe(true)
    expect(val(EB.gpsFiles, ug)).toBe('a.gpx')
  })

  it('hides every underground field for an overhead main', () => {
    const d = { ...ug, distributionMain: 'Overhead' }
    expect(val(EB.numberOfDucts, d)).toBe('')
    expect(val(EB.ductSize, d)).toBe('')
    expect(val(EB.cappedYes, d)).toBe('')
    expect(val(EB.drawWireYes, d)).toBe('')
    expect(val(EB.otherServicesGas, d)).toBe('')
    expect(val(EB.otherServicesOtherText, d)).toBe('')
    expect(val(EB.gpsFiles, d)).toBe('')
  })

  it('hides duct details when the cable is not ducted', () => {
    const d = { ...ug, cableDuctUsed: 'No' }
    expect(val(EB.numberOfDucts, d)).toBe('')
    expect(val(EB.ductUsedNo, d)).toBe(true)   // "No" itself is still shown
  })
})

import { describe, it, expect } from 'vitest'
import { latLonToNztm } from './nztm'

// Reference northings below were computed independently by numerically
// integrating the GRS80 meridian arc (not with the series formula nztm.js
// uses), so they check the projection rather than restating it.
describe('latLonToNztm', () => {
  it('on the central meridian (173°E) easting is the false easting', () => {
    for (const lat of [-36.85, -41, -46.4]) {
      expect(Math.abs(latLonToNztm(lat, 173).easting - 1600000)).toBeLessThanOrEqual(1)
    }
  })

  it('on the central meridian northing matches the meridian arc', () => {
    expect(Math.abs(latLonToNztm(-41.0, 173).northing - 5461243)).toBeLessThanOrEqual(1)
    expect(Math.abs(latLonToNztm(-36.85, 173).northing - 5921767)).toBeLessThanOrEqual(1)
    expect(Math.abs(latLonToNztm(-46.4, 173).northing - 4861508)).toBeLessThanOrEqual(1)
  })

  it('eastings are symmetric either side of the central meridian', () => {
    const west = latLonToNztm(-41, 172).easting
    const east = latLonToNztm(-41, 174).easting
    expect(Math.abs((east - 1600000) - (1600000 - west))).toBeLessThanOrEqual(1)
  })

  it('Wellington lands in the expected region of NZ', () => {
    const { northing, easting } = latLonToNztm(-41.2865, 174.7762)
    expect(Math.abs(easting - 1748000)).toBeLessThanOrEqual(3000)
    expect(Math.abs(northing - 5427000)).toBeLessThanOrEqual(3000)
  })

  it('returns whole metres', () => {
    const { northing, easting } = latLonToNztm(-37.7, 176.2)
    expect(Number.isInteger(northing)).toBe(true)
    expect(Number.isInteger(easting)).toBe(true)
  })
})

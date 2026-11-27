/**
 * geoid.js — converts a GPS (ellipsoidal) height into height above sea level.
 *
 *   H (above sea level) = h (GPS, WGS84 ellipsoid) − N (geoid undulation)
 *
 * N comes from the NZGeoid2016 grid at public/geoid/nzgeoid2016.json, built
 * from LINZ's NZGeoid2016 with tools/build-geoid-grid.py. The grid is
 * precached by the service worker, so this works offline after install.
 *
 * Every function returns null (never throws) when the grid is missing or the
 * point is outside it, so callers can leave the field for manual entry.
 */
import { reportError } from './errorLog'

const GRID_URL = `${import.meta.env.BASE_URL}geoid/nzgeoid2016.json`

let grid = null
let loading = null

function isValidGrid(g) {
  return !!g
    && Number.isFinite(g.lat0) && Number.isFinite(g.lon0)
    && Number.isFinite(g.dLat) && Number.isFinite(g.dLon)
    && g.nLat >= 2 && g.nLon >= 2
    && Array.isArray(g.values) && g.values.length === g.nLat * g.nLon
}

/** Loads the grid once per session. Retries on the next call if it failed. */
export function loadGeoidGrid() {
  if (grid) return Promise.resolve(grid)
  if (!loading) {
    loading = fetch(GRID_URL)
      .then(res => {
        if (!res.ok) throw new Error(`geoid grid HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!isValidGrid(json)) throw new Error('geoid grid file is malformed')
        grid = json
        return grid
      })
      .catch(err => {
        loading = null
        throw err
      })
  }
  return loading
}

/** Bilinear interpolation of the undulation N (metres) at lat/lon. null if outside the grid. */
export function undulationAt(lat, lon) {
  if (!grid) return null
  const fy = (lat - grid.lat0) / grid.dLat
  const fx = (lon - grid.lon0) / grid.dLon
  if (fy < 0 || fx < 0 || fy > grid.nLat - 1 || fx > grid.nLon - 1) return null

  const i = Math.min(Math.floor(fy), grid.nLat - 2)
  const j = Math.min(Math.floor(fx), grid.nLon - 2)
  const ty = fy - i
  const tx = fx - j
  const at = (r, c) => grid.values[r * grid.nLon + c]

  const top = at(i, j) * (1 - tx) + at(i, j + 1) * tx
  const bottom = at(i + 1, j) * (1 - tx) + at(i + 1, j + 1) * tx
  return top * (1 - ty) + bottom * ty
}

/**
 * Height above sea level in metres, or null if it cannot be calculated.
 * @param {number} ellipsoidalHeight  GPS height from the device (metres)
 * @param {number} lat                WGS84 latitude (decimal degrees)
 * @param {number} lon                WGS84 longitude (decimal degrees)
 */
export async function heightAboveSeaLevel(ellipsoidalHeight, lat, lon) {
  try {
    await loadGeoidGrid()
  } catch (err) {
    reportError('geoid', err, { step: 'load grid' })
    return null
  }
  const N = undulationAt(lat, lon)
  return N === null ? null : ellipsoidalHeight - N
}

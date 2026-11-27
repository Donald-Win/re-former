/**
 * GpsCoordButton
 *
 * Reads the device GPS and fills North / East (NZTM2000) and Altitude
 * (height above sea level, in metres) for the Pole Record "GPS Co-ordinates" section.
 *
 * North / East: local WGS84 → NZTM2000 conversion (src/shared/nztm.js).
 * Altitude:     GPS height minus the NZGeoid2016 undulation (src/shared/geoid.js).
 *               If the device gives no height, or the grid is unavailable, the
 *               altitude is left for manual entry and a note explains why.
 *
 * No network request is made, so this works offline.
 * A 2-second cooldown follows any error to avoid rapid re-taps.
 * maximumAge (30 s) lets the OS reuse a recent lock instead of reacquiring
 * satellites, which times out often in rural areas.
 *
 * Props:
 *   onCoords(fields) — called with { gpsNorth, gpsEast, altitude? }.
 *                      `altitude` is only included when calculated, so existing
 *                      typed values are never blanked.
 *   accent           — hex colour for the button border/text
 */
import { useState, useRef, useEffect } from 'react'
import { latLonToNztm } from './nztm'
import { heightAboveSeaLevel } from './geoid'

const COOLDOWN_MS = 2000

export function GpsCoordButton({ onCoords, accent = '#6366f1' }) {
  const [status, setStatus]         = useState('idle') // idle | locating | error
  const [errorMsg, setErrorMsg]     = useState('')
  const [altNote, setAltNote]       = useState('')
  const [isCooldown, setIsCooldown] = useState(false)

  const cooldownRef = useRef(null)
  const mountedRef  = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (cooldownRef.current) clearTimeout(cooldownRef.current)
    }
  }, [])

  const enterError = (msg) => {
    if (!mountedRef.current) return
    setStatus('error')
    setErrorMsg(msg)
    if (cooldownRef.current) clearTimeout(cooldownRef.current)
    setIsCooldown(true)
    cooldownRef.current = setTimeout(() => {
      if (mountedRef.current) setIsCooldown(false)
      cooldownRef.current = null
    }, COOLDOWN_MS)
  }

  const handleFix = async (pos) => {
    const { latitude, longitude, altitude } = pos.coords
    try {
      const { northing, easting } = latLonToNztm(latitude, longitude)
      const fields = { gpsNorth: String(northing), gpsEast: String(easting) }

      let note = ''
      if (altitude === null || altitude === undefined) {
        note = 'Your device gave no height reading, so altitude was not filled. Enter it by hand.'
      } else {
        const aboveSea = await heightAboveSeaLevel(altitude, latitude, longitude)
        if (aboveSea === null) {
          note = 'Altitude could not be calculated (geoid grid unavailable, or outside NZ). Enter it by hand.'
        } else {
          fields.altitude = `${Math.round(aboveSea)}m`
        }
      }

      if (!mountedRef.current) return
      setAltNote(note)
      onCoords(fields)
      setStatus('idle')
    } catch (err) {
      console.error('GpsCoordButton: NZTM conversion failed', err)
      enterError('Could not calculate co-ordinates. Try again.')
    }
  }

  const handlePress = () => {
    if (status === 'locating' || isCooldown) return

    if (!navigator.geolocation) {
      enterError('Geolocation is not supported by this browser.')
      return
    }

    setStatus('locating')
    setErrorMsg('')
    setAltNote('')

    navigator.geolocation.getCurrentPosition(
      handleFix,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          const isInsecure = location.protocol !== 'https:' && location.hostname !== 'localhost'
          if (isInsecure) {
            enterError('GPS is only available on the deployed app (HTTPS). It will not work on the local dev server.')
            return
          }
          const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent)
          const isStandalone = window.matchMedia('(display-mode: standalone)').matches
          let msg
          if (isIOS) {
            msg = 'Location denied. Go to Settings → Safari → Location → Allow.'
          } else if (isStandalone) {
            msg = 'Location was previously blocked. In Android Settings → Apps, find the browser you installed this app from, then go to Permissions → Location → Allow.'
          } else {
            msg = 'Location was previously blocked. In your browser settings, find this site under Location permissions and change it to Allow.'
          }
          enterError(msg)
        } else if (err.code === err.TIMEOUT) {
          enterError('Location timed out. Try again outdoors with a clear sky view.')
        } else {
          enterError('Could not get location. Try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }

  const disabled = status === 'locating' || isCooldown
  const label = status === 'locating' ? '📡 Getting GPS fix…'
              : isCooldown            ? '⏳ Please wait…'
              : '📍 Use my GPS for North / East'

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={handlePress}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: `2px dashed ${accent}`,
          background: disabled ? '#f5f5ff' : '#eef2ff',
          color: disabled ? '#9ca3af' : accent,
          fontWeight: 700,
          fontSize: 14,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {label}
      </button>
      {status === 'error' && (
        <div style={{
          marginTop: 6,
          padding: '8px 12px',
          background: '#fff1f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          fontSize: 12,
          color: '#dc2626',
        }}>
          {errorMsg}
        </div>
      )}
      {altNote && (
        <div style={{
          marginTop: 6,
          padding: '8px 12px',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 6,
          fontSize: 12,
          color: '#92400e',
        }}>
          {altNote}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.4 }}>
        Fills North / East (NZTM2000). Altitude is height above sea level, calculated from the
        device's GPS height using the NZ geoid model. Works offline.
      </div>
    </div>
  )
}

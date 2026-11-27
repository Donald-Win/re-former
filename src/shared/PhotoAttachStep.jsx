/**
 * PhotoAttachStep — shared wizard step for attaching photos to a PDF.
 *
 * Props:
 *   photos   – array of { dataUrl: string, name: string, normalized: boolean }
 *   onChange – setter: (updaterFn) => void
 *   accent   – hex colour for branding
 *
 * Each photo is resized and re-encoded as a JPEG (max 1600px, 80%) before it
 * enters wizard state, so drafts and autosaves stay small. `normalized: true`
 * tells appendPhotosToPdf.js the photo is already correctly oriented and
 * sized, so it can skip its own processing pass. A photo whose compression
 * fails keeps its original data with `normalized: false`.
 *
 * Photos are read one at a time, in selection order. Decoding several
 * full-size camera images at once can exhaust memory on an iPad.
 */
import React, { useRef, useState } from 'react'
import { Camera, X, ImageIcon } from 'lucide-react'

const MAX_ATTACH_PX       = 1600  // longest edge cap — matches appendPhotosToPdf.js
const ATTACH_JPEG_QUALITY = 0.8

/** Resize `img` to fit within MAX_ATTACH_PX and re-encode as a JPEG data URL. */
function compressImage(img) {
  const { naturalWidth: w, naturalHeight: h } = img
  let drawW = w
  let drawH = h
  if (w > MAX_ATTACH_PX || h > MAX_ATTACH_PX) {
    const scale = MAX_ATTACH_PX / Math.max(w, h)
    drawW = Math.round(w * scale)
    drawH = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width  = drawW
  canvas.height = drawH
  canvas.getContext('2d').drawImage(img, 0, 0, drawW, drawH)
  return canvas.toDataURL('image/jpeg', ATTACH_JPEG_QUALITY)
}

function readFileAsPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const rawDataUrl = ev.target.result
      const img = new Image()
      img.onload = () => {
        try {
          resolve({ dataUrl: compressImage(img), name: file.name, normalized: true })
        } catch (err) {
          // Compression failed: keep the original. It is not normalised, so
          // appendPhotosToPdf.js must run its full processing on it.
          console.warn(`PhotoAttachStep: compression failed for ${file.name}, using original`, err)
          resolve({ dataUrl: rawDataUrl, name: file.name, normalized: false })
        }
      }
      img.onerror = () => reject(new Error(`Failed to decode ${file.name}`))
      img.src = rawDataUrl
    }
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export function PhotoAttachStep({ photos = [], onChange, accent = '#4f46e5' }) {
  const inputRef = useRef(null)
  // How many photos from the most recent selection could not be read.
  const [failedCount, setFailedCount] = useState(0)

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    // Clear the input so the same file can be picked again later.
    e.target.value = ''

    const batch = []
    let failed = 0
    for (const file of files) {
      try {
        batch.push(await readFileAsPhoto(file))
      } catch (err) {
        failed += 1
        console.warn('PhotoAttachStep: could not read photo', err)
      }
    }
    if (batch.length > 0) onChange(prev => [...prev, ...batch])
    setFailedCount(failed)
  }

  const removePhoto = (idx) => {
    onChange(prev => prev.filter((_, i) => i !== idx))
  }

  // Photos are appended to the PDF in this order (one per page).
  const movePhoto = (idx, dir) => {
    onChange(prev => {
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const arrowBtn = (disabled) => ({
    background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
    width: 26, height: 26, padding: 0, color: '#fff', fontSize: 15, lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
        Select photos to attach at the end of the PDF.
        Each photo appears on its own full page — landscape photos are automatically placed on a landscape page.
      </p>

      {failedCount > 0 && (
        <div role="alert" style={{
          background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10,
          padding: '10px 14px', marginBottom: 12,
          fontSize: 13, color: '#b91c1c', fontWeight: 600, lineHeight: 1.4,
        }}>
          {failedCount} photo{failedCount !== 1 ? 's' : ''} could not be read and {failedCount !== 1 ? 'were' : 'was'} not added.
          Try again, or pick a JPEG or PNG photo.
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 10,
          border: `2px dashed ${accent}`,
          background: accent + '18',
          color: accent,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Camera size={18} />
        {photos.length === 0 ? 'Add Photos' : 'Add More Photos'}
      </button>

      {photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#d1d5db' }}>
          <ImageIcon size={44} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
          <div style={{ fontSize: 13 }}>No photos attached — tap above to add photos from your camera roll or take a new photo.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {photos.map((photo, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f3f4f6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                }}
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.name || `Photo ${idx + 1}`}
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => removePhoto(idx)}
                  style={{
                    position: 'absolute', top: 5, right: 5,
                    background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
                    width: 26, height: 26, cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}
                >
                  <X size={14} />
                </button>
                <div style={{
                  position: 'absolute', top: 5, left: 5,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <button onClick={() => movePhoto(idx, -1)} disabled={idx === 0}
                    aria-label="Move earlier" style={arrowBtn(idx === 0)}>‹</button>
                  <span style={{
                    background: accent, color: '#fff', borderRadius: 10,
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', minWidth: 18, textAlign: 'center',
                  }}>{idx + 1}</span>
                  <button onClick={() => movePhoto(idx, 1)} disabled={idx === photos.length - 1}
                    aria-label="Move later" style={arrowBtn(idx === photos.length - 1)}>›</button>
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  color: '#fff', fontSize: 10, padding: '8px 6px 4px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  📷 {photo.name || `Photo ${idx + 1}`}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: accent + '12', border: `1px solid ${accent}40`, borderRadius: 8,
            fontSize: 13, color: accent, fontWeight: 600, textAlign: 'center',
          }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} will be appended to the PDF, in the order shown
          </div>
        </>
      )}
    </div>
  )
}

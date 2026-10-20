/**
 * BackupRestore — "Backup & Restore" card for My Details (UserSettings.jsx).
 *
 * All logic lives in backupData.js; this is just the buttons, a confirm
 * step before anything is overwritten, and a status line. After a restore
 * the page reloads so every screen re-reads the restored details.
 */
import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportBackupFile, parseBackup, applyBackup, summarise } from './backupData'
import { APP_ACCENT } from './constants'

export function BackupRestore({ accent = APP_ACCENT }) {
  const fileRef = useRef(null)
  const [busy, setBusy]     = useState(false)
  const [status, setStatus] = useState(null) // { ok: boolean, text: string }

  const handleExport = async () => {
    setBusy(true); setStatus(null)
    try {
      const { done, summary } = await exportBackupFile()
      if (done) {
        setStatus({ ok: true, text: `Backed up ${summary.drafts} draft${summary.drafts !== 1 ? 's' : ''}, ${summary.projects} project${summary.projects !== 1 ? 's' : ''} and your saved details.` })
      }
    } catch (err) {
      console.error('[BackupRestore] export failed:', err)
      setStatus({ ok: false, text: 'Could not create the backup. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return
    setBusy(true); setStatus(null)
    try {
      const backup = parseBackup(await file.text())
      const s = summarise(backup)
      const ok = window.confirm(
        `Restore ${s.drafts} draft${s.drafts !== 1 ? 's' : ''}, ${s.projects} project${s.projects !== 1 ? 's' : ''} and your saved details from this backup?\n\n` +
        'Anything on this device with the same name will be overwritten.'
      )
      if (!ok) { setBusy(false); return }
      const written = await applyBackup(backup)
      setStatus({ ok: true, text: `Restored ${written.drafts} draft${written.drafts !== 1 ? 's' : ''}, ${written.projects} project${written.projects !== 1 ? 's' : ''}. Reloading…` })
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      console.error('[BackupRestore] restore failed:', err)
      setStatus({ ok: false, text: err.message || 'Could not restore that file.' })
      setBusy(false)
    }
  }

  const btn = (primary) => ({
    flex: 1, padding: '12px 8px', borderRadius: 10,
    border: `2px solid ${accent}`,
    background: primary ? accent : '#fff',
    color: primary ? '#fff' : accent,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  })

  return (
    <div style={{
      background: '#fff', border: `1px solid ${accent}20`, borderRadius: 14,
      padding: '18px 16px', marginBottom: 14, boxShadow: `0 2px 8px ${accent}10`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700,
        color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
      }}>
        Backup &amp; Restore
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12, lineHeight: 1.4 }}>
        Your drafts, projects and saved details only exist on this device. Save a backup
        file somewhere safe (Files, email, cloud) so you can restore them after replacing
        or resetting it. The file includes your signature and any draft photos.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleExport} disabled={busy} style={btn(true)}>
          <Download size={16} /> Back up my data
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn(false)}>
          <Upload size={16} /> Restore from backup
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".json,application/json"
        onChange={handleFile} style={{ display: 'none' }} />

      {status && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.4,
          background: status.ok ? '#f0fdf4' : '#fff1f2',
          border: `1px solid ${status.ok ? '#86efac' : '#fecaca'}`,
          color: status.ok ? '#166534' : '#dc2626',
        }}>
          {status.text}
        </div>
      )}
    </div>
  )
}

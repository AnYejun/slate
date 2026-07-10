import React, { useEffect, useState } from 'react'
import { Icon } from './Icon.jsx'
import { listVersions, restoreVersion, saveCheckpoint } from './sync.js'

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const KIND_LABEL = { checkpoint: 'Checkpoint', auto: 'Auto-save', 'pre-restore': 'Before restore' }

export default function HistoryModal({ onClose, onToast }) {
  const [versions, setVersions] = useState(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => listVersions().then(setVersions)
  useEffect(() => { refresh() }, [])

  async function checkpoint() {
    setBusy(true)
    await saveCheckpoint(label.trim())
    setLabel('')
    await refresh()
    setBusy(false)
    onToast?.('Checkpoint saved')
  }
  async function restore(file) {
    setBusy(true)
    const ok = await restoreVersion(file)
    setBusy(false)
    onToast?.(ok ? 'Version restored' : 'Restore failed')
    if (ok) onClose()
  }

  return (
    <div className="modal-overlay" onPointerDown={onClose}>
      <div className="modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3><Icon name="clock" size={16} /> Version history</h3>
          <button className="icon-btn subtle" style={{ width: 30, height: 30 }} onClick={onClose} title="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="checkpoint-row">
          <input
            type="text"
            placeholder="Name this checkpoint (optional)…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !(e.nativeEvent?.isComposing || e.keyCode === 229)) checkpoint() }}
          />
          <button className="btn btn-primary" onClick={checkpoint} disabled={busy}>
            <Icon name="clock" size={15} stroke={2} /> Save checkpoint
          </button>
        </div>

        <div className="version-list">
          {versions == null ? (
            <div className="version-empty">Loading…</div>
          ) : versions.length === 0 ? (
            <div className="version-empty">No versions yet. Snapshots are captured automatically as you edit.</div>
          ) : (
            versions.map((v) => (
              <div key={v.file} className={'version ' + v.kind}>
                <span className={'v-dot ' + v.kind} />
                <span className="v-main">
                  <span className="v-title">{v.label || KIND_LABEL[v.kind] || v.kind}</span>
                  <span className="v-sub">{ago(v.ts)} · {v.cardCount} slide{v.cardCount === 1 ? '' : 's'}{v.title ? ` · ${v.title}` : ''}</span>
                </span>
                <button className="btn btn-secondary v-restore" onClick={() => restore(v.file)} disabled={busy}>Restore</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Talk to the Vite dev-server middleware (see vite.config.js).

export async function loadDoc() {
  const r = await fetch('/api/cards', { cache: 'no-store' })
  if (!r.ok) throw new Error('load failed')
  return await r.json()
}

export async function saveDoc(doc) {
  await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  })
}

// One SSE stream for everything the server pushes:
//  - onDoc(doc, changes): cards.json was edited on disk by someone other than
//    this editor (i.e. Claude). `changes` = element-level diff for presence.
//  - onPresence(event): an agent announced itself via POST /api/presence.
// Returns an unsubscribe.
export function subscribeEvents({ onDoc, onPresence, onAgent }) {
  let es
  try {
    es = new EventSource('/api/stream')
  } catch {
    return () => {}
  }
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'external' && onDoc) onDoc(JSON.parse(msg.content), msg.changes || [])
      else if (msg.type === 'presence' && onPresence) onPresence(msg.event)
      else if (msg.type === 'agent' && onAgent) onAgent(msg.ev)
    } catch {
      /* ignore malformed frame */
    }
  }
  return () => es.close()
}

// ── sub-agent control ──
export async function runAgents(payload) {
  try {
    const r = await fetch('/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    })
    return await r.json()
  } catch {
    return { ok: false, error: 'request failed' }
  }
}

export async function stopAgent(id) {
  try {
    await fetch('/api/agents/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  } catch { /* ignore */ }
}

// Back-compat shim.
export function subscribeExternal(cb) {
  return subscribeEvents({ onDoc: cb })
}

// ── version history ──
export async function listVersions() {
  try {
    const r = await fetch('/api/versions', { cache: 'no-store' })
    return r.ok ? await r.json() : []
  } catch {
    return []
  }
}

export async function saveCheckpoint(label) {
  try {
    await fetch('/api/checkpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    return true
  } catch {
    return false
  }
}

export async function restoreVersion(file) {
  try {
    const r = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file }),
    })
    return r.ok
  } catch {
    return false
  }
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'

// cards.json lives next to package.json (the process cwd when `vite` runs).
const ROOT = process.cwd()
const CARDS_PATH = path.resolve(ROOT, 'cards.json')
const HIST_DIR = path.resolve(ROOT, '.slate-history')
const INDEX_PATH = path.resolve(HIST_DIR, 'index.json')

const EMPTY_DOC = { version: 1, doc: { title: 'Untitled' }, cards: [], comments: [] }

const AUTO_MIN_GAP = 20000 // ms between auto-snapshots
const AUTO_KEEP = 40 // max auto snapshots retained

function readJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

function cardsApiPlugin() {
  let lastServerWrite = ''
  let lastAutoTs = 0
  const clients = new Set()

  function readCards() {
    try {
      return fs.readFileSync(CARDS_PATH, 'utf8')
    } catch {
      return JSON.stringify(EMPTY_DOC, null, 2)
    }
  }

  function broadcast(msg) {
    const payload = `data: ${JSON.stringify(msg)}\n\n`
    for (const res of clients) {
      try { res.write(payload) } catch { /* gone */ }
    }
  }

  function broadcastExternal(content, changes) {
    broadcast({ type: 'external', content, changes: changes || [] })
  }

  // Element-level diff between two doc strings → what an agent "touched".
  // Powers the live Claude-cursor presence layer in the editor.
  function computeChanges(oldStr, newStr) {
    let a, b
    try {
      a = JSON.parse(oldStr)
      b = JSON.parse(newStr)
    } catch {
      return []
    }
    const out = []
    const oldCards = new Map((a.cards || []).map((c) => [c.id, c]))
    for (const nc of b.cards || []) {
      const oc = oldCards.get(nc.id)
      if (!oc) {
        out.push({ cardId: nc.id, elementId: null, kind: 'add' })
        continue
      }
      // card-level props (background, size, name)
      const cardProps = (c) => JSON.stringify([c.name, c.width, c.height, c.background])
      if (cardProps(oc) !== cardProps(nc)) out.push({ cardId: nc.id, elementId: null, kind: 'update' })
      const oldEls = new Map((oc.elements || []).map((e) => [e.id, e]))
      for (const ne of nc.elements || []) {
        const oe = oldEls.get(ne.id)
        if (!oe) out.push({ cardId: nc.id, elementId: ne.id, kind: 'add' })
        else if (JSON.stringify(oe) !== JSON.stringify(ne)) out.push({ cardId: nc.id, elementId: ne.id, kind: 'update' })
        oldEls.delete(ne.id)
      }
      for (const [id] of oldEls) out.push({ cardId: nc.id, elementId: id, kind: 'remove' })
      oldCards.delete(nc.id)
    }
    for (const [id] of oldCards) out.push({ cardId: id, elementId: null, kind: 'remove' })
    return out.slice(0, 24)
  }

  // ── sub-agent runner (headless `claude -p` processes) ────────
  const agents = new Map() // id → {name, cardId, proc, status, startedAt, timer}
  let claudeBin = null
  function findClaude() {
    if (claudeBin) return claudeBin
    try { claudeBin = execSync('which claude', { encoding: 'utf8' }).trim() || null } catch { /* no shell hit */ }
    if (!claudeBin) {
      const home = process.env.HOME || ''
      const cands = ['/opt/homebrew/bin/claude', '/usr/local/bin/claude', `${home}/.local/bin/claude`]
      try {
        const nvm = `${home}/.nvm/versions/node`
        for (const v of fs.readdirSync(nvm)) cands.push(`${nvm}/${v}/bin/claude`)
      } catch { /* no nvm */ }
      claudeBin = cands.find((p) => { try { return fs.existsSync(p) } catch { return false } }) || null
    }
    return claudeBin
  }

  const SCHEMA_HINT = `cards.json schema: {version, doc:{title}, cards:[{id,name,width,height,background,elements:[...]}], comments:[...]}.
Element: {id, type: heading|text|rect|ellipse|line|image, x,y,w,h (top-left px), rotation, text?, src?, style}.
Text style: {color, fontSize, fontWeight, fontFamily?, textAlign, vAlign, lineHeight, letterSpacing}. rect: {fill, stroke, strokeWidth, radius}. ellipse: {fill}. line: {stroke, strokeWidth, arrow}. Draw order = array order.
Comment: {id, cardId, elementId, status, body, replies:[{author,body}], queued, sent}.`

  function agentPrompt({ cardName, cardId, items, freeform }) {
    const rules = `You are a Slate design sub-agent. Work ONLY on the file cards.json in the current directory.
${SCHEMA_HINT}
Rules:
- Read cards.json first. If design.md exists in the current directory, Read it too and follow its design system (palette, type scale, spacing).
- Make targeted, minimal edits. Never rewrite unrelated slides.
- Keep coordinates inside each card's width/height. Keep the existing visual language.
- For EACH directive you complete: set that comment's "status" to "resolved" and append {"author":"claude","body":"<one line: what you changed>"} to its "replies". Reply in the same language as the directive. NEVER modify "queued"/"sent" fields.
- If a directive is ambiguous, act on your best judgment and note the assumption in the reply.`
    if (freeform) {
      return `${rules}\n\nThe user asks (apply to the deck, any slide as needed):\n${freeform}\n\nThis request has no comment attached — just make the change. When done, print a one-line summary.`
    }
    const list = items
      .map((c, i) => `${i + 1}. [comment ${c.id}] element ${c.elementId || '(whole card)'}: ${c.body}`)
      .join('\n')
    return `${rules}\n\nSlide "${cardName}" (card id "${cardId}"). Apply these user directives:\n${list}\n\nWhen done, print a one-line summary.`
  }

  function spawnAgent({ name, cardId, prompt, model, directives }) {
    const bin = findClaude()
    if (!bin) return null
    const id = 'ag-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json', '--verbose',
      '--allowedTools', 'Read,Edit,Write',
      '--permission-mode', 'acceptEdits',
      '--model', model || 'claude-sonnet-5',
    ]
    // Fully isolated env: drop every nested-session/proxy marker (the desktop
    // app injects ANTHROPIC_BASE_URL etc., which 401s a standalone CLI) so the
    // agent authenticates with the user's own `claude /login` credentials.
    // Close stdin so `-p` mode doesn't wait for a piped prompt.
    const env = { ...process.env }
    for (const k of Object.keys(env)) {
      if (k.startsWith('CLAUDECODE') || k.startsWith('CLAUDE_') || k.startsWith('ANTHROPIC_')) delete env[k]
    }
    const proc = spawn(bin, args, { cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe'] })
    try { proc.stdin.end() } catch { /* fine */ }
    const a = { id, name, cardId, proc, status: 'running', startedAt: Date.now(), timer: null }
    agents.set(id, a)
    broadcast({ type: 'agent', ev: { id, kind: 'start', name, cardId, directives: directives || [] } })
    let buf = ''
    proc.stdout.on('data', (chunk) => {
      buf += chunk
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 1)
        handleAgentLine(a, line)
      }
    })
    proc.stderr.on('data', (c) => {
      const s = String(c).trim()
      if (s) broadcast({ type: 'agent', ev: { id, kind: 'log', line: '! ' + s.slice(0, 280) } })
    })
    proc.on('close', (code) => {
      clearTimeout(a.timer)
      if (a.status === 'running') {
        a.status = code === 0 ? 'done' : 'error'
        broadcast({ type: 'agent', ev: { id, kind: 'done', status: a.status } })
      }
      setTimeout(() => agents.delete(id), 8000) // linger for cursor attribution
    })
    a.timer = setTimeout(() => {
      try { proc.kill() } catch { /* already dead */ }
      a.status = 'error'
      broadcast({ type: 'agent', ev: { id, kind: 'done', status: 'timeout' } })
    }, 300000)
    return a
  }

  function handleAgentLine(a, line) {
    if (!line.trim()) return
    let j
    try { j = JSON.parse(line) } catch {
      broadcast({ type: 'agent', ev: { id: a.id, kind: 'log', line: line.slice(0, 280) } })
      return
    }
    if (j.type === 'system' && j.subtype === 'init') {
      broadcast({ type: 'agent', ev: { id: a.id, kind: 'log', line: `⚙ ${j.model || 'model'} · session ${String(j.session_id || '').slice(0, 8)}` } })
    } else if (j.type === 'assistant' && j.message?.content) {
      for (const c of j.message.content) {
        if (c.type === 'text' && c.text?.trim()) {
          broadcast({ type: 'agent', ev: { id: a.id, kind: 'log', line: '💬 ' + c.text.trim().replace(/\s+/g, ' ').slice(0, 240) } })
        } else if (c.type === 'tool_use') {
          const f = c.input?.file_path ? ' ' + String(c.input.file_path).split('/').pop() : ''
          broadcast({ type: 'agent', ev: { id: a.id, kind: 'log', line: `▸ ${c.name}${f}` } })
        }
      }
    } else if (j.type === 'result') {
      a.status = j.subtype === 'success' ? 'done' : 'error'
      broadcast({
        type: 'agent',
        ev: {
          id: a.id, kind: 'done', status: a.status,
          cost: j.total_cost_usd, duration: j.duration_ms,
          summary: String(j.result || '').replace(/\s+/g, ' ').slice(0, 280),
        },
      })
    }
  }

  // attribute a changed card to the sub-agent working on it (cursor naming)
  function agentForCard(cardId) {
    for (const a of agents.values()) {
      if (a.status === 'running' && a.cardId === cardId) return a.name
    }
    const running = [...agents.values()].filter((a) => a.status === 'running')
    if (running.length === 1) return running[0].name
    return null
  }

  // ── version history ──────────────────────────────────────────
  function loadIndex() {
    return readJSON(INDEX_PATH, [])
  }
  function saveIndex(idx) {
    fs.mkdirSync(HIST_DIR, { recursive: true })
    fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2))
  }
  function snapshot(content, kind, label) {
    try {
      fs.mkdirSync(HIST_DIR, { recursive: true })
      const ts = Date.now()
      const file = `${kind}-${ts}.json`
      fs.writeFileSync(path.resolve(HIST_DIR, file), content)
      let idx = loadIndex()
      let cardCount = 0
      let title = ''
      try {
        const d = JSON.parse(content)
        cardCount = (d.cards || []).length
        title = d.doc?.title || ''
      } catch { /* ignore */ }
      idx.unshift({ file, ts, kind, label: label || '', cardCount, title })
      // prune auto snapshots beyond AUTO_KEEP
      const autos = idx.filter((e) => e.kind === 'auto')
      if (autos.length > AUTO_KEEP) {
        const drop = new Set(autos.slice(AUTO_KEEP).map((e) => e.file))
        idx = idx.filter((e) => {
          if (drop.has(e.file)) {
            try { fs.unlinkSync(path.resolve(HIST_DIR, e.file)) } catch {}
            return false
          }
          return true
        })
      }
      saveIndex(idx)
      return { file, ts }
    } catch {
      return null
    }
  }

  // watch dir for external (Claude) edits
  let timer = null
  function startWatch() {
    try {
      fs.watch(path.dirname(CARDS_PATH), (_evt, fname) => {
        if (fname && fname !== 'cards.json') return
        clearTimeout(timer)
        timer = setTimeout(() => {
          const content = readCards()
          if (content !== lastServerWrite) {
            const changes = computeChanges(lastServerWrite, content)
            for (const ch of changes) {
              const n = agentForCard(ch.cardId)
              if (n) ch.agent = n
            }
            lastServerWrite = content
            snapshot(content, 'auto') // external edits are always worth a snapshot
            broadcastExternal(content, changes)
          }
        }, 80)
      })
    } catch { /* unsupported */ }
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => resolve(body))
    })
  }

  return {
    name: 'slate-cards-api',
    configureServer(server) {
      lastServerWrite = readCards()
      startWatch()

      server.middlewares.use('/api/cards', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(readCards())
          return
        }
        if (req.method === 'POST' || req.method === 'PUT') {
          readBody(req).then((body) => {
            try {
              const parsed = JSON.parse(body)
              const content = JSON.stringify(parsed, null, 2) + '\n'
              lastServerWrite = content
              fs.writeFileSync(CARDS_PATH, content)
              const now = Date.now()
              if (now - lastAutoTs > AUTO_MIN_GAP) {
                lastAutoTs = now
                snapshot(content, 'auto')
              }
              res.setHeader('Content-Type', 'application/json')
              res.end('{"ok":true}')
            } catch {
              res.statusCode = 400
              res.end('{"ok":false,"error":"invalid json"}')
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })

      server.middlewares.use('/api/stream', (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        res.write('retry: 2000\n\n')
        clients.add(res)
        req.on('close', () => clients.delete(res))
      })

      // list versions
      server.middlewares.use('/api/versions', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(loadIndex()))
      })

      // save a named checkpoint of the current doc
      server.middlewares.use('/api/checkpoint', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        readBody(req).then((body) => {
          let label = ''
          try { label = JSON.parse(body || '{}').label || '' } catch {}
          const info = snapshot(readCards(), 'checkpoint', label)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: !!info, ...info }))
        })
      })

      // design style library: list bundled design systems / apply one as design.md
      server.middlewares.use('/api/designs', (req, res) => {
        const dir = path.resolve(ROOT, 'designs')
        if (req.method === 'GET') {
          let list = []
          try {
            list = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
          } catch { /* no designs dir */ }
          let current = null
          try {
            const head = fs.readFileSync(path.resolve(ROOT, 'design.md'), 'utf8').slice(0, 400)
            const m = head.match(/<!-- slate-style: ([\w.-]+) -->/)
            current = m ? m[1] : null
          } catch { /* no design.md */ }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ styles: list, current }))
          return
        }
        if (req.method === 'POST') {
          readBody(req).then((body) => {
            let name = ''
            try { name = JSON.parse(body || '{}').name || '' } catch { /* keep '' */ }
            const src = path.resolve(dir, path.basename(name) + '.md')
            if (!name || !fs.existsSync(src)) { res.statusCode = 404; res.end('{"ok":false}'); return }
            const content = `<!-- slate-style: ${path.basename(name)} -->\n` + fs.readFileSync(src, 'utf8')
            fs.writeFileSync(path.resolve(ROOT, 'design.md'), content)
            res.setHeader('Content-Type', 'application/json')
            res.end('{"ok":true}')
          })
          return
        }
        res.statusCode = 405
        res.end()
      })

      // run sub-agents on queued directives (or a free-form prompt)
      server.middlewares.use('/api/agents/run', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        readBody(req).then((body) => {
          let payload = {}
          try { payload = JSON.parse(body || '{}') } catch { /* keep {} */ }
          if (!findClaude()) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: 'claude CLI not found on this machine' }))
            return
          }
          const started = []
          if (payload.prompt && String(payload.prompt).trim()) {
            const a = spawnAgent({
              name: 'Claude',
              cardId: null,
              prompt: agentPrompt({ freeform: String(payload.prompt).slice(0, 4000) }),
              model: payload.model,
              directives: [String(payload.prompt).slice(0, 200)],
            })
            if (a) started.push({ id: a.id, name: a.name, cardId: null })
          } else {
            let doc
            try { doc = JSON.parse(readCards()) } catch { doc = null }
            if (!doc) { res.statusCode = 500; res.end('{"ok":false,"error":"cards.json unreadable"}'); return }
            const wanted = new Set(payload.commentIds || [])
            const items = (doc.comments || []).filter((c) =>
              c.status !== 'resolved' && (c.body || '').trim() &&
              (wanted.size ? wanted.has(c.id) : c.queued && !c.sent),
            )
            const byCard = new Map()
            for (const c of items) {
              if (!byCard.has(c.cardId)) byCard.set(c.cardId, [])
              byCard.get(c.cardId).push(c)
            }
            let n = 0
            for (const [cardId, list] of byCard) {
              if (n >= 3) break // concurrency cap
              const card = doc.cards.find((cc) => cc.id === cardId)
              if (!card) continue
              const a = spawnAgent({
                name: `Agent · ${card.name}`,
                cardId,
                prompt: agentPrompt({ cardName: card.name, cardId, items: list }),
                model: payload.model,
                directives: list.map((c) => ({ id: c.id, body: String(c.body).slice(0, 160) })),
              })
              if (a) { started.push({ id: a.id, name: a.name, cardId, commentIds: list.map((c) => c.id) }); n++ }
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: started.length > 0, agents: started }))
        })
      })

      server.middlewares.use('/api/agents/stop', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        readBody(req).then((body) => {
          let id = ''
          try { id = JSON.parse(body || '{}').id || '' } catch { /* keep '' */ }
          const a = agents.get(id)
          if (a) {
            a.status = 'error'
            try { a.proc.kill() } catch { /* already dead */ }
            broadcast({ type: 'agent', ev: { id, kind: 'done', status: 'stopped' } })
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: !!a }))
        })
      })

      // presence: agents announce themselves (name, target, action) → the
      // editor renders live multiplayer-style cursors. POST one event per move.
      server.middlewares.use('/api/presence', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        readBody(req).then((body) => {
          try {
            const e = JSON.parse(body || '{}')
            if (!e.agent || typeof e.agent !== 'string') throw new Error('agent required')
            broadcast({
              type: 'presence',
              event: {
                agent: String(e.agent).slice(0, 40),
                color: typeof e.color === 'string' ? e.color : null,
                cardId: e.cardId || null,
                elementId: e.elementId || null,
                x: Number.isFinite(e.x) ? e.x : null,
                y: Number.isFinite(e.y) ? e.y : null,
                action: typeof e.action === 'string' ? e.action.slice(0, 80) : '',
              },
            })
            res.setHeader('Content-Type', 'application/json')
            res.end('{"ok":true}')
          } catch {
            res.statusCode = 400
            res.end('{"ok":false}')
          }
        })
      })

      // restore a version into cards.json (snapshots current first)
      server.middlewares.use('/api/restore', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        readBody(req).then((body) => {
          let file = ''
          try { file = JSON.parse(body || '{}').file || '' } catch {}
          const target = path.resolve(HIST_DIR, path.basename(file))
          if (!file || !fs.existsSync(target)) {
            res.statusCode = 404
            res.end('{"ok":false}')
            return
          }
          snapshot(readCards(), 'checkpoint', 'before restore')
          const content = fs.readFileSync(target, 'utf8')
          const changes = computeChanges(lastServerWrite, content)
          lastServerWrite = content
          fs.writeFileSync(CARDS_PATH, content)
          broadcastExternal(content, changes)
          res.setHeader('Content-Type', 'application/json')
          res.end('{"ok":true}')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), cardsApiPlugin()],
  server: { host: true, port: 5173, strictPort: false },
})

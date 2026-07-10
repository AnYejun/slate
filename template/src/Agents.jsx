import React, { useEffect, useRef, useState } from 'react'
import { Icon, IconButton } from './Icon.jsx'
import { isComposingEvent } from './sync.js'

function elapsed(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const STATUS_LABEL = { running: 'working…', done: 'done', error: 'failed', timeout: 'timed out', stopped: 'stopped' }

function AgentMessage({ run, cards, onStop }) {
  const logRef = useRef(null)
  const [now, setNow] = useState(Date.now())
  const [showShell, setShowShell] = useState(true)

  useEffect(() => {
    if (run.status !== 'running') return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [run.status])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [run.log.length, showShell])

  const card = cards.find((c) => c.id === run.cardId)
  const running = run.status === 'running'
  const meta = running
    ? elapsed(now - run.startedAt)
    : run.cost > 0.005
      ? `$${run.cost.toFixed(2)} · ${elapsed(run.duration || 0)}`
      : run.duration
        ? elapsed(run.duration)
        : STATUS_LABEL[run.status]

  return (
    <div className={'msg agent ' + run.status}>
      <div className="msg-head">
        <span className={'ar-dot ' + run.status} />
        <span className="msg-author">{run.name}</span>
        {card && <span className="msg-target">→ {card.name}</span>}
        <span className="grow" />
        <span className="msg-meta">{meta}</span>
        {running && (
          <IconButton icon="x" label="Stop agent" variant="danger" size={22} iconSize={13} onClick={() => onStop(run.id)} />
        )}
      </div>

      {run.directives?.length > 0 && (
        <div className="msg-directives">
          {run.directives.map((d, i) => (
            <div key={i} className="ar-directive">
              <Icon name="comment" size={12} />
              {typeof d === 'string' ? d : d.body}
            </div>
          ))}
        </div>
      )}

      {run.summary && <div className="msg-text">{run.summary}</div>}

      {run.log.length > 0 && (
        <>
          <button className="shell-toggle" onClick={() => setShowShell((v) => !v)}>
            <Icon name={showShell ? 'chevronDown' : 'arrow'} size={12} />
            shell {showShell ? '' : `· ${run.log.length} lines`}
          </button>
          {showShell && (
            <pre className="ar-log" ref={logRef}>
              {run.log.join('\n')}
            </pre>
          )}
        </>
      )}
      {running && run.log.length === 0 && <div className="msg-text dim">Booting agent…</div>}
    </div>
  )
}

export default function Agents({ runs, feed, cards, onStop, onRunPrompt, running }) {
  const [prompt, setPrompt] = useState('')
  const feedRef = useRef(null)
  const taRef = useRef(null)

  // pin feed to bottom on growth
  const depth = feed.length + Object.values(runs).reduce((n, r) => n + r.log.length + (r.summary ? 1 : 0), 0)
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [depth])

  function fire() {
    const p = prompt.trim()
    if (!p) return
    onRunPrompt(p)
    setPrompt('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  return (
    <div className="agents">
      <div className="agent-feed" ref={feedRef}>
        <div className="comments-intro">
          This is your <b>direct line to Claude</b> — no chat window needed. Type below, or queue
          comments and hit <b>Run</b>. Each reply is a real agent working on this deck.
        </div>

        {feed.length === 0 && (
          <div className="comments-empty">
            Try: <i>“모든 제목을 명조로 통일해줘”</i> · <i>“make slide 2 punchier”</i>
          </div>
        )}

        {feed.map((item, i) =>
          item.t === 'user' ? (
            <div key={i} className="msg user">
              <div className="msg-bubble">{item.text}</div>
            </div>
          ) : runs[item.id] ? (
            <AgentMessage key={item.id} run={runs[item.id]} cards={cards} onStop={onStop} />
          ) : null,
        )}

        {running > 0 && (
          <div className="agents-note">
            {running} agent{running > 1 ? 's' : ''} working — watch the cursors on the canvas.
          </div>
        )}
      </div>

      <div className="composer">
        <textarea
          ref={taRef}
          rows={1}
          placeholder="Tell Claude anything…"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              if (isComposingEvent(e)) return // Korean IME: composing Enter ≠ submit
              e.preventDefault()
              fire()
            }
          }}
        />
        <button className="composer-send" onClick={fire} disabled={!prompt.trim()} title="Send (Enter)">
          <Icon name="send" size={15} stroke={2} />
        </button>
      </div>
    </div>
  )
}

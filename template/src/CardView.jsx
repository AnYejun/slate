import React, { useEffect, useRef, useState } from 'react'
import { cardToSVG } from './svg.js'

const HANDLES = [
  ['nw', 0, 0],
  ['n', 0.5, 0],
  ['ne', 1, 0],
  ['e', 1, 0.5],
  ['se', 1, 1],
  ['s', 0.5, 1],
  ['sw', 0, 1],
  ['w', 0, 0.5],
]

const MIN = 12

function resize(dir, start, dx, dy) {
  let { x, y, w, h } = start
  if (dir.includes('e')) w = start.w + dx
  if (dir.includes('s')) h = start.h + dy
  if (dir.includes('w')) {
    w = start.w - dx
    x = start.x + dx
  }
  if (dir.includes('n')) {
    h = start.h - dy
    y = start.y + dy
  }
  if (w < MIN) {
    if (dir.includes('w')) x = start.x + start.w - MIN
    w = MIN
  }
  if (h < MIN) {
    if (dir.includes('n')) y = start.y + start.h - MIN
    h = MIN
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

// Smart snapping: align the moving element's edges/centers to other elements
// and to the card's edges/center. Returns a delta correction + guide lines.
function snapMove(proj, others, card, thr) {
  const tx = [0, card.width / 2, card.width]
  const ty = [0, card.height / 2, card.height]
  others.forEach((o) => {
    tx.push(o.x, o.x + o.w / 2, o.x + o.w)
    ty.push(o.y, o.y + o.h / 2, o.y + o.h)
  })
  const exs = [proj.x, proj.x + proj.w / 2, proj.x + proj.w]
  const eys = [proj.y, proj.y + proj.h / 2, proj.y + proj.h]
  let bx = null
  exs.forEach((e) => tx.forEach((t) => {
    const d = t - e
    if (Math.abs(d) <= thr && (bx === null || Math.abs(d) < Math.abs(bx.d))) bx = { d, line: t }
  }))
  let by = null
  eys.forEach((e) => ty.forEach((t) => {
    const d = t - e
    if (Math.abs(d) <= thr && (by === null || Math.abs(d) < Math.abs(by.d))) by = { d, line: t }
  }))
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, vline: bx ? bx.line : null, hline: by ? by.line : null }
}

function intersects(el, r) {
  const rx = Math.min(r.x, r.x + r.w)
  const ry = Math.min(r.y, r.y + r.h)
  const rw = Math.abs(r.w)
  const rh = Math.abs(r.h)
  return el.x < rx + rw && el.x + el.w > rx && el.y < ry + rh && el.y + el.h > ry
}

function anchorFor(comment, card) {
  if (comment.elementId) {
    const el = (card.elements || []).find((e) => e.id === comment.elementId)
    if (el) return { x: el.x + el.w, y: el.y }
  }
  return { x: comment.x || 24, y: comment.y || 24 }
}

export default function CardView({
  card,
  scale,
  selectedIds = [],
  onSelectOne,
  onToggle,
  onSelectMany,
  onClear,
  onChange,
  onChangeMany,
  onCommit,
  editingId,
  onStartEdit,
  onEndEdit,
  commentMode = false,
  comments = [],
  activeComment = null,
  onAddComment,
  onOpenComment,
  cursors = [],
  glowIds = new Set(),
  drawMode = null,
  onDrawLine,
}) {
  const dragRef = useRef(null)
  const marqueeRef = useRef(null)
  const drawRef = useRef(null)
  const innerRef = useRef(null)
  const [guides, setGuides] = useState(null)
  const [marquee, setMarquee] = useState(null)
  const [drawPreview, setDrawPreview] = useState(null)
  const svg = cardToSVG(card)
  const selSet = new Set(selectedIds)

  useEffect(() => {
    function onMove(e) {
      // draw-to-line
      if (drawRef.current) {
        const rect = innerRef.current.getBoundingClientRect()
        const x2 = (e.clientX - rect.left) / scale
        const y2 = (e.clientY - rect.top) / scale
        drawRef.current.x2 = x2
        drawRef.current.y2 = y2
        setDrawPreview({ ...drawRef.current })
        return
      }
      // marquee
      if (marqueeRef.current) {
        const m = marqueeRef.current
        const rect = innerRef.current.getBoundingClientRect()
        const cx = (e.clientX - rect.left) / scale
        const cy = (e.clientY - rect.top) / scale
        const box = { x: m.sx, y: m.sy, w: cx - m.sx, h: cy - m.sy }
        m.rect = box
        setMarquee(box)
        return
      }
      const d = dragRef.current
      if (!d) return
      if (d.mode === 'rotate') {
        let deg = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90
        if (e.shiftKey) deg = Math.round(deg / 15) * 15
        onChange(d.primary, { rotation: Math.round(((deg % 360) + 360) % 360) })
        return
      }
      const baseDx = (e.clientX - d.px) / scale
      const baseDy = (e.clientY - d.py) / scale
      if (d.mode === 'move') {
        const p = d.starts[d.primary]
        const proj = { x: p.x + baseDx, y: p.y + baseDy, w: p.w, h: p.h }
        const others = card.elements.filter((el) => !d.ids.includes(el.id))
        const snap = snapMove(proj, others, card, 6 / scale)
        const dx = baseDx + snap.dx
        const dy = baseDy + snap.dy
        const updates = {}
        d.ids.forEach((id) => {
          const s = d.starts[id]
          updates[id] = { x: Math.round(s.x + dx), y: Math.round(s.y + dy) }
        })
        onChangeMany(updates)
        setGuides(snap.vline != null || snap.hline != null ? { v: snap.vline, h: snap.hline } : null)
      } else {
        onChange(d.primary, resize(d.mode, d.starts[d.primary], baseDx, baseDy))
      }
    }
    function onUp() {
      if (drawRef.current) {
        const d = drawRef.current
        drawRef.current = null
        setDrawPreview(null)
        if (onDrawLine) onDrawLine(d.x1, d.y1, d.x2 ?? d.x1, d.y2 ?? d.y1)
        return
      }
      if (marqueeRef.current) {
        const m = marqueeRef.current
        const r = m.rect || { x: m.sx, y: m.sy, w: 0, h: 0 }
        marqueeRef.current = null
        setMarquee(null)
        if (Math.abs(r.w) < 4 && Math.abs(r.h) < 4) {
          if (!m.add) onClear()
          return
        }
        const hit = card.elements.filter((el) => intersects(el, r)).map((el) => el.id)
        onSelectMany(m.add ? Array.from(new Set([...selectedIds, ...hit])) : hit)
        return
      }
      if (dragRef.current) {
        dragRef.current = null
        setGuides(null)
        onCommit()
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [scale, card, onChange, onChangeMany, onCommit, onClear, onSelectMany, selectedIds, onDrawLine])

  function beginMove(e, el) {
    // decide the set to move
    const ids = selSet.has(el.id) && selectedIds.length > 1 ? selectedIds : [el.id]
    if (!selSet.has(el.id)) onSelectOne(el.id)
    const starts = {}
    ids.forEach((id) => {
      const g = card.elements.find((x) => x.id === id)
      if (g) starts[id] = { x: g.x, y: g.y, w: g.w, h: g.h }
    })
    dragRef.current = { ids, mode: 'move', primary: el.id, px: e.clientX, py: e.clientY, starts }
  }

  function beginResize(e, el, dir) {
    e.stopPropagation()
    e.preventDefault()
    onSelectOne(el.id)
    dragRef.current = { ids: [el.id], mode: dir, primary: el.id, px: e.clientX, py: e.clientY, starts: { [el.id]: { x: el.x, y: el.y, w: el.w, h: el.h } } }
  }

  function bgPointerDown(e) {
    const rect = innerRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / scale
    const py = (e.clientY - rect.top) / scale
    if (drawMode === 'line') {
      drawRef.current = { x1: px, y1: py, x2: px, y2: py }
      setDrawPreview({ ...drawRef.current })
      return
    }
    if (commentMode) {
      onAddComment(null, px, py)
      return
    }
    marqueeRef.current = { sx: px, sy: py, add: e.shiftKey }
  }

  function startRotate(e, el) {
    e.stopPropagation()
    e.preventDefault()
    const rect = innerRef.current.getBoundingClientRect()
    dragRef.current = {
      ids: [el.id],
      mode: 'rotate',
      primary: el.id,
      cx: rect.left + (el.x + el.w / 2) * scale,
      cy: rect.top + (el.y + el.h / 2) * scale,
      starts: {},
    }
  }

  const hsize = 11 / scale
  const pinSize = 26 / scale
  const single = selectedIds.length === 1

  return (
    <div
      className={'card-frame' + (commentMode ? ' comment-mode' : '') + (drawMode ? ' draw-mode' : '')}
      style={{ width: card.width * scale, height: card.height * scale }}
      onPointerDown={bgPointerDown}
    >
      <div
        ref={innerRef}
        className="card-inner"
        style={{ width: card.width, height: card.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <div className="card-svg" dangerouslySetInnerHTML={{ __html: svg }} />

        {/* snap guides */}
        {guides?.v != null && (
          <div className="guide v" style={{ left: guides.v, width: 1 / scale, height: card.height }} />
        )}
        {guides?.h != null && (
          <div className="guide h" style={{ top: guides.h, height: 1 / scale, width: card.width }} />
        )}

        {/* interaction layer */}
        {(card.elements || []).map((el) => {
          const selected = selSet.has(el.id)
          const editing = el.id === editingId
          const isText = el.type === 'heading' || el.type === 'text'
          return (
            <div
              key={el.id}
              className={'hitbox' + (selected && !commentMode ? ' selected' : '') + (commentMode ? ' commentable' : '') + (glowIds.has(el.id) ? ' glow' : '')}
              style={{
                left: el.x,
                top: el.y,
                width: el.w,
                height: Math.max(el.h, el.type === 'line' ? 20 : el.h),
                transform: el.rotation
                  ? `translateY(${el.type === 'line' ? -10 : 0}px) rotate(${el.rotation}deg)`
                  : el.type === 'line'
                    ? 'translateY(-10px)'
                    : undefined,
                outlineWidth: selected && !commentMode ? 2 / scale : 1 / scale,
                cursor: commentMode ? 'default' : editing ? 'text' : 'move',
              }}
              onPointerDown={(e) => {
                if (commentMode) {
                  e.stopPropagation()
                  onAddComment(el.id, el.x + el.w, el.y)
                  return
                }
                e.stopPropagation()
                if (e.shiftKey) {
                  onToggle(el.id)
                  return
                }
                if (!editing) beginMove(e, el)
              }}
              onDoubleClick={(e) => {
                if (!commentMode && isText) {
                  e.stopPropagation()
                  onStartEdit(el.id)
                }
              }}
            >
              {editing && isText && (
                <TextEditor el={el} onChange={(text) => onChange(el.id, { text })} onCommit={onCommit} onDone={onEndEdit} />
              )}

              {selected && single && !editing && !commentMode && (
                <>
                  <div
                    className="rot-handle"
                    style={{
                      width: hsize * 1.15,
                      height: hsize * 1.15,
                      left: `calc(50% - ${(hsize * 1.15) / 2}px)`,
                      top: -26 / scale,
                    }}
                    title="Drag to rotate (Shift = 15° steps)"
                    onPointerDown={(e) => startRotate(e, el)}
                  />
                  {HANDLES.map(([dir, fx, fy]) => (
                    <div
                      key={dir}
                      className="handle"
                      style={{
                        width: hsize,
                        height: hsize,
                        left: `calc(${fx * 100}% - ${hsize / 2}px)`,
                        top: `calc(${fy * 100}% - ${hsize / 2}px)`,
                        cursor: dir + '-resize',
                      }}
                      onPointerDown={(e) => beginResize(e, el, dir)}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}

        {/* line-draw preview */}
        {drawPreview && (
          <svg
            className="draw-preview"
            width={card.width}
            height={card.height}
            viewBox={`0 0 ${card.width} ${card.height}`}
          >
            <line
              x1={drawPreview.x1} y1={drawPreview.y1}
              x2={drawPreview.x2} y2={drawPreview.y2}
              stroke="#3b82f6" strokeWidth={3 / scale} strokeDasharray={`${8 / scale} ${6 / scale}`}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* marquee rectangle */}
        {marquee && (
          <div
            className="marquee"
            style={{
              left: Math.min(marquee.x, marquee.x + marquee.w),
              top: Math.min(marquee.y, marquee.y + marquee.h),
              width: Math.abs(marquee.w),
              height: Math.abs(marquee.h),
              borderWidth: 1 / scale,
            }}
          />
        )}

        {/* comment pins */}
        {comments.map((cm, i) => {
          const a = anchorFor(cm, card)
          const active = cm.id === activeComment
          return (
            <button
              key={cm.id}
              type="button"
              className={'pin ' + cm.status + (active ? ' active' : '')}
              style={{
                left: a.x,
                top: a.y,
                width: pinSize,
                height: pinSize,
                fontSize: `${13 / scale}px`,
                borderWidth: 1.5 / scale,
                transform: 'translate(-30%, -70%)',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onOpenComment(cm.id)
              }}
              title={cm.body || 'Comment'}
            >
              {cm.status === 'resolved' ? '✓' : i + 1}
            </button>
          )
        })}

        {/* live agent cursors (Claude & friends) */}
        {cursors.map((cu) => (
          <div key={cu.name} className="agent-cursor" style={{ left: cu.x, top: cu.y }}>
            <div className="cursor-inner" style={{ transform: `scale(${1 / scale})` }}>
              <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
                <path
                  d="M2 1.5 L2 15.5 L5.6 12.2 L8 18 L10.6 16.9 L8.2 11.2 L13.4 10.9 Z"
                  fill={cu.color}
                  stroke="#ffffff"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="cursor-tag" style={{ background: cu.color }}>
                {cu.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TextEditor({ el, onChange, onCommit, onDone }) {
  const ref = useRef(null)
  const s = el.style || {}

  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.textContent = el.text || ''
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className="text-editor"
      contentEditable
      suppressContentEditableWarning
      style={{
        color: s.color || '#111827',
        fontSize: s.fontSize || 40,
        fontWeight: s.fontWeight ?? 400,
        fontFamily: s.fontFamily,
        textAlign: s.textAlign || 'left',
        lineHeight: s.lineHeight ?? 1.35,
        letterSpacing: (s.letterSpacing || 0) + 'px',
        justifyContent: s.vAlign === 'center' ? 'center' : s.vAlign === 'bottom' ? 'flex-end' : 'flex-start',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => onChange(e.currentTarget.innerText)}
      onBlur={() => {
        onCommit()
        onDone()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') e.currentTarget.blur()
      }}
    />
  )
}

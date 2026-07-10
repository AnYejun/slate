import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CardView from './CardView.jsx'
import Inspector from './Inspector.jsx'
import Agents from './Agents.jsx'
import Layers from './Layers.jsx'
import HistoryModal from './HistoryModal.jsx'
import { Icon, IconButton, Logo } from './Icon.jsx'
import { emptyDoc, newCard, newElement, uid } from './model.js'
import { exportPDF, exportPNG, exportSVG } from './export.js'
import { loadDoc, saveDoc, subscribeEvents, runAgents, stopAgent } from './sync.js'

const TOOLS = [
  { type: 'heading', icon: 'heading', label: 'Heading' },
  { type: 'text', icon: 'text', label: 'Text' },
  { type: 'rect', icon: 'square', label: 'Rectangle' },
  { type: 'ellipse', icon: 'circle', label: 'Ellipse' },
  { type: 'line', icon: 'line', label: 'Line / Arrow' },
  { type: 'image', icon: 'image', label: 'Image' },
]

const AGENT_PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4']
function agentColor(name) {
  if (name === 'Claude') return '#3b82f6'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AGENT_PALETTE[h % AGENT_PALETTE.length]
}

export default function App() {
  const [doc, setDoc] = useState(null)
  const [selCard, setSelCard] = useState(null)
  const [selIds, setSelIds] = useState([])
  const [editingEl, setEditingEl] = useState(null)

  const [rightTab, setRightTab] = useState('design')
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useState(null)
  const [hist, setHist] = useState({ u: 0, r: 0 })

  const externalRef = useRef(false)
  const pendingExternal = useRef(null)
  const areaRef = useRef(null)
  const [area, setArea] = useState({ w: 800, h: 600 })
  const H = useRef({ past: [], future: [], base: null, silent: false })
  const [zoom, setZoom] = useState(null)
  const [drawMode, setDrawMode] = useState(null)
  const fitRef = useRef(1)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const panRef = useRef(null)

  // ── sub-agent runs (the work board) ──
  const [agentRuns, setAgentRuns] = useState({})
  const [feed, setFeed] = useState([])
  const runningCount = Object.values(agentRuns).filter((r) => r.status === 'running').length
  const fileRef = useRef(null)

  // ── live presence (agent cursors) ──
  const [agents, setAgents] = useState({})
  const [glowIds, setGlowIds] = useState(() => new Set())
  const [follow, setFollow] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const docRef = useRef(null)
  const selCardRef = useRef(null)
  const followRef = useRef(true)
  const stepsRef = useRef([])
  const playingRef = useRef(false)
  useEffect(() => { docRef.current = doc }, [doc])
  useEffect(() => { selCardRef.current = selCard }, [selCard])
  useEffect(() => { followRef.current = follow }, [follow])

  function toastMsg(m) {
    setToast(m)
    setTimeout(() => setToast(null), 1800)
  }
  function syncHist() {
    setHist({ u: H.current.past.length, r: H.current.future.length })
  }

  const applyStep = useCallback((step) => {
    const d = docRef.current
    let { x, y } = step
    const c = d?.cards.find((cc) => cc.id === step.cardId)
    if (c && step.elementId) {
      const el = (c.elements || []).find((e) => e.id === step.elementId)
      if (el) { x = el.x + el.w / 2; y = el.y + el.h / 2 }
    }
    if (c && (x == null || y == null)) { x = c.width / 2; y = c.height / 2 }
    if (followRef.current && step.cardId) {
      if (selCardRef.current !== step.cardId) setSelCard(step.cardId)
      document.getElementById(`board-${step.cardId}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
    setAgents((prev) => ({
      ...prev,
      [step.agent]: { color: step.color, cardId: step.cardId, x: x ?? 80, y: y ?? 80, action: step.action, ts: Date.now() },
    }))
    if (step.elementId) {
      setGlowIds((prev) => { const n = new Set(prev); n.add(step.elementId); return n })
      setTimeout(() => setGlowIds((prev) => { const n = new Set(prev); n.delete(step.elementId); return n }), 1300)
    }
  }, [])

  const pump = useCallback(() => {
    if (playingRef.current) return
    playingRef.current = true
    const tick = () => {
      const step = stepsRef.current.shift()
      if (!step) { playingRef.current = false; return }
      applyStep(step)
      setTimeout(tick, 640)
    }
    tick()
  }, [applyStep])

  const enqueueSteps = useCallback((steps) => {
    if (!steps.length) return
    stepsRef.current.push(...steps)
    if (stepsRef.current.length > 40) stepsRef.current = stepsRef.current.slice(-40)
    pump()
  }, [pump])

  useEffect(() => {
    const iv = setInterval(() => {
      setAgents((prev) => {
        const now = Date.now()
        const alive = Object.entries(prev).filter(([, a]) => now - a.ts < 4200)
        return alive.length === Object.keys(prev).length ? prev : Object.fromEntries(alive)
      })
    }, 1200)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
    document.documentElement.requestFullscreen().catch(() =>
      toastMsg('For true full screen, open localhost:5173 in your browser'),
    )
  }

  // ── initial load ──
  useEffect(() => {
    loadDoc()
      .then((d) => {
        externalRef.current = true
        const next = d && d.cards && d.cards.length ? d : emptyDoc()
        setDoc(next)
        setSelCard(next.cards[0]?.id ?? null)
      })
      .catch(() => setDoc(emptyDoc()))
  }, [])

  // ── live sync ──
  useEffect(() => {
    return subscribeEvents({
      onDoc: (next, changes) => {
        if (!next || !next.cards) return
        if (editingEl) {
          pendingExternal.current = next
          return
        }
        externalRef.current = true
        setDoc(next)
        setSelCard((prev) => (next.cards.find((c) => c.id === prev) ? prev : next.cards[0]?.id ?? null))
        setSelIds((prev) => prev.filter((id) => next.cards.some((c) => (c.elements || []).some((e) => e.id === id))))
        enqueueSteps(
          (changes || []).map((ch) => {
            let type = ''
            const c = next.cards.find((cc) => cc.id === ch.cardId)
            if (ch.elementId && c) {
              const el = (c.elements || []).find((e) => e.id === ch.elementId)
              if (el) type = ' ' + el.type
            }
            const verb = ch.kind === 'add' ? 'Adding' : ch.kind === 'remove' ? 'Removing' : 'Editing'
            const who = ch.agent || 'Claude'
            return { agent: who, color: agentColor(who), cardId: ch.cardId, elementId: ch.elementId, action: `${verb}${type}…` }
          }),
        )
      },
      onPresence: (ev) => {
        if (!ev || !ev.agent) return
        enqueueSteps([{
          agent: ev.agent,
          color: ev.color || agentColor(ev.agent),
          cardId: ev.cardId,
          elementId: ev.elementId,
          x: ev.x,
          y: ev.y,
          action: ev.action || 'Working…',
        }])
      },
      onAgent: (ev) => {
        if (!ev || !ev.id) return
        if (ev.kind === 'start') {
          setFeed((f) => (f.some((it) => it.t === 'run' && it.id === ev.id) ? f : [...f, { t: 'run', id: ev.id, ts: Date.now() }]))
        }
        setAgentRuns((prev) => {
          const cur = prev[ev.id] || { id: ev.id, name: ev.name || 'Agent', cardId: ev.cardId || null, status: 'running', log: [], directives: [], startedAt: Date.now() }
          const next = { ...cur }
          if (ev.kind === 'start') {
            next.name = ev.name || next.name
            next.cardId = ev.cardId ?? next.cardId
            next.directives = ev.directives || []
            next.status = 'running'
          } else if (ev.kind === 'log') {
            next.log = [...next.log.slice(-200), ev.line]
          } else if (ev.kind === 'done') {
            next.status = ev.status || 'done'
            if (ev.cost != null) next.cost = ev.cost
            if (ev.duration != null) next.duration = ev.duration
            if (ev.summary) next.summary = ev.summary
          }
          return { ...prev, [ev.id]: next }
        })
      },
    })
  }, [editingEl, enqueueSteps])

  // ── undo/redo ──
  useEffect(() => {
    if (!doc) return
    const h = H.current
    if (h.base == null) { h.base = doc; return }
    if (h.silent) { h.silent = false; h.base = doc; return }
    const t = setTimeout(() => {
      if (h.base && h.base !== doc) {
        h.past.push(h.base)
        if (h.past.length > 80) h.past.shift()
        h.future = []
        h.base = doc
        syncHist()
      }
    }, 500)
    return () => clearTimeout(t)
  }, [doc])

  function undo() {
    const h = H.current
    if (!h.past.length) return
    h.future.push(doc)
    const prev = h.past.pop()
    h.base = prev
    h.silent = true
    externalRef.current = false
    setDoc(prev)
    syncHist()
  }
  function redo() {
    const h = H.current
    if (!h.future.length) return
    h.past.push(doc)
    const next = h.future.pop()
    h.base = next
    h.silent = true
    externalRef.current = false
    setDoc(next)
    syncHist()
  }

  // ── autosave ──
  useEffect(() => {
    if (!doc) return
    if (externalRef.current) { externalRef.current = false; return }
    const t = setTimeout(() => saveDoc(doc), 250)
    return () => clearTimeout(t)
  }, [doc])

  // ── canvas sizing ──
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setArea({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

  const card = useMemo(() => doc?.cards.find((c) => c.id === selCard) || doc?.cards[0] || null, [doc, selCard])
  const element = useMemo(
    () => (selIds.length === 1 ? card?.elements.find((e) => e.id === selIds[0]) || null : null),
    [card, selIds],
  )

  const fitScale = useMemo(() => {
    if (!doc || !doc.cards.length) return 1
    const margin = 96
    const maxW = Math.max(...doc.cards.map((c) => c.width))
    const maxH = Math.max(...doc.cards.map((c) => c.height))
    const s = Math.min((area.w - margin) / maxW, (area.h - margin) / maxH)
    return Math.max(0.05, Math.min(s, 1))
  }, [doc, area])
  const scale = zoom ?? fitScale
  useEffect(() => { fitRef.current = fitScale }, [fitScale])

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    function onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setZoom((z) => {
        const cur = z ?? fitRef.current
        return Math.min(4, Math.max(0.05, cur * (1 - e.deltaY * 0.0025)))
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [doc])

  // ── Figma-style pan: hold Space (or middle-drag) to grab the canvas ──
  useEffect(() => {
    function isTyping() {
      const t = document.activeElement
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    }
    function down(e) {
      if (e.code === 'Space' && !e.repeat && !isTyping()) {
        setSpaceHeld(true)
        if (document.activeElement?.tagName !== 'BUTTON') e.preventDefault()
      }
    }
    function up(e) {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    function move(e) {
      const p = panRef.current
      if (!p) return
      const el = areaRef.current
      el.scrollLeft = p.sl - (e.clientX - p.x)
      el.scrollTop = p.st - (e.clientY - p.y)
    }
    function up() {
      if (panRef.current) {
        panRef.current = null
        setPanning(false)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  function startPan(e) {
    // space+drag, or middle mouse button
    if (!spaceHeld && e.button !== 1) return false
    e.preventDefault()
    e.stopPropagation()
    const el = areaRef.current
    panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    setPanning(true)
    return true
  }

  // ── mutations ──
  const mutateCard = useCallback(
    (cardId, patch) => setDoc((d) => ({ ...d, cards: d.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) })),
    [],
  )
  const mutateEl = useCallback(
    (cardId, elId, patch) =>
      setDoc((d) => ({
        ...d,
        cards: d.cards.map((c) => (c.id !== cardId ? c : { ...c, elements: c.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) })),
      })),
    [],
  )
  const mutateMany = useCallback(
    (cardId, updates) =>
      setDoc((d) => ({
        ...d,
        cards: d.cards.map((c) => (c.id !== cardId ? c : { ...c, elements: c.elements.map((e) => (updates[e.id] ? { ...e, ...updates[e.id] } : e)) })),
      })),
    [],
  )
  const mutateElStyle = useCallback(
    (cardId, elId, stylePatch) =>
      setDoc((d) => ({
        ...d,
        cards: d.cards.map((c) => (c.id !== cardId ? c : { ...c, elements: c.elements.map((e) => (e.id === elId ? { ...e, style: { ...e.style, ...stylePatch } } : e)) })),
      })),
    [],
  )
  const forceSave = useCallback(() => { setDoc((d) => { if (d) saveDoc(d); return d }) }, [])

  // ── selection ──
  const selectOne = (id) => setSelIds([id])
  const toggleSel = (id) => setSelIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const selectMany = (ids) => setSelIds(ids)
  const clearSel = () => setSelIds([])
  function activateCard(id) {
    if (selCard !== id) {
      setSelCard(id)
      setSelIds([])
    }
  }

  // ── agent dispatch (material tagging) ──
  async function runPrompt(prompt, target) {
    const label = target
      ? target.elementIds?.length
        ? `${target.elementIds.length} el · ${target.cardName}`
        : `${target.cardName}`
      : null
    setFeed((f) => [...f, { t: 'user', text: label ? `⟦${label}⟧ ${prompt}` : prompt, ts: Date.now() }])
    const targets = target
      ? target.elementIds?.length
        ? target.elementIds.map((id) => ({ cardId: target.cardId, elementId: id }))
        : [{ cardId: target.cardId }]
      : null
    const r = await runAgents({ prompt, targets })
    if (!r.ok) toastMsg(r.error || 'Agent launch failed')
  }

  // ── images ──
  function insertImageFile(file) {
    if (!file || !file.type.startsWith('image/') || !card) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result
      const img = new Image()
      img.onload = () => {
        const maxW = Math.min(640, card.width - 200)
        const w = Math.min(img.naturalWidth, maxW)
        const h = Math.round(w * (img.naturalHeight / img.naturalWidth))
        const el = { ...newElement('image', card), x: Math.round(card.width / 2 - w / 2), y: Math.round(card.height / 2 - h / 2), w, h, src }
        mutateCard(card.id, { elements: [...card.elements, el] })
        setSelIds([el.id])
        toastMsg('Image added')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }
  function onCanvasDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f) insertImageFile(f)
  }

  // ── draw line ──
  function drawLineOn(cardId, x1, y1, x2, y2) {
    const c = doc?.cards.find((cc) => cc.id === cardId)
    if (!c) return
    const L = Math.hypot(x2 - x1, y2 - y1)
    if (L < 8) { setDrawMode(null); return }
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    const el = { ...newElement('line', c), x: Math.round(cx - L / 2), y: Math.round(cy), w: Math.round(L), h: 0, rotation: Math.round(angle) }
    mutateCard(cardId, { elements: [...c.elements, el] })
    setSelCard(cardId)
    setSelIds([el.id])
    setDrawMode(null)
  }

  // ── element / card actions ──
  function addElement(type) {
    if (!card) return
    const el = newElement(type, card)
    mutateCard(card.id, { elements: [...card.elements, el] })
    setSelIds([el.id])
  }
  function deleteSelected() {
    if (!card || !selIds.length) return
    const set = new Set(selIds)
    mutateCard(card.id, { elements: card.elements.filter((e) => !set.has(e.id)) })
    setSelIds([])
  }
  function orderElement(dir) {
    if (!card || !element) return
    const els = [...card.elements]
    const i = els.findIndex((e) => e.id === element.id)
    if (i < 0) return
    els.splice(i, 1)
    if (dir === 'front') els.push(element)
    else els.unshift(element)
    mutateCard(card.id, { elements: els })
  }
  function alignSelected(edge) {
    const set = new Set(selIds)
    const els = card.elements.filter((e) => set.has(e.id))
    if (els.length < 2) return
    const L = Math.min(...els.map((e) => e.x))
    const R = Math.max(...els.map((e) => e.x + e.w))
    const T = Math.min(...els.map((e) => e.y))
    const B = Math.max(...els.map((e) => e.y + e.h))
    const u = {}
    els.forEach((e) => {
      if (edge === 'left') u[e.id] = { x: L }
      else if (edge === 'hcenter') u[e.id] = { x: Math.round((L + R) / 2 - e.w / 2) }
      else if (edge === 'right') u[e.id] = { x: Math.round(R - e.w) }
      else if (edge === 'top') u[e.id] = { y: T }
      else if (edge === 'vcenter') u[e.id] = { y: Math.round((T + B) / 2 - e.h / 2) }
      else if (edge === 'bottom') u[e.id] = { y: Math.round(B - e.h) }
    })
    mutateMany(card.id, u)
  }
  function distributeSelected(axis) {
    const set = new Set(selIds)
    const els = [...card.elements.filter((e) => set.has(e.id))]
    if (els.length < 3) return
    const key = axis === 'h' ? 'x' : 'y'
    els.sort((a, b) => a[key] - b[key])
    const start = els[0][key]
    const end = els[els.length - 1][key]
    const gap = (end - start) / (els.length - 1)
    const u = {}
    els.forEach((e, i) => { u[e.id] = { [key]: Math.round(start + gap * i) } })
    mutateMany(card.id, u)
  }
  function addCard() {
    const base = card || newCard()
    const c = { ...newCard(), width: base.width, height: base.height, background: base.background, name: `Slide ${doc.cards.length + 1}` }
    setDoc((d) => ({ ...d, cards: [...d.cards, c] }))
    setSelCard(c.id)
    setSelIds([])
  }
  function duplicateCard(srcId) {
    const src = doc.cards.find((c) => c.id === srcId)
    if (!src) return
    const clone = { ...src, id: uid('card'), name: src.name + ' copy', elements: src.elements.map((e) => ({ ...e, id: uid(), style: { ...e.style } })) }
    const i = doc.cards.findIndex((c) => c.id === srcId)
    const cards = [...doc.cards]
    cards.splice(i + 1, 0, clone)
    setDoc((d) => ({ ...d, cards }))
    setSelCard(clone.id)
    setSelIds([])
  }
  function deleteCard(id) {
    if (doc.cards.length <= 1) return
    const cards = doc.cards.filter((c) => c.id !== id)
    setDoc((d) => ({ ...d, cards }))
    if (selCard === id) setSelCard(cards[0].id)
  }
  function endEdit() {
    setEditingEl(null)
    if (pendingExternal.current) {
      const next = pendingExternal.current
      pendingExternal.current = null
      externalRef.current = true
      setDoc(next)
    }
  }

  // ── keyboard ──
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || editingEl
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return }
      if (typing) return
      if (e.key === 'Escape') {
        if (drawMode) setDrawMode(null)
        else clearSel()
        return
      }
      if (!selIds.length) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const set = new Set(selIds)
        const u = {}
        card.elements.forEach((el) => { if (set.has(el.id)) u[el.id] = { x: el.x + dx, y: el.y + dy } })
        mutateMany(card.id, u)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selIds, card, editingEl, drawMode, mutateMany, doc])

  if (!doc || !card) return <div className="loading">Loading…</div>

  const target = card
    ? { cardId: card.id, cardName: card.name, elementIds: selIds }
    : null

  return (
    <div className="app">
      {/* ── top bar ── */}
      <header className="topbar">
        <div className="brand">
          <Logo size={22} />
          <span className="wordmark">Slate</span>
        </div>

        <div className="hist-group">
          <IconButton icon="undo" label="Undo (⌘Z)" variant="subtle" size={30} onClick={undo} disabled={!hist.u} />
          <IconButton icon="redo" label="Redo (⌘⇧Z)" variant="subtle" size={30} onClick={redo} disabled={!hist.r} />
          <IconButton icon="clock" label="Version history" variant="subtle" size={30} onClick={() => setShowHistory(true)} />
        </div>

        <div className="topbar-spacer" />

        <div className="tool-pill">
          {TOOLS.map((t, i) => (
            <React.Fragment key={t.type}>
              {i === 2 || i === 5 ? <span className="divider-v" /> : null}
              <IconButton
                icon={t.icon}
                label={
                  t.type === 'image'
                    ? 'Image — pick a file (or drop one on the canvas)'
                    : t.type === 'line'
                      ? 'Line — click, then drag on the canvas to draw'
                      : t.label
                }
                className={t.type === 'line' && drawMode === 'line' ? 'on' : ''}
                onClick={() =>
                  t.type === 'image'
                    ? fileRef.current?.click()
                    : t.type === 'line'
                      ? setDrawMode((d) => (d === 'line' ? null : 'line'))
                      : addElement(t.type)
                }
              />
            </React.Fragment>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            insertImageFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="topbar-spacer" />

        <div className="topbar-right">
          {Object.keys(agents).length > 0 && (
            <div className="presence-chip">
              {Object.entries(agents).map(([name, a]) => (
                <span key={name} className="presence-agent">
                  <span className="p-dot" style={{ background: a.color }} />
                  <b>{name}</b> <em>{a.action}</em>
                </span>
              ))}
            </div>
          )}
          <button
            className={'icon-btn ghost' + (follow ? ' on' : '')}
            onClick={() => setFollow((v) => !v)}
            title={follow ? 'Following agents — click to stop' : 'Follow agents as they edit'}
            style={{ width: 32, height: 32 }}
          >
            <Icon name={follow ? 'eye' : 'eyeOff'} size={17} />
          </button>
          <span className="divider-v-sm" />
          <IconButton icon="minus" label="Zoom out" variant="subtle" size={26} iconSize={14}
            onClick={() => setZoom((z) => Math.max(0.05, (z ?? fitRef.current) / 1.25))} />
          <button className="zoom zoom-reset" onClick={() => setZoom(null)} title="Fit to view">
            {Math.round(scale * 100)}%
          </button>
          <IconButton icon="plus" label="Zoom in" variant="subtle" size={26} iconSize={14}
            onClick={() => setZoom((z) => Math.min(4, (z ?? fitRef.current) * 1.25))} />
          <IconButton
            icon={isFullscreen ? 'shrink' : 'expand'}
            label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            variant="subtle"
            size={30}
            onClick={toggleFullscreen}
          />
          <span className="divider-v-sm" />
          <ExportMenu card={card} cards={doc.cards} title={doc.doc?.title} />
        </div>
      </header>

      {/* ── left: pages + layers ── */}
      <aside className="sidebar">
        <Layers
          cards={doc.cards}
          activeCard={card.id}
          selectedIds={selIds}
          onSelectCard={(id) => { activateCard(id); document.getElementById(`board-${id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }}
          onSelectElement={(id) => setSelIds([id])}
          onToggleElement={toggleSel}
          onAddCard={addCard}
          onDuplicateCard={duplicateCard}
          onDeleteCard={deleteCard}
          onReorder={(cardId, elements) => mutateCard(cardId, { elements })}
        />
      </aside>

      {/* ── stage: every card on one board ── */}
      <main className="stage">
        <div
          className={'canvas-area board-scroll' + (panning ? ' panning' : spaceHeld ? ' pan-ready' : '')}
          ref={areaRef}
          onPointerDownCapture={startPan}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
        >
          <div className="board">
            {doc.cards.map((c) => (
              <div
                key={c.id}
                id={`board-${c.id}`}
                className={'board-card' + (c.id === card.id ? ' active' : '')}
                onPointerDownCapture={() => activateCard(c.id)}
              >
                <div className="board-card-name">{c.name}</div>
                <CardView
                  card={c}
                  scale={scale}
                  selectedIds={c.id === card.id ? selIds : []}
                  editingId={c.id === card.id ? editingEl : null}
                  onSelectOne={selectOne}
                  onToggle={toggleSel}
                  onSelectMany={selectMany}
                  onClear={clearSel}
                  onChange={(id, patch) => mutateEl(c.id, id, patch)}
                  onChangeMany={(u) => mutateMany(c.id, u)}
                  onCommit={forceSave}
                  onStartEdit={setEditingEl}
                  onEndEdit={endEdit}
                  cursors={Object.entries(agents)
                    .filter(([, a]) => a.cardId === c.id)
                    .map(([name, a]) => ({ name, ...a }))}
                  glowIds={glowIds}
                  drawMode={drawMode}
                  onDrawLine={(x1, y1, x2, y2) => drawLineOn(c.id, x1, y1, x2, y2)}
                />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── right panel ── */}
      <aside className="right-panel">
        <div className="panel-tabs">
          <button className={rightTab === 'design' ? 'on' : ''} onClick={() => setRightTab('design')}>Design</button>
          <button className={rightTab === 'agents' ? 'on' : ''} onClick={() => setRightTab('agents')}>
            Agents{runningCount > 0 ? ` · ${runningCount}` : ''}
            {runningCount > 0 && <span className="tab-live" />}
          </button>
        </div>
        {rightTab === 'agents' ? (
          <Agents
            runs={agentRuns}
            feed={feed}
            cards={doc.cards}
            running={runningCount}
            onStop={stopAgent}
            onRunPrompt={runPrompt}
            target={target}
          />
        ) : (
          <Inspector
            card={card}
            element={element}
            selectedCount={selIds.length}
            onCardChange={(patch) => mutateCard(card.id, patch)}
            onElChange={(patch) => element && mutateEl(card.id, element.id, patch)}
            onElStyle={(patch) => element && mutateElStyle(card.id, element.id, patch)}
            onDelete={deleteSelected}
            onOrder={orderElement}
            onAlign={alignSelected}
            onDistribute={distributeSelected}
            onToast={toastMsg}
          />
        )}
      </aside>

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onToast={toastMsg} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function ExportMenu({ card, cards, title }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])
  function run(fn) { setOpen(false); Promise.resolve().then(fn) }
  return (
    <div className="export" ref={ref}>
      <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
        <Icon name="download" size={16} stroke={2} />
        Export
        <Icon name="chevronDown" size={14} stroke={2} />
      </button>
      {open && (
        <div className="menu">
          <button className="menu-item" onClick={() => run(() => exportPNG(card))}>
            <span className="mi-icon"><Icon name="image" size={16} /></span>Export PNG<span className="mi-sub">this slide</span>
          </button>
          <button className="menu-item" onClick={() => run(() => exportSVG(card))}>
            <span className="mi-icon"><Icon name="square" size={16} /></span>Export SVG<span className="mi-sub">this slide</span>
          </button>
          <button className="menu-item" onClick={() => run(() => exportPDF(cards, title))}>
            <span className="mi-icon"><Icon name="download" size={16} /></span>Export PDF<span className="mi-sub">all slides</span>
          </button>
        </div>
      )}
    </div>
  )
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CardView from './CardView.jsx'
import Inspector from './Inspector.jsx'
import Comments from './Comments.jsx'
import Agents from './Agents.jsx'
import HistoryModal from './HistoryModal.jsx'
import { Icon, IconButton, Logo } from './Icon.jsx'
import { emptyDoc, newCard, newComment, newElement, uid } from './model.js'
import { exportPDF, exportPNG, exportSVG } from './export.js'
import { loadDoc, saveDoc, subscribeEvents, runAgents, stopAgent } from './sync.js'
import { cardToSVG } from './svg.js'

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
  const [commentMode, setCommentMode] = useState(false)
  const [activeComment, setActiveComment] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useState(null)
  const [hist, setHist] = useState({ u: 0, r: 0 })

  const externalRef = useRef(false)
  const pendingExternal = useRef(null)
  const areaRef = useRef(null)
  const [area, setArea] = useState({ w: 800, h: 600 })
  const H = useRef({ past: [], future: [], base: null, silent: false })
  const [zoom, setZoom] = useState(null) // null = fit to view
  const [drawMode, setDrawMode] = useState(null) // 'line' | null
  const fitRef = useRef(1)

  // ── sub-agent runs (the work board) ──
  const [agentRuns, setAgentRuns] = useState({}) // id → {name, cardId, status, log, directives, ...}
  const [feed, setFeed] = useState([]) // chat thread: {t:'user', text, ts} | {t:'run', id, ts}
  const runningCount = Object.values(agentRuns).filter((r) => r.status === 'running').length
  const fileRef = useRef(null)

  // ── live presence (Claude / agent cursors) ──
  const [agents, setAgents] = useState({}) // name → {color, cardId, x, y, action, ts}
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

  const applyStep = useCallback((step) => {
    const d = docRef.current
    let { x, y } = step
    const c = d?.cards.find((cc) => cc.id === step.cardId)
    if (c && step.elementId) {
      const el = (c.elements || []).find((e) => e.id === step.elementId)
      if (el) { x = el.x + el.w / 2; y = el.y + el.h / 2 }
    }
    if (c && (x == null || y == null)) { x = c.width / 2; y = c.height / 2 }
    if (followRef.current && step.cardId && selCardRef.current !== step.cardId) setSelCard(step.cardId)
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

  // fade idle agents out
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

  function toastMsg(m) {
    setToast(m)
    setTimeout(() => setToast(null), 1600)
  }
  function syncHist() {
    setHist({ u: H.current.past.length, r: H.current.future.length })
  }

  // ── initial load ──
  useEffect(() => {
    loadDoc()
      .then((d) => {
        externalRef.current = true
        const next = d && d.cards && d.cards.length ? d : emptyDoc()
        if (!next.comments) next.comments = []
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
        if (!next.comments) next.comments = []
        if (editingEl) {
          pendingExternal.current = next
          return
        }
        externalRef.current = true
        setDoc(next)
        setSelCard((prev) => (next.cards.find((c) => c.id === prev) ? prev : next.cards[0]?.id ?? null))
        setSelIds((prev) => prev.filter((id) => next.cards.some((c) => (c.elements || []).some((e) => e.id === id))))
        // theatre: walk each agent's cursor across everything it changed
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
    })
  }, [editingEl, enqueueSteps])

  // ── undo/redo history ──
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
  const comments = doc?.comments || []
  const cardComments = useMemo(() => comments.filter((c) => c.cardId === card?.id), [comments, card])
  const openCount = comments.filter((c) => c.status !== 'resolved').length

  const fitScale = useMemo(() => {
    if (!card) return 1
    const margin = 16
    const s = Math.min((area.w - margin) / card.width, (area.h - margin) / card.height)
    return Math.max(0.05, Math.min(s, 1))
  }, [card, area])
  const scale = zoom ?? fitScale
  useEffect(() => { fitRef.current = fitScale }, [fitScale])

  // ⌘/ctrl + wheel zoom
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

  // ── comment mutations ──
  const mutateComment = useCallback(
    (id, patch) => setDoc((d) => ({ ...d, comments: (d.comments || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    [],
  )
  function addComment(elementId, x, y) {
    if (!card) return
    const existing = (doc.comments || []).find(
      (c) => c.cardId === card.id && (c.elementId || null) === (elementId || null) && c.status !== 'resolved' && !(c.body || '').trim(),
    )
    if (existing) { setActiveComment(existing.id); setRightTab('comments'); return }
    const c = newComment(card.id, elementId, x, y)
    setDoc((d) => ({ ...d, comments: [...(d.comments || []), c] }))
    setActiveComment(c.id)
    setRightTab('comments')
  }
  function replyComment(id, body) {
    setDoc((d) => ({ ...d, comments: (d.comments || []).map((c) => (c.id === id ? { ...c, replies: [...(c.replies || []), { author: 'user', body }] } : c)) }))
  }
  function resolveComment(id) {
    setDoc((d) => ({ ...d, comments: (d.comments || []).map((c) => (c.id === id ? { ...c, status: c.status === 'resolved' ? 'open' : 'resolved' } : c)) }))
  }
  function deleteComment(id) {
    setDoc((d) => ({ ...d, comments: (d.comments || []).filter((c) => c.id !== id) }))
    if (activeComment === id) setActiveComment(null)
  }
  function focusComment(id) {
    const c = comments.find((x) => x.id === id)
    if (c) setSelCard(c.cardId)
    setActiveComment(id)
    setRightTab('comments')
  }
  function addCommentToSelection() {
    if (element) addComment(element.id, element.x + element.w, element.y)
    else if (card) addComment(null, 40, 40)
  }

  // ── send-to-Claude (copy directive to clipboard) ──
  function directiveText(cm) {
    const ci = doc.cards.findIndex((c) => c.id === cm.cardId)
    const cardName = doc.cards[ci]?.name || cm.cardId
    let target = 'the whole card'
    if (cm.elementId) {
      const el = doc.cards[ci]?.elements.find((e) => e.id === cm.elementId)
      target = el ? `the ${el.type} element (id "${cm.elementId}")` : `element "${cm.elementId}"`
    }
    return `In Slate (slate/cards.json), slide "${cardName}" (id "${cm.cardId}") — for ${target}: ${cm.body}`
  }
  async function copyText(text) {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // fallback for sandboxed / unfocused contexts
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.top = '-1000px'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch { /* give up */ }
    }
    toastMsg(ok ? 'Copied — paste into chat and send to Claude' : 'Copy failed — select the text manually')
  }
  function copyDirective(cm) {
    copyText(directiveText(cm))
    mutateComment(cm.id, { sent: true })
  }
  function toggleQueue(id) {
    setDoc((d) => ({
      ...d,
      comments: (d.comments || []).map((c) => (c.id === id ? { ...c, queued: !c.queued, sent: !c.queued ? false : c.sent } : c)),
    }))
  }
  function selectAllQueue(on) {
    setDoc((d) => ({
      ...d,
      comments: (d.comments || []).map((c) => (c.status !== 'resolved' && (c.body || '').trim() ? { ...c, queued: on } : c)),
    }))
  }
  async function sendQueued() {
    const q = comments.filter((c) => c.status !== 'resolved' && (c.body || '').trim() && c.queued && !c.sent)
    if (!q.length) { toastMsg('Nothing queued to run'); return }
    const ids = q.map((c) => c.id)
    // persist 'sent' immediately so the agent reads a consistent file
    const nextDoc = { ...doc, comments: (doc.comments || []).map((c) => (ids.includes(c.id) ? { ...c, sent: true } : c)) }
    externalRef.current = false
    setDoc(nextDoc)
    await saveDoc(nextDoc)
    setFeed((f) => [...f, { t: 'user', text: `Run ${ids.length} queued directive${ids.length > 1 ? 's' : ''}`, ts: Date.now() }])
    const r = await runAgents({ commentIds: ids })
    if (r.ok) {
      setRightTab('agents')
      toastMsg(`Dispatched ${r.agents.length} agent${r.agents.length > 1 ? 's' : ''}`)
    } else {
      // fall back to clipboard hand-off if the CLI isn't available
      const text =
        'Apply these Slate directives in cards.json. For each: make the change, set the ' +
        'comment\'s status to "resolved", and append a reply {"author":"claude","body":"<what you changed>"}.\n\n' +
        q.map((c, i) => `${i + 1}. ${directiveText(c)}`).join('\n')
      copyText(text)
      toastMsg(r.error === 'claude CLI not found on this machine'
        ? 'claude CLI not found — directives copied, paste into chat'
        : 'Agent launch failed — directives copied instead')
    }
  }

  async function runPrompt(prompt) {
    setFeed((f) => [...f, { t: 'user', text: prompt, ts: Date.now() }])
    const r = await runAgents({ prompt })
    if (!r.ok) toastMsg(r.error || 'Agent launch failed')
  }

  // ── image insertion (file picker + drag-drop → data URI) ──
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
        const el = {
          ...newElement('image', card),
          x: Math.round(card.width / 2 - w / 2),
          y: Math.round(card.height / 2 - h / 2),
          w, h, src,
        }
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

  // drag-to-draw line: two points → horizontal line + rotation about center
  function drawLine(x1, y1, x2, y2) {
    if (!card) return
    const L = Math.hypot(x2 - x1, y2 - y1)
    if (L < 8) { setDrawMode(null); return }
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    const el = {
      ...newElement('line', card),
      x: Math.round(cx - L / 2),
      y: Math.round(cy),
      w: Math.round(L),
      h: 0,
      rotation: Math.round(angle),
    }
    mutateCard(card.id, { elements: [...card.elements, el] })
    setSelIds([el.id])
    setDrawMode(null)
  }

  // ── element actions ──
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

  // ── cards ──
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
    const comments2 = (doc.comments || []).filter((c) => c.cardId !== id)
    setDoc((d) => ({ ...d, cards, comments: comments2 }))
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
        else if (commentMode) setCommentMode(false)
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
  }, [selIds, card, editingEl, commentMode, drawMode, mutateMany, doc])

  if (!doc || !card) return <div className="loading">Loading…</div>

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
          <button
            className={'icon-btn ghost comment-toggle' + (commentMode ? ' on' : '')}
            onClick={() => { setCommentMode((v) => !v); if (!commentMode) setRightTab('comments') }}
            title="Comment — click an element to leave Claude a directive"
            style={{ width: 32, height: 32 }}
          >
            <Icon name="comment" size={17} />
            {openCount > 0 && <span className="badge">{openCount}</span>}
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

      {/* ── sidebar ── */}
      <aside className="sidebar">
        <div className="panel-head">
          <span className="panel-title">Pages</span>
          <span className="count">{doc.cards.length}</span>
          <span className="grow" />
          <IconButton icon="plus" label="Add page" variant="subtle" size={26} iconSize={16} onClick={addCard} />
        </div>
        <div className="pages">
          {doc.cards.map((c, i) => {
            const n = comments.filter((x) => x.cardId === c.id && x.status !== 'resolved').length
            return (
              <div key={c.id} className={'page' + (c.id === selCard ? ' active' : '')} onClick={() => { setSelCard(c.id); setSelIds([]) }}>
                <div className="page-thumb" style={{ aspectRatio: `${c.width} / ${c.height}`, background: c.background }}>
                  <ThumbSVG card={c} />
                  {n > 0 && <span className="thumb-badge">{n}</span>}
                </div>
                <div className="page-meta">
                  <span className="page-index">{i + 1}</span>
                  <span className="page-name">{c.name}</span>
                  <span className="page-actions">
                    <IconButton icon="copy" label="Duplicate" variant="subtle" size={24} iconSize={14} onClick={(e) => { e.stopPropagation(); duplicateCard(c.id) }} />
                    {doc.cards.length > 1 && (
                      <IconButton icon="trash" label="Delete" variant="danger" size={24} iconSize={14} onClick={(e) => { e.stopPropagation(); deleteCard(c.id) }} />
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── stage ── */}
      <main className="stage">
        <div
          className={'canvas-area' + (commentMode ? ' comment-cursor' : '')}
          ref={areaRef}
          onPointerDown={() => { if (!commentMode) { setEditingEl(null) } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
        >
          <div onPointerDown={(e) => e.stopPropagation()}>
            <CardView
              card={card}
              scale={scale}
              selectedIds={selIds}
              editingId={editingEl}
              onSelectOne={selectOne}
              onToggle={toggleSel}
              onSelectMany={selectMany}
              onClear={clearSel}
              onChange={(id, patch) => mutateEl(card.id, id, patch)}
              onChangeMany={(u) => mutateMany(card.id, u)}
              onCommit={forceSave}
              onStartEdit={setEditingEl}
              onEndEdit={endEdit}
              commentMode={commentMode}
              comments={cardComments}
              activeComment={activeComment}
              onAddComment={addComment}
              onOpenComment={focusComment}
              cursors={Object.entries(agents)
                .filter(([, a]) => a.cardId === card.id)
                .map(([name, a]) => ({ name, ...a }))}
              glowIds={glowIds}
              drawMode={drawMode}
              onDrawLine={drawLine}
            />
          </div>
        </div>
      </main>

      {/* ── right panel ── */}
      <aside className="right-panel">
        <div className="panel-tabs">
          <button className={rightTab === 'design' ? 'on' : ''} onClick={() => setRightTab('design')}>Design</button>
          <button className={rightTab === 'comments' ? 'on' : ''} onClick={() => setRightTab('comments')}>
            Comments{openCount > 0 ? ` · ${openCount}` : ''}
          </button>
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
          />
        ) : rightTab === 'design' ? (
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
        ) : (
          <Comments
            comments={comments}
            cards={doc.cards}
            activeComment={activeComment}
            onFocus={focusComment}
            onUpdate={mutateComment}
            onReply={replyComment}
            onResolve={resolveComment}
            onDelete={deleteComment}
            onAdd={addCommentToSelection}
            addLabel={element ? element.type : 'this card'}
            canAdd={!!card}
            onCopy={copyDirective}
            onToggleQueue={toggleQueue}
            onSendQueued={sendQueued}
            onSelectAll={selectAllQueue}
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

function ThumbSVG({ card }) {
  return (
    <div
      className="thumb-svg"
      style={{ width: '100%', height: '100%' }}
      dangerouslySetInnerHTML={{
        __html: cardToSVG(card).replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" '),
      }}
    />
  )
}

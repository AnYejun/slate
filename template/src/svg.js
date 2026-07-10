import { FONT } from './model.js'

// ── The single source of truth for what a card LOOKS like. ──────────────
// The on-screen canvas renders this exact string (via innerHTML) and the PNG
// / PDF exporters serialize the same string, so what you see is exactly
// what you export. Every effect here is a plain SVG primitive — no browser-
// only tricks — so glass panels, glows and gradients survive rasterization.

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escAttr(s = '') {
  return esc(s).replace(/"/g, '&quot;')
}

// "linear:#from,#to,angle" → gradient descriptor (angle in degrees, 0 = →)
function parseGradient(v) {
  if (typeof v !== 'string' || !v.startsWith('linear:')) return null
  const parts = v.slice(7).split(',')
  if (parts.length < 2) return null
  const from = parts[0].trim()
  const to = parts[1].trim()
  const angle = Number(parts[2]) || 0
  const rad = (angle * Math.PI) / 180
  const x1 = 0.5 - Math.cos(rad) / 2
  const y1 = 0.5 + Math.sin(rad) / 2
  const x2 = 0.5 + Math.cos(rad) / 2
  const y2 = 0.5 - Math.sin(rad) / 2
  return { from, to, x1, y1, x2, y2 }
}

// "dx dy blur color" → drop-shadow descriptor
function parseShadow(v) {
  if (typeof v !== 'string') return null
  const m = v.trim().split(/\s+/)
  if (m.length < 4) return null
  return { dx: Number(m[0]) || 0, dy: Number(m[1]) || 0, blur: Number(m[2]) || 0, color: m.slice(3).join(' ') }
}

function textDivCSS(style = {}, w, h) {
  const justify =
    style.vAlign === 'center' ? 'center' : style.vAlign === 'bottom' ? 'flex-end' : 'flex-start'
  const parts = [
    `width:${w}px`,
    `height:${h}px`,
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    `justify-content:${justify}`,
    `color:${style.color || '#111827'}`,
    `font-size:${style.fontSize || 40}px`,
    `font-weight:${style.fontWeight ?? 400}`,
    `font-family:${style.fontFamily || FONT}`,
    `text-align:${style.textAlign || 'left'}`,
    `line-height:${style.lineHeight ?? 1.35}`,
    `letter-spacing:${style.letterSpacing || 0}px`,
    'white-space:pre-wrap',
    'word-break:break-word',
    'overflow:hidden',
  ]
  if (style.background && style.background !== 'transparent') parts.push(`background:${style.background}`)
  if (style.padding) parts.push(`padding:${style.padding}px`)
  if (style.fontStyle) parts.push(`font-style:${style.fontStyle}`)
  if (style.textDecoration) parts.push(`text-decoration:${style.textDecoration}`)
  return parts.join(';')
}

// Returns { body, defs } for one element.
function elementSVG(el, uid) {
  const { x, y, w, h, rotation = 0, style = {} } = el
  const cx = x + w / 2
  const cy = y + h / 2
  let inner = ''
  const defs = []

  // resolve fill (solid or gradient)
  function fillFor(raw, fallback) {
    const g = parseGradient(raw)
    if (!g) return raw || fallback
    const id = `g-${uid}`
    defs.push(
      `<linearGradient id="${id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}">` +
        `<stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>`,
    )
    return `url(#${id})`
  }

  switch (el.type) {
    case 'rect': {
      const fill = fillFor(style.fill, '#000000')
      const strokeAttrs =
        style.stroke && style.stroke !== 'none'
          ? ` stroke="${style.stroke}" stroke-width="${style.strokeWidth || 0}"`
          : ''
      inner = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${style.radius || 0}" ry="${style.radius || 0}" fill="${fill}"${strokeAttrs}/>`
      break
    }
    case 'ellipse': {
      const fill = fillFor(style.fill, '#000000')
      const strokeAttrs =
        style.stroke && style.stroke !== 'none'
          ? ` stroke="${style.stroke}" stroke-width="${style.strokeWidth || 0}"`
          : ''
      inner = `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(w / 2)}" ry="${Math.abs(h / 2)}" fill="${fill}"${strokeAttrs}/>`
      break
    }
    case 'line': {
      const x1 = x
      const y1 = y + h / 2
      const x2 = x + w
      const y2 = y + h / 2
      const sw = style.strokeWidth || 4
      const color = style.stroke || '#000000'
      let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`
      if (style.arrow) {
        const size = Math.max(14, sw * 2.4)
        s += `<path d="M ${x2} ${y2} L ${x2 - size} ${y2 - size * 0.55} L ${x2 - size} ${y2 + size * 0.55} Z" fill="${color}"/>`
      }
      inner = s
      break
    }
    case 'image': {
      if (el.src) {
        const par = style.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
        const clip = style.radius ? ` clip-path="inset(0 round ${style.radius}px)"` : ''
        inner = `<image href="${escAttr(el.src)}" xlink:href="${escAttr(el.src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${par}"${clip}/>`
      } else {
        inner = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${style.radius || 0}" fill="#e5e7eb"/><text x="${cx}" y="${cy}" font-family="${FONT}" font-size="28" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">Image — set source</text>`
      }
      break
    }
    case 'heading':
    case 'text': {
      const css = textDivCSS(style, w, h)
      const html = esc(el.text || '').replace(/\n/g, '<br/>')
      inner = `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="${escAttr(css)}">${html}</div></foreignObject>`
      break
    }
    default:
      inner = ''
  }

  // effect filter: blur and/or drop shadow (exportable SVG filters)
  const shadow = parseShadow(style.shadow)
  const blur = Number(style.blur) || 0
  let filterAttr = ''
  if (blur > 0 || shadow) {
    const fid = `f-${uid}`
    const prims = []
    if (blur > 0) prims.push(`<feGaussianBlur stdDeviation="${blur / 2}"/>`)
    if (shadow) prims.push(`<feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur / 2}" flood-color="${shadow.color}"/>`)
    defs.push(`<filter id="${fid}" x="-60%" y="-60%" width="220%" height="220%">${prims.join('')}</filter>`)
    filterAttr = ` filter="url(#${fid})"`
  }

  const opacity = style.opacity != null && style.opacity !== 1 ? ` opacity="${style.opacity}"` : ''
  const transform = rotation ? ` transform="rotate(${rotation} ${cx} ${cy})"` : ''
  const body =
    filterAttr || opacity || transform ? `<g${transform}${opacity}${filterAttr}>${inner}</g>` : inner
  return { body, defs }
}

export function cardToSVG(card) {
  const allDefs = []
  // background: solid or gradient
  let bgFill = card.background || '#ffffff'
  const bgGrad = parseGradient(bgFill)
  if (bgGrad) {
    allDefs.push(
      `<linearGradient id="g-bg" x1="${bgGrad.x1}" y1="${bgGrad.y1}" x2="${bgGrad.x2}" y2="${bgGrad.y2}">` +
        `<stop offset="0" stop-color="${bgGrad.from}"/><stop offset="1" stop-color="${bgGrad.to}"/></linearGradient>`,
    )
    bgFill = 'url(#g-bg)'
  }
  const bg = `<rect x="0" y="0" width="${card.width}" height="${card.height}" fill="${bgFill}"/>`

  let body = ''
  ;(card.elements || []).forEach((el, i) => {
    const { body: b, defs } = elementSVG(el, `${el.id || i}`)
    allDefs.push(...defs)
    body += b
  })

  const defsBlock = allDefs.length ? `<defs>${allDefs.join('')}</defs>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${card.width}" height="${card.height}" viewBox="0 0 ${card.width} ${card.height}">` +
    defsBlock +
    bg +
    body +
    `</svg>`
  )
}

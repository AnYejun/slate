import { FONT } from './model.js'

// ── The single source of truth for what a card LOOKS like. ──────────────
// The on-screen canvas renders this exact string (via innerHTML) and the PNG
// / SVG / PDF exporters serialize the same string, so what you see is exactly
// what you export.

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escAttr(s = '') {
  return esc(s).replace(/"/g, '&quot;')
}

function textDivCSS(style = {}, w, h) {
  const justify =
    style.vAlign === 'center'
      ? 'center'
      : style.vAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start'
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
  if (style.background && style.background !== 'transparent') {
    parts.push(`background:${style.background}`)
  }
  if (style.padding) parts.push(`padding:${style.padding}px`)
  if (style.fontStyle) parts.push(`font-style:${style.fontStyle}`)
  if (style.textDecoration) parts.push(`text-decoration:${style.textDecoration}`)
  return parts.join(';')
}

function elementSVG(el) {
  const { x, y, w, h, rotation = 0, style = {} } = el
  const cx = x + w / 2
  const cy = y + h / 2
  let inner = ''

  switch (el.type) {
    case 'rect': {
      const strokeAttrs =
        style.stroke && style.stroke !== 'none'
          ? ` stroke="${style.stroke}" stroke-width="${style.strokeWidth || 0}"`
          : ''
      inner = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${style.radius || 0}" ry="${style.radius || 0}" fill="${style.fill || '#000000'}"${strokeAttrs}/>`
      break
    }
    case 'ellipse': {
      const strokeAttrs =
        style.stroke && style.stroke !== 'none'
          ? ` stroke="${style.stroke}" stroke-width="${style.strokeWidth || 0}"`
          : ''
      inner = `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(w / 2)}" ry="${Math.abs(h / 2)}" fill="${style.fill || '#000000'}"${strokeAttrs}/>`
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
        const par =
          style.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
        const clip = style.radius
          ? ` clip-path="inset(0 round ${style.radius}px)"`
          : ''
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

  if (rotation) {
    return `<g transform="rotate(${rotation} ${cx} ${cy})">${inner}</g>`
  }
  return inner
}

export function cardToSVG(card) {
  const bg = `<rect x="0" y="0" width="${card.width}" height="${card.height}" fill="${card.background || '#ffffff'}"/>`
  const body = (card.elements || []).map(elementSVG).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${card.width}" height="${card.height}" viewBox="0 0 ${card.width} ${card.height}">` +
    bg +
    body +
    `</svg>`
  )
}

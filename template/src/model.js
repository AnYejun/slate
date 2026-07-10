// Shared font stack. Renders Korean well on macOS out of the box; falls back
// to Pretendard if the user has it installed.
export const FONT =
  "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"

export function uid(prefix = 'el') {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  }
}

// Canvas size presets. width/height are the intrinsic export pixels.
export const PRESETS = {
  'card-square': { label: 'Card 1:1', width: 1080, height: 1080 },
  'card-portrait': { label: 'Card 4:5', width: 1080, height: 1350 },
  'story': { label: 'Story 9:16', width: 1080, height: 1920 },
  'figure-wide': { label: 'Figure 16:9', width: 1280, height: 720 },
  'figure-standard': { label: 'Figure 4:3', width: 1200, height: 900 },
}

export function newCard(preset = 'card-square', name = 'Slide') {
  const p = PRESETS[preset] || PRESETS['card-square']
  return {
    id: uid('card'),
    name,
    width: p.width,
    height: p.height,
    background: '#ffffff',
    elements: [],
  }
}

// Element factory. All geometry is in card (intrinsic) coordinates.
export function newElement(type, card) {
  const cx = card.width / 2
  const cy = card.height / 2
  const base = {
    id: uid(),
    type,
    x: Math.round(cx - 300),
    y: Math.round(cy - 100),
    w: 600,
    h: 200,
    rotation: 0,
    style: {},
  }
  switch (type) {
    case 'heading':
      return {
        ...base,
        h: 170,
        text: 'Add a headline',
        style: {
          color: '#111827',
          fontSize: 88,
          fontWeight: 800,
          fontFamily: FONT,
          textAlign: 'left',
          vAlign: 'top',
          lineHeight: 1.1,
          letterSpacing: -1,
        },
      }
    case 'text':
      return {
        ...base,
        text: 'Add body text — it wraps across multiple lines automatically.',
        style: {
          color: '#374151',
          fontSize: 44,
          fontWeight: 400,
          fontFamily: FONT,
          textAlign: 'left',
          vAlign: 'top',
          lineHeight: 1.45,
          letterSpacing: 0,
        },
      }
    case 'rect':
      return {
        ...base,
        x: Math.round(cx - 200),
        y: Math.round(cy - 150),
        w: 400,
        h: 300,
        style: { fill: '#2563eb', stroke: 'none', strokeWidth: 0, radius: 24 },
      }
    case 'ellipse':
      return {
        ...base,
        x: Math.round(cx - 150),
        y: Math.round(cy - 150),
        w: 300,
        h: 300,
        style: { fill: '#10b981', stroke: 'none', strokeWidth: 0 },
      }
    case 'line':
      return {
        ...base,
        x: Math.round(cx - 300),
        y: cy,
        w: 600,
        h: 0,
        style: { stroke: '#111827', strokeWidth: 8, arrow: true },
      }
    case 'image':
      return {
        ...base,
        x: Math.round(cx - 300),
        y: Math.round(cy - 200),
        w: 600,
        h: 400,
        src: '',
        style: { radius: 0, fit: 'cover' },
      }
    default:
      return base
  }
}

// A comment is a directive for Claude, anchored to an element (or a card).
// status 'open' = Claude should act on it; 'resolved' = done.
export function newComment(cardId, elementId, x = 0, y = 0) {
  return {
    id: uid('cm'),
    cardId,
    elementId: elementId || null,
    x: Math.round(x),
    y: Math.round(y),
    status: 'open', // 'open' | 'resolved'  (Claude's contract)
    queued: true, // UI: included in the next batch send
    sent: false, // UI: copied/sent to Claude, awaiting action
    body: '',
    replies: [], // [{ author: 'user' | 'claude', body }]
  }
}

export const emptyDoc = () => ({
  version: 1,
  doc: { title: 'Untitled' },
  cards: [newCard('card-square', 'Slide 1')],
  comments: [],
})

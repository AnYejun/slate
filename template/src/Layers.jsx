import React, { useRef, useState } from 'react'
import { Icon, IconButton } from './Icon.jsx'
import { cardToSVG } from './svg.js'

const TYPE_ICON = {
  heading: 'heading',
  text: 'text',
  rect: 'square',
  ellipse: 'circle',
  line: 'line',
  image: 'image',
}

function labelFor(el) {
  if (el.type === 'heading' || el.type === 'text') {
    const t = (el.text || '').replace(/\s+/g, ' ').trim()
    if (t) return t.length > 22 ? t.slice(0, 22) + '…' : t
  }
  return el.type.charAt(0).toUpperCase() + el.type.slice(1)
}

function ThumbSVG({ card }) {
  return (
    <div
      className="thumb-svg"
      style={{ width: '100%', height: '100%' }}
      dangerouslySetInnerHTML={{
        __html: cardToSVG(card).replace(
          '<svg ',
          '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
        ),
      }}
    />
  )
}

export default function Layers({
  cards,
  activeCard,
  selectedIds,
  onSelectCard,
  onSelectElement,
  onToggleElement,
  onAddCard,
  onDuplicateCard,
  onDeleteCard,
  onReorder, // (cardId, newElementsArray)
}) {
  const card = cards.find((c) => c.id === activeCard) || cards[0]
  const dragIdx = useRef(null)
  const [overIdx, setOverIdx] = useState(null)

  // display topmost-first (Figma-style): reverse of render order
  const display = card ? [...card.elements].map((el, i) => ({ el, i })).reverse() : []

  function drop(toDisplayIdx) {
    const fromDisplayIdx = dragIdx.current
    dragIdx.current = null
    setOverIdx(null)
    if (fromDisplayIdx == null || fromDisplayIdx === toDisplayIdx || !card) return
    const arr = [...display]
    const [moved] = arr.splice(fromDisplayIdx, 1)
    arr.splice(toDisplayIdx, 0, moved)
    // back to render order (bottom-first)
    onReorder(card.id, [...arr].reverse().map((d) => d.el))
  }

  return (
    <div className="layers-panel">
      <div className="panel-head">
        <span className="panel-title">Pages</span>
        <span className="count">{cards.length}</span>
        <span className="grow" />
        <IconButton icon="plus" label="Add page" variant="subtle" size={26} iconSize={16} onClick={onAddCard} />
      </div>
      <div className="page-strip">
        {cards.map((c, i) => (
          <div
            key={c.id}
            className={'strip-page' + (c.id === card?.id ? ' active' : '')}
            title={c.name}
            onClick={() => onSelectCard(c.id)}
          >
            <div className="strip-thumb" style={{ aspectRatio: `${c.width} / ${c.height}`, background: c.background?.startsWith?.('linear:') ? '#101425' : c.background }}>
              <ThumbSVG card={c} />
            </div>
            <span className="strip-index">{i + 1}</span>
            <span className="strip-actions">
              <IconButton icon="copy" label="Duplicate" variant="subtle" size={20} iconSize={12}
                onClick={(e) => { e.stopPropagation(); onDuplicateCard(c.id) }} />
              {cards.length > 1 && (
                <IconButton icon="trash" label="Delete" variant="danger" size={20} iconSize={12}
                  onClick={(e) => { e.stopPropagation(); onDeleteCard(c.id) }} />
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="panel-head layers-head">
        <span className="panel-title">Layers</span>
        <span className="count">{card ? card.elements.length : 0}</span>
        <span className="grow" />
        <span className="layers-cardname">{card?.name}</span>
      </div>
      <div className="layers-list">
        {display.length === 0 && <div className="layers-empty">No elements yet — add one from the top bar.</div>}
        {display.map((d, di) => {
          const selected = selectedIds.includes(d.el.id)
          return (
            <div
              key={d.el.id}
              className={'layer' + (selected ? ' selected' : '') + (overIdx === di ? ' over' : '')}
              draggable
              onDragStart={() => { dragIdx.current = di }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(di) }}
              onDragLeave={() => setOverIdx((v) => (v === di ? null : v))}
              onDrop={() => drop(di)}
              onDragEnd={() => { dragIdx.current = null; setOverIdx(null) }}
              onClick={(e) => (e.shiftKey ? onToggleElement(d.el.id) : onSelectElement(d.el.id))}
            >
              <span className="layer-grip"><Icon name="minus" size={11} /><Icon name="minus" size={11} /></span>
              <span className="layer-icon"><Icon name={TYPE_ICON[d.el.type] || 'square'} size={13} /></span>
              <span className="layer-label">{labelFor(d.el)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

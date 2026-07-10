import React from 'react'
import { PRESETS } from './model.js'
import { Icon, IconButton } from './Icon.jsx'

const TYPE_META = {
  heading: { icon: 'heading', label: 'Heading' },
  text: { icon: 'text', label: 'Text' },
  rect: { icon: 'square', label: 'Rectangle' },
  ellipse: { icon: 'circle', label: 'Ellipse' },
  line: { icon: 'line', label: 'Line' },
  image: { icon: 'image', label: 'Image' },
}

function Row({ label, children }) {
  return (
    <label className="insp-row">
      <span className="insp-label">{label}</span>
      <span className="insp-control">{children}</span>
    </label>
  )
}

function Num({ value, onChange, step = 1, min }) {
  return (
    <input
      type="number"
      value={Math.round((value ?? 0) * 100) / 100}
      step={step}
      min={min}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function Color({ value, onChange, allowNone }) {
  const isNone = !value || value === 'none' || value === 'transparent'
  return (
    <span className="color-control">
      <input
        type="color"
        className="color-swatch"
        value={isNone ? '#000000' : value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        className="color-hex"
        value={value ?? ''}
        placeholder={allowNone ? 'none' : ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {allowNone && (
        <IconButton icon="x" label="No border" variant="subtle" size={26} iconSize={14} onClick={() => onChange('none')} />
      )}
    </span>
  )
}

function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'on' : ''}
          title={o.label}
          onClick={() => onChange(o.value)}
        >
          <Icon name={o.icon} size={16} />
        </button>
      ))}
    </div>
  )
}

function ActionGroup({ items, onAction }) {
  return (
    <div className="seg">
      {items.map((it) => (
        <button key={it.action} title={it.label} onClick={() => onAction(it.action)}>
          <Icon name={it.icon} size={16} />
        </button>
      ))}
    </div>
  )
}

export default function Inspector({ card, element, selectedCount = 0, onCardChange, onElChange, onElStyle, onDelete, onOrder, onAlign, onDistribute }) {
  const meta = element ? TYPE_META[element.type] : null
  const isText = element && (element.type === 'heading' || element.type === 'text')
  const multi = selectedCount > 1

  return (
    <div className="inspector">
      <section className="insp-section">
        <h3>Canvas</h3>
        <Row label="Name">
          <input type="text" value={card.name || ''} onChange={(e) => onCardChange({ name: e.target.value })} />
        </Row>
        <Row label="Preset">
          <select
            value=""
            onChange={(e) => {
              const p = PRESETS[e.target.value]
              if (p) onCardChange({ width: p.width, height: p.height })
            }}
          >
            <option value="">Choose size…</option>
            {Object.entries(PRESETS).map(([k, v]) => (
              <option key={k} value={k}>{v.label} · {v.width}×{v.height}</option>
            ))}
          </select>
        </Row>
        <Row label="W / H">
          <span className="pair">
            <Num value={card.width} min={16} onChange={(v) => onCardChange({ width: v })} />
            <Num value={card.height} min={16} onChange={(v) => onCardChange({ height: v })} />
          </span>
        </Row>
        <Row label="Background">
          <Color value={card.background} onChange={(v) => onCardChange({ background: v })} />
        </Row>
      </section>

      {multi ? (
        <section className="insp-section">
          <div className="insp-head">
            <h3><span className="type-ic"><Icon name="group" size={15} /></span>{selectedCount} selected</h3>
            <div className="insp-head-actions">
              <IconButton icon="trash" label="Delete all" variant="danger" size={28} iconSize={16} onClick={onDelete} />
            </div>
          </div>
          <Row label="Align">
            <div>
              <ActionGroup
                onAction={onAlign}
                items={[
                  { action: 'left', icon: 'alLeft', label: 'Align left' },
                  { action: 'hcenter', icon: 'alCenterH', label: 'Align center' },
                  { action: 'right', icon: 'alRight', label: 'Align right' },
                ]}
              />
              <ActionGroup
                onAction={onAlign}
                items={[
                  { action: 'top', icon: 'alTop', label: 'Align top' },
                  { action: 'vcenter', icon: 'alMiddleV', label: 'Align middle' },
                  { action: 'bottom', icon: 'alBottom', label: 'Align bottom' },
                ]}
              />
            </div>
          </Row>
          <Row label="Distribute">
            <ActionGroup
              onAction={onDistribute}
              items={[
                { action: 'h', icon: 'distH', label: 'Distribute horizontally' },
                { action: 'v', icon: 'distV', label: 'Distribute vertically' },
              ]}
            />
          </Row>
          <p className="insp-hint">Shift-click to add · drag empty canvas to marquee-select.</p>
        </section>
      ) : element ? (
        <section className="insp-section">
          <div className="insp-head">
            <h3>
              <span className="type-ic"><Icon name={meta.icon} size={15} /></span>
              {meta.label}
            </h3>
            <div className="insp-head-actions">
              <IconButton icon="sendBack" label="Send to back" variant="subtle" size={28} iconSize={16} onClick={() => onOrder('back')} />
              <IconButton icon="bringFront" label="Bring to front" variant="subtle" size={28} iconSize={16} onClick={() => onOrder('front')} />
              <IconButton icon="trash" label="Delete" variant="danger" size={28} iconSize={16} onClick={onDelete} />
            </div>
          </div>

          <Row label="X / Y">
            <span className="pair">
              <Num value={element.x} onChange={(v) => onElChange({ x: v })} />
              <Num value={element.y} onChange={(v) => onElChange({ y: v })} />
            </span>
          </Row>
          <Row label="W / H">
            <span className="pair">
              <Num value={element.w} onChange={(v) => onElChange({ w: v })} />
              <Num value={element.h} onChange={(v) => onElChange({ h: v })} />
            </span>
          </Row>
          <Row label="Rotation">
            <Num value={element.rotation} onChange={(v) => onElChange({ rotation: v })} />
          </Row>

          {isText && (
            <>
              <Row label="Text">
                <textarea rows={3} value={element.text || ''} onChange={(e) => onElChange({ text: e.target.value })} />
              </Row>
              <Row label="Color">
                <Color value={element.style.color} onChange={(v) => onElStyle({ color: v })} />
              </Row>
              <Row label="Size / Wt.">
                <span className="pair">
                  <Num value={element.style.fontSize} min={1} onChange={(v) => onElStyle({ fontSize: v })} />
                  <select value={element.style.fontWeight ?? 400} onChange={(e) => onElStyle({ fontWeight: Number(e.target.value) })}>
                    {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </span>
              </Row>
              <Row label="Align">
                <div>
                  <Seg
                    value={element.style.textAlign || 'left'}
                    onChange={(v) => onElStyle({ textAlign: v })}
                    options={[
                      { value: 'left', icon: 'alignLeft', label: 'Left' },
                      { value: 'center', icon: 'alignCenter', label: 'Center' },
                      { value: 'right', icon: 'alignRight', label: 'Right' },
                    ]}
                  />
                  <Seg
                    value={element.style.vAlign || 'top'}
                    onChange={(v) => onElStyle({ vAlign: v })}
                    options={[
                      { value: 'top', icon: 'alignTop', label: 'Top' },
                      { value: 'center', icon: 'alignMiddle', label: 'Middle' },
                      { value: 'bottom', icon: 'alignBottom', label: 'Bottom' },
                    ]}
                  />
                </div>
              </Row>
              <Row label="Letter / Line">
                <span className="pair">
                  <Num value={element.style.letterSpacing || 0} step={0.5} onChange={(v) => onElStyle({ letterSpacing: v })} />
                  <Num value={element.style.lineHeight ?? 1.35} step={0.05} onChange={(v) => onElStyle({ lineHeight: v })} />
                </span>
              </Row>
            </>
          )}

          {(element.type === 'rect' || element.type === 'ellipse') && (
            <>
              <Row label="Fill">
                <Color value={element.style.fill} onChange={(v) => onElStyle({ fill: v })} />
              </Row>
              <Row label="Border">
                <Color allowNone value={element.style.stroke} onChange={(v) => onElStyle({ stroke: v })} />
              </Row>
              <Row label="Border W">
                <Num value={element.style.strokeWidth || 0} min={0} onChange={(v) => onElStyle({ strokeWidth: v })} />
              </Row>
              {element.type === 'rect' && (
                <Row label="Radius">
                  <Num value={element.style.radius || 0} min={0} onChange={(v) => onElStyle({ radius: v })} />
                </Row>
              )}
            </>
          )}

          {element.type === 'line' && (
            <>
              <Row label="Color">
                <Color value={element.style.stroke} onChange={(v) => onElStyle({ stroke: v })} />
              </Row>
              <Row label="Width">
                <Num value={element.style.strokeWidth || 4} min={1} onChange={(v) => onElStyle({ strokeWidth: v })} />
              </Row>
              <Row label="Arrow">
                <input type="checkbox" checked={!!element.style.arrow} onChange={(e) => onElStyle({ arrow: e.target.checked })} />
              </Row>
            </>
          )}

          {element.type === 'image' && (
            <>
              <Row label="Source">
                <textarea rows={2} value={element.src || ''} placeholder="https://…  or  data:image/…" onChange={(e) => onElChange({ src: e.target.value })} />
              </Row>
              <Row label="Fit">
                <select value={element.style.fit || 'cover'} onChange={(e) => onElStyle({ fit: e.target.value })}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </Row>
              <Row label="Radius">
                <Num value={element.style.radius || 0} min={0} onChange={(v) => onElStyle({ radius: v })} />
              </Row>
            </>
          )}
        </section>
      ) : (
        <div className="insp-empty">Select an element to edit its properties.</div>
      )}
    </div>
  )
}

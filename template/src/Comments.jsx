import React, { useEffect, useRef, useState } from 'react'
import { Icon, IconButton } from './Icon.jsx'
import { isComposingEvent } from './sync.js'

const TYPE_ICON = {
  heading: 'heading',
  text: 'text',
  rect: 'square',
  ellipse: 'circle',
  line: 'line',
  image: 'image',
}

function targetInfo(comment, cards) {
  const ci = cards.findIndex((c) => c.id === comment.cardId)
  const card = cards[ci]
  if (!card) return { label: 'Removed', icon: 'x' }
  if (comment.elementId) {
    const el = (card.elements || []).find((e) => e.id === comment.elementId)
    if (el) return { label: el.type, icon: TYPE_ICON[el.type] || 'square' }
    return { label: 'element removed', icon: 'x' }
  }
  return { label: 'Card', icon: 'square' }
}

function stateOf(c) {
  if (c.status === 'resolved') return { key: 'resolved', label: 'Resolved' }
  if (!(c.body || '').trim()) return { key: 'draft', label: 'Draft' }
  if (c.sent) return { key: 'sent', label: 'Sent' }
  if (c.queued) return { key: 'queued', label: 'Queued' }
  return { key: 'held', label: 'Held' }
}

function CommentItem({ comment, cards, active, onFocus, onUpdate, onReply, onResolve, onDelete, onCopy, onToggleQueue }) {
  const [draft, setDraft] = useState('')
  const bodyRef = useRef(null)
  const info = targetInfo(comment, cards)
  const st = stateOf(comment)
  const resolved = comment.status === 'resolved'

  useEffect(() => {
    if (active && !comment.body && bodyRef.current) bodyRef.current.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div className={'cmt ' + st.key + (active ? ' active' : '')} onPointerDown={() => onFocus(comment.id)}>
      <div className="cmt-head">
        {resolved ? (
          <span className="cmt-dot resolved" title="Resolved"><Icon name="check" size={10} stroke={3} /></span>
        ) : (
          <input
            type="checkbox"
            className="cmt-check"
            checked={!!comment.queued}
            title="Include in the next batch send"
            onChange={() => onToggleQueue(comment.id)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        )}
        <span className={'chip ' + st.key}>{st.label}</span>
        <span className="cmt-target">
          <Icon name={info.icon} size={13} />
          {info.label}
        </span>
        <span className="grow" />
        <IconButton icon="clipboard" label="Copy directive for Claude" variant="subtle" size={26} iconSize={15}
          onClick={(e) => { e.stopPropagation(); onCopy(comment) }} />
        <IconButton icon={resolved ? 'reopen' : 'checkCircle'} label={resolved ? 'Reopen' : 'Resolve'} variant="subtle" size={26} iconSize={15}
          onClick={(e) => { e.stopPropagation(); onResolve(comment.id) }} />
        <IconButton icon="trash" label="Delete" variant="danger" size={26} iconSize={15}
          onClick={(e) => { e.stopPropagation(); onDelete(comment.id) }} />
      </div>

      <textarea
        ref={bodyRef}
        className="cmt-body"
        rows={2}
        placeholder="Tell Claude what to do with this…  e.g. make it bolder, 2 lines"
        value={comment.body}
        onChange={(e) => onUpdate(comment.id, { body: e.target.value, sent: false })}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {comment.replies?.length > 0 && (
        <div className="cmt-thread">
          {comment.replies.map((r, i) => (
            <div key={i} className={'bubble ' + (r.author === 'claude' ? 'claude' : 'user')}>
              <span className="bubble-author">{r.author === 'claude' ? 'Claude' : 'You'}</span>
              <span className="bubble-body">{r.body}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cmt-reply-box" onPointerDown={(e) => e.stopPropagation()}>
        <input
          type="text"
          placeholder="Reply / add detail…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              if (isComposingEvent(e)) return // Korean IME guard
              onReply(comment.id, draft.trim()); setDraft('')
            }
          }}
        />
        <IconButton icon="send" label="Send reply" variant="subtle" size={30} iconSize={16}
          onClick={() => { if (draft.trim()) { onReply(comment.id, draft.trim()); setDraft('') } }} />
      </div>
    </div>
  )
}

export default function Comments({
  comments,
  cards,
  activeComment,
  onFocus,
  onUpdate,
  onReply,
  onResolve,
  onDelete,
  onAdd,
  addLabel,
  canAdd,
  onCopy,
  onToggleQueue,
  onSendQueued,
  onSelectAll,
}) {
  const sendable = comments.filter((c) => c.status !== 'resolved' && (c.body || '').trim() && c.queued && !c.sent)
  const queueableAll = comments.filter((c) => c.status !== 'resolved' && (c.body || '').trim() && !c.sent)
  const allQueued = queueableAll.length > 0 && queueableAll.every((c) => c.queued)
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length
  const sentCount = comments.filter((c) => c.status !== 'resolved' && c.sent).length

  // group by slide, in card order
  const groups = cards
    .map((card, i) => ({ card, index: i, items: comments.filter((c) => c.cardId === card.id) }))
    .filter((g) => g.items.length > 0)
  const orphaned = comments.filter((c) => !cards.some((card) => card.id === c.cardId))

  return (
    <div className="comments">
      <div className="comments-intro">
        Comments are <b>instructions for Claude</b>. Pin one on an element, write the change, check
        the ones to run, then <b>Run with Claude</b> — real sub-agents execute them (watch the
        Agents tab).
      </div>

      <button className="btn btn-secondary add-comment" onClick={onAdd} disabled={!canAdd}>
        <Icon name="comment" size={15} stroke={2} />
        {canAdd ? `Comment on ${addLabel}` : 'Select an element to comment'}
      </button>

      {comments.length === 0 ? (
        <div className="comments-empty">
          No comments yet. Toggle the comment tool in the top bar, then click any element on the
          canvas.
        </div>
      ) : (
        <>
          <div className="batch-bar">
            <label className="select-all" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={allQueued} onChange={() => onSelectAll(!allQueued)} disabled={!queueableAll.length} />
              Select all
            </label>
            <span className="grow" />
            <button className="btn btn-primary send-queued" disabled={!sendable.length} onClick={onSendQueued}>
              <Icon name="send" size={15} stroke={2} />
              Run {sendable.length || ''} with Claude
            </button>
          </div>
          <div className="comments-count">
            {sendable.length} queued · {sentCount} sent · {resolvedCount} resolved
          </div>

          {groups.map((g) => (
            <div className="cmt-group" key={g.card.id}>
              <div className="cmt-group-head">
                <span className="cg-index">{g.index + 1}</span>
                <span className="cg-name">{g.card.name}</span>
                <span className="cg-count">{g.items.length}</span>
              </div>
              {g.items.map((c) => (
                <CommentItem key={c.id} comment={c} cards={cards} active={c.id === activeComment}
                  onFocus={onFocus} onUpdate={onUpdate} onReply={onReply} onResolve={onResolve}
                  onDelete={onDelete} onCopy={onCopy} onToggleQueue={onToggleQueue} />
              ))}
            </div>
          ))}

          {orphaned.length > 0 && (
            <div className="cmt-group">
              <div className="cmt-group-head"><span className="cg-name">Orphaned</span><span className="cg-count">{orphaned.length}</span></div>
              {orphaned.map((c) => (
                <CommentItem key={c.id} comment={c} cards={cards} active={c.id === activeComment}
                  onFocus={onFocus} onUpdate={onUpdate} onReply={onReply} onResolve={onResolve}
                  onDelete={onDelete} onCopy={onCopy} onToggleQueue={onToggleQueue} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

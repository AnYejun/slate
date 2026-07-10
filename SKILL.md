---
name: slate
description: Design card-news slides (카드뉴스), carousels, and figures/diagrams on a live, fully-editable Figma-style canvas that opens in the preview panel. Use when the user wants to create, design, or iterate on social cards, carousel slides, infographics, diagrams, or figures and wants to SEE and hand-edit the result while you keep modifying it. Triggers include "카드뉴스", "card news", "make a figure/diagram", "carousel", "infographic", "editable canvas", "design a slide", "Slate". You edit cards.json and the canvas updates live; the user drags/edits on the canvas and you see their changes.
---

# Slate

A local Vite+React canvas editor that runs in the **preview panel** with a
Cal.com-flavored, Figma-grade UI (light chrome, Cal Sans display type, stroke
pictograms). It gives the user a real design tool on the right while **you** keep
editing the design by writing to a single JSON file. Edits flow **both ways**:

- **You → canvas**: edit `cards.json` with the Edit tool → the canvas updates
  instantly (Server-Sent Events, no reload).
- **User → you**: the user drags, resizes, retypes, recolors on the canvas → it
  auto-saves to `cards.json` → you `Read` it to see their changes and continue.

What you see on the canvas is exactly what exports (PNG / SVG / PDF), because the
on-screen render and the exporters share one SVG serializer.

The editor chrome is English; card **content** can be any language (Korean,
etc. — the content font stack renders CJK well).

## When to use

Card-news slides, carousels, infographics, diagrams, figures — anything the user
wants to design visually and iterate on with you. If they just want a one-shot
static image and no editing, a plain SVG/Artifact may be simpler; use Slate when
**live, repeated, collaborative editing** is the point.

## Setup (once per project)

1. Copy the template into a workspace dir (default `slate/`):

   ```bash
   mkdir -p slate
   cp -R ~/.claude/skills/slate/template/. slate/
   ```

2. Install deps (Node 18+):

   ```bash
   npm install --prefix slate --no-audit --no-fund
   ```

3. Register a launch config so the preview panel can run it. Create or edit
   `.claude/launch.json` at the **project root** (keep any existing configs):

   ```json
   {
     "version": "0.0.1",
     "configurations": [
       {
         "name": "slate",
         "runtimeExecutable": "npm",
         "runtimeArgs": ["--prefix", "slate", "run", "dev"],
         "port": 5173
       }
     ]
   }
   ```

   `--prefix` makes vite run with `slate/` as its cwd, so it reads/writes
   `slate/cards.json`.

4. Start the preview: call `preview_start` with name `slate`. The editor opens on
   the right.

## The edit loop

- **The design lives in `slate/cards.json`.** This is the ONLY file you edit to
  change the design. Read `reference/schema.md` for the full schema.
- To change the design, use the **Edit** tool on `cards.json` (targeted edits
  keep the diff small and patch the canvas smoothly). The canvas reflects it
  within ~100ms. Do NOT restart the server for content changes.
- **Before a fresh round of edits, `Read` `cards.json`** — the user may have moved
  or restyled things on the canvas since your last write. Build on their state;
  don't clobber it.
- Keep coordinates inside each card's `width`/`height` (top-left origin, export
  pixels).
- To verify, `preview_screenshot`, or read the rendered SVG via `preview_eval`
  (`document.querySelector('.card-svg').innerHTML`).

## Comments = directives for you

The user can pin **comments** on the canvas — each one is an instruction for you,
scoped to a specific element (or card). They live in `doc.comments[]` in
`cards.json`, so you see them through the same file.

Each comment: `{ id, cardId, elementId, status: 'open'|'resolved', body, replies, queued, sent }`.
`body` is the directive; `elementId` says which element it targets (null = whole
card). `queued`/`sent` are UI-only (the user's batch selection) — **don't touch
them**; only ever change `status` and append to `replies`. The user sends you a
batch (often pasted from the panel's "Send to Claude"); handle every directive
in it. Pins on the canvas are numbered; the sidebar/tab show open counts.

**Your loop when the user says "apply comments" (or you notice open ones):**

1. `Read` `cards.json` and find comments with `status: 'open'` and a non-empty
   `body`. (Skip empty ones — the user is still typing them.)
2. For each, do exactly what the `body` says to the element identified by
   `elementId` on card `cardId`. Keep changes scoped to that target.
3. After applying, in the same `cards.json` edit:
   - set that comment's `status` to `'resolved'`, and
   - append a short reply: `{ "author": "claude", "body": "<what you did>" }`.
4. If a directive is ambiguous or you need input, DON'T resolve it — append a
   `claude` reply asking the question and leave it `open`.

The user sees resolutions and replies update live on the canvas. Treat comments
as the primary way the user hands you precise, per-element work.

## Capabilities

- **Multiple cards** (carousel / deck) — each entry in `cards[]`. The sidebar
  ("Pages") lists them; the top tool-pill adds elements.
- **Element types**: `heading`, `text` (wrap + `\n`), `rect`, `ellipse`, `line`
  (optional arrow), `image` (URL or `data:` URI).
- **Presets**: Card 1:1 (1080²), Card 4:5 (1080×1350), Story 9:16, Figure 16:9,
  Figure 4:3.
- **Export**: the black **Export** button → PNG (per card, 2×), SVG (per card,
  clean vectors), PDF (all cards). Tell the user to click it; downloads land in
  their browser. (You can't trigger the browser download, but you can reproduce
  the exact output from `cards.json`.)

### Editor power features (for the user; useful to mention)

- **Multi-select**: shift-click elements, or drag a marquee on empty canvas.
  The inspector then shows **align** (6 ways) and **distribute** controls.
- **Smart guides**: dragging an element snaps to other elements' edges/centers
  and the card center, drawing alignment guides.
- **Undo / redo**: ⌘Z / ⌘⇧Z (also toolbar buttons). Your edits are undoable too.
- **Version history**: the clock button lists auto-snapshots + named checkpoints
  and can restore any of them. Snapshots persist in `slate/.slate-history/`
  (gitignored). A snapshot is taken on every external edit — so if you make a
  bad change, the user can roll back.
- **Send to Claude**: each comment (and "Copy N open") has a copy button that
  puts a ready-to-paste directive on the clipboard — the user pastes it to you.
- **Live presence (Claude cursors)**: whenever you edit `cards.json`, the server
  diffs the change and the editor walks an animated "Claude" cursor across every
  element you touched, with a glow pulse — the user literally watches you work.
  This is automatic; you don't need to do anything.
- **Full screen**: the expand button, or open `localhost:5173` directly in a
  browser tab — Slate is a standalone web app, the preview panel is just its
  docked mode.

### Presence choreography (optional, for extra theatre)

For richer presence — e.g. when fanning out per-slide subagents — POST cursor
events and the editor renders one named cursor per agent (auto-colored):

```bash
curl -s -X POST localhost:5173/api/presence -H 'Content-Type: application/json' \
  -d '{"agent":"Claude · Slide 2","cardId":"card-body","elementId":"bd-title","action":"Rewriting headline…"}'
```

Fields: `agent` (required, cursor label), `cardId`, `elementId` (cursor moves to
its center) or `x`/`y`, `action` (status text), `color` (optional hex). Send one
event per step, ~0.5–1s apart. Cursors fade out ~4s after the last event. The
user can toggle "follow" (eye icon) to auto-jump to the slide being edited.

## Design guidance (Figma-grade, not "AI slop")

- One dominant heading, supporting body, generous margins (~10% of card width).
  Don't fill every pixel.
- 2–3 colors + neutrals; reuse one accent.
- Card-news body text ≥ 36px at 1080px width for mobile legibility.
- Figures: align to a grid, consistent stroke widths, arrows (`line` +
  `"arrow": true`) for flow.
- Make a batch of related edits, then screenshot and critique before the next
  round.

## Notes & limits

- `image` elements: prefer `data:` URIs or same-origin URLs. Cross-origin remote
  images can taint the canvas and break PNG/PDF export (SVG still works).
- Resize handles assume rotation 0; rotate via the inspector's Rotation field.
- The workspace dir has `node_modules/` (gitignored) and bundles the Cal Sans
  variable font under `public/fonts/` (OFL license included).

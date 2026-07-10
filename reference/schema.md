# cards.json schema

The entire design is one JSON document. Edit it to change the design; the canvas
patches live.

```jsonc
{
  "version": 1,
  "doc": { "title": "My deck" },      // title used as the PDF filename
  "cards": [ /* one object per card/slide */ ],
  "comments": [ /* directives from the user — see below */ ]
}
```

## Card

```jsonc
{
  "id": "card-1",          // unique, stable string
  "name": "Cover",         // shown in the sidebar
  "width": 1080,           // intrinsic export pixels
  "height": 1080,
  "background": "#0f172a", // any CSS color
  "elements": [ /* drawn back-to-front: last element is on top */ ]
}
```

Common sizes: `1080×1080` (1:1), `1080×1350` (4:5), `1080×1920` (9:16 story),
`1280×720` (16:9 figure), `1200×900` (4:3 figure).

## Element (shared fields)

Every element has geometry in **card coordinates** (top-left origin, pixels):

```jsonc
{
  "id": "el-1",
  "type": "heading | text | rect | ellipse | line | image",
  "x": 100, "y": 120,      // top-left corner
  "w": 880, "h": 200,      // box size
  "rotation": 0,           // degrees, about the box center
  "style": { /* type-specific, see below */ }
}
```

## Types

### `heading` / `text`
Multi-line, auto-wrapping. Use `\n` in `text` for hard line breaks.

```jsonc
{
  "type": "heading",
  "text": "A headline\non two lines",
  "style": {
    "color": "#111827",
    "fontSize": 88,          // px
    "fontWeight": 800,       // 300–900
    "textAlign": "left",     // left | center | right
    "vAlign": "top",         // top | center | bottom (vertical align in the box)
    "lineHeight": 1.1,       // multiplier
    "letterSpacing": -1,     // px
    "background": "transparent", // optional box fill behind the text
    "padding": 0             // optional px
  }
}
```
(`heading` and `text` are identical in behavior — the split just gives sensible
default sizes/weights. Style them however you like.)

### `rect`
```jsonc
{ "type": "rect", "style": {
  "fill": "#2563eb",
  "stroke": "none",        // or a color
  "strokeWidth": 0,
  "radius": 24             // corner radius px
}}
```

### `ellipse`
Fills the box; `w`/`h` are the bounding box (diameters).
```jsonc
{ "type": "ellipse", "style": { "fill": "#10b981", "stroke": "none", "strokeWidth": 0 } }
```

### `line`
Drawn horizontally across the box's vertical center (`y + h/2`), from `x` to
`x + w`. To make it slanted, set `rotation`. `h` can be `0`.
```jsonc
{ "type": "line", "style": { "stroke": "#111827", "strokeWidth": 8, "arrow": true } }
```

### `image`
```jsonc
{ "type": "image", "src": "data:image/png;base64,…", "style": {
  "fit": "cover",          // cover | contain
  "radius": 0              // rounded corners px
}}
```
Prefer `data:` URIs or same-origin URLs. Cross-origin images can break PNG/PDF
export (they taint the canvas); SVG export still works.

## Tips for editing

- **Back-to-front order = array order.** Put backgrounds first, text last.
- Keep everything within `[0,0] … [width,height]`; off-canvas elements are
  clipped on export.
- Make **targeted edits** (change one element's `text` or a `style` value) rather
  than rewriting the whole file — smaller diffs patch the canvas more smoothly and
  won't stomp the user's manual tweaks.
- Always `Read` the file right before editing if the user has been interacting
  with the canvas.

## Comments (directives from the user)

`doc.comments` is an array of instructions the user pinned on the canvas. Each is
scoped to an element (or a whole card) and is meant for **you** to act on.

```jsonc
{
  "id": "cm-1",             // unique, stable
  "cardId": "card-1",       // which card the pin is on
  "elementId": "el-3",      // which element it targets — null = whole card
  "x": 998, "y": 430,       // pin fallback position (used only when elementId is null)
  "status": "open",         // "open" = act on it · "resolved" = done
  "body": "Make this punchier, 2 lines max, emphasize one word",
  "replies": [              // conversation thread
    { "author": "claude", "body": "Done — tightened to 2 lines." }
  ],
  "queued": true,           // UI-only (user's batch selection) — DON'T touch
  "sent": false             // UI-only (marked when sent to you) — DON'T touch
}
```

Only ever change `status` and append to `replies`. Leave `queued`/`sent` as-is.

**How to process** (when asked to "apply comments", or proactively):
1. Handle each comment where `status` is `"open"` and `body` is non-empty (empty =
   still being typed).
2. Apply exactly what `body` says, to the element `elementId` on card `cardId`.
3. In the same edit, set `status` to `"resolved"` and append a reply
   `{ "author": "claude", "body": "<one line: what you changed>" }`.
4. If ambiguous, append a `claude` reply asking, and leave it `"open"`.

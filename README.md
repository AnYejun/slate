<p align="center"><img src="banner.svg" alt="Slate — a visual canvas for Claude Code" width="100%"/></p>

<p align="center">
  <b>English</b> · <a href="README.ko.md">한국어</a>
</p>

# Slate

**An open-source Skill that gives Claude Code a visual editor for card news, carousels, and figures.**

Slate turns a folder of design into a live, Figma-style canvas inside Claude
Code's preview panel. You arrange and edit visually; Claude edits the same file
and you see it update in real time. When you want help, you can tag any element
and ask — a Claude sub-agent makes the change while you keep working.

The whole design is one JSON file, so nothing is locked away. What you see on the
canvas is exactly what exports to PNG, SVG, or PDF.

---

## Made with Slate

These slides were designed on the Slate canvas and rendered by its own exporter.
The source is in [`examples/slate-promo/`](examples/slate-promo/cards.json) — open
it in Slate and edit.

<table>
  <tr>
    <td><img src="docs/promo/promo-01-hook.png" alt="Your canvas has a Claude army." width="100%"/></td>
    <td><img src="docs/promo/promo-02-problem.png" alt="Design tools wait for your hands." width="100%"/></td>
    <td><img src="docs/promo/promo-03-flip.png" alt="Slate listens instead." width="100%"/></td>
  </tr>
  <tr>
    <td><img src="docs/promo/promo-04-parallel.png" alt="Real agents, live shells: tag material, give one order, watch them run." width="100%"/></td>
    <td><img src="docs/promo/promo-05-craft.png" alt="Fancy is the default — glass, gradients, glow, all pure SVG." width="100%"/></td>
    <td><img src="docs/promo/promo-06-cta.png" alt="git clone and ask Claude to make you a deck." width="100%"/></td>
  </tr>
</table>

---

## What it does

- **Live two-way sync.** The whole deck is one `cards.json`. You drag and type on
  the canvas; Claude edits the file; both stay in sync. Work in chat, or command
  Claude from the board — same file, same result.
- **Tag and ask.** Select elements (or a whole page) and they attach to the
  composer as a chip. Ask for a change and a sub-agent handles exactly that
  material. Send more requests to run them in parallel, each with its own live
  shell log.
- **Live cursors.** Every edit is diffed and shown as a named cursor moving across
  the canvas, so you can watch changes happen — including several agents at once.
- **Fancy by default.** A glassmorphism style engine — gradients, blur, drop
  shadows, opacity — rendered as pure SVG, so exports match the screen exactly.
- **14 design systems built in.** glass · apple · linear · vercel · stripe · figma ·
  raycast · notion · spotify · nike · theverge · framer · cal · slate. Pick one and
  every edit follows it. (Twelve are from
  [awesome-design-md](https://github.com/VoltAgent/awesome-design-md), MIT.)
- **A real editor.** All slides on one Figma-style board, a layers panel with drag
  reordering, multi-select and marquee, smart alignment guides, rotation, zoom,
  drag-to-draw lines, image drop, undo/redo, and version history with restore.
- **Clean exports.** PNG, SVG, and PDF — one shared serializer, so what you see is
  what you get.

## Get started

```bash
git clone https://github.com/AnYejun/slate.git ~/.claude/skills/slate
```

Open Claude Code and ask for something visual — for example, *"카드뉴스 5장 만들어줘"*
or *"design a figure for my paper."* Claude sets up a workspace, opens the editor
in the preview panel (or full-screen at `localhost:5173`), and you're editing
together.

**Requirements.** Node 18+. To dispatch sub-agents from the board, the
[Claude Code CLI](https://claude.com/claude-code) should be logged in once
(`claude` → `/login`); runs use your Claude subscription, not a separate API key.
Without the CLI, the board copies the request for you to paste into chat instead.

## How it works

```
tag elements ──► POST /api/agents/run ──► claude -p per request
      ▲                                    (Read / Edit / Write, sandboxed)
      │                                              │
 live canvas ◄── file diff → named cursors ◄── agent edits cards.json
 (React + Vite)      shell output → work board       └─ auto-snapshot, restorable
```

`cards.json` is the single source of truth. The dev server watches it, diffs each
change, attributes it to the agent that made it, snapshots it for history, and
streams cursors and shell output to the board. The on-screen SVG serializer is
also the exporter, so the canvas and the output are the same thing.

## Notes

- **Safety.** Sub-agents run with `Read/Edit/Write` only, inside the workspace
  directory, with a timeout and an isolated environment. Every external edit is
  snapshotted first, and any version can be restored in one click.
- **Chat also works.** Slate is a normal Claude Code skill — you can always just
  ask Claude in chat. The board is there for when pointing is easier than
  describing.
- **Korean input.** IME composition is handled, so Enter won't submit mid-composition.

## Credits & license

MIT ([LICENSE](LICENSE)). Bundles [Cal Sans](https://github.com/calcom/sans)
(SIL OFL 1.1) and design systems from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT).

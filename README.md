# Slate

**A Figma-style canvas skill for Claude Code.** Design card-news decks, carousels,
and figures *by conversation* — you edit on a live canvas, Claude edits the same
file, and you watch its cursor work in real time.

> 카드뉴스·피겨를 대화로 만드는 Claude Code 스킬. 캔버스에 코멘트를 꽂으면
> 진짜 서브에이전트가 실행하고, 커서가 움직이는 걸 실시간으로 봅니다.

---

## What it does

- **Live canvas editor** (Vite + React) that opens in Claude Code's preview panel —
  or full-screen in any browser tab at `localhost:5173`.
- **One file = the design.** Everything lives in `cards.json`. Claude edits it with
  its file tools; the canvas patches live over SSE. You drag/resize/retype on the
  canvas; it autosaves; Claude reads your changes back. True two-way sync.
- **Comments are directives.** Pin a comment on any element, write what you want
  ("make this bolder, 2 lines"), queue several, hit **Run with Claude** — real
  headless `claude -p` sub-agents execute them, one per slide, in parallel.
- **Agent work board.** A chat-style panel shows each sub-agent: who's running,
  which directive, a live shell log, cost/duration. Plus a composer to command
  Claude directly — no chat window needed.
- **Live presence cursors.** The server diffs every external edit and walks a named
  cursor across each touched element, Figma-multiplayer style. Multiple agents =
  multiple colored cursors. Toggle "follow" to ride along.
- **Design tooling that holds up**: multi-select (shift / marquee), align &
  distribute, smart snap guides, undo/redo, version history with checkpoints &
  restore, image drag-drop (data-URI), and a `design.md` design system agents
  actually follow.
- **WYSIWYG exports.** The on-screen render and the PNG / SVG / PDF exporters share
  one SVG serializer — what you see is exactly what ships.

## Install

```bash
git clone https://github.com/AnYejun/slate.git ~/.claude/skills/slate
```

That's it — Claude Code picks up the skill (`/slate`). Requirements: Node 18+, and
the [Claude Code CLI](https://claude.com/claude-code) logged in (`claude` in a
terminal, then `/login`) if you want board-dispatched sub-agents.

## Quickstart

Ask Claude: *"카드뉴스 5장 만들어줘"* or *"open Slate and design a figure for my
paper"*. Claude scaffolds a workspace, starts the preview, and you're in the loop:

1. Claude drafts slides → you watch its cursor build them.
2. You drag things around, or pin comments with changes you want.
3. **Run with Claude** → sub-agents execute your comments, resolve them, and reply
   in-thread.
4. Export PNG/SVG/PDF.

## How sub-agents work (and what they cost)

The dev server spawns `claude -p "<your directives>"` as isolated headless
processes (default model: Sonnet, `Read/Edit/Write` only, edits auto-accepted,
5-minute timeout). If your CLI is logged in with a Claude subscription, runs bill
to your plan — no separate API key needed. The board streams each agent's
stream-json output as a live shell.

No CLI? The button falls back to copying the directives so you can paste them
into any Claude chat.

## Architecture (30 seconds)

```
cards.json  ←→  Vite dev server  ←→  React canvas (SVG serializer = exports)
     ↑            │  SSE: doc diffs → presence cursors, agent logs
     └─ Claude / sub-agents edit the file; server snapshots every change
        (.slate-history/, restorable)
```

## Credits & license

- Code: [MIT](LICENSE).
- Bundled [Cal Sans](https://github.com/calcom/sans) variable font: SIL OFL 1.1
  (license included next to the font).
- Built end-to-end in a single Claude Code session — the skill, the live cursors,
  the agent board, and this README. 🤖

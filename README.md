<p align="center"><img src="banner.svg" alt="Slate — the canvas where Claude agents hold the cursors" width="100%"/></p>

# Slate

**Your canvas has a Claude army now.**

Tag elements on a Figma-style board, type one sentence, and *real* headless
Claude sub-agents grab named cursors and redesign your deck — in parallel,
live, while you watch. No chat window. No copy-paste. **The canvas is the
interface.**

> 카드뉴스 툴 구독하다 화나서 만들었습니다. 요소 선택하고 "더 대담하게"라고
> 치면, 진짜 Claude 에이전트가 커서 잡고 고칩니다. 여러 개 동시에.

---

## The pitch

- 🎯 **Tag material, give orders.** Select elements (or a whole page) → they
  become a chip on the composer → send. That agent touches *only* what you
  tagged. Send again with other material → **parallel agents**, each with its
  own live shell log on the work board.
- 🖱 **Multiplayer cursors, except your teammates are AI.** Every file edit is
  diffed server-side and walked across the canvas as a named, colored cursor
  with glow pulses. Two agents = two cursors. Toggle *follow* and ride along.
- 🧊 **Fancy is the default.** Glassmorphism engine — gradients
  (`linear:#from,#to,angle`), gaussian blur, drop shadows, opacity — all pure
  SVG, so exports match the screen pixel-for-pixel. PNG / SVG / PDF.
- 🎨 **14 design systems built in.** glass · apple · linear · vercel · stripe ·
  figma · raycast · notion · spotify · nike · theverge · framer · cal · slate
  (12 via [awesome-design-md](https://github.com/VoltAgent/awesome-design-md),
  MIT). Pick one in the inspector; every agent obeys it.
- 🗂 **A real editor.** Figma-style board (all slides on one canvas), layers
  panel with drag z-reorder, multi-select + marquee, smart snap guides,
  rotation handle, ⌘-wheel zoom, drag-to-draw lines, image drag-drop, undo/redo,
  version history with restore.
- 🔁 **True two-way sync.** The whole deck is one `cards.json`. You drag on the
  canvas, Claude edits the file, both stay live. Ask Claude in chat *or* command
  it from the board — same brain, same file.

## 30-second start

```bash
git clone https://github.com/AnYejun/slate.git ~/.claude/skills/slate
```

Open Claude Code, say **"카드뉴스 5장 만들어줘"** (or "design a figure for my
paper"). Claude scaffolds the workspace, the editor opens in the preview panel
(or full-screen at `localhost:5173`), and the cursors start moving.

Requirements: Node 18+. For board-dispatched agents: the
[Claude Code CLI](https://claude.com/claude-code) logged in once (`claude` →
`/login`) — runs bill to your Claude subscription, not a separate API key. No
CLI? The board falls back to copy-paste directives.

## How it actually works

```
you tag elements ──► POST /api/agents/run ──► spawn `claude -p` per job
        ▲                                        (Read/Edit/Write only, 5min cap)
        │                                                   │
   live canvas ◄── SSE: file diff → named cursors ◄── agent edits cards.json
   (React+Vite)         agent shell logs → work board       └─ auto-snapshot,
                                                                restorable
```

One file (`cards.json`) is the whole design. The dev server diffs every write,
attributes it to the running agent, snapshots it, and streams cursors + shell
output to the board. The on-screen SVG serializer *is* the exporter — WYSIWYG
isn't a promise, it's an identity.

## FAQ

**Is this safe?** Agents run with `Read/Edit/Write` only, in the workspace
directory, auto-accepted edits, 5-minute timeout, isolated env. Every external
edit is snapshotted first — one click restores.

**Why not just use the chat?** You can! Slate is also a normal Claude Code
skill. The board exists because pointing at things beats describing them.

**Korean IME?** 조합 중 Enter 이중 전송 문제 해결되어 있습니다.

## Credits & license

MIT ([LICENSE](LICENSE)). Bundled [Cal Sans](https://github.com/calcom/sans)
(SIL OFL 1.1). Design systems from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
(MIT). Built end-to-end — code, cursors, this README, the banner SVG — in one
Claude Code session. 🤖

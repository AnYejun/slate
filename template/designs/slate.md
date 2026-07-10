# Slate deck design system

The design language for every card in this workspace. Any agent editing
`cards.json` reads this first and stays inside it. Edit freely — this file is
yours; agents follow whatever it says.

## Palette

| Role | Value | Use |
|---|---|---|
| Ink | `#0B0F1A` | Dark backgrounds, headline text on light |
| Canvas | `#ffffff` | Light backgrounds |
| Accent | `#27DBA2` | ONE accent — badges, rules, number circles, a full-bleed statement slide |
| Body on dark | `#e5eaf1` | Primary text on dark |
| Muted on dark | `#8b98ab` | Secondary text on dark |
| Body on light | `#374151` | Primary body on light |
| Muted on light | `#6b7280` / `#9ca3af` | Secondary / captions on light |

Rules: monochrome + one accent. Never introduce a second accent color. Dark and
light slides alternate for rhythm; the accent full-bleed slide is a once-per-deck
statement, not a template.

## Type scale (1080×1350 card)

| Role | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Display (cover) | 112–128 | 800 | -3 | 1.05–1.14 |
| H1 (section) | 88–96 | 800 | -2 | 1.1 |
| H2 / punch | 72–76 | 800 | -1.5 | 1.15 |
| Point title | 46–48 | 700 | 0 | 1.2 |
| Body | 38–44 | 400 | 0 | 1.4–1.45 |
| Caption / label | 26–34 | 500–700 | +2~4 (labels) | 1.3 |

Labels (e.g. `PROBLEM`, `LAPLAS MANIFESTO`) are small caps-feel: uppercase,
26px, weight 700, letterSpacing 4, muted color.

Serif option: `'Noto Serif KR','Nanum Myeongjo',serif` for editorial covers.
When mixing, serif = display only; keep body sans. Serif wants weight 700,
tracking -1, lineHeight 1.14.

## Layout

- Margins: 100px on every side (1080-wide card). Content width 880.
- One idea per slide. One dominant element; everything else supports it.
- Accent rule line: 120–300px wide, 6–10px thick, sits between heading and body.
- Number circles: 96px accent ellipse + ink number 48/800, text block starts x=240.
- Breathing room beats density — if it feels full, cut a line.

## Voice

- Korean copy: short declarative lines, no trailing 요-chains on covers.
  Hook → problem → belief → product → CTA is the default 5-beat arc.
- One bolded idea per slide max.

## Don'ts

- Don't center-align body paragraphs (headlines may center on statement slides).
- Don't use more than 2 font sizes per slide besides labels.
- Don't fill the accent slide with body text — it's a poster, not a page.
- Don't place text within 60px of card edges.

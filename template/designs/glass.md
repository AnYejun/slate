# Glass — the Slate signature style

Fancy by default: deep gradient atmospheres, floating glass panels, one luminous
accent. Built to look like an art-school poster, and to export pixel-perfect
(every effect below maps to SVG primitives — no browser-only tricks).

## Atmosphere (card background)

Always a gradient, never flat. `background` accepts `linear:<from>,<to>,<angle>`:

- Midnight: `linear:#0B1020,#1B1140,160` (navy → violet)
- Aurora: `linear:#04160F,#0B3B2E,150` (ink → deep emerald)
- Blush: `linear:#1A0B14,#3B0B2E,145` (plum → magenta)
- Daylight glass: `linear:#EEF2F7,#DCE4F0,165` (for light decks)

Add 1–2 huge soft glow orbs behind content: `ellipse` with accent `fill`,
`opacity` 0.25–0.4, `blur` 60–120, overlapping the card edge. They are the light
source of the composition.

## Glass panels

A glass panel = `rect` with:

```jsonc
"style": {
  "fill": "rgba(255,255,255,0.08)",      // 0.06–0.12 on dark, 0.4–0.6 white on light
  "stroke": "rgba(255,255,255,0.25)",    // 1px luminous edge
  "strokeWidth": 1.5,
  "radius": 28,
  "shadow": "0 24 60 rgba(0,0,0,0.35)"   // dx dy blur color — float it
}
```

Stack content ON the panel (panel first in the array, content after). Panels
tilt −2…2° (`rotation`) for life. Never more than 3 panels per card.

## Accent & light

ONE luminous accent per deck — electric mint `#5EEAD4`, cyan `#67E8F9`, or
violet `#A78BFA`. Use it for: one gradient stop, glow orbs, a rule line, one
emphasized word (its own element). Text glow: duplicate the heading, put the
copy underneath with `blur: 18`, `opacity: 0.6`, accent color.

## Type

- Display: 116–136, weight 800, tracking −3, lineHeight 1.04. White `#F8FAFC`.
- The emphasized word/line gets the accent color as its own element.
- Serif mix (`'Noto Serif KR',serif`) allowed for ONE display line — italic
  feel via serif contrast, not synthetic slant.
- Body on glass: 38–44, `#C7D2E5` (dark decks). Caption labels: 26, uppercase,
  tracking 4, accent color at 0.8 opacity.

## Effects vocabulary (all exportable)

| style key | value | renders as |
|---|---|---|
| `opacity` | 0–1 | element transparency |
| `blur` | px | gaussian blur (glows, orbs, text halos) |
| `shadow` | `"dx dy blur color"` | drop shadow (float panels) |
| `fill`/`background` | `linear:from,to,angle` | linear gradient |

## Composition rules

- Depth order: atmosphere → glow orbs → glass panels → text → accent details.
- 100px margins; let orbs bleed off-edge, never text.
- One focal point per card. If everything glows, nothing glows.
- Rhythm across a deck: alternate orb positions (top-left / bottom-right).

## Don'ts

- No pure black `#000` and no pure flat backgrounds.
- No more than one accent hue; neutrals do the rest.
- Don't put long body copy on high-blur areas — keep glass under text calm.

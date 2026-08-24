# PAPI — Design System

Direction: **premium esports organisation × World of Warcraft × live sports
broadcast × raid command center.** Dark, exclusive, extremely legible,
data-driven. Not a WordPress gaming theme, not glassmorphism, not purple
gradients.

## Color

Tokens live in `src/styles/globals.css` (`@theme`).

| Token | Value | Use |
| --- | --- | --- |
| `canvas` / `canvas-deep` | `#05050D` / `#080812` | page background |
| `surface` / `surface-2` / `surface-3` | `#0D0D1B` / `#121225` / `#181832` | elevated panels |
| `papi-navy` | `#07065F` | brand ground (logo, deep accents) |
| `papi-red` | `#E13527` | **sparingly**: primary CTA, live status, HIGH priority, critical alerts, progression highlights |
| `papi-blue` | `#397CEF` | links, selected states, information, graphs, M+ |
| `papi-white` / `ink` | `#FBFBFC` | primary content |
| `ink-muted` / `ink-faint` | neutral greys | secondary/tertiary text |
| `ok` / `warn` / `danger` | green / amber / red | status — **never color alone**, always paired with a label/glyph |

WoW class colors are tokens (`--color-class-*`) used for character names and
class chips.

## Type

- **Display**: Archivo (900, uppercase, tight tracking) — headings, stats
- **Body**: Inter
- **Numbers**: JetBrains Mono, `tabular-nums` — countdowns, counts, scores

Loaded via `next/font` (self-hosted at build, zero runtime requests).

## The three PAPI signatures (use consistently, nowhere else)

1. **Split-line** — a red→blue hairline (`.split-line`, `.split-line-soft`).
   Under the header, under hero, section punctuation.
2. **Live dot** — pulsing red dot (`.live-dot`) for anything live/in
   progress: `● RAID LIVE`, progress boss.
3. **Oversized statistics** — `.stat-oversized` + `.stat-label`: `11.7%`,
   `6 / 8`, `19 / 20`. One or two per screen; hierarchy over card grids.

## Principles

- Few strong visual elements per page instead of 12 identical boxes.
- Microinteractions: hover states, animated progress bars, live countdown —
  all gated by `prefers-reduced-motion` (global override in CSS).
- Mobile-first; bottom tab bar on mobile (`HOME RAIDS ROSTER GUILD PROFILE`),
  top nav on desktop. Admin has its own nav.
- Accessibility: semantic HTML, visible focus (`:focus-visible` ring),
  WCAG-contrast tokens, labels on all form fields, `aria` on progress bars,
  status conveyed by text+shape+color.
- Personality in microcopy ("Quiet day. No fresh meat yet."), never at the
  cost of clarity.

## Logo

Original PAPI mark (`src/components/Logo.tsx`, `public/favicon.svg`): two
interlocking chevrons — red descending, blue ascending — forming a "P"
counter on navy, echoing the split-line. Deliberately distinct from any
existing brand (the old circle/wave logo was a Pepsi pastiche and was
retired).

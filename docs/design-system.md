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

---

## Dropping in a new logo

The identity is deliberately centralised, so replacing the mark is a small,
contained change rather than a rebuild. Four places, in order:

| What | Where |
| --- | --- |
| Brand colours | `src/styles/globals.css` → `@theme` block (`--color-papi-*`, surfaces, ink) |
| The mark + wordmark | `src/components/Logo.tsx` (`PapiMark`, `PapiWordmark`, `PapiLogo`) |
| Favicon / tab icon | `public/favicon.svg` |
| Signature motifs | `.split-line`, `.live-dot`, `.stat-oversized` in `globals.css` |

Nothing else in the app hardcodes a brand colour — every component reads the
tokens, so re-pointing the `@theme` values re-skins the entire site. (The one
deliberate exception is Discord's own `#5865F2` on the sign-in button, which
must stay Discord's blue.)

### Asset requirements

**SVG, not PNG.** The mark is rendered from ~24px (favicon, roster rows) to
hero scale, and is recoloured per context. A raster file cannot do either: it
blurs when small and cannot be restyled. If the source is a raster image, it
gets redrawn as clean vector before it enters the codebase.

Needed for a complete swap:

- Primary mark as SVG, transparent background, square-ish viewBox
- A single-colour version (`fill="currentColor"`) for monochrome contexts
- Wordmark, if the logo has one, as a separate asset or as outlined paths
- The exact hex values the mark uses, so the `@theme` palette can follow it

### Deriving the rest from the mark

Once the mark is final, the design system should be re-derived from it rather
than kept as-is: corner radii and stroke weights matched to the mark's own
geometry, the palette re-pointed to its colours, and the signature motifs
replaced if the mark implies a stronger device than the current red→blue
split-line. That is a deliberate pass, not a search-and-replace.

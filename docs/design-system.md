# PAPI — Design System

The identity is led by the guild badge: a vintage sports-club emblem with the
PAPI mascot — glasses, moustache, vest, briefs, club socks — ringed in purple
and indigo over a banner reading **PAPI · EST. ALWAYS DAD**.

Everything else follows from that mark. The site is **light, warm and
printed-looking**, not dark and technical: cream paper, indigo type, purple
furniture. The joke belongs to the badge; the interface around it stays
straight-faced so the data reads clearly.

## Colour

Tokens live in `src/styles/globals.css` (`@theme`). Every value below was
sampled from the badge artwork rather than chosen independently.

| Token | Value | Use |
| --- | --- | --- |
| `papi-indigo` | `#0C1338` | primary type, headers, primary buttons |
| `papi-indigo-soft` | `#1C2456` | hovers on indigo surfaces |
| `papi-purple` | `#5B37A0` | links, active states, brand furniture, M+ figures |
| `papi-purple-soft` | `#7C5BC4` | secondary accents |
| `papi-purple-wash` | `#EFEAF9` | selected chips, quiet purple fills |
| `papi-cream` | `#F7F3EA` | the paper the badge sits on |
| `canvas` / `surface` | `#FFFFFF` | page and card backgrounds |
| `canvas-deep` / `surface-2` / `surface-3` | cream tints | banded sections, insets |
| `edge` / `edge-strong` | `#E2DCCF` / `#CEC6B4` | borders — warm, never grey |
| `ink` / `ink-muted` / `ink-faint` | indigo / `#5A6080` / `#8A90A8` | text hierarchy |
| `stripe-red` | `#D1372C` | **sparingly**: live status, HIGH priority, critical alerts, progression |
| `stripe-blue` | `#215598` | the stripe's second band |
| `ok` / `warn` / `danger` | `#1F7A4D` / `#A8690A` / `#D1372C` | status, always with a label or glyph |

**WoW class colours are darkened for light backgrounds.** Blizzard's canonical
values — Priest white, Rogue yellow, Monk green — are unreadable on white, so
each is tuned to stay recognisable while clearing contrast on `canvas` and
`surface-2`. They live as `--color-class-*` tokens.

## Type

- **Display**: Archivo (900, uppercase, tight tracking) — headings and stats,
  matching the heavy condensed wordmark inside the badge
- **Body**: Inter
- **Numbers**: JetBrains Mono, `tabular-nums` — countdowns, counts, scores

Loaded through `next/font`, self-hosted at build, no runtime font requests.

## The three signatures

Use these consistently and nowhere else.

1. **The athletic stripe** (`.stripe`, `.stripe-thin`) — red / cream / blue,
   lifted straight off the mascot's club socks. It closes sections and
   underlines the header the way a sock cuff does. This replaced the earlier
   red→blue "split-line", which belonged to a design system the badge
   superseded.
2. **The banner kicker** (`.banner`) — an indigo tab with clipped corners,
   echoing the wordmark banner across the bottom of the badge. Used for every
   section kicker, so each heading carries a piece of the mark.
3. **Oversized statistics** (`.stat-oversized` + `.stat-label`) — `11.7%`,
   `6 / 8`, `18 / 20`. One or two per screen; hierarchy over card grids.

`.paper` gives banded sections the cream ground with a faint dot texture — pure
CSS, no image request.

## Principles

- The badge is the hero. On the homepage it sits at full size beside the
  headline, and moves **above** the copy on mobile so the mascot is the first
  thing a visitor meets.
- Few strong elements per page instead of a grid of identical boxes.
- Microinteractions — hovers, animated progress bars, the live countdown — all
  gated by `prefers-reduced-motion` (global override in CSS).
- Mobile-first: bottom tab bar on mobile (`HOME RAIDS ROSTER GUILD PROFILE`),
  top nav on desktop. Admin has its own navigation.
- Accessibility: semantic HTML, visible focus ring, WCAG-contrast tokens,
  labelled form fields, `aria` on progress bars. Status is never conveyed by
  colour alone — always colour plus text or shape.
- Personality lives in the badge and the microcopy ("Quiet day. No fresh meat
  yet."), never at the cost of clarity.

## Assets

| File | Use |
| --- | --- |
| `public/brand/papi-logo.png` | display master (1000px tall), hero and large lockups |
| `public/brand/papi-logo-sm.png` | 260px variant for navigation, footer, small contexts |
| `public/brand/papi-logo-180.png` | Apple touch icon |
| `public/brand/papi-og.png` | 1200×630 social card |
| `public/favicon.svg` | badge reduced to ring + banner; the mascot cannot read at 16px |

`PapiBadge` in `src/components/Logo.tsx` picks the small source automatically
at ≤130px, so a 44px header badge never downloads the hero asset.

The artwork is raster. That is a real constraint: it cannot be recoloured per
context and cannot be redrawn at arbitrary detail. If a vector version ever
exists, swapping it in is confined to `Logo.tsx` and `favicon.svg`.

## Replacing the identity again

Four places, in order: the `@theme` block in `src/styles/globals.css`,
`src/components/Logo.tsx`, `public/favicon.svg`, and the signature motifs in
`globals.css`. Nothing else hardcodes a brand colour — every component reads
tokens, so re-pointing `@theme` re-skins the whole site. The one deliberate
exception is Discord's own `#5865F2` on the sign-in button.

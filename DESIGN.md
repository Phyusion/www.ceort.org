# Design system — ceort.org

The site is built on the **CEO Roundtable on Cancer / Project Data Sphere design
system** (handoff: *CEORT Design System*, high-fidelity). All design values live in
`css/tokens.css` and are consumed by `css/style.css`.

## Files

| File | What it holds |
| --- | --- |
| `css/tokens.css` | Colour ramps, type scale, spacing, radii, elevation, motion — verbatim from the handoff `tokens/`. Also loads the four webfonts. |
| `css/style.css` | Every page component, expressed only through those tokens. |

Link order matters: `tokens.css` first, then `style.css`.

## Rules the stylesheet encodes

- **Two background colours per page maximum** — white and `--ink-50` — with navy
  (`--ink-800`/`--ink-900`) reserved for full-bleed bands: the hero, the
  presidential pullquote, and the closing CTA.
- **The gold rule is the signature device**: 56×3px under a section heading,
  32×2px under a stat numeral, 2px as the active-nav underline, 3px as a card's
  top rule, 2px as the left marker on an active list item.
- **Type has four jobs**: Cormorant Garamond (display and all headings, weight
  300–500, never bold), Cinzel (eyebrows and labels — uppercase, 0.14em tracking,
  gold), Jost (body, buttons, nav, tables), IBM Plex Mono (dates, counts, IDs).
- **Radii are small** — 2/3/4px. Pills are for status badges only.
- **Hairline borders do the work of shadows.** A marketing card at rest has no
  shadow; hover lifts 2px with `--shadow-md`.
- **Motion is short and flat**: 140ms colour, 220ms movement, 640ms scroll reveal
  (16px rise + fade). No bounces, springs, scale-ups, parallax, or auto-playing
  animation. `prefers-reduced-motion` is honoured.
- **Voice**: Title Case headlines, UPPERCASE eyebrows and stat captions, sentence
  case body and buttons. Arrows (`→`) terminate forward-navigation links. No emoji.

Reference colour, type, and space through the custom properties — never hard-code a
hex or a px value that a token already covers, and prefer the semantic aliases
(`--text-muted`, `--surface-alt`, `--border-hairline`) over the base ramps.

## Caveats carried over from the handoff

1. **Fonts are substitutions.** No licensed binaries were supplied. Cinzel,
   Cormorant Garamond, Jost, and IBM Plex Mono are the Google Fonts nearest to the
   lettering in the two brand marks. If the organization licenses the originals
   (the CEORT mark's serif resembles Trajan; the PDS wordmark resembles a Futura
   relative), self-host them with `@font-face` and repoint `css/tokens.css`.
2. **Icons.** The inline SVGs are drawn at 1.5px stroke, line only, never filled,
   to match the handoff's icon rule. Icons support text; they never replace it.
3. **Brand marks.** `images/logo.png` and `images/pds-logo.png` are never redrawn
   or recoloured. The footer sets the organization's name in Cinzel rather than
   inverting the mark, because the supplied PNG carries an opaque gold glow that
   does not invert cleanly.

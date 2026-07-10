# WP4 — Design system foundation + brand

**Goal**: one visual language across the whole app. Kill the three coexisting token systems,
the light-mode fragments, and emoji iconography. Produce the primitives every later WP builds from.
**Depends on**: WP1. **Size**: 3–5 days. **Branch**: `wp4-design-system`.

The intended aesthetic — dark ice, frosted glass, cyan glow, scoreboard numerals — is
**kept and systematized**, not replaced. Load the `frontend-design` skill before UI work.

## Current state (measured)

- `web/src/index.css`: 4,568 lines, **867 `!important`**, two `:root` blocks, three token
  vocabularies (`--ci-*`, `--ice-*`, legacy `--rink-navy`/`--teal-500`/`--navy-900`/`--ice-300`), 137 custom properties.
- 352 light-theme Tailwind utilities in `web/src/**/*.tsx` (`bg-white` ×127, `text-gray-*` ×167,
  `bg-blue-50` ×15, `bg-gray-50` ×14, `bg-red-100` ×6, `bg-green-100` ×2). The Draft Helper
  results table is entirely light-mode inside the dark shell.
- Emoji as UI chrome in 7+ files (🔴🟢🔵⭐👇✅📅). Mixed icon systems (emoji + lucide + inline SVG).
- Two PNG logos incl. `upscalemedia-transformed (1).png`; toast styled by a 20-line inline object;
  `WorkstationLayout.tsx` embeds a `<style>` tag.

## 1. Tokens

Create `web/src/styles/tokens.css` — the ONLY place colors/effects are defined (~25 semantic tokens):

```
--surface-0/-1/-2        page → panel → raised panel (current dark ice values)
--ink / --ink-dim / --ink-mute
--line / --line-strong
--accent / --accent-ink  (laser cyan + readable-on-cyan)
--positive / --warning / --negative
--glow-accent / --glow-positive   (box-shadow values)
--frost                  (backdrop-filter value)
--radius-sm/-md/-lg
--font-display / --font-body / --font-mono
```

Map values from the best of the existing `--ice-*` palette. Then migrate: mechanical
find-replace of all `--ci-*` / `--ice-*` / legacy var references to semantic tokens, then
delete the old definitions. `index.css` shrinks accordingly; target **zero new `!important`**
and remove any that become unnecessary during migration (don't chase all 867 — that's
incremental; forbid new ones via review).

## 2. Primitives

In `web/src/components/ui/` (some exist — extend, don't duplicate):

- `Button` (primary/ghost/danger variants; replaces `btn-neon` classes)
- `Card` (exists — align to tokens)
- `DataTable` (dark glass table: header row, zebra via tokens, sticky header option —
  replaces the light-mode table pattern)
- `StatBar` (replaces ConflictProgressBar/UsableStartsProgressBar/OffNightProgressBar; value +
  max normalized by caller, color by semantic intent)
- `Badge`, `Toast` (replaces the inline-styled toast in UnifiedDraftHelper), `EmptyState`,
  `Modal`/`Drawer`/`Sheet` (align existing ones), `Tooltip` (wrap installed Radix tooltip;
  replaces every `title=` attribute usage)
- Icons: lucide-react only. Remove all emoji from UI chrome (grep: 🔴🟢🔵⭐👇✅📅🎯🔥❄️🏒).

## 3. Light-mode purge

Sweep all 352 light-theme utility usages. Rules: surfaces → `--surface-*`, text → `--ink*`,
states → `--positive/--warning/--negative` tinted panels (e.g. error banner = negative-tinted
glass, not `bg-red-100`). Empty states and error banners get the `EmptyState` primitive.
After the sweep, add a CI grep guard (extend the WP1 workflow):
`git grep -nE "bg-white|bg-gray-[0-9]|text-gray-[0-9]|bg-(blue|red|green)-(50|100)" web/src` must return nothing.

## 4. Motion + behavior cleanup

- Delete the 8-second periodic `lockButtonPulse` nag (`UnifiedDraftHelper.tsx:436-445`).
- Delete the "ACTION 👇 CLICK LOCK IN!" column header and the 3-step light-blue stepper bar
  (WP5 replaces the guidance with a self-explanatory layout; if WP4 lands first, replace with
  a single quiet caption).
- Keep: row fade-in stagger, hover states, glow on active.

## 5. Brand assets

- New SVG wordmark "CRACKED ICE" + puck mark in the neon-ice style. **Owner approves before merge.**
- Derive: favicon (SVG + PNG fallbacks), OG image 1200×630 (wordmark + tagline
  "Win your league with schedule math"), header logo replacing both PNGs in `Header.tsx`.
- Update `web/index.html` title/OG (coordinates with WP3), all `alt` texts, and the studio
  sidebar branding.

## Acceptance criteria

- [ ] Every page renders visually coherent dark theme: no white panels, no light tables, no emoji chrome. Manual pass through: Home (both modes), Schedule, Game Analysis, Blog, Help, `/coach/roster`.
- [ ] CI grep guard for light-mode utilities passes and is enforced.
- [ ] `tokens.css` is the only file defining color values; component grep for `#[0-9a-fA-F]{3,6}` yields only data-driven exceptions (team colors).
- [ ] Old PNG logos removed; SVG wordmark + favicon + OG image shipped; owner approved the mark.
- [ ] No new `!important`; net count reduced from 867 (record the new number in the PR).
- [ ] `npm run build` clean; no visual regression in the primitives' consumers (screenshot the 5 main pages before/after into the PR).

## Verification

`cd web && npm run dev`, walk every route at 1440px and 390px widths, screenshot each,
attach before/after to the PR. Owner reviews screenshots.

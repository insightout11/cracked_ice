# Locked decisions (owner-confirmed 2026-07-10)

These are settled. Agents do not relitigate them; if implementation reveals a conflict,
stop and surface it to the owner rather than choosing differently.

## Product

| Topic | Decision |
|---|---|
| Draft Helper | **Full redesign**: verdict card (headline `+N usable starts / ~+X fantasy pts`), schedule interleave strip, share-to-PNG, ranked list demoted below the verdict. |
| Input model | **Player-first**: search a player ("McDavid") → team + slot count inferred. Team-based entry remains as a secondary tab. |
| Navigation / IA | Nav becomes **Draft · Season · My Team (later) · Blog**. Game Analysis merges into the Season page as a tab. Old URLs 301-redirect. Help page collapses into tooltips + footer link. |
| Public AI Coach | **Simplify & keep**: reframed "Get this week's best move". Manual player search is the primary input, OCR demoted to a shortcut, GPT chat removed from the public surface. One hero recommendation, others collapsed. |
| League format | **Points leagues first.** Categories support is roadmap, not launch. Schedule tools are format-agnostic. |
| Monetization | **None in 2026.** No paywall, no pro gating. Buy-me-a-coffee link stays. Decision revisited for 2027-28 with a season of analytics. |
| Studio beta | **November, desktop-first, free.** The mobile shell (`web/src/mobile/`) stays in code but hidden until it passes a real device test pass. |
| Yahoo OAuth | Deferred; build only after the studio beta shows weekly return usage (WP11 is conditional). |

## Brand

- Name: **Cracked Ice Hockey** everywhere (page titles, OG tags, header, studio). The name
  "Off-Night Optimizer" survives only as the Draft tool's descriptive subtitle if useful.
- New **SVG wordmark + favicon** in the existing neon-ice style, replacing
  `web/public/puck.png` and `web/public/upscalemedia-transformed*.png`. Owner approves the
  mark before it ships.
- Keep the dark ice / frosted glass / cyan glow aesthetic. Unify it; don't replace it.

## Execution

- Repo cleanup: create branch **`archive/pre-consolidation`** at current master first, then
  delete stale copies from master.
- Budget: **free tier only** — GA4, Upstash Redis free tier, OpenAI pay-per-use for OCR only.
- Owner content commitment: ~1 post/week Aug–Oct from generated material → invest properly
  in the WP9 content generator.
- Timeline: no owner availability constraints. Public relaunch target **Aug 31, 2026**;
  the NHL 2026-27 schedule drops mid-July, so WP2 runs as early as possible.

## Known verified facts that shaped these decisions

- Viral proof: Reddit post on complementary center pairs → hundreds of thousands of views, 400+ shares.
- Current traffic: effectively zero (no promotion since; no analytics installed to know).
- Nightly hydrate last ran 2026-03-15; prod serves 2025-26 data.
- `index.css`: 4,568 lines, 867 `!important`, 3 coexisting token systems; 352 light-theme
  Tailwind utility usages inside the dark app (the flagship results table is light-mode).
- The coach scoring engine (`server/src/features/coach/scoring.ts`) is points/FPPG-based with
  custom league weights — this is why points leagues launch first.
- Owner's own league is on Yahoo.

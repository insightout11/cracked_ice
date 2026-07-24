# Locked decisions (owner-confirmed through 2026-07-22)

These are settled. Agents do not relitigate them; if implementation reveals a conflict,
stop and surface it to the owner rather than choosing differently.

## Product

| Topic | Decision |
|---|---|
| Optimizer | Player-first schedule optimizer for draft, pickups, streaming, and rest-of-season planning. Do not frame the product or route as draft-only. WP5's verdict/proof work remains useful, but WP6 removes oversized explanatory marketing and lets the user reach the tool immediately. |
| Input model | **Player-first**: search a player ("McDavid") → team + slot count inferred. Team-based entry remains as a secondary tab. |
| Navigation / IA | Nav becomes **Optimizer · Season · My Team · Blog**. Game Analysis, off-night lists, back-to-backs, dense weekly schedule, and the complement matrix remain discoverable under the appropriate tool surface. |
| My Team / coach | My Team is the persistent roster workspace and eventual signed-in landing page. Recommendations and explanations live in context; there is no separate public AI Coach destination or chat-centric product. |
| League Workspace | A league is configured once and reused everywhere: scoring, roster slots, dates/timezone, matchup and playoff windows, acquisition rules, provider, roster, keepers, candidate lists, and sync/freshness state. Support multiple leagues in the schema; one active league is acceptable in the initial UI. |
| Identity | Guests receive immediate value. Durable cross-device saving and provider connections require a Cracked Ice profile. Yahoo is a connected provider, not the sole user identity. Do not bind long-lived provider tokens only to an anonymous browser-device id. |
| League format | **Points leagues first.** Category optimization is explicitly deferred; preserve extensible scoring contracts but do not delay the points experience or imply category support exists. Schedule tools remain format-agnostic. |
| Keepers | Keepers are first-class pre-draft roster members. The optimizer must account for protected players, occupied positions/slots, remaining draft needs, and roster/schedule fit when recommending draft targets. Full dynasty/prospect valuation remains later scope. |
| Draft strategy | Draft mode treats all compared players as draft candidates and ranks transparent production, regular-season schedule, fantasy-playoff schedule, and positional-value components. Strategy presets and custom weights are saved per League Workspace; playoff emphasis must always expose its regular-season tradeoff. |
| Acquisition analysis | Recommend add/drop pairs, not isolated adds. Candidate availability carries provenance: live provider, screenshot-confirmed, user-confirmed, imported snapshot, or unknown. Never label an unknown player as available. |
| Screenshot import | Screenshots of platform free-agent results are a first-class, provider-neutral way to build a current candidate list. Extracted player matches and timestamp may be saved; source images are transient and deleted after processing by default. |
| Provider priority | Yahoo first. Fantrax is the first assisted non-OAuth platform. ESPN follows the generic screenshot/paste workflow until a supported integration path exists. Do not request platform passwords or session cookies. |
| Yahoo writes | Yahoo read/import/sync ships before write. Lineup writes are planned as a separate beta with before/after preview, eligibility/lock validation, explicit confirmation, audit history, and read-after-write verification. No silent/background execution. Transactions remain a later separate decision. |
| Monetization | **None in 2026.** No paywall, no pro gating. Buy-me-a-coffee link stays. Decision revisited for 2027-28 with a season of analytics. |
| My Team delivery | Build the reliable desktop core first, but retain a useful mobile read/review and candidate-import path. Do not call the product complete while serious users cannot inspect their roster. |
| Yahoo OAuth | No longer conditional on three weeks of studio analytics. Implement after the League Workspace and My Team schemas are reliable. Begin read-only; add lineup writes only through WP13's separate approval and safety gate. |

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

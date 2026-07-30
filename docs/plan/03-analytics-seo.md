# WP3 — Analytics + SEO baseline

**Goal**: stop flying blind; make the site legible to search engines and social unfurls.
**Depends on**: WP1 (WP4 supplies the final favicon/OG image — use placeholders until then).
**Size**: 1–2 days. **Branch**: `wp3-analytics-seo`.

## 1. Analytics (GA4 — free tier per decisions)

- **Owner task complete (2026-07-29)**: GA4 property and production web stream created for
  `https://www.crackedicehockey.com`.
- Load gtag centrally after the application hydrates; respect Do Not Track; no cookie banner needed
  beyond GA4 defaults (US-focused hobby site; revisit if EU traffic grows).
- Create `web/src/lib/analytics.ts` with a typed `track(event, params)` wrapper. NO direct
  `gtag` calls from components.
- Instrument these events (names are final; agents must not invent variants):
  - `complement_run` {mode: 'complement'|'roster-aware', anchors: n}
  - `team_locked` {team}
  - `pairing_shared` {format: 'png'} (WP5)
  - `schedule_week_view` {week}
  - `season_view` (WP7)
  - `player_comparison_completed` {mode, window, projection_source}
  - `roster_created` {source: 'manual'|'ocr'} (studio)
  - `roster_shared` {mode: 'roster'|'tonight', result: 'shared'|'downloaded'}
  - `league_settings_saved` {platform, scoring_profile, team_count}
  - `account_sign_in` {method: 'magic_link'}
  - `workspace_sync_completed` {source}
  - `draft_board_action` {action, position}
  - `article_tool_click` {article_id, destination}
  - `outbound_coffee` (buy-me-a-coffee click)

GA4 Enhanced Measurement owns `page_view`, including React Router history changes. Do not also
emit manual `page_view` events unless the stream's **Page changes based on browser history events**
setting is disabled first; otherwise GA4 records duplicate views.

For owner QA, append `?ga_debug=1` to a route. The centralized wrapper adds GA4's `debug_mode`
parameter to configuration and custom events without persisting the flag or collecting extra data.

## 2. SEO / meta baseline

`web/index.html` currently has ONLY `<title>Off-Night Optimizer</title>`. Add:

- `<title>Cracked Ice Hockey — Fantasy Hockey Schedule Tools</title>` (per-route titles via a
  small `useDocumentTitle` hook on each page).
- Meta description (~150 chars: the games-played edge pitch), canonical URL,
  `og:title/description/image/url`, `twitter:card=summary_large_image`.
- OG image: 1200×630 placeholder now; replaced by WP4 brand asset.
- Favicon: placeholder from existing puck.png now; replaced by WP4 SVG.

## 3. Crawlability

- `web/public/robots.txt` (allow all; sitemap pointer).
- `web/public/sitemap.xml` generated at build time (small Vite plugin or a `scripts/gen-sitemap.mjs`
  run in `build.sh`): `/`, `/season` (or current routes pre-WP6), `/blog`, each blog article URL.
- Note: full blog prerendering is WP9. This WP only guarantees the shell metadata is correct.
- Register the sitemap in Google Search Console — **owner task**; agent prepares the file and
  writes one-paragraph instructions in the PR.

## Acceptance criteria

- [ ] GA4 shows real-time events from a preview deploy for at least `complement_run` and `schedule_week_view`.
- [ ] `curl` of the deployed homepage HTML contains title, description, OG tags, favicon link.
- [ ] Sharing the URL in a Slack/Discord/X preview renders name + description + image.
- [ ] `robots.txt` and `sitemap.xml` served with correct content types.
- [x] Zero direct `gtag(` calls outside `web/src/lib/analytics.ts`.

## Verification

Deploy preview → open GA4 DebugView → click through the site and confirm each instrumented
event fires exactly once per action.

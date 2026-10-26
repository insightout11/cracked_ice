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

For owner QA, append `?ga_debug=1` to any route. Debug mode remains active for that browser tab's
session while navigating around the app, without persisting to the account or collecting extra data.
The explicit QA flag overrides browser Do Not Track only for that tab session; normal visits continue
to respect Do Not Track. Append `?ga_debug=0` to turn debug mode off explicitly.

### Measurement correction (local implementation, 2026-10-26)

Existing event names remain unchanged. For all existing events with a typed `source`
context (season view, roster import, workspace sync and roster cards), the analytics
wrapper sends that value as **`event_origin`**, never acquisition `source`.
This prevents internal values such as `account_cache_refresh` from being attributed
as traffic origins. Historical attribution is not rewritten.

`article_tool_click` now covers article-body links and footer buttons, with
`placement: 'body' | 'footer'`. Destinations include optimizer, compare, season,
team, draft and card. Article links keep their original hrefs, dates and navigation.

Additional funnel events (approved measurement work):

| Event | Meaning | Parameters |
| --- | --- | --- |
| `setup_started` | First paste/read, screenshot selection or manual setup action in an attempt | `import_method`, `setup_mode: initial | refresh` |
| `setup_completed` | A user-started attempt reaches usable roster readiness and configured scoring | `setup_mode`, `platform`, `roster_size` |
| `weekly_plan_viewed` | A successfully calculated weekly add/hold summary is at least 25% visible in a foreground tab | `week`, `surface: home | team`, `plan_mode: personalized | demo`, `roster_size`, `recommended_adds`, `recommendation: add | hold | limit-reached` |
| `weekly_plan_action` | User inspects a plan player, marks a candidate taken, or changes the finder range | `week`, `plan_mode`, `action: inspect_player | mark_taken | change_range` |

Plan impressions are once per browser tab session, league, matchup week, surface and
mode. Home and My Team may each record an impression; use GA **users**, not event
totals, for reach. No-result/hold plans count when successfully calculated. Loading,
errors and incomplete rosters do not count as personalized impressions. A source
refresh/rerender does not count as another impression. Loading a saved account is
not setup completion. Setup attempts are kept in memory; a full reload interrupts
that attempt's completion measurement. The automatic two-paste and manual setup
paths are covered; roster-card saves/provider sync are not counted as imports.

No league IDs, user IDs, player IDs/names, roster contents, pasted text or estimated
points are included in the new event payloads. Actions are **not** confirmed Yahoo
transactions or evidence that a recommendation was followed.

Collection and QA:

- Only production builds on `crackedicehockey.com` or `www.crackedicehockey.com`
  load the Google tag. Localhost and preview deployments collect nothing by default.
- On localhost/preview, `?ga_debug=1` queues events in `window.dataLayer` for local
  inspection without loading the Google tag or sending requests to Google.
- On production, debug config/events carry `debug_mode: true` and
  `traffic_type: internal`. Changing debug state does not emit an extra page view.
- Owner opt-out: `?analytics=off` persists on that browser/origin and disables
  custom events and the already-loaded tag. `?analytics=on` restores collection.
  Explicit owner exclusion takes precedence over debug mode. This is opt-in;
  the app cannot infer that an ordinary visitor is the owner.
- No GA property, key-event, filter or connector settings are changed by this code.
  Internal debug labeling alone is not an active GA report exclusion filter.

After a separately approved deployment, validate the events in DebugView and
prepare a GA funnel using `setup_mode=initial` and `plan_mode=personalized`.
Measure week-to-week return by the same GA user having `weekly_plan_viewed` in
consecutive matchup weeks. Do not use the site's broad returning-user percentage
as this cohort-retention rate. No custom cross-device identity is added.

For future Reddit links use `utm_source=reddit&utm_medium=social` and a stable
weekly campaign such as `utm_campaign=week-5-edge`. Use `utm_content=article` or
`utm_content=schedule` to distinguish destinations. No existing published links
or drafts are altered by this implementation.

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

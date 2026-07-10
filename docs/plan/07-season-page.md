# WP7 — Season page: Schedule + Game Analysis merge, answer bar

**Goal**: one page, one mental model — "the NHL schedule at two zoom levels" — that answers
questions instead of displaying data.
**Depends on**: WP2 (derived data), WP4 (primitives), WP6 (route). **Size**: 4–5 days.
**Branch**: `wp7-season-page`.

## 1. Structure

`/season` (new `web/src/pages/SeasonPage.tsx`) with a **Week ↔ Season** toggle
(`?view=week|season`, week default):

- **Week view** = current `SchedulePage.tsx` content: `ScoreboardBanner` week nav +
  `WeeklyScheduleGrid` + player heat-map toggle. Restyled with primitives; behavior kept.
- **Season view** = current `GameAnalysisPage.tsx` content (off-nights + back-to-backs),
  reworked per §3.
- Delete `GameAnalysisPage.tsx` and the `/game-analysis` route after merge (redirect from WP6).

## 2. Answer bar (week view) — the personalization bridge

Above the grid, one `Card`:

- **With a roster** (localStorage user has coach roster data): "This week: you're idle
  **Wed & Fri** · best fills: **ANA** (3 games, covers both), **SJS** (2)." Computed from the
  existing-but-buried logic in `SchedulePage.tsx` (`calculateDayConflicts`,
  `calculateStreamingValues`) — promote these from subtle overlays to the headline.
- **Without a roster**: "See your team's gap nights → **Set up your roster**" (links to coach/
  studio flow). This is the studio's public on-ramp.
- Fix: the page currently calls `getCoachRoster()` for every visitor and logs an error for
  most. Gate the call on a local flag (`hasRoster` in localStorage) so anonymous visitors make
  zero coach API calls.

## 3. Season view output upgrade

- Lead with a **podium strip**: "Most off-nights ({window label}): NSH 31 · UTA 30 · CHI 29"
  and the back-to-backs equivalent — `Badge`/stat-tile primitives, not a table.
- Below: the full sortable `DataTable` (dark primitive) with delta-vs-league-average column
  (average from `data/derived.json`). Emoji sort icons → lucide chevrons; remove `as any` sort access.
- Keep TimeWindow + playoff-mode support; keep tier coloring.
- Season-average for week intensity: read precomputed value from `data/derived.json` (WP2)
  instead of client-side `calculateSeasonAverage()`; delete the localStorage cache
  (`SEASON_AVERAGE_CACHE_KEY` logic) entirely.

## 4. Shareability (small, high leverage)

"Copy as image" button on the season podium + weekly grid (reuse WP5's `shareImage.ts`) —
these are exactly the artifacts WP9's weekly posts embed.

## Acceptance criteria

- [ ] `/season` renders week view by default; toggle switches views; URL param deep-links work.
- [ ] Week + season numbers match the old pages exactly for identical windows (spot-check 3 teams).
- [ ] Anonymous visitor: zero coach API requests, no console errors, sees the roster CTA.
- [ ] Roster-holding visitor: answer bar shows correct idle nights (verify by hand against the grid).
- [ ] Old pages deleted; redirects live; no dead imports (`GameAnalysisPage`, season-average cache code).
- [ ] `schedule_week_view` and `season_view` events fire.

## Verification

Manual: both views at desktop + 390px; simulate roster/no-roster states (seed/clear
localStorage); compare off-night totals against `/api/offnights` raw output.

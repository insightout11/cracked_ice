# WP7 — Season page: Schedule + Game Analysis merge, answer bar

**Goal**: one page, one mental model — "the NHL schedule at two zoom levels" — that answers
questions instead of displaying data.
**Depends on**: WP2 (derived data), WP4 (primitives), WP6 (route). **Size**: 4–5 days.
**Branch**: `wp7-season-page`.

## 1. Structure

`/season` (new `web/src/pages/SeasonPage.tsx`) with a **Week ↔ Season** toggle
(`?view=week|season`, week default):

- **Week view** = current `SchedulePage.tsx` content: `ScoreboardBanner` week nav +
  `WeeklyScheduleGrid` + player heat-map toggle. Preserve the underlying schedule behavior and
  calculations, but redesign the grid for information density per §2.
- **Season view** = current `GameAnalysisPage.tsx` content (off-nights + back-to-backs),
  reworked per §4.
- Delete `GameAnalysisPage.tsx` and the `/game-analysis` route after merge (redirect from WP6).

## 2. Week-view density redesign

The current desktop grid shows only ~6 teams at 1440px because rows, empty day cells, and the
Total/Strength column are substantially taller than their content. The WP4 dark-theme pass does
not solve this product-layout problem. Redesign `WeeklyScheduleGrid` for fast league-wide scanning:

- Compact is the default desktop density: target ~56–64px rows and at least 12–14 teams visible
  in a 1440px viewport without reducing text below a comfortably readable size.
- Game chips size to their matchup content instead of determining the cell size. Empty dates use
  a quiet compact marker; off-night and back-to-back states must not tint oversized rectangles.
- Compress the per-team Total/Strength summary into one compact row or similarly space-efficient
  treatment. Preserve all existing totals, schedule-strength information, and tooltips.
- Keep the weekday header and team-identity column sticky while scrolling the full league.
- If a density control is retained, offer Compact and Comfortable, with Compact as the default.
- Mobile gets a purpose-built compact presentation; do not shrink or horizontally squeeze the
  desktop grid. Preserve access to matchup, off-night, back-to-back, and weekly-total details.
- Validate that all 32 teams can be scanned quickly and that logos, chips, and hit targets remain
  visually balanced at both supported widths.

## 3. Answer bar (week view) — the personalization bridge

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

## 4. Season view output upgrade

- Lead with a **podium strip**: "Most off-nights ({window label}): NSH 31 · UTA 30 · CHI 29"
  and the back-to-backs equivalent — `Badge`/stat-tile primitives, not a table.
- Below: the full sortable `DataTable` (dark primitive) with delta-vs-league-average column
  (average from `data/derived.json`). Emoji sort icons → lucide chevrons; remove `as any` sort access.
- Keep TimeWindow + playoff-mode support; keep tier coloring.
- Season-average for week intensity: read precomputed value from `data/derived.json` (WP2)
  instead of client-side `calculateSeasonAverage()`; delete the localStorage cache
  (`SEASON_AVERAGE_CACHE_KEY` logic) entirely.

## 5. Shareability (small, high leverage)

"Copy as image" button on the season podium + weekly grid (reuse WP5's `shareImage.ts`) —
these are exactly the artifacts WP9's weekly posts embed.

## Acceptance criteria

- [ ] `/season` renders week view by default; toggle switches views; URL param deep-links work.
- [ ] At 1440px, the default week grid shows at least 12–14 complete team rows; game chips no
      longer inflate day cells, and all 32 teams remain readable and quickly scannable.
- [ ] At 390px, the week schedule uses its purpose-built mobile presentation with no clipped
      matchup, off-night, back-to-back, or weekly-total information.
- [ ] Week + season numbers match the old pages exactly for identical windows (spot-check 3 teams).
- [ ] Anonymous visitor: zero coach API requests, no console errors, sees the roster CTA.
- [ ] Roster-holding visitor: answer bar shows correct idle nights (verify by hand against the grid).
- [ ] Old pages deleted; redirects live; no dead imports (`GameAnalysisPage`, season-average cache code).
- [ ] `schedule_week_view` and `season_view` events fire.

## Verification

Manual: both views at desktop + 390px; capture the top viewport and full-league scan at each
width; verify the 12–14-row desktop density target; simulate roster/no-roster states (seed/clear
localStorage); compare off-night totals against `/api/offnights` raw output.

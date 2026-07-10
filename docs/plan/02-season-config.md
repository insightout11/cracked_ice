# WP2 — Season config, 2026-27 rollover, data sanity gate

**Goal**: the season becomes a single config value; the pipeline hydrates 2026-27 data
nightly again; implausible data fails the pipeline instead of reaching users.
**Depends on**: WP1. **Size**: 2–3 days. **Branch**: `wp2-season-config`.
**Urgency**: the NHL 2026-27 schedule is released mid-July — run this WP as soon as WP1 merges.

## 1. Create the single source of truth

`config/season.json` (root):

```json
{
  "seasonId": "20262027",
  "label": "2026-27",
  "regularSeasonStart": "2026-10-07",
  "regularSeasonEnd": "2027-04-15",
  "defaultFantasyPlayoffsStart": "2027-03-01",
  "scheduleFile": "schedules-20262027.json"
}
```

Fill real dates from the released NHL schedule (verify via the NHL API used by
`apps/api/scripts/hydrate.ts`; if the schedule is not yet published, this WP blocks — notify owner).

Consumers to create:
- `api/_lib/season.ts` — reads the JSON, exports typed constants for serverless functions.
- `web/src/lib/season.ts` — same for the frontend (import the JSON directly; Vite supports it).
- `server/src/config/season.ts` — same for the coach backend.

## 2. Replace every hardcoded season reference

Grep targets (verified to exist): `20252026`, `2025-10-01`, `2026-04-30`, `2025-26`,
`schedules-20252026`, `April 20`, `April 30`.

Known locations (not exhaustive — grep the whole repo):
- `api/complement.ts`, `api/added-starts.ts`, `api/added-starts-bulk.ts`, `api/backtobacks.ts`,
  `api/offnights.ts`, `api/health.ts` — schedule filename + default start/end dates.
- `.github/workflows/hydrate.yml` — `STATS_SEASON: "20252026"` env.
- `web/src/components/CoachAssistant.tsx` `computeWindow()` — `rest-of-season` hardcodes `2026-04-30`.
- `web/src/pages/SchedulePage.tsx` — `SEASON_AVERAGE_CACHE_KEY = 'schedule-season-average-2025-26'`
  (derive the key from `seasonId` so caches self-invalidate on rollover).
- `web/src/components/ScoreboardBanner.tsx` — week-range options comment/logic ("season ends April 20").
- `web/src/lib/timeWindow.ts` and `web/src/lib/playoffCalculations.ts` — check for season bounds.
- `apps/api/scripts/hydrate.ts`, `calculate-team-stats.mjs` — season parameters.

## 3. Data sanity gate (codifies DATA_WARNING.md)

Add a validation step to the hydrate pipeline (`apps/api/scripts/validate-schedule.mjs`,
invoked by `hydrate.mjs` after fetch, before the atomic dir swap):

- Every team has 78–84 scheduled games.
- Pairwise overlap sanity: for 20 random team pairs, shared game-nights must be > 0 and < 60.
- Off-night share across teams must vary (fail if any team is exactly 100% or all values identical).
- Dates fall within `regularSeasonStart..regularSeasonEnd`.

Non-zero exit fails the GitHub Action → no commit of bad data. Also update `DATA_WARNING.md`
to reference the validator.

## 4. Re-enable and de-triple the pipeline

- Update `hydrate.yml`: npm (from WP1), `STATS_SEASON` from `config/season.json`
  (read it in a step, don't duplicate the value).
- Reduce triple-write: runtime reads root `data/` (per WP1 map). Keep `apps/api/cache/` as the
  pipeline's working dir, copy once to `data/`, and stop writing `apps/api/data-cache/` if
  nothing reads it (verify via WP1 runtime map first).
- Trigger `workflow_dispatch` manually once; confirm a green run commits 2026-27 data.
- Precompute extras for later WPs while in here: weekly league game-count averages
  (consumed by Season page, replaces client-side `calculateSeasonAverage`) and positional
  FPPG averages (consumed by WP5 verdict card) → `data/derived.json`.

## 5. Freshness surfacing

`api/health.ts` should report `seasonId`, hydrate timestamp (from the manifest), and team
count. The existing `DataFreshnessIndicator` component should read it; footer shows
"Data updated nightly · last: {date}".

## Acceptance criteria

- [ ] `git grep -E "20252026|2025-10-01|2026-04-30"` returns matches only in `docs/`, git history, or archived data files.
- [ ] Manual `workflow_dispatch` hydrate run: green, commits 2026-27 schedule + stats, validator passed.
- [ ] Sabotage test: point the validator at a synthetically broken schedule (script a fixture) and confirm the pipeline fails.
- [ ] `/api/complement?seedTeamCode=EDM` returns 2026-27 dates on a preview deploy.
- [ ] `/api/health` reports season + freshness; footer indicator renders it.
- [ ] Rolling to 2027-28 would require editing exactly one file (`config/season.json`) — document this in the root README.

## Verification

Run the Draft Helper end-to-end on a preview deploy against 2026-27 data; sanity-check one
known pairing by hand against the published NHL schedule (pick 2 teams, count a week's games).

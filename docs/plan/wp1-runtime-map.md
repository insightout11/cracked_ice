# WP1 runtime map (verified 2026-07-10, wp1-consolidation branch)

What production actually executes and reads. Basis for the Phase 2 deletions.

## Frontend → API calls

All prod calls go to `/api/*` (`web/src/services/api.ts:getBaseURL`; localhost dev uses
`http://localhost:8080/api`).

| Endpoint | Served by |
|---|---|
| `/api/teams`, `/api/complement`, `/api/added-starts`, `/api/added-starts-bulk`, `/api/offnights`, `/api/backtobacks`, `/api/team-tiers`, `/api/health` | root `api/*.ts` Vercel functions |
| `/api/coach/**` (status, roster, free-agents, settings, projections, recommend, conflicts, chat, uploads, players search, position-overrides, compare-swap, smart-suggestions, player-schedule) | `vercel.json` rewrite → `api/simple-test.ts` → Express app from `server/dist` (`server/src/routes/coach.ts`, `coach-chat.ts`) |
| static `GET /schedules-20252026.json` | `web/public/schedules-20252026.json` — the client-side week grid loads this directly (`web/src/lib/schedule.ts:254`). **Season-hardcoded static file; add to WP2 scope.** |

`web/src/lib/coachApi.ts` (secondary fetch wrapper, `VITE_API_URL`) is live — used by
GlobalErrorToast, GlobalLoadingBar, LeaguePresetBar, WeightsDrawer.

`/schedule-v2` route + `ScheduleV2.tsx` are reachable from the router (not nav-linked).
Removal deferred to WP6 per plan.

## Server data reads (fallback chains, first hit wins)

`server/src/context/{schedules,stats,teamStats,players}.ts` try, in order, paths under:
`apps/api/cache/` → `apps/api/data-cache/` → root `data/` → `server/data/`.
Therefore **`apps/api/cache/`, `apps/api/data-cache/`, root `data/`, `server/data/` are all
live runtime data directories.** Do not delete. (De-duplication is WP2 §4.)

Root `api/*.ts` functions read only root `data/` (e.g. `data/schedules-20252026.json`).

## apps/api: live vs dead

**Live (hydrate pipeline, invoked by `.github/workflows/hydrate.yml`):**
- `scripts/hydrate.mjs` → `scripts/hydrate.ts` (imports `src/services/stats_provider.ts`,
  `src/services/providers/nhl_api_web.ts`, `src/services/providers/nhl_stats_rest.ts`, and
  cross-project `server/src/context/schedules.js` via tsx)
- `scripts/manifest.mjs`, `scripts/calculate-team-stats.mjs` (self-contained)
- `scripts/test-*.mjs`, `scripts/hydrate-team-stats.mjs`, `fetch-*.mjs`, `find-aho.mjs`,
  `print-cache-state.mjs` — manual utility scripts, kept
- `src/data/` (players.json is updated by hydrate and copied to `data/`; fixtures used by
  `ALLOW_FIXTURE_FALLBACK`)
- `cache/`, `data-cache/` (runtime data, see above)

**Dead (nothing imports them outside themselves/their tests):**
- `src/server.ts`, `src/routes/` (coach.streamers.post, players.get, schedule.get, health.get)
- MVP streamers engine: `src/services/{rank,simulate,loaders,badges,logger}.ts`
- `src/services/{resolve,schedule,stats,alias_resolver}.ts` (imported only by dead routes/engine)
- `src/lib/`, `src/models/`, `src/config/`, `src/types/` — verify per-file at deletion time
  (keep anything the providers/stats_provider chain types depend on)
- `scripts/dump-golden.ts`, `scripts/update-golden.ts` (import dead `rank.ts`)
- `tests/{rank,simulate,golden.streamers,alias_resolver,schedule.enrichment}.test.ts` + golden JSONs
- `apps/api/dist/` build output — `npm start` is the only consumer and nothing runs it.
  **`build.sh` therefore does not need the apps/api build step** (hydrate runs via tsx in CI,
  not in Vercel builds).

## Deployment build (`build.sh`)

Needs: root npm install (for `api/` function deps), `server` build (produces `server/dist`
loaded by the coach entrypoint), `web` build. Does NOT need: `apps/api` build (dead dist).

## Corrections to prior audit assumptions

- The nightly hydrate never stopped — it runs daily (local clone was stale). It is pinned to
  season 20252026.
- `web/public/schedules-*.json` is an additional season-data location not previously listed
  in WP2; added above.

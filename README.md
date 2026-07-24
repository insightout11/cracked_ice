# Cracked Ice Hockey

Fantasy hockey schedule tools — [crackedicehockey.com](https://crackedicehockey.com).
Find the schedule edges your league ignores: complementary team pairs (extra usable starts),
off-night analysis, back-to-back tracking, and a roster studio with add/drop recommendations.

## Repository layout

| Path | What it is |
|---|---|
| `web/` | The deployed frontend (Vite + React SPA). |
| `api/` | Vercel serverless functions (`/api/*`): complement, added-starts, offnights, backtobacks, teams, team-tiers, health. Shared helpers in `api/_lib/`. `api/coach.ts` boots the coach backend. |
| `server/` | Express coach backend (roster, projections, recommendations, OCR). Built to `server/dist`, loaded by `api/coach.ts` via the `/api/coach/:path*` rewrite. |
| `apps/api/` | Data hydrate pipeline only (scripts + NHL API providers + cached data). No runtime server. |
| `config/season.json` | **Single source of truth for the season.** Season id, dates, games-per-team, schedule filename. See "Rolling over to a new season" below. |
| `data/` | Generated NHL data (schedule, stats, players, `derived.json`) committed nightly by the hydrate workflow. **Never hand-edit** — see `DATA_WARNING.md`. |
| `docs/plan/` | The relaunch implementation plan (start at `docs/plan/README.md`). |

## Development

```bash
npm install                # root deps (used by api functions at runtime)
npm run dev                # web frontend on :3000 (Vite)
npm run dev:server         # coach backend on :8080 (frontend calls it directly on localhost)
npm test                   # web unit tests (vitest)
npm run build              # full production build (bash build.sh)
```

## Deployment

Vercel. `vercel.json` runs `build.sh` (builds `server/` then `web/`), serves `web/dist`,
deploys `api/*.ts` as serverless functions, and rewrites `/api/coach/:path*` to `api/coach.ts`.

Required production env vars: `REDIS_URL` (user data persistence; Upstash), `OPENAI_API_KEY`
(roster screenshot OCR). `VITE_COACH_USER_ID` must NOT be set in production builds.

## Data pipeline

`.github/workflows/hydrate.yml` runs nightly: reads the season from `config/season.json`,
validates the schedule (`apps/api/scripts/validate-schedule.mjs` — fails the run on implausible
data), fetches NHL stats via `apps/api/scripts/hydrate.ts`, writes to `apps/api/cache/` +
`apps/api/data-cache/`, copies to `data/`, precomputes `data/derived.json`
(`apps/api/scripts/build-derived.mjs`), and commits.

## Rolling over to a new season

The season lives in exactly one file: **`config/season.json`**. To roll over (e.g. to
2027-28):

1. Fetch the new schedule: `node scripts/fetch-all-schedules.js` (reads the season id from
   `config/season.json`, so bump that first), which writes `data/schedules-<seasonId>.json`.
   Copy it to `server/data/` and `web/public/` as well.
2. Edit `config/season.json`: `seasonId`, `label`, `regularSeasonStart`, `regularSeasonEnd`,
   `gamesPerTeam`, `defaultFantasyPlayoffsStart`, `scheduleFile`.
3. Run `node apps/api/scripts/validate-schedule.mjs` to confirm the data is sane.

Every consumer — the serverless API functions, the frontend, the coach backend, and the
hydrate pipeline — reads from `config/season.json`. No other file hardcodes the season.

## History

Started as the "Off-Night Optimizer" (a viral Reddit tool for picking complementary center
pairs), grew into a full fantasy hockey studio. Relaunching for the 2026-27 season —
roadmap and work packages in `docs/plan/`.

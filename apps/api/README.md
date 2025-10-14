# Cracked Ice API (Dev Only)

**Staging-only API** that powers the Cracked Ice Hockey AI Coach MVP. It ingests mock league fixtures, simulates lineup starts for a requested window, and ranks single-move streamer recommendations without calling live NHL services.

## Quick Start

```powershell
cd apps/api
pnpm install
pnpm hydrate   # refresh cache/stats.json + cache/schedule.json
pnpm dev       # starts the API on http://localhost:3000
```

> The process exits if `NEXT_PUBLIC_ENV !== "staging"` or `DISABLE_PROD !== "true"` so keep the defaults in your `.env` file.

## Environment

Create `apps/api/.env` (the tests fall back to `demo` fixtures if the file is missing):

```
PORT=3000
NEXT_PUBLIC_ENV=staging
DISABLE_PROD=true
ALLOW_ORIGIN=http://localhost:3000
FEATURE_OCR=false
FEATURE_MULTI_MOVE=false
FEATURE_CUSTOM_SCORING=false
NHL_STATS_BASE=https://statsapi.web.nhl.com
HYDRATE_TIMEOUT_MS=20000
```

All routes require the request header `x-user-id`. The sample fixtures only support `demo` out of the box.

## API Surface

### `POST /api/coach/streamers`

Request body:

```json
{
  "window": { "start": "2025-10-13", "end": "2025-10-20" }
}
```

Response body:

```json
{
  "baseline_points": 19.15,
  "recommendations": [
    {
      "player": { "id": "nhl:8479343", "name": "Robert Thomas", "team": "STL", "pos": ["C"] },
      "deltaPoints": 5.71,
      "deltaGp": 2,
      "bestDrop": { "player": { "id": "nhl:8480801", "name": "Alexis Lafreniere", "team": "NYR", "pos": ["LW", "RW"] }, "lostPoints": 1.61 },
      "badges": ["Cyan", "PP1"]
    }
  ],
  "meta": { "reqId": "uuid", "durationMs": 215 }
}
```

Error codes:
- `400` invalid or unsorted window payload
- `401` missing `x-user-id`
- `422` missing league/roster/fa fixtures for the supplied user (response includes `how_to_fix`)
- `429` recommendation loop exceeded the 1s CPU budget

### `GET /api/players/:id`
Returns the canonical player card plus cached stat bundle (season/last30/last7/blended).

### `GET /api/schedule/:team`
Returns the cached schedule for the given team with the off-night flag per date.

### `GET /api/health`
Returns `{ "ok": true }` when the service is accepting requests.

## Local Smoke

```powershell
curl -H "x-user-id: demo" `
     -H "Content-Type: application/json" `
     -d '{"window":{"start":"2025-10-13","end":"2025-10-20"}}' `
     http://localhost:3000/api/coach/streamers
```

## Testing

```powershell
pnpm test          # unit + golden snapshot guard
pnpm tsx scripts/update-golden.ts  # refresh snapshot after intentional changes
```

Vitest covers the lineup filler (dual eligibility, UTIL fallback), the ranking pipeline (caps, badge wiring, sort order), alias resolution (fuzzy initials + logging of misses), and an end-to-end snapshot of the streamer output.

## Implementation Notes

- `pnpm hydrate` populates `cache/stats.json` and `cache/schedule.json` (currently derived from the fixtures in `src/data/fixtures` but ready for nightly jobs).
- Nightly hydrator pulls season + recent splits from `NHL_STATS_BASE`, writing to `cache/stats.json` atomically so the request path stays cache-only.
- If `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_CACHE_BUCKET` are provided, hydrated cache files are uploaded to Supabase storage for downstream consumers.
- Request handlers and services read from the cache directory first; they fall back to the bundled samples if you haven't hydrated yet.
- Alias resolver logs unrecognized names to `apps/api/logs/aliases_pending.csv` so you can backfill `src/data/aliases.json` as new OCR edge-cases appear.
- `apps/api/logs/coach_requests.log` receives one JSON line per call with request timing, pool sizes, and a timeout flag if the guard trips.
- Free-agent candidates are capped at 30; drop pool at 8; we return the top 5 recommendations by projected delta points.
- Feature flags (`FEATURE_OCR`, `FEATURE_MULTI_MOVE`, `FEATURE_CUSTOM_SCORING`) must remain `false` in the MVP build.

## Future Hooks

- nightly cache job to fetch live NHL data and hydrate `cache/*.json`
- alias review queue for the resolver (`src/services/resolve.ts`)
- weekly/UTIL lineup rules for non-daily leagues

## Supabase Cache Sync (local)

To test the Supabase-backed cache bootstrap locally, run the API directly with the flag enabled:

```powershell
cd apps/api
BOOT_SYNC_CACHE=true npx tsx src/server.ts
```

Example logs:
- Success: `[boot] Pulled latest cache from Supabase (ts=2025-10-14T09:00:00.123Z, stats=512.8 KB, schedule=78.3 KB)`
- Skip (no credentials or flag disabled): `[boot] Using local cache (no Supabase env)`

Required `.env` entries: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_CACHE_BUCKET`, and `BOOT_SYNC_CACHE=true`. This boot sync path only executes inside your local Node process and does not alter the Vercel build or production deployment.




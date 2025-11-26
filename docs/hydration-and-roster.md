# Nightly Hydration & Manual Roster Integration

This guide explains how to keep the AI Coach data fresh and how to build custom user contexts manually.

## 1. Refresh schedules + stats nightly

Run the hydrator from the repo root (or from `apps/api`) once per day. Use a cron/Task Scheduler job in production.

```powershell
pnpm install    # first run only
pnpm hydrate
```

What happens:

- `apps/api/cache/schedule.json` & `apps/api/cache/stats.json` are rewritten with the latest NHL data.
- If `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_CACHE_BUCKET` are present, both files are uploaded and `cache/v1/latest.json` is updated.

### Point the Express server at the refreshed cache

The server automatically searches for the cache in:

1. `apps/api/cache/schedule.json` & `stats.json` (preferred)
2. `cache/*.json`
3. `server/data/*.json`

If you want a single source of truth, copy the cache into `server/data/` after each hydrate:

```powershell
Copy-Item apps/api/cache/schedule.json server/data/schedules-20252026.json
Copy-Item apps/api/cache/stats.json server/data/stats.json
```

Restart `npm run dev` in `server/` to load the new context (or bounce the production process).

## 2. Player directory + search API

- Player metadata lives in `apps/api/src/data/players.json`. It is bundled with aliases and refreshed alongside the stats cache.
- The Express server now exposes `GET /api/players/search?q=NAME&limit=12`.
  - Response includes canonical id, aliases, team tri-code, and blended/season/last30/last7 FPPG.
  - The front-end `Player Lookup` panel (home page, right column) uses this endpoint for live typeahead when building rosters.

## 3. Manual roster contexts

1. Start from `server/data/coach/users/demo-user.json` as the template. The schema (validated by `UserContextSchema`) requires:
   - `league_profile`: scoring weights, lineup slots, optional notes.
   - `roster`: array of players with stats, upcoming games, and drop eligibility flags.
   - `free_agents`: candidates in the same shape.
2. Use the Player Lookup to pull canonical ids, aliases, and FPPG when assembling rosters.
3. Upload components individually (all JSON):

   ```bash
   # league settings
   curl -X PUT http://localhost:8080/api/coach/users/<user-id>/settings \
        -H "Content-Type: application/json" \
        -d @path/to/league_profile.json

   # roster (16 players)
   curl -X PUT http://localhost:8080/api/coach/users/<user-id>/roster \
        -H "Content-Type: application/json" \
        -d @path/to/roster.json

   # free agents (candidate pool)
   curl -X PUT http://localhost:8080/api/coach/users/<user-id>/free-agents \
        -H "Content-Type: application/json" \
        -d @path/to/free_agents.json
   ```

   The server writes to `server/data/coach/users/<user-id>/{settings,roster,free_agents}.json` and maintains a combined snapshot plus the legacy `<user-id>.json`.
4. You can still bulk upload a combined payload via `PUT /api/coach/users/<user-id>`; it will populate all three files.
5. Hit the coach endpoints with `x-user-id: <user-id>` to generate recommendations.
6. To inspect schedule congestion before streaming, call:

   ```bash
   curl "http://localhost:8080/api/coach/users/<user-id>/conflicts?start=2025-10-10&end=2025-10-16"
   ```

   The response lists starters, benched players, and unused lineup slots per day.

> Screenshot/OCR ingestion is stubbed in `server/src/services/ocr.ts`. Once a provider (ChatGPT, Groq, etc.) is chosen, wire it into the upload handler. Until then only `application/json` uploads are accepted.

## 4. Health checks

- Cache timestamps are logged on server boot.
- The player search endpoint returns `meta.generatedAt` so the UI can warn if data is stale.
- Future improvement: expose `/api/cache/status` summarizing schedule/stats last refresh.

# Hydration Workflow

## Modes

- **Live (default):** `DISABLE_LIVE_STATS=false`. The hydrator pulls the NHL APIs and writes real data into `apps/api/data-cache/`.
- **Fixture / offline:** set `DISABLE_LIVE_STATS=true` when running `pnpm -C apps/api hydrate`. The script skips the live providers, seeds the cache from the bundled fixtures, and drops a `.fixture` marker so CI and tooling know the run was synthetic.

Use `ALLOW_FIXTURE_FALLBACK=true` in CI only when you intentionally want to allow fixture commits; otherwise live failures cause the workflow to fail.

## Commands

```bash
pnpm -C apps/api hydrate          # schedules + player stats
pnpm -C apps/api hydrate:teams    # normalized team metrics
pnpm -C apps/api manifest         # rebuild data-cache/manifest.json
pnpm -C apps/api show:cache       # print the active cache paths + timestamps
```

`hydrate` shells into `scripts/hydrate.mjs`, which stages files in `apps/api/data-cache_tmp/` and then atomically renames the folder back to `apps/api/data-cache/`. `show:cache` is a utility that reports the absolute paths, file sizes, and the manifest `generatedAt` so you can confirm the cache you are about to serve.

## Runtime behaviour

All API loaders read JSON directly from `apps/api/data-cache/` via the helpers in `src/lib/cache.ts`. The `/health` endpoint now exposes the path(s) and file metadata:

```json
{
  "ok": true,
  "dataCache": {
    "loaded": true,
    "version": "1731024000000",
    "generatedAt": "2025-11-07T05:38:29.231Z",
    "sourcePaths": ["/abs/path/to/apps/api/data-cache"],
    "files": {
      "stats": { "exists": true, "bytes": 602380, "mtime": "2025-11-05T17:19:14.000Z" },
      "schedule": { "exists": true, ... }
    },
    "teamStats": {
      "loaded": true,
      "generatedAt": "2025-11-07T05:38:29.227Z"
    }
  }
}
```

If the manifest is missing you will see `loaded: false` and zero-byte file entries so that the UI (and CI) can alert you before stale data ships.

## Team Stats Cache

Refresh the team stats bundle with:

```bash
pnpm -C apps/api hydrate:teams
```

Set `TEAM_STATS_URL` (or `TEAM_STATS_SOURCE` for a local JSON file) before running. The script fetches the upstream payload, normalizes it, writes `team_stats.json`, and updates the manifest. The health endpoint reflects the file size + modified time so you can confirm downstream consumers see the new data.

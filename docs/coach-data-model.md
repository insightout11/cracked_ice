# Coach Data Model Updates (Design Draft)

## Goals
- Persist user league settings separately so they can be reused across uploads.
- Accept roster and free-agent payloads independently (JSON today, OCR later).
- Provide a conflict report highlighting benchings caused by schedule congestion.
- Keep backwards compatibility with existing combined user context file while we migrate.

## Storage Layout (per user)
```
server/data/coach/users/{userId}/
  settings.json          # League profile: scoring weights, lineup slots, metadata
  roster.json            # 16-player roster payload
  free_agents.json       # Candidate pool (from JSON or OCR translation)
  context.snapshot.json  # Optional merged file for debugging/backups
```

Each file follows a strict schema and is validated independently. `loadUserContext` will assemble the runtime structure by pulling the latest versions of all three files, falling back to the legacy `{userId}.json` if the directory doesnt exist yet.

## API Surface
| Method | Path | Purpose |
| --- | --- | --- |
| `PUT` | `/api/coach/users/:userId/settings` | Store `LeagueProfile` (scoring weights, lineup slots). |
| `PUT` | `/api/coach/users/:userId/roster` | Store roster players (16 objects with stats + upcoming games). |
| `PUT` | `/api/coach/users/:userId/free-agents` | Store candidate pool. Initially JSON only; future `multipart/form-data` invokes OCR. |
| `GET` | `/api/coach/users/:userId/conflicts?start=YYYY-MM-DD&end=YYYY-MM-DD` | Return lineup simulation summary: starters, bench counts, unused slots per day. |
| `POST` | `/api/coach/users/:userId/streamers` | (alias to existing `/coach/streamers`) run recommendations using stored settings + roster + free agents. |

> Existing `PUT /api/coach/users/:userId` remains for bulk uploads; it writes the combined JSON and updates `context.snapshot.json`.

## Conflict Report Payload
```json
{
  "window": { "start": "2025-10-10", "end": "2025-10-16" },
  "summary": {
    "totalBenchGp": 6,
    "totalStarts": 34,
    "lineupSlots": { "F": 3, "D": 2 }
  },
  "byDay": [
    {
      "date": "2025-10-10",
      "availableSlots": { "F": 3, "D": 2 },
      "starts": [ { "playerId": "connor-mcdavid", "position": "F" } ],
      "benched": [ { "playerId": "joe-pavelski", "position": "F" } ]
    }
  ],
  "benchCounts": {
    "connor-mcdavid": 0,
    "joe-pavelski": 1
  }
}
```

## OCR Integration Notes
- Endpoint accepts `multipart/form-data` with `image` + optional `provider` and `promptHints`.
- Server stores the raw image temporarily (e.g. under `server/data/uploads/{uuid}.png`).
- `parseRosterScreenshot` sends the image to the configured provider, normalizes the results (matching to `players.json` aliases), and returns structured player objects with `id`, `team`, inferred stats placeholders, and raw OCR text for auditing.
- Once parsed, the payload is persisted via the same JSON path as manual uploads.

## Migration Strategy
1. Implement new loaders/writers; keep old combined file flow working.
2. Update the front-end to use new endpoints (settings editor, roster builder, free-agent upload, conflict report panel).
3. Add instrumentation to warn when any required component is missing before users run the coach.
4. Once stable, deprecate the legacy single-file upload.

## Open Questions
- Should we persist OCR outputs along with confidence metrics for future review?
- Do we need versioning for nightly contexts (e.g., `settings.2025-10-28.json`)? For now, single latest copy is acceptable.
- Where should we surface conflict reports in the UI (inline with coach overlay vs. separate modal)?

# WP8 persistence map

Audited 2026-07-22 before the League Workspace migration.

| Existing owner | Existing storage | League Workspace destination |
|---|---|---|
| Time window | `off-night-time-window-mode`, `off-night-playoff-preset`, `off-night-playoff-custom-dates`, `off-night-league-weeks` | `schedule.defaultWindow`, `schedule.matchupWeekStart`, `schedule.playoffs` |
| Optimizer | `off-night-anchor-players`, `off-night-locked-teams`, `off-night-seed-team`, `off-night-show-all-teams`, `off-night-daily-slots`, `off-night-custom-slots` | Anchors remain temporary tool state; default capacity migrates to `analysis.defaultDailySlots` |
| Anonymous identity | `cracked-ice-user-id` | Remains a device identifier for the legacy coach API; it is not a durable profile or provider-token owner |
| Coach league settings | Redis key `users:{userId}:settings`; `/tmp` read fallback | Migrates on first My Team load to active League Workspace league size, scoring, slots, playoff range, and provenance |
| Coach roster | Redis key `users:{userId}:roster`; `/tmp` read fallback | Migrates to `roster[]` with provider id, slot, keeper, protected, and undroppable fields |
| Mobile/desktop settings | Duplicated preset objects in roster settings components | Active League Workspace is authoritative; legacy forms write through to it during the WP10 transition |

The canonical guest key is `cracked-ice-league-workspaces`. Its payload is versioned, validates on
read/import/write, supports multiple leagues, and retains the original legacy keys for recovery.
Invalid stored data is not overwritten: the UI enters a visible recovery state and accepts a
validated JSON backup.

Production coach writes already fail when Redis is missing or unavailable. The filesystem path is
read-only recovery behavior for existing development data; the UI must not describe it as durable
storage. Cross-device storage and provider connections require a future durable Cracked Ice profile
repository and must never be attached only to `cracked-ice-user-id`.

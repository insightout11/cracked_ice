# WP10 — My Team core + keeper-aware roster

**Goal**: make `/team` a reliable roster workspace that provides immediate weekly value and supplies
the shared roster model required by acquisition and provider work.
**Depends on**: WP8. **Branch**: `wp10-my-team-core`.

## 1. Stabilize before redesign

- Remove `@ts-nocheck` from roster/coach surfaces and fix errors without broad `any` casts.
- Decompose the current large roster page into tested state, persistence, projection, lineup, and
  comparison boundaries.
- Consolidate duplicated scoring preset and client FPPG logic against the WP8 contract.
- Preserve existing useful roster behavior while removing separate AI Coach navigation/chat UI.

## 2. Roster setup

First run offers:

1. Select/create League Workspace.
2. Add own roster through search, pasted names/table, roster screenshots, or later provider import.
3. Resolve ambiguous player matches.
4. Mark keepers/protected players and review occupied/remaining positions.
5. Land on My Team with the current matchup window and useful analysis already populated.

Users may enter only their own roster. League-wide roster/free-agent maintenance is not required.

## 3. Default My Team dashboard

Lead with actionable state, not configuration panels:

- empty active slots and playable bench games;
- games lost to daily roster congestion;
- gap nights and position needs;
- upcoming off-nights/back-to-backs relevant to this roster;
- acquisition limit/moves remaining when configured;
- keeper/protected state; and
- explicit season, scoring, roster source, and freshness timestamps.

Lineup recommendations remain previews until WP13. Manual roster edits update the shared workspace.

## 4. Keeper-aware optimizer bridge

Optimizer can select the active League Workspace and use keepers as anchors. It reports occupied
slots, remaining positional needs, roster strengths/weaknesses, and schedule complement. It may
recommend draft targets from a supplied candidate pool, but does not claim knowledge of a live draft
board without provider/candidate evidence.

## 5. Responsive scope

Desktop receives the full editing workspace. Mobile must at minimum support roster inspection,
current-week issues, screenshot/candidate intake entry points, and navigation; do not hide the roster
entirely behind a generic desktop-only message. Complex bulk editing may remain desktop-first.

## Acceptance criteria

- [x] Fresh user can create a league, add a roster, mark keepers, and reach useful analysis.
- [x] Returning user can inspect and edit the saved roster without repeating setup.
- [x] Optimizer consumes keepers and remaining slots from the same League Workspace.
- [x] Dashboard counts reconcile by hand with schedule + daily lineup capacity fixtures.
- [x] Source/scoring/season/sync freshness is visible.
- [x] No separate public AI Coach/chat surface remains.
- [x] Persistence failure is visible and export/import recovery works.
- [x] Full desktop flow and useful mobile inspection verified in a real browser.
- [ ] Web/API typecheck, tests, lint, and builds pass.

## Out of scope

Full dynasty valuation, category optimization, live provider sync, provider writes, and multi-move
streaming execution are later packages.

# WP12 — Acquisition workspace

**Goal**: evaluate realistic add/drop decisions using the user's roster, league rules, date window,
and a candidate list whose availability provenance is explicit.
**Depends on**: WP8, WP10. **Branch**: `wp12-acquisition-workspace`.

## Candidate intake

Normalize all sources to the League Workspace pickup board:

- live provider availability (WP11 when present);
- screenshots of Yahoo/Fantrax/ESPN available-player screens;
- pasted names or copied tables;
- manual search/marking; and
- optional full-pool/league snapshot.

Screenshot extraction accepts multiple/overlapping images, deduplicates, recognizes platform rows,
matches aliases, and requires review for ambiguous players. Save extracted ids, source, confidence,
and observation time; delete source images after extraction by default. Do not introduce a new paid
vision dependency without exact owner approval.

Yahoo, Fantrax, and ESPN screenshots or copied tables use this same user-facing flow. Provider
adapters may recognize layout, export columns, position/status vocabulary, and settings, but they
must normalize into the shared review contract rather than creating separate provider tools.

## Analysis

- Rank **add/drop pairs**, not isolated additions.
- Respect scoring weights, selected dates, remaining moves, position eligibility, roster slots,
  daily capacity, protected/undroppable players, and schedule congestion.
- Separate short stream, matchup window, playoffs, and rest-of-season horizons.
- Explain fantasy-point/stat source, games gained/lost, conflicts, off-night value, and the drop cost.
- Permit protected players and user exclusions.
- Phrase incomplete pools honestly: "best among 18 imported candidates," not "best free agent."

## Acceptance criteria

- [ ] Screenshot, paste, manual, and provider candidates use one contract and review flow.
- [x] Overlapping screenshots deduplicate; ambiguous matches cannot silently enter analysis.
- [x] Images are transient by default and privacy guidance appears before upload.
- [x] Known fixtures prove daily-capacity and drop-cost calculations.
- [x] Availability source + timestamp is visible and stale entries can be removed quickly.
- [x] Category-aware claims do not appear.
- [x] Desktop and mobile candidate intake/decision review pass browser verification.
- [ ] Web/API typecheck, tests, lint, and builds pass.

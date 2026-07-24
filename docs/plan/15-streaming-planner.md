# WP15 — Transaction-aware streaming planner

**Goal**: propose an understandable sequence of add/drop moves that maximizes usable production over
a matchup window without exceeding league or roster constraints.
**Depends on**: WP7, WP8, WP10, WP12. **Branch**: `wp15-streaming-planner`.

## Required inputs

- selected League Workspace and matchup dates;
- own roster, active/bench slots, eligibility, keepers/protected players;
- daily/weekly locking and timezone;
- acquisition limit and moves remaining;
- candidate pool with availability provenance;
- waiver/add timing assumptions; and
- league scoring weights.

## Output

For zero through the configured remaining moves, show:

- each add and drop with effective date;
- per-day active lineup effect;
- usable games and projected points gained/lost after congestion;
- acquisition consumption and remaining flexibility;
- availability/waiver assumptions; and
- alternatives when a candidate is taken.

Unknown availability produces a scenario, not an executable plan. Keepers/protected players are
never proposed as drops unless explicitly unlocked by the user.

## Acceptance criteria

- [x] Hand-computed fixtures validate one-, two-, and three-move sequences.
- [x] Planner respects daily capacity, eligibility, locks, moves remaining, and protected players.
- [x] Zero-move baseline and each incremental move are visible.
- [x] Same-day conflicts cannot be counted as added starts.
- [x] Candidate removal/replacement recalculates without rebuilding league settings.
- [x] Explanations identify scoring/stat source and every material assumption.
- [x] Desktop and mobile sequence review pass browser verification.
- [x] Performance remains acceptable for realistic roster/candidate/window sizes.

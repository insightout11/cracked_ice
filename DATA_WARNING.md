# ⚠️ CRITICAL: NEVER USE FAKE SCHEDULE DATA

## Automated gate (WP2)

`apps/api/scripts/validate-schedule.mjs` codifies every rule below into a hard
gate. It runs at the start of the hydrate pipeline (`hydrate.mjs`) and exits
non-zero — failing the GitHub Action and blocking the commit — if the schedule
in `config/season.json`'s `scheduleFile` shows any fake-data signature: wrong
game counts, pairwise overlaps of 0 or ≥60, identical or 0%/100% off-night
shares, or dates outside the season bounds. Run it by hand any time you touch a
schedule file:

```bash
node apps/api/scripts/validate-schedule.mjs
```

## The Problem

**FAKE SCHEDULE DATA BREAKS THE ENTIRE APPLICATION AND WASTES HOURS OF DEBUGGING TIME.**

The live schedule file is whatever `config/season.json` points at (currently
`schedules-20262027.json`), always built from the real NHL API. Historically an
early `schedules-20252026.json` contained **artificially generated data** where
teams were segregated into alternating day patterns (those stale copies have
since been removed):

- Team A plays: Oct 9, 11, 13, 15... (odd days)  
- Team B plays: Oct 8, 10, 12, 14... (even days)
- Team C plays: Same as Team A (identical schedule)
- Team D plays: Same as Team B (identical schedule)

## Why This Breaks Everything

Real NHL teams have **overlapping game schedules** - multiple teams play on the same nights. Fake data with artificial separation causes:

1. **0 conflicts** between some teams (impossible in real NHL)
2. **82 conflicts** between other teams (identical schedules)  
3. **100% off-night percentages** (unrealistic)
4. **Meaningless complement analysis** (the core feature)

## Symptoms of Fake Data

When you see these patterns, you have fake data:

- Most teams show "0 conflicts & 82 extra games" 
- Off-night percentages are exactly 100% or 98.8%
- Teams have identical date lists in the JSON
- No realistic schedule overlaps between teams

## The Fix

**USE ONLY REAL NHL SCHEDULE DATA.** The canonical builder fetches every team
from the real NHL API and writes the season file named in `config/season.json`,
including full game metadata (opponent, home/away, gameId, start time, off-night):

```bash
# Reads the season id from config/season.json, writes data/schedules-<season>.json
node scripts/fetch-all-schedules.js

# Then validate before trusting it:
node apps/api/scripts/validate-schedule.mjs
```

## Testing Real vs Fake Data

Use the diagnostic endpoint to verify data quality:

```bash
# Real data should show realistic overlaps (10-30 games typically)
curl "http://localhost:8093/api/diag/overlap?a=CAR&b=BUF"

# ✅ Good: {"aCount":82,"bCount":82,"overlap":24}  
# ❌ Bad:  {"aCount":82,"bCount":82,"overlap":0}
```

## Never Again

- ❌ **NEVER** generate fake schedule patterns  
- ❌ **NEVER** use alternating day schedules
- ❌ **NEVER** create artificial team segregation
- ✅ **ALWAYS** use real NHL API data
- ✅ **ALWAYS** verify realistic team overlaps exist
- ✅ **ALWAYS** test with the diagnostic endpoint

**This issue has wasted multiple debugging sessions. Real data is required for meaningful fantasy hockey analysis.**
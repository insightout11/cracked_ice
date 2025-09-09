# ⚠️ CRITICAL: NEVER USE FAKE SCHEDULE DATA

## The Problem

**FAKE SCHEDULE DATA BREAKS THE ENTIRE APPLICATION AND WASTES HOURS OF DEBUGGING TIME.**

The current `schedules-20252026.json` files contain **artificially generated data** where teams are segregated into alternating day patterns:

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

**USE ONLY REAL NHL SCHEDULE DATA:**

```bash
# Fetch real data for each team (example for Calgary)
curl "https://api-web.nhle.com/v1/club-schedule-season/CGY/20252026" > real-CGY.json

# Extract only regular season games (gameType: 2)
# Build realistic schedules-20252026.json with real overlaps
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
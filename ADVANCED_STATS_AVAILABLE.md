# NHL API Advanced Stats Available

## Current Status
- ✅ Basic stats (goals, assists, shots, blocks, hits) - **IMPLEMENTED**
- ✅ Career history and bio - **IMPLEMENTED**
- ⚠️ Injury status - **PARTIAL** (only isActive, not detailed statuses)
- ❌ Advanced analytics - **NOT IMPLEMENTED**

## Available Advanced Stats from NHL API

### 1. Power Play Stats (`/stats/rest/en/skater/powerplay`)
- `ppTimeOnIce` - Total PP time in seconds
- `ppTimeOnIcePerGame` - Average PP time per game
- `ppTimeOnIcePctPerGame` - PP time as % of total ice time
- `ppGoals`, `ppAssists`, `ppPoints`
- `ppShots`, `ppShootingPct`
- `ppGoalsForPer60` - Team goals while player on PP (per 60 min)
- `ppIndividualSatFor` - Individual shot attempts on PP
- `ppPrimaryAssists`, `ppSecondaryAssists`

### 2. Penalty Kill Stats (`/stats/rest/en/skater/penaltykill`)
- `shTimeOnIce` - Total PK time in seconds
- `shTimeOnIcePerGame` - Average PK time per game
- `shTimeOnIcePctPerGame` - PK time as % of total ice time
- `shGoals`, `shAssists`, `shPoints`
- `shShots`, `shShootingPct`
- `ppGoalsAgainstPer60` - Team goals against while player on PK
- `shIndividualSatFor` - Individual shot attempts on PK
- `shPrimaryAssists`, `shSecondaryAssists`

### 3. Realtime/Advanced Stats (`/stats/rest/en/skater/realtime`)
- **Giveaways/Takeaways:**
  - `giveaways`, `giveawaysPer60`
  - `takeaways`, `takeawaysPer60`

- **Hits:**
  - `hits`, `hitsPer60`

- **Blocked Shots:**
  - `blockedShots`, `blockedShotsPer60`

- **Missed Shots (Breakdown):**
  - `missedShotCrossbar`
  - `missedShotGoalpost`
  - `missedShotOverNet`
  - `missedShotShort`
  - `missedShotWideOfNet`
  - `missedShots` (total)

- **Shot Attempts:**
  - `shotAttemptsBlocked` (Corsi blocked)

- **Empty Net:**
  - `emptyNetGoals`, `emptyNetAssists`, `emptyNetPoints`

- **Other:**
  - `firstGoals` - First goal of game
  - `timeOnIcePerGame`
  - `avgShiftsPerGame`

### 4. Shot Type Stats (`/stats/rest/en/skater/shottype`)
Goals and shots by shot type:
- Backhand
- Bat
- Between Legs
- Cradle
- Deflected
- Poke
- Slap
- Snap
- Tip-In
- Wrap Around
- Wrist

Each with:
- `goals[ShotType]`
- `shotsOnNet[ShotType]`
- `shootingPct[ShotType]`

### 5. Faceoff Stats (`/stats/rest/en/skater/faceoffpercentages`)
- **By Zone:**
  - `defensiveZoneFaceoffPct`, `defensiveZoneFaceoffs`
  - `neutralZoneFaceoffPct`, `neutralZoneFaceoffs`
  - `offensiveZoneFaceoffPct`, `offensiveZoneFaceoffs`

- **By Situation:**
  - `evFaceoffPct`, `evFaceoffs` (Even strength)
  - `ppFaceoffPct`, `ppFaceoffs` (Power play)
  - `shFaceoffPct`, `shFaceoffs` (Shorthanded)

- **Total:**
  - `faceoffWinPct`, `totalFaceoffs`

### 6. Scoring Per Game Stats (`/stats/rest/en/skater/scoringpergame`)
Per-game averages:
- `goalsPerGame`, `assistsPerGame`, `pointsPerGame`
- `primaryAssistsPerGame`, `secondaryAssistsPerGame`
- `shotsPerGame`, `hitsPerGame`, `blocksPerGame`
- `penaltyMinutesPerGame`
- `timeOnIcePerGame`

### 7. Club Stats (`/v1/club-stats/{team}/{season}/{gameType}`)
Team-level player stats including:
- `avgTimeOnIcePerGame` (in seconds)
- `avgShiftsPerGame`
- All standard stats (goals, assists, points, etc.)

## NOT Available from NHL Public API

### Expected Goals (xG)
❌ Not available in public API
- Would need third-party analytics services
- Options: Evolving Hockey, Natural Stat Trick, MoneyPuck

### Zone Starts
❌ Not available in public API (only faceoff zones)
- No detailed zone start/deployment data

### Detailed Injury Information
❌ Only `isActive: true/false` available
- No DTD, IR, IR+, OUT, QUESTIONABLE statuses
- No injury descriptions or timelines
- Would need to scrape NHL.com injury report or use third-party

### Corsi/Fenwick/PDO
❌ Advanced possession metrics not in public API
- Only basic shot attempts blocked available
- Full Corsi For/Against would need calculation or third-party

## Implementation Priority

### High Priority (Most Valuable)
1. **Power Play Time** - Fantasy relevant, available
2. **Penalty Kill Time** - Fantasy relevant for leagues with SHP
3. **Giveaways/Takeaways** - Some leagues track these
4. **Faceoff Stats by Zone** - Useful for deeper leagues

### Medium Priority
1. **Shot Type Breakdown** - Interesting but less fantasy relevant
2. **Empty Net Points** - Edge case tracking
3. **Missed Shot Details** - Analytics depth

### Low Priority
1. **Shifts per game** - Minimal fantasy value

## Recommended Next Steps

1. **Update Hydration Script** to fetch:
   - Power play TOI (`ppTimeOnIcePerGame`)
   - Penalty kill TOI (`shTimeOnIcePerGame`)
   - Giveaways/Takeaways (`giveaways`, `takeaways`)
   - Faceoff win % by zone

2. **Injury Data Alternative Sources:**
   - ESPN API (if accessible)
   - Daily Faceoff (scraping)
   - Rotoworld/Rotowire APIs
   - NHL.com injury report scraping

3. **Expected Goals (xG):**
   - Requires third-party analytics service
   - Not feasible without paid API access

4. **Display in UI:**
   - Add PP/PK TOI to player detail modal
   - Show giveaways/takeaways in advanced stats tab
   - Faceoff stats for centers in detailed view

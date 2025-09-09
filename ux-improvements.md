# Fantasy Hockey Draft Complement UX Improvements

## Overview
Merge the Complement Finder and Roster Fit tabs into a single unified page that provides a clearer, more intuitive user experience for building optimal fantasy hockey rosters.

## 🔄 Wording Clarity

### Column Header Changes
- **Conflicts** → **"Games same nights as [seed]"**
  - Tooltip: "Nights both teams play (bad, avoid high numbers)"
- **Extra Games** → **"Games when [seed] is idle"** 
  - Tooltip: "Games the candidate team plays when your seed team is idle (good, higher = more starts)"
- **Off-Night %** → **"% of extra games on Mon/Wed/Fri/Sun"**
  - Tooltip: "How many of those extra games fall on Mon/Wed/Fri/Sun (easy lineup nights)"
- **Usable Starts** → **"Real starts this team adds with your roster"**
  - Tooltip: "Usable Starts = how many real games this team adds with your current centers"

### Page Title Change
- From: "Teams with least overlap"
- To: **"Best Draft Complements for [Team Name] ([ABBR])"**
- Subtitle: "Ranked by: Fewest Conflicts → Most Extra Games → Off-Night %"

## 📊 Data Presentation

### Show All Teams
- Display all 32 teams in one ranked list (instead of cutting off at top 10)
- Users can see both good complements and bad overlaps for draft avoidance
- Add toggle: **Show All Teams / Show Top 10 Complements**

### Remove Sample Dates Column
- Drop the "Sample Dates" column (noisy and not useful)
- Replace with **"Draft Fit Score"** - composite metric combining:
  - Low conflicts (weighted heavily)
  - High extra games 
  - Good off-night share percentage

### Alternative: Visual Bar Chart
- Small bar chart cell showing relative value at a glance
- Green bars for good fits, red for poor fits

## 🌈 Visual Enhancements

### Color Coding System
- **Conflicts column**: Red gradient (higher = darker red = worse)
- **Extra Games**: Green gradient (higher = darker green = better)
- **Off-Night %**: Blue gradient (higher % = darker blue = better)
- **Draft Fit Score**: Star rating system (⭐⭐⭐⭐⭐ for best fits, ❌ for avoid)

### Example Table Layout
```
Team    Games Same Nights 🔴    Games When Idle 🟢    Off-Night % 🔵    Draft Fit ⭐
UTA     39                      43                    70%               ⭐⭐⭐⭐
SJS     44                      38                    58%               ⭐⭐⭐
WSH     46                      36                    69%               ⭐⭐⭐
NYR     47                      35                    69%               ⭐⭐
TOR     65 (bad)               17                    40%               ❌ Avoid
```

## 🎯 Focus on Decisions

### Unified Page Flow
1. **Start with Seed Team**: User picks initial team (e.g., CAR for Aho)
2. **View All Complements**: Table shows all other teams ranked by fit
3. **Progressive Building**: User can "lock in" teams from the table
4. **Recalculation**: When teams are locked, ranking recalculates using roster-aware logic
5. **Continue Building**: User adds more teams, table updates each time

### Roster-Aware Logic Integration
- **Added Starts Formula**: For each candidate team, count only games on dates where `occupied[d] < slotsPerDay`
- **Default slotsPerDay = 2** (for 2C positions)
- **Return metrics**: addedStarts, candidateGames, % usable, weighted score
- **Real-time updates**: Table recalculates as user builds roster

## 🔧 Technical Implementation

### Single Page Architecture
- Merge `/complement-finder` and `/roster-fit` into unified component
- Maintain state for:
  - Selected seed team
  - Locked roster teams
  - Current calculation mode (complement vs roster-aware)
  - Window filter (season/30d/7d)

### Added Starts Calculation
```javascript
function calculateAddedStarts(candidateTeam, currentRoster, slotsPerDay = 2) {
  // Count games only where roster has availability
  let addedStarts = 0;
  let candidateGames = 0;
  
  candidateTeam.games.forEach(gameDate => {
    candidateGames++;
    const occupied = currentRoster.getGamesOnDate(gameDate);
    if (occupied < slotsPerDay) {
      addedStarts++;
    }
  });
  
  return {
    addedStarts,
    candidateGames,
    usablePercentage: (addedStarts / candidateGames) * 100,
    draftFitScore: calculateCompositeScore(conflicts, addedStarts, offNightPct)
  };
}
```

### Window Toggle Implementation
- Apply consistent filters across both complement and roster modes
- Options: Full Season / Last 30 Days / Last 7 Days
- Maintain filter state when switching between modes

### Draft Fit Composite Score
```javascript
function calculateDraftFitScore(conflicts, extraGames, offNightPct) {
  // Lower conflicts = better (inverse relationship)
  const conflictScore = Math.max(0, (82 - conflicts) / 82);
  // Higher extra games = better
  const extraGamesScore = extraGames / 82;
  // Higher off-night % = better  
  const offNightScore = offNightPct / 100;
  
  // Weighted average (conflicts weighted most heavily)
  return (conflictScore * 0.5) + (extraGamesScore * 0.3) + (offNightScore * 0.2);
}
```

## ✅ Acceptance Criteria

### Core Functionality
- [ ] Only one tab remains (unified page)
- [ ] User can start with 1 team and progressively build roster without changing views
- [ ] Both complement analysis and roster-aware analysis live in same table
- [ ] Column names are user-friendly with hover tooltips
- [ ] All calculations respect real schedule limits (≤82 games)

### Visual Requirements
- [ ] Color-coded columns for quick visual assessment
- [ ] All 32 teams shown with toggle for top 10
- [ ] Sample dates column removed
- [ ] Draft fit score or visual indicators added
- [ ] Responsive design maintains usability

### User Experience
- [ ] Clear introductory text explaining the tool
- [ ] Tooltips provide context without cluttering interface
- [ ] Progressive roster building feels intuitive
- [ ] Window toggles work consistently across all modes
- [ ] Performance remains good with full team list

### Technical Standards
- [ ] Clean component architecture
- [ ] Efficient recalculation algorithms
- [ ] Proper state management
- [ ] Error handling for edge cases
- [ ] Unit tests for calculation functions

## 🚀 Implementation Priority

1. **Phase 1**: Merge tabs and basic UI cleanup
2. **Phase 2**: Implement roster-aware progressive building
3. **Phase 3**: Add visual enhancements and color coding
4. **Phase 4**: Polish tooltips, introductory text, and final UX details
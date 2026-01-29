# Mobile Player Detail: Add Game Log Tab + Goals/Assists to Season History

## File to modify
`web/src/mobile/sheets/MobilePlayerDetailSheet.tsx`

## Task 1: Add Game Log tab to mobile player detail sheet

The desktop version has a Game Log tab (`web/src/components/player/GameLogTab.tsx`) that's already a reusable component. The mobile sheet already has a tab system with Overview, Stats, Schedule, Career.

### Changes

1. **Import GameLogTab** and the `List` icon (used on desktop for this tab)

2. **Add `'gamelog'` to the `DetailTab` type** (line ~30):
   ```
   type DetailTab = 'overview' | 'stats' | 'schedule' | 'career' | 'gamelog';
   ```

3. **Add tab entry** to the `tabs` array (line ~187):
   ```
   { id: 'gamelog', label: 'Game Log', icon: List },
   ```

4. **Add tab content rendering** (after line ~347):
   ```tsx
   {activeTab === 'gamelog' && player.gameLog && (
     <div className="p-4">
       <GameLogTab games={player.gameLog} isGoalie={player.positions.includes('G')} />
     </div>
   )}
   ```

   Note: The existing `GameLogTab` component renders a full HTML table. On mobile this may need horizontal scroll. Wrap in `overflow-x-auto` if needed.

## Task 2: Add Goals and Assists to Season History in Career tab

In the `CareerTab` component (line ~793-807), the season history currently shows GP, P, and FPPG. The data schema already has `goals` and `assists` fields available.

### Changes

Insert G and A stats between GP and P in the stats row (line ~797):

```tsx
<span className="text-slate-400">
  GP: <span className="text-white">{stats.gamesPlayed}</span>
</span>
{stats.goals !== undefined && (
  <span className="text-slate-400">
    G: <span className="text-white">{stats.goals}</span>
  </span>
)}
{stats.assists !== undefined && (
  <span className="text-slate-400">
    A: <span className="text-white">{stats.assists}</span>
  </span>
)}
{stats.points !== undefined && (
  ...existing points code...
)}
```

## Verification

1. Run `pnpm -C web dev` and open on mobile viewport
2. Tap a player to open the detail sheet
3. Confirm new "Game Log" tab appears and shows game-by-game data
4. Go to Career tab → Season History and confirm G and A columns appear
5. Check a goalie player to ensure game log shows goalie-specific columns and season history doesn't show G/A (they'll be undefined)

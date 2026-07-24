# WP16 — Player decision workspace

**Goal:** make draft, keeper, and in-season player choices immediately reachable, transparent, and
shareable. **Depends on:** WP8 and the reliable My Team core in WP10. This package is incremental;
it must not block schedule-fit or roster work already in use.

## 1. Optimizer entry points

- Present Schedule Fit, Draft Board, and Compare Players as sibling Optimizer tools.
- Preserve mode and selected players in URLs.
- Add a consistent Compare action to search results, roster cards, pickup candidates, and board rows.
- Never require an anchor/team recommendation before the ranked board is usable.

## 2. Ranked draft board

- Rank the active player pool using league FPPG, regular-season usable starts, fantasy-playoff
  usable starts, and value over replacement.
- Recalculate around keepers, drafted players, occupied slots, and remaining roster needs.
- Filter by position and availability/taken state; show replacement depth and opportunity cost.
- Break playoffs out by matchup week and identify championship-week strength.
- Treat goalie opportunity, volume, and risk separately from skater production.
- Group comparable values into strategy-aware tiers and expose the cost of waiting at each position.
- Persist a draft session with `mine`, `taken`, undo, automatic slot assignment, and recalculated needs.
- Save a personal target queue with intended rounds and surface targets as their round approaches.

### Live draft companion

- Optimize the Draft Room for a narrow second-screen or split-screen window as well as mobile.
- Keep the complete Draft Room as the default. Offer compact second-screen mode as an optional,
  URL-addressable composition of the same session data, with a persistent one-click return to full view.
- Keep provider synchronization capability-specific. Until an active provider feed is verified, label
  the session as manual and offer exact-name bulk catch-up instead of requiring one action per pick.
- Show synchronization mode and freshness prominently; never imply a provider draft is live when it is not.
- Keep recent activity compact and secondary to recommendations, tiers, targets, and player context.

## 3. Keeper mode

- Save maximum keepers, horizon (`next-season` or `two-to-three-years`), and cost system in the
  League Workspace.
- Save optional keeper cost per roster player.
- Compare production, trajectory, age context, NHL/PP role, durability, positional scarcity, and
  keeper-cost surplus. Label missing evidence and uncertainty.
- Keep upcoming schedule modest in next-season mode and exclude it from multi-year valuation.
- Do not market the result as dynasty valuation; prospects, contracts, and future-pick models remain
  deferred until supported by reliable data.

## 4. Decision visuals and sharing

- Use side-by-side bars, trajectory sparklines, and schedule strips where they reduce reading time.
- Include headshots, team marks, scoring profile, dates/horizon, strategy, source season, and data
  freshness in share images.
- Keep shared verdicts understandable without the app and avoid unsupported availability claims.

## Acceptance criteria

- [x] Draft Board and Compare Players are directly reachable from the Optimizer first viewport.
- [x] A board is useful with zero roster players and becomes roster-aware when keepers exist.
- [x] Keeper mode exposes its horizon, inputs, missing data, and confidence; no unexplained score.
- [x] Playoff evidence is visible per fantasy matchup week, including the championship week.
- [x] Goalies are not ranked by a skater-only model.
- [x] Tiers explain when comparable players remain and when a position is about to drop.
- [x] Draft progress, targets, intended rounds, and undo survive refresh on the current device.
- [x] Unsupported-provider drafts can bulk-catch up without silently accepting ambiguous names.
- [x] Shared comparisons contain both player headshots and the active league/source context.
- [x] Desktop and mobile flows pass typecheck, tests, lint, build, and browser verification.

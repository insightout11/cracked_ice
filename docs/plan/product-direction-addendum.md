# Product Direction Addendum

Agreed July 2026. This addendum refines the relaunch plan without expanding the
August launch indiscriminately.

## Product position

Cracked Ice should own a simple promise:

> Find the games a fantasy roster can actually use, then show exactly why.

Decision-oriented outputs, transparent calculations, and shareable schedule
insights take priority over generic projections, commodity data tables, or more
AI chat surfaces.

## Agreed priorities

1. Finish WP2 with trustworthy season data, validation, and explicit metric
   provenance.
2. In WP5, reuse the user's existing league profile and scoring weights for
   personalized fantasy-point estimates. The precomputed Default-preset FPPG in
   `data/derived.json` is a clearly labeled fallback only.
3. Add shareable result URLs that encode anchors, time window, slots, and other
   relevant settings. PNG sharing remains useful but is not a substitute for an
   interactive permalink.
4. Add an interactive Complement Matrix as an alternate Draft Helper view. The
   current ranked result for one seed team is effectively one matrix row; the
   new view should expose the full 32x32 surface, with Full Season, selected
   window, and Fantasy Playoffs modes. Clicking a cell opens the WP5 verdict and
   proof view. Precompute matrix data rather than issuing hundreds of API calls.
5. Add quick roster paste as a no-login path to personalized gap-night results.
6. Keep calculation provenance visible: configured season, source-stat season,
   scoring preset or custom weights, generation time, and whether a value is
   live, prior-season, or a proxy.
7. Add lightweight saved plans in local storage after the core flow is stable.

## Weekly Streaming Plan

The plan is valuable, but it must be transaction-aware before it presents an
executable sequence. Required inputs include:

- league acquisition limit per matchup/week;
- moves already used, or simply moves remaining;
- roster and active lineup slots;
- daily versus weekly lineup locking;
- player availability; and
- the active matchup window.

Add `weekly_add_limit` to league settings when this work begins. Treat
`adds_used_this_week` or `moves_remaining` as user-specific, short-lived state.
A useful first version can answer separately for one, two, or three remaining
moves without maintaining transaction history.

Example output:

> With one move left, add ANA. With two moves, add ANA Monday and switch to SJS
> Friday. Projected gain: four usable starts.

This belongs after the WP5/WP7 decision surfaces and quick-roster path are
working; it is not required for the initial August launch.

## Existing capabilities to reuse

- Scoring presets already exist for Yahoo Standard, ESPN Standard, KKUPFL, APL,
  Chesterfield, and editable custom scoring.
- Scoring is stored in the user's league profile and resolved by the coach
  scoring engine. Do not create a second preset system for Draft Helper.
- The existing complement calculation and ranked seed-team results should power
  the matrix; the matrix is a new view, not a new scoring model.

Preset definitions are currently duplicated across server, desktop, and mobile
code. Consolidating them into one shared contract is preferable to adding more
copies.

## Explicit deferrals

- Yahoo OAuth remains conditional WP11 work.
- Category-league optimization comes after the points-league experience is
  reliable.
- Starting-goalie alerts, injuries, and live line-combination feeds are useful
  but operationally expensive and crowded; they are not launch priorities.
- Do not require login or league connection before a visitor receives value.

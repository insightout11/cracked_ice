# Canonical product direction

Agreed through 2026-07-22. This document supersedes conflicting product language in the
original July relaunch work packages. Completed implementation remains valid where it supports
this architecture; future work must not preserve an obsolete label or flow merely because an
earlier WP specified it.

## Product promise

Cracked Ice helps a fantasy-hockey manager decide which players their roster can actually use,
over the dates that matter, under their league's rules. It combines production, NHL schedule,
fantasy lineup capacity, roster construction, and acquisition constraints. Outputs must expose
their inputs and reasoning rather than presenting unexplained scores.

The product is useful at the draft, during weekly pickups and streams, and for rest-of-season
planning. **Draft Helper is not the umbrella product name.** The top-level tool is the
**Optimizer**.

## Information architecture

Top navigation:

1. **Optimizer** — player/team schedule-fit exploration and, when a league exists, personalized
   draft and pickup decisions.
2. **Season** — dense weekly schedule, off-night list, back-to-backs, complement matrix, and
   season-scale schedule analysis.
3. **My Team** — roster, keepers, lineup capacity, gaps, acquisition board, and recommendations.
4. **Blog** — generated and owner-reviewed schedule content.

The root route should let a visitor use the Optimizer immediately. Do not consume the first
viewport with a large marketing thesis, redundant live demo, or draft-only headline. Help lives
next to the controls and calculations it explains.

There is no separate AI Coach product surface. Recommendation and explanation components are
embedded in Optimizer and My Team. AI may assist matching, extraction, and explanation; it is not
the navigation model and it never executes a provider write autonomously.

## Persistence model

### Cracked Ice profile

- Guest visitors can use public tools without login.
- A durable Cracked Ice profile enables cross-device persistence and provider connections.
- Yahoo may be an authentication option, but Yahoo identity must not be the only account path.
- Provider tokens belong to a durable profile/provider connection, not only to the existing
  anonymous localStorage device id.

### League Workspace

Configure a league once and reuse it across the site. The canonical league contract includes:

- name, platform/provider, season, league type, and sync state;
- points scoring weights and preset provenance;
- lineup slots, bench/IR slots, position eligibility rules, and daily/weekly locking;
- timezone, matchup week boundary, active analysis dates, and fantasy-playoff dates;
- acquisition limit, moves used/remaining, waiver behavior, and other actionable constraints;
- the user's roster, keeper flags, protected/undroppable flags, and provider player ids;
- candidate/pickup board entries with availability source and observation timestamp; and
- source/freshness metadata for every imported or calculated dataset.

The persistence layers must converge on this contract. TimeWindow localStorage, Draft Helper
localStorage, coach league profiles, and roster storage must not evolve as separate settings
systems. The schema supports multiple leagues from the start; the first UI may expose one active
league at a time.

## My Team

My Team is the serious-user workspace and the eventual signed-in landing page. Its useful default
view answers "what needs attention now?" with:

- empty active slots and benched players who have games;
- upcoming lineup conflicts and games lost to congestion;
- roster gap nights and position needs;
- current acquisition budget/limit and relevant waiver/lock state;
- suggested lineup changes (read-only until a provider write is explicitly confirmed);
- pickup/add-drop opportunities; and
- visible source season and last-updated/sync timestamps.

Own-roster entry is valuable even without a league-wide free-agent pool. Manual search, paste,
roster screenshot extraction, and provider import all resolve to the same roster model.

### Keepers and draft mode

Keepers are roster members with `keeper/protected` state before the draft. Draft recommendations
must consider occupied positions, remaining slots, league scoring, roster strengths/needs, and
schedule complement. This is not full dynasty support: prospect pipelines, future picks, contracts,
and multi-year surplus-value models remain deferred.

### Draft strategy and player valuation

Draft mode is a first-class decision context even before a roster exists. It assumes players are
draft candidates rather than inferring free-agent availability. Recommendations combine four
visible components: active-league production, regular-season usable schedule, fantasy-playoff
usable schedule, and positional value over replacement. The default Balanced strategy weights
these 55/20/15/10; league-level presets may shift emphasis toward making the playoffs, playoff
weeks, stars-and-streamers, or schedule maximization. Custom weights remain transparent and are
saved with the League Workspace.

Schedule should generally break close production decisions rather than push a materially weaker
player ahead of an elite one. As keepers and drafted players are added, rankings recalculate from
standalone team games to marginal starts that fit the actual roster. Every recommendation must
show regular-season and playoff-week consequences separately so a playoff-heavy strategy cannot
hide the risk of weakening qualification odds. The composite score is a ranking convenience, not
a substitute for its component values and source periods.

### Player-decision workspace

Schedule fit, a ranked draft board, and two-player comparison are sibling Optimizer tools. Users
must be able to enter each directly from the Optimizer rather than first completing an unrelated
anchor or team-pairing flow. Player search results, roster cards, pickup candidates, and draft-board
rows expose a consistent Compare action. Comparison URLs remain shareable and restore the selected
players, mode, dates, league context, and strategy.

The ranked draft board works before a roster exists and recalculates as keepers and drafted players
occupy slots. It supports position filters, remaining-roster needs, and an explicit available/taken
state. It shows opportunity cost and replacement depth so a small ranking edge does not imply a
player must be selected immediately. Skaters and goalies use separate models and evidence.

Fantasy-playoff value is shown per matchup week, including a distinct championship-week result;
an aggregate playoff total must not hide a weak final week. Visual evidence favors comparable bars,
small trajectory charts, and schedule strips over decorative gauges or radar charts.

### Keeper comparison

Keeper comparison is a separate decision mode with an explicit horizon: next season or two-to-three
years. It combines league production, multi-season trajectory, age context, role and power-play
usage, durability, positional scarcity, and keeper-cost surplus when a cost exists. Upcoming
schedule may contribute to a next-season decision, but not to multi-year value. Every factor and
source period remains visible, with an uncertainty indicator when projections or role data are weak.

Keeper rules live in the League Workspace: maximum keepers, horizon, cost system, and optional
per-player cost. The initial model may provide a transparent keeper profile without claiming a
universal dynasty score. Full dynasty support still requires prospect pipelines, contracts, future
picks, and defensible multi-year projections and remains deferred.

### Shareable decisions

Share images include player headshots, team marks, active scoring profile, decision horizon, source
season, strategy, and the few metrics that explain the verdict. They should remain legible without
the surrounding application and must not imply certainty or availability the source data lacks.

## Acquisition and availability

The fundamental decision is an **add/drop pair**, evaluated over a selected window. Ranking an add
without modeling the dropped player and daily lineup capacity is incomplete.

Availability is evidence, not an assumption:

| State | Meaning |
|---|---|
| Live provider | Confirmed by a current supported provider sync |
| Screenshot-confirmed | Visible in a user-supplied free-agent screenshot at the recorded time |
| User-confirmed | Explicitly marked available by the user |
| Imported snapshot | Derived from a platform table/CSV or league roster census |
| Unknown | Cracked Ice has no current league-specific evidence |

Unknown players may appear as general targets, but never as confirmed free agents. Imported state
always shows its observation time and can be invalidated with one action.

### Candidate import paths

All paths normalize to a short pickup-board candidate list:

1. Yahoo live pool.
2. One or more screenshots of the platform's currently available players.
3. Pasted player names or copied platform table.
4. Optional full-league roster/free-agent snapshot.
5. Manual player search and availability marking.

Busy leagues make manually maintained league-wide snapshots unrealistic. Snapshot import is an
optional bootstrap, not the primary non-OAuth workflow. Screenshot/paste import should accept
multiple overlapping captures, deduplicate, resolve aliases, review ambiguous matches, and state
"best among N imported candidates" rather than claiming league-wide completeness. Source images
are transient and deleted after extraction by default.

## Calculation contract

- Points leagues are the supported personalized format for the current plan.
- Category-league optimization is deferred. Existing category fields may be preserved, but the UI
  must not imply category-aware recommendations until they exist.
- Fantasy-point estimates use the active League Workspace scoring weights when available.
- Any fallback (preset, prior-season production, league average, proxy, or projection) is labeled.
- PPG and FPPG are not interchangeable. UI labels and explanations must identify the statistic,
  source period, scoring profile, and calculation.
- Schedule-fit analysis counts actual usable starts under daily capacity, not merely games played
  or two-team conflicts.
- Player affiliation, schedule season, source-stat season, generation time, provider sync time,
  and candidate observation time are visible where they affect a decision.

## Provider strategy

Provider adapters expose capabilities rather than forcing every platform into the Yahoo model:

```text
LeagueProviderCapabilities
  importIdentity
  importSettings
  importRoster
  importAvailability
  sync
  writeLineup
  writeTransactions
```

### Yahoo

1. Authorization-code OAuth attached to a durable Cracked Ice profile.
2. Read/import/sync league settings, roster, lineup, availability, and relevant transaction state.
3. Show sync health and degrade safely to last-known/manual data.
4. Separately release lineup writes after read sync is trustworthy.
5. Do not expose add/drop, waiver, or trade writes merely because the OAuth grant technically
   permits them.

Every lineup write requires a date-specific before/after preview, eligibility and lock validation,
explicit user confirmation, idempotency/drift protection, audit record, and read-after-write
verification. Recommendations may be automatic; execution is never silent or background-driven.

### Fantrax

Fantrax is the first non-OAuth platform priority. Until supported partner/API access exists, build
excellent platform-specific screenshot, copied-table, and CSV guidance/parsing on top of the shared
roster and candidate-import pipeline. Do not request passwords, session cookies, or unsupported
browser credentials.

### ESPN and generic platforms

Use the same screenshot/paste/manual workflows. Undocumented private endpoints are not a production
contract. Add a provider adapter only when a supportable authentication and data-access path is
verified.

## Streaming planner

The planner comes after My Team and add/drop analysis are reliable. It evaluates one or more moves
over a matchup window using:

- remaining acquisitions;
- roster and daily active slots;
- daily or weekly locks;
- position eligibility and keeper/protected state;
- candidate availability evidence;
- add/drop timing and waiver delay; and
- actual games gained after congestion.

It must show the proposed sequence, each dropped player, assumptions, and per-day lineup effect. A
plan with unknown availability is a scenario, not an executable recommendation.

## Explicit deferrals

- Category-league optimization.
- Full dynasty/prospect/future-pick valuation.
- Yahoo add/drop, waiver, and trade writes.
- Unsupported ESPN/Fantrax authenticated scraping.
- Autonomous or background provider mutations.
- Permanent storage of uploaded roster/free-agent screenshots by default.
- Starting-goalie alerts, injuries, and live line-combination feeds until the core data pipeline is
  demonstrably fresh and reliable.

## Delivery principle

Do not resume broad visual redesign until the current WP6 shell reflects this IA. Build the shared
League Workspace before expanding roster or acquisition surfaces; otherwise scoring, dates, roster,
and provider state will fragment again. Every WP must preserve useful existing schedule tools and
must include desktop/mobile browser verification appropriate to the surface.

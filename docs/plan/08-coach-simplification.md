# WP8 — League Workspace foundation

**Goal**: create one persistent, provider-neutral league contract reused throughout Optimizer,
Season, My Team, acquisition analysis, and provider integrations.
**Depends on**: WP4, WP6. **Branch**: `wp8-league-workspace`.

## 1. Audit and migration

Implementation audit: [`wp8-persistence-map.md`](wp8-persistence-map.md).

Inventory and map all current persistence before changing behavior:

- `TimeWindowContext` localStorage keys;
- Draft Helper anchors/slots/window keys;
- coach `LeagueProfile` and preset definitions;
- anonymous-device roster storage;
- desktop/mobile duplicated presets and FPPG calculations; and
- any server Redis or `/tmp` fallback behavior.

Write migrations; do not strand existing rosters or silently reset user settings.

## 2. Canonical contract

Define versioned shared types/schema for:

- profile id and active league id;
- league identity, platform, season, type, and source;
- scoring preset/custom weights and provenance;
- positions, lineup/bench/IR slots, eligibility, and locking mode;
- timezone, matchup boundaries, default analysis window, and playoffs;
- acquisition limits plus short-lived moves-used/remaining state;
- roster entries including keeper/protected/undroppable flags and provider ids;
- candidate availability source, confidence, observed-at, and expiry/staleness; and
- source season, generated-at, imported-at, synced-at, and last-error metadata.

Support multiple leagues in storage and APIs while exposing one active league in the initial UI.
Category fields may be preserved for future compatibility, but category optimization is deferred.

## 3. Persistence boundary

- Guest: versioned local persistence plus JSON export/import.
- Durable profile: server persistence behind one repository/service boundary.
- Provider connections attach to durable profile + league, never only to the browser device id.
- Production writes fail visibly if durable storage is unavailable; never claim `/tmp` data is saved.
- Centralize scoring preset resolution and league-window resolution; downstream tools consume them.

Authentication implementation may be a follow-on owner-approved task, but the schema and service
boundary must not assume Yahoo is the only identity provider.

## 4. Shared UI

Build a compact League switcher/settings entry using existing primitives. Configure league settings
once; individual tools may temporarily override a date window without silently modifying the league
default. Display scoring profile, season, and freshness provenance where calculations depend on them.

## Acceptance criteria

- [x] One League Workspace contract serves Optimizer, Season, and current roster code.
- [x] Existing local settings/roster migrate or produce a recoverable review flow.
- [x] Changing league scoring or dates is reflected across consumers without duplicate setup.
- [x] Multiple league records can be stored and switched in tests.
- [x] Category analysis is not advertised.
- [x] No provider token is keyed solely by anonymous device id.
- [x] Storage failures and stale source data are visible.
- [x] Contract, migrations, repositories, and core selectors have automated tests.
- [ ] Web/API typecheck, tests, lint, and builds pass.

## Explicit non-goals

No Yahoo OAuth, lineup write, full My Team redesign, screenshot vision extraction, or streaming
sequence optimizer in this WP.

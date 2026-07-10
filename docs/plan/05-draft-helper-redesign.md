# WP5 — Draft Helper full redesign (the launch centerpiece)

**Goal**: transform the ranked table into a verdict → proof → options flow with player-first
input and a shareable artifact. This is the tool that went viral; the redesign turns its one
insight into the product's permanent visual identity.
**Depends on**: WP2 (season data, `data/derived.json`), WP4 (primitives).
**Size**: ~2 weeks. **Branch**: `wp5-draft-helper`. Load `frontend-design` + `dataviz` skills.

## Layout (top to bottom)

1. **Anchor input** — "Who's your anchor?"
2. **Verdict card** — the hero answer with headline numbers
3. **Interleave strip** — visual proof (inside the verdict card)
4. **Ranked list** — compact alternatives
5. Tier legend / settings, demoted

## 1. Input: player-first with team tab

Two tabs: **Players** (default) | **Teams** (current dropdown flow, restyled).

Players tab:
- Search box with autocomplete over `data/players.json` (reuse the search logic from
  `CoachPlayerSearchPanel.tsx` — extract shared `web/src/lib/playerSearch.ts`).
- Selecting a player adds an anchor chip: `Connor McDavid · C · EDM` (team logo, remove ×).
  Multiple anchors allowed (the current "locked teams" concept, now expressed as players).
- Slot count inferred from anchor positions: any C/W/G anchor → 2 slots; all-D anchors → 4;
  "Adjust" link reveals the custom slot control. Persist to localStorage (keep existing keys
  `off-night-*`, add `off-night-anchor-players`).
- Time window: compact control, default = full season before Oct 7, rest-of-season after
  (from `config/season.json`). Full TimeWindow options behind one popover, playoff mode included.
- Teams tab preserves pure team-pair analysis for draft preppers; both tabs drive the same
  results state.

Remove entirely: the 3-step light-blue stepper, the pulsing Lock In nag, "Seed Team" and
"Position Type: Standard (2 slots)" labels, all console.logs, the `${slots+1}rd`-style
grammar bugs (`getPositionDescription` and friends get rewritten).

## 2. API: one round trip

New function `api/pairings.ts` (reuses `api/_lib/`):

```
GET /api/pairings?anchors=EDM,NYI&start=...&end=...&slots=2
→ {
  baseline: { usableStarts, teams: ["EDM"] },
  results: [{
    team, teamName,
    addedStarts,          // usable starts delta vs baseline
    conflicts, offNightShare,
    addedDates: ["2026-10-08", ...],   // the actual nights gained
    gamesByDate: {...}                  // candidate's game dates in window (for the strip)
  }, ...],
  anchorsGamesByDate: {...}
}
```

Internally merges the logic of `api/complement.ts` + `api/added-starts-bulk.ts` (which the
current UI calls sequentially and stitches client-side, silently zero-filling on partial
failure). Keep the old endpoints live for one release, then remove after the UI cuts over.

## 3. Verdict card

For the top-ranked result (or any row the user clicks):

- Headline: **"Best pair for {anchor}: {TEAM}"**
- Stats row (scoreboard numerals): `+13 usable starts` · `~+31 fantasy pts` · `71% off-nights`
- Fantasy points = `addedStarts × positional average FPPG` from `data/derived.json` (WP2).
  Label it honestly: "at league-average {C} production". Round to whole points.
- Suggested players on that team at the anchor's position (top 2-3 by FPPG from
  `data/players.json` + stats): "Target: Barzal, Horvat". This makes it actionable.
- Share button (see §5) and "Add to stack" (adds the team/players as a new anchor,
  re-runs — the old Lock In, renamed).

## 4. Interleave strip (the signature visual — load `dataviz` skill)

New component `web/src/components/draft/ScheduleInterleaveStrip.tsx`, pure SVG:

- Rows: one per anchor team (combined ok when >2) + one for the candidate.
- Columns: time. Two density modes:
  - Window ≤ 6 weeks → daily dots (dot = game night), weekend/weekday tick marks.
  - Longer windows → per-week columns; each cell is a mini 7-dot cluster or intensity block.
    Default view for full season: current-month detail + season heat context, or paginate by month. Pick
    whichever reads better in implementation; acceptance is legibility at 640px wide.
- Highlight in `--accent`: candidate game nights that are **added starts** (in `addedDates`).
  Anchor-conflicting nights render muted.
- Legend: three items max (anchor games / candidate games / added starts).
- Accessible: `role="img"` + generated `aria-label` ("NYI adds 13 starts, mostly Mon/Wed/Fri...").

## 5. Share to PNG

- Render verdict card + strip to a canvas → PNG download / native share.
  `RosterShareFrame.tsx` already implements canvas export — extract the technique into
  `web/src/lib/shareImage.ts`.
- Fixed 1200×675 layout (looks right on X/Reddit), wordmark + `crackedicehockey.com` footer.
- Fires `pairing_shared` analytics event.

## 6. Ranked list (demoted, honest)

- Compact rows: rank, logo+tricode (tier coloring kept), **+N starts** (large, the one number),
  off-night% small, top target players inline, "Add to stack".
- Progress bars: `StatBar` normalized against the max in the current result set —
  delete the hardcoded caps (60/200/50) and the `/82` conflict normalization.
- Draft Fit stars: **removed**. The list is ordered by addedStarts (ties: off-night share);
  ordering IS the recommendation. Delete `calculateDraftFitScore`/`DraftFitStars`/z-score code.
- Row click → that team becomes the verdict card subject (strip swaps in).
- Top-10 default with "show all 31" (keep localStorage persistence).
- Mobile: the existing 2×2 stat-box card layout adapts: verdict card stacks, strip scrolls
  horizontally in an `overflow-x` container, rows condense.

## Acceptance criteria

- [ ] Typing "McDavid" → chip → verdict card + strip + list render in one API round trip.
- [ ] Teams tab reproduces old team-based workflow (parity check vs production for EDM full season: same addedStarts numbers via the new endpoint).
- [ ] The +N starts number for a known pairing matches a hand-computed count from the raw schedule JSON (document the check in the PR).
- [ ] Strip is legible at 640px and 375px; aria-label present.
- [ ] Share produces a correct PNG with brand footer on Chrome + one WebKit browser.
- [ ] No stepper, no pulse, no emoji, no console.log, no light-mode classes; grammar strings gone.
- [ ] Old flow's localStorage settings migrate (anchors seeded from `off-night-locked-teams` if present).
- [ ] Events fire: `complement_run`, `team_locked` (now "add to stack"), `pairing_shared`.

## Verification

Full manual pass: fresh browser (no localStorage) → player flow; returning-user simulation
(seed old localStorage keys) → migration; slow network throttle → loading states; API-down
simulation → error state uses `EmptyState` primitive. Compare three pairings' numbers against
production endpoints before removing them.

# WP8 — Public AI Coach simplification: "Get this week's best move"

**Goal**: invert the funnel — value first, uploads optional. One hero recommendation instead
of an accordion of prerequisites. Remove the GPT chat from the public surface.
**Depends on**: WP4 (primitives), WP6 (placement decision executed here). **Size**: 4–6 days.
**Branch**: `wp8-coach-simplification`.

## Placement decision (execute, don't debate)

The coach becomes its own public page at **`/coach`** ("Best Move" in copy, not nav —
it is linked from: Draft results footer ("In-season? Get your best move →"), the Season page
answer bar CTA, and the homepage footer. It does NOT return to the homepage toggle, and it
does NOT get a top-nav slot until the studio beta (WP10) absorbs it under My Team.

## 1. New flow (replaces the 5-section accordion in `CoachAssistant.tsx`)

Single-column, three states:

**State A — no roster yet:**
- One `Card`: "Get this week's best add/drop." League preset dropdown (default: Yahoo
  standard points, from `server/src/features/coach/presets.ts`), then a player search
  (reuse `web/src/lib/playerSearch.ts` from WP5) with the prompt "Add your skaters — 5 minimum
  to start."
- OCR demoted to a link under the search: "Have a roster screenshot? Upload it instead."
  (existing `ImageUploadZone` in a `Modal`; unmatched-player reconciliation kept).
- Free agents: optional. If absent, recommendations run against all rostered-eligible players
  in `data/players.json` minus the user's roster (verify the server engine supports a default
  candidate pool; if not, add `defaultCandidatePool` handling to
  `server/src/features/coach/recommendations.ts` — top ~150 skaters by season FPPG).

**State B — roster present:** hero recommendation card:
- "**Add {player} · drop {player}** → **+{Δ} projected points** this week" with the why:
  games gained (mini interleave strip from WP5's component, anchor = current lineup coverage),
  FPPG comparison, badges (tier/B2B — keep `badges.ts` logic).
- "Other options" collapsed list (the remaining 4 recommendations, compact rows).
- Window presets kept (rest-of-week default) via the standard TimeWindow control.

**State C — error/empty:** `EmptyState` primitive with a single retry path.

## 2. Removals

- `CoachChat.tsx` usage from the public surface (component stays for possible studio use;
  route `server/src/routes/coach-chat.ts` gated behind `FEATURE_COACH_CHAT` env flag, default off —
  do not delete the backend, the OpenAI dependency there also serves OCR).
- The `expandedSection` accordion state machine and its debug logging.
- `ConflictDashboard` moves below the hero as a collapsed "Lineup conflicts" panel (it's good
  content, wrong prominence).

## 3. Identity hardening (prerequisite for any promotion of this page)

- Confirm `VITE_COACH_USER_ID` is absent from prod build env (**owner task** — block release on it).
- Server: if `REDIS_URL` is missing in prod, `kvStorage` must fail loudly on writes (it partially
  does — verify the error surfaces to the UI as "couldn't save" rather than silently using /tmp).
- Roster data saved under the anonymous device id; add an "Export/Import my data" JSON button
  in settings (cheap insurance against localStorage loss; also the studio migration path).

## Acceptance criteria

- [ ] Fresh visitor reaches a real recommendation with: preset → type 5 players → result. No uploads, under 2 minutes.
- [ ] OCR path still works end-to-end behind the "upload instead" link.
- [ ] Hero card numbers reconcile with the engine: Δ points matches `simulateSwap` output for the same inputs (log a worked example in the PR).
- [ ] No public chat UI; `FEATURE_COACH_CHAT=false` verified on preview deploy.
- [ ] `coach_reco_run` and `roster_created` {source} events fire.
- [ ] Page is fully primitive-styled (no accordion, no light-mode remnants, no emoji).

## Verification

Manual: all three states; screenshot-OCR with a real Yahoo roster screenshot; kill `REDIS_URL`
locally and confirm the save-failure surfaces visibly; throttled-network loading states.

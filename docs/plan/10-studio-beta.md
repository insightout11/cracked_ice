# WP10 — Studio hardening for the November desktop beta

**Goal**: take `/coach/roster` from 80%-built to a releasable free desktop beta: type-safe,
decomposed, one projection formula, a real first-run, honest persistence.
**Depends on**: WP4 (primitives), WP8 (identity hardening). **Size**: 1–2 weeks.
**Branch**: `wp10-studio-beta`. Target: **early November** (before most leagues' trade/streaming
season peaks).

## 1. Type safety first (prerequisite for agent-safe editing)

- Remove `// @ts-nocheck` from `web/src/pages/RosterPage.tsx` (1,204 lines) and
  `web/src/components/CoachAssistant.tsx` (1,027 lines); grep for other occurrences.
- Fix every surfaced error properly (no `any`-casting sweeps; `as any` count must not increase —
  currently present in sort handlers etc.).
- Re-enable these files in the CI typecheck (WP1 may have excluded them).

## 2. Decompose RosterPage

Extract from the ~25-useState component into hooks, no behavior change:
- `useRosterState` — roster, working lineup, autosave (timer/refs), slot management
- `useProjections` — projection fetching, debounce/abort, merge with client fallback
- `useComparisonFlows` — comparison mode/modal/drawer state, free-agent tracking
- Modals/drawers become self-contained: parent passes ids + callbacks, not 6 state setters.

Definition of done for this section: `RosterPage.tsx` under ~300 lines of layout + hook wiring.

## 3. One projection formula

The FPPG blend (`season*0.5 + last30*0.3 + last7*0.2`) exists in ≥3 places:
`server/src/features/coach/scoring.ts`, desktop `PlayerRow.tsx`, mobile
`calculateProjection.ts` (which self-documents as a manual copy).
- Create `web/src/lib/fppg.ts` as the single client implementation; desktop + mobile consume it.
- Add a golden test asserting client output matches a fixture generated from the server
  implementation, so drift fails CI instead of quietly diverging.

## 4. First-run experience (the beta's make-or-break)

Replace the empty-grid landing with a 3-step wizard (primitives, single modal flow):
1. League preset (Yahoo points default) — full `LeagueSettingsDrawer` reachable via "customize".
2. Add skaters — player search, paste-a-list bulk match (reuse alias resolution), or OCR upload.
   Minimum 5 to proceed; encourage full roster.
3. Land on the lineup with projections + gaps panel already populated for the current week.

Returning users skip the wizard. Wizard completion fires `roster_created`.

## 5. Desktop-first scope enforcement

- The mobile shell (`web/src/mobile/`, `useDeviceDetection` switch in RosterPage) is gated
  behind `VITE_ENABLE_MOBILE_STUDIO` (default off). Mobile visitors to `/team` get a clean
  "best on desktop for now" `EmptyState` with the Season page as the suggested mobile surface.
  Do NOT delete the mobile code — it's post-beta work pending a device test pass.
- Studio chrome: `WorkstationSidebar` gets text labels (icon-only 72px rail fails first-use);
  inline `<style>` blocks in `WorkstationLayout.tsx` move to CSS; "Front Office — Coming Soon"
  stub route is **removed** (nothing unfinished ships in the beta); Press Box renamed "Season"
  and simply routes to the WP7 page.
- Route alias: `/team` → studio (WP6 reserved it); `/coach/roster` redirects. "My Team"
  appears in the top nav (removing the hidden-links era).

## 6. Persistence honesty

- Redis (Upstash free) confirmed in prod (owner, via WP8). Autosave surfaces failures as a
  visible "not saved" state, never silent.
- Export/Import JSON (from WP8) present in studio settings.

## Acceptance criteria

- [ ] `npx tsc --noEmit` clean over the whole web app with zero `@ts-nocheck`.
- [ ] RosterPage ≤ ~300 lines; extracted hooks unit-tested at least for autosave debounce and projection merge.
- [ ] FPPG golden test in CI; grep shows exactly one client implementation.
- [ ] Fresh user: wizard → populated lineup in under 3 minutes (manual timing).
- [ ] Mobile visitor sees the graceful desktop-first message; flag flips the shell on locally.
- [ ] No "Coming Soon" surfaces anywhere; sidebar labeled; `/team` live in nav.
- [ ] A full week of self-dogfooding by the owner (set lineup, evaluate a pickup) without data loss — the final gate before announcing the beta.

## Verification

Playthrough matrix: fresh user, returning user, OCR user, import-JSON user × Chrome/Firefox.
Kill the network mid-autosave and confirm the unsaved indicator. Owner dogfoods for a week
in their real Yahoo league before any public mention.

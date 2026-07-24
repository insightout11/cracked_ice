# WP6 — Direct tool shell + navigation reset

**Goal**: remove the obsolete draft-only/marketing framing and make every existing tool easy to
find without introducing another component system.
**Depends on**: WP4, WP5. **Branch**: `wp6-homepage-nav`.

## Product corrections

- Root route opens the functioning player-first **Optimizer** immediately.
- Replace `Draft`, `Draft Helper`, and `Off-night Draft Tool` umbrella copy with neutral optimizer,
  pickup, roster-fit, or schedule-fit language. Contextual draft wording is allowed only when the
  user explicitly selects a draft/keeper workflow.
- Remove the oversized marketing hero, redundant populated live example, and claims that consume
  space before the real tool.
- Keep the existing WP5 verdict, ranked analysis, matrix, player/team modes, and date controls.
  Clarify labels and calculations; do not delete working analytical surfaces.
- Do not add a separate AI Coach page or homepage toggle.

## Navigation

Top nav is **Optimizer · Season · My Team · Blog**.

- `/` and `/optimizer` resolve to Optimizer; choose one canonical URL and redirect the other.
- `/season` owns weekly schedule, off-night, back-to-back, matrix, and season analysis routes.
- `/team` owns League Workspace/My Team and always renders inside the standard global site shell.
  Until WP10 is complete it may show the current roster
  surface with an honest beta label; it must not be a dead or misleading placeholder.
- Preserve redirects from `/schedule`, `/game-analysis`, `/help`, and old coach/roster URLs. Old
  `/coach/*` pages must redirect outward to `/team` or `/season`; they must not expose the retired
  standalone Workstation shell.
- Help content becomes contextual explanations plus a compact footer help link; do not silently
  discard calculation explanations.

## Layout and responsive behavior

- Compact application header; no fixed-width or absolute-position margin hacks.
- Tool controls and first useful result should dominate the first viewport at 1440px.
- At 390px, navigation, search, date window, and primary result remain usable without horizontal
  clipping or desktop-only empty space.
- Reuse WP4 primitives and semantic tokens. Preserve the dark ice/frosted-glass/cyan system.

## Acceptance criteria

- [ ] A visitor can begin player or team analysis immediately without scrolling past a story/demo.
- [ ] No primary heading frames the optimizer as draft-only.
- [ ] Nav and mobile menu expose Optimizer, Season, My Team, and Blog with correct active states.
- [ ] `/team` uses the global header/mobile navigation, and legacy `/coach/*` URLs redirect into the
  canonical site shell.
- [ ] Off-night, back-to-back, schedule, matrix, and roster destinations remain reachable.
- [ ] Existing WP5 analyses and share links still work.
- [ ] Old URLs redirect without loops or lost query parameters.
- [ ] Browser evidence at 1440px and 390px covers all top-level routes.
- [ ] Web typecheck, tests, lint, and build pass.

## Out of scope

Do not build League Workspace persistence, provider OAuth, add/drop optimization, or new homepage
marketing sections in this WP. WP6 establishes an honest shell for the subsequent product work.

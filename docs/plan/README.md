# Cracked Ice Hockey — Product Plan (revised 2026-07-22)

This directory is the implementation plan for the 2026 relaunch of crackedicehockey.com.
Each numbered file is a **work package (WP)**: self-contained, with file-level tasks,
acceptance criteria, and verification steps. Implementation agents should read this README
and `00-decisions.md` first, then execute their assigned WP without re-deriving strategy.

The canonical product architecture and post-WP5 direction are recorded in
[`product-direction-addendum.md`](product-direction-addendum.md). It supersedes conflicting
language in completed work packages. Read it before WP6 or any roster, acquisition,
provider-integration, or streaming-planner work.

## Strategy (one paragraph)

Cracked Ice is a league-aware fantasy-hockey decision workspace. Visitors can use the
schedule optimizer immediately; serious users configure a League Workspace once and reuse
its scoring, dates, slots, roster, keepers, and acquisition rules throughout Optimizer,
Season, and My Team. Yahoo becomes the first live provider, including a separately gated
lineup-write beta. Fantrax is the first assisted non-OAuth integration. No paywall in 2026.
Full rationale and locked product decisions: `00-decisions.md`.

## Work packages and sequencing

| WP | File | Title | Depends on | Target |
|----|------|-------|-----------|--------|
| 1 | `01-consolidation.md` | Repo consolidation + CI | — | mid-July |
| 2 | `02-season-config.md` | Season config + 2026-27 rollover + data sanity gate | 1 | late July |
| 3 | `03-analytics-seo.md` | Analytics + SEO baseline | 1 | late July |
| 4 | `04-design-system.md` | Design system foundation + brand | 1 | early Aug |
| 5 | `05-draft-helper-redesign.md` | Player-first optimizer foundation (implemented; framing revised in WP6) | 2, 4 | complete |
| 6 | `06-homepage-nav.md` | Direct tool shell + navigation reset | 4, 5 | next |
| 7 | `07-season-page.md` | Season workspace + dense schedule | 2, 4, 6 | after WP6 |
| 8 | `08-coach-simplification.md` | League Workspace foundation | 4, 6 | after WP6 |
| 9 | `09-blog-content-engine.md` | Blog rebuild + weekly content generator | 3, 5 | Sept |
| 10 | `10-studio-beta.md` | My Team core + keeper-aware roster | 8 | after WP8 |
| 11 | `11-yahoo-oauth.md` | Yahoo Connect: read/import/sync | 8, 10 | after My Team core |
| 12 | `12-acquisition-workspace.md` | Pickup board + screenshot candidate import + add/drop analysis | 8, 10 | after My Team core |
| 13 | `13-yahoo-lineup-write.md` | Explicit-confirmation Yahoo lineup writes | 11 | beta after read sync proves stable |
| 14 | `14-fantrax-import.md` | Fantrax adapter checklist folded into universal import | 8, 10, 12 | folded into WP12 |
| 15 | `15-streaming-planner.md` | Transaction-aware multi-move streaming planner | 7, 8, 10, 12 | after acquisition core |
| 16 | `16-player-decision-workspace.md` | Draft board, keeper comparison, and shareable player decisions | 8, 10 | incremental after My Team core |

**Current product path:** the local implementations of WP6, WP7, WP8, WP10, WP12, WP15,
and WP16 now exist and the League Workspace/My Team/acquisition contracts have completed a
desktop + mobile stabilization pass. WP11 Yahoo read/import/sync is the next dependency-safe
feature package; WP13 lineup writes remain a separate safety-gated beta. The site must never
present stale season, player-team, provider-sync, or candidate-pool data as current.

## Ground rules for implementation agents

1. **Branching**: never commit directly to `master`. One branch per WP
   (`wp1-consolidation`, `wp2-season-config`, ...). PRs merge in dependency order.
2. **Verification is part of the task.** Every WP lists verification steps; run them before
   declaring done. Minimum bar for any frontend change: `cd web && npx tsc --noEmit && npm run build`
   and exercise the changed flow in the running app (`npm run dev` in `web/`).
3. **Design constraints (after WP4 lands)**:
   - Only semantic design tokens (`var(--...)` from `web/src/styles/tokens.css`). No raw hex
     in components, no `bg-white`/`bg-gray-*`/`text-gray-*`/`bg-blue-50` Tailwind utilities.
   - No emoji in UI chrome. Icons come from `lucide-react` only.
   - No inline `style={{...}}` objects except for truly dynamic values (computed widths, colors from data).
   - New UI work: load the `frontend-design` skill. Charts/visualizations: load the `dataviz` skill.
4. **No new dependencies** without noting it in the PR description. No paid services —
   free tier only (GA4, Upstash Redis free tier, existing OpenAI pay-per-use for OCR).
5. **No `console.log` in shipped code** (`warn`/`error` allowed). CI enforces after WP1.
6. **Season awareness**: never hardcode a season id or date. Everything reads
   `config/season.json` (created in WP2).
7. **Data files are generated.** Never hand-edit `data/`, `apps/api/cache/`. See `DATA_WARNING.md`
   for why fake schedule data is catastrophic.
8. **The archive branch `archive/pre-consolidation` is read-only history.** Never merge or
   rebase it.

## Current architecture (verified July 2026 — read before editing)

- **Deployed frontend**: `web/` (Vite + React SPA). `vercel.json` at root: builds via
  `build.sh`, output `web/dist`, SPA fallback rewrite.
- **Deployed API**: root `api/` = Vercel serverless functions (complement, added-starts,
  added-starts-bulk, offnights, backtobacks, teams, team-tiers, health). The rewrite
  `/api/coach/:path*` → `/api/simple-test` boots the Express coach app from `server/dist`
  (WP1 renames this).
- **Coach backend**: `server/src/` — Express routes (`coach.ts`, `coach-chat.ts`) +
  `features/coach/` (scoring, simulation, recommendations, kvStorage w/ Redis + /tmp fallback,
  projectionCache) + `services/ocr.ts` (OpenAI vision).
- **Data pipeline**: `.github/workflows/hydrate.yml` (nightly, **still running as of 2026-07-10**
  but pinned to season 20252026 — WP2 re-points it, no re-enable needed) → `apps/api/scripts/hydrate.ts` +
  `calculate-team-stats.mjs` → commits JSON to `apps/api/cache/`, `apps/api/data-cache/`, `data/`.
  Runtime API functions read root `data/`.
- **Stale copies slated for deletion in WP1**: `src/`, `cracked-ice-web/`, `workstation/`,
  `pages/api/`, assorted `*-backup.*` files.
- **User identity**: anonymous per-device id in localStorage (`web/src/services/api.ts:getUserId`),
  overridable by `VITE_COACH_USER_ID` env (must NOT be set in prod builds).

## Owner-only tasks (agents: flag, don't attempt)

- Verify in Vercel dashboard: `VITE_COACH_USER_ID` is **not** set for production;
  `REDIS_URL` **is** set (create free Upstash Redis if missing).
- Create GA4 property, provide Measurement ID (WP3).
- Post weekly content (WP9 generates it).
- Approve the new SVG wordmark (WP4) before it replaces the header logos.

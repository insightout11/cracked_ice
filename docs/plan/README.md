# Cracked Ice Hockey — Relaunch Plan (July → November 2026)

This directory is the implementation plan for the 2026 relaunch of crackedicehockey.com.
Each numbered file is a **work package (WP)**: self-contained, with file-level tasks,
acceptance criteria, and verification steps. Implementation agents should read this README
and `00-decisions.md` first, then execute their assigned WP without re-deriving strategy.

## Strategy (one paragraph)

Free, best-in-class schedule/complement tooling relaunched for the 2026-27 season by
**end of August**, promoted with weekly data-generated content (owner posts ~1x/week).
The hidden roster studio ships as a **free desktop-first beta in November**. No paywall in
2026. Yahoo OAuth import is a conditional later package. Full rationale and all locked
product decisions: `00-decisions.md`.

## Work packages and sequencing

| WP | File | Title | Depends on | Target |
|----|------|-------|-----------|--------|
| 1 | `01-consolidation.md` | Repo consolidation + CI | — | mid-July |
| 2 | `02-season-config.md` | Season config + 2026-27 rollover + data sanity gate | 1 | late July |
| 3 | `03-analytics-seo.md` | Analytics + SEO baseline | 1 | late July |
| 4 | `04-design-system.md` | Design system foundation + brand | 1 | early Aug |
| 5 | `05-draft-helper-redesign.md` | Draft Helper full redesign | 2, 4 | mid/late Aug |
| 6 | `06-homepage-nav.md` | Homepage story + nav/IA restructure | 4, 5 | late Aug |
| 7 | `07-season-page.md` | Season page (Schedule + Game Analysis merge) | 2, 4 | late Aug |
| 8 | `08-coach-simplification.md` | Public AI Coach simplification | 4 | early Sept |
| 9 | `09-blog-content-engine.md` | Blog rebuild + weekly content generator | 3, 5 | Sept |
| 10 | `10-studio-beta.md` | Studio hardening for desktop beta | 4 | early Nov |
| 11 | `11-yahoo-oauth.md` | Yahoo OAuth roster import (conditional) | 10 | TBD |

**Launch-critical path: 1 → 2 → 4 → 5 → 6.** If August gets tight, WP7 ships in a reduced
form (restyle only, merge deferred) and WP8–9 slip to September. The site must never be in a
state where it is deployed but season-stale or half-themed: WP2 and WP4 land whole or not at all.

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

# WP1 — Repo consolidation + CI

**Goal**: one frontend, one runtime API surface, one data pipeline, CI that gates PRs.
Everything later gets cheaper and safer because of this package.
**Depends on**: nothing. **Size**: ~1 week. **Branch**: `wp1-consolidation`.

## Phase 0 — Archive (do first, exactly this)

1. `git branch archive/pre-consolidation master` and push it. This branch is read-only history.

## Phase 1 — Map runtime reality (investigate before deleting)

Before deleting anything, produce `docs/plan/wp1-runtime-map.md` documenting:

1. Every endpoint `web/src/services/api.ts` (and `web/src/lib/coachApi.ts`) actually calls.
2. Which file serves each endpoint in production (root `api/*.ts` function, or `server/dist`
   via the `/api/coach/:path*` rewrite in `vercel.json`).
3. Confirmation that nothing at runtime imports from `apps/api/src/` (the MVP streamer engine
   `rank.ts`/`simulate.ts`/`loaders.ts`/`badges.ts` and `apps/api/src/routes/` are believed dead;
   verify with grep for imports and by checking `build.sh` outputs actually get loaded).
4. Which `data/` paths each runtime function reads (expected: root `data/*.json` only).

If reality contradicts the deletion list below, stop and update this doc before proceeding.

## Phase 2 — Delete (on the WP branch, after Phase 1 confirms)

- `src/` (stale copy of the app; deployed app is `web/`)
- `cracked-ice-web/` (stale copy)
- `workstation/` (stale build artifacts)
- `pages/api/` (stray Next.js-style endpoints: hello.ts, test.ts, etc.)
- Root-level junk: `C:UsersinsigDocumentsfantasy-hockeyapicomplement.ts`,
  `C:UsersinsigDocumentsfantasy-hockeyroster-test.json`, `src_index_backup.css`,
  `web_index_backup.css`, `App.tsx.backup`, `Header.tsx.backup` (glob for `*.backup`, `*.bak`)
- `api/added-starts-backup.ts`, `api/server-backup.ts` (deployed dead endpoints)
- `api/migrate-demo.ts`, `api/redis-test.ts` (deployed debug endpoints — check `redis-test`
  output for leaked config before deleting; note anything found in the PR)
- `server/src/features/coach/simulation.ts.bak`
- `apps/api/src/routes/`, `apps/api/src/services/` MVP engine files, `apps/api/src/server.ts`
  — ONLY the parts Phase 1 confirmed dead. Keep `apps/api/scripts/`, `apps/api/src/data/`,
  and whatever hydrate imports.
- `web/src/App.tsx.backup` and any other `.backup` under `web/`

## Phase 3 — Restructure what remains

1. **Rename the coach entrypoint**: `api/simple-test.ts` → `api/coach.ts`. Update the
   `vercel.json` rewrite (`/api/coach/:path*` → `/api/coach`). Verify the Express app's
   internal routing still matches.
2. **Simplify `build.sh`**: it currently builds `api`, `apps/api`, `server`, `web`. After
   Phase 2 it should build only `server` (for `server/dist`) and `web`, plus install for `api/`
   functions. Remove the `apps/api` build if nothing runtime needs its `dist`.
3. **Lockfiles**: the repo mixes npm and pnpm (`package-lock.json` + `pnpm-lock.yaml` in
   several dirs). Standardize on **npm** everywhere (Vercel default, existing root lockfile).
   Delete pnpm lockfiles; update `hydrate.yml` to use npm (it currently uses pnpm).
4. **Shared API utilities**: root `api/` functions each re-declare `NHL_TEAMS`, date filtering,
   and CORS headers. Extract to `api/_lib/` (underscore prefix so Vercel doesn't deploy it as
   a function): `teams.ts`, `dates.ts`, `respond.ts`. Refactor all functions to use it.
5. **Update `README.md`** (root): rewrite to describe the actual current architecture
   (it still documents the 2-year-old prototype with a `statsapi.web.nhl.com` API that no
   longer exists). Short: what it is, layout, how to run, link to `docs/plan/`.

## Phase 4 — CI

Create `.github/workflows/ci.yml`, on PR + push to master:

1. `npm ci` (root), `cd web && npm ci`, `cd server && npm ci`
2. Typecheck: `cd web && npx tsc --noEmit` — **note**: this will fail until `@ts-nocheck`
  files are excluded; do NOT remove `@ts-nocheck` in this WP (that's WP10). If needed, keep
  typecheck scoped to pass as-is and tighten later.
3. Tests: `cd web && npx vitest run` and `cd server && npm test` if a test script exists.
   Current test health is UNVERIFIED. First: run them. Green: gate on them. Broken: fix
   cheaply or quarantine with `.skip` + a `// QUARANTINED(WP1): reason` comment, and list
   every quarantined test in the PR description.
4. Build: `bash build.sh` must succeed.
5. Lint rule: add `no-console: ["error", { allow: ["warn", "error"] }]` to the web ESLint
   config. Fix or delete the offending ~50+ `console.log` calls (mechanical; most are in
   `UnifiedDraftHelper.tsx`, `CoachAssistant.tsx`, `Header.tsx`, `SchedulePage.tsx`).

## Acceptance criteria

- [ ] `archive/pre-consolidation` branch exists and is pushed.
- [ ] None of the Phase 2 paths exist on the WP branch; `git grep -l "cracked-ice-web\|workstation/"` returns only docs.
- [ ] `api/coach.ts` serves the coach API locally and the rewrite is updated; no file named `simple-test` remains.
- [ ] One package manager (npm) across the repo; `hydrate.yml` runs on npm.
- [ ] CI workflow passes on the PR: typecheck, tests (or documented quarantine list), build, no-console lint.
- [ ] Root README describes current reality.
- [ ] Deployed preview (Vercel) serves: homepage, `/schedule`, `/game-analysis`, `/api/health`,
      `/api/complement?seedTeamCode=EDM`, and a coach endpoint (`/api/coach/users/test/status`) without regression vs production.

## Verification

1. `bash build.sh` locally (or in CI) — clean exit.
2. `cd web && npm run dev` — click through every page; run a complement search; confirm
   results match production for the same inputs.
3. Deploy the branch to a Vercel preview and repeat the endpoint checks above against it.

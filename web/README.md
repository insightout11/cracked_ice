# Cracked Ice Web Frontend

Vite + React client for the Cracked Ice Hockey project. This layer now includes a Coach overlay stub that talks to the staging-only API for streamer recommendations. Use the window controls (7d/14d/custom) to re-run suggestions and see delta shifts.

## Quick Start

```powershell
cd web
npm install
npm run dev
```

The dev server runs on http://localhost:5173 by default. It expects the API gateway to be available (see `apps/api`).

## Environment

Create `web/.env.local` if you want to override defaults:

```
VITE_COACH_API_URL=http://localhost:3000/api
VITE_COACH_USER_ID=demo
VITE_COACH_PRO=true
```

- Set `VITE_COACH_PRO=false` to display the upgrade banner instead of calling the API.
- `VITE_COACH_USER_ID` should map to fixtures in the backend (defaults to `demo`).

## Tests

```powershell
npm test
```

Vitest currently runs a single smoke test for the root app; add additional coverage as features grow.

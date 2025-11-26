# Cracked Ice Hockey AI Coach Backend

This package exposes the staging-only API that powers the AI coaching recommendations for the Cracked Ice Hockey project. It reads mock user contexts, computes fantasy projections from cached stats, simulates lineup starts inside a requested date window, and returns ranked add/drop moves.

## Prerequisites
- Node.js 18+
- npm 9+

## Installation
```powershell
cd server
npm install
```

## Environment Configuration
Create `server/.env` based on the example and keep the staging guardrails intact.
```powershell
Copy-Item .env.example .env
```

Mandatory variables (defaults shown):
- `NODE_ENV=development`
- `NEXT_PUBLIC_ENV=staging`
- `DISABLE_PROD=true`
- `ALLOW_ORIGIN=http://localhost:3000`
- `FEATURE_RECENT_FORM=false` (set `true` to blend recent form into FPPG)
- `FEATURE_BADGE_DEBUG=false` (set `true` to log badge reasoning)

## Running the Dev Server
```powershell
npm run dev
```
The server starts on `http://localhost:8080` (or `PORT` if overridden). Requests from origins outside `ALLOW_ORIGIN` are rejected.

## Request Requirements
- All endpoints require the header `x-user-id`.
- Only staging is supported; the process exits if `NEXT_PUBLIC_ENV` or `DISABLE_PROD` are misconfigured.
- The coach route enforces a 1 second budget, truncates free-agent pools to 30, and drop pools to 8.

### Coach Recommendations Endpoint
`POST /api/coach/recommendations`

```json
{
  "window": {
    "start": "2025-10-10",
    "end": "2025-10-16"
  }
}
```

Response fields:
- `baseline_points`: projected points if no moves are made.
- `recommendations[]`: each contains `add_player`, `drop_player`, `delta_points`, `delta_gp`, and `badge`.
- `window`: echo of the input range.

Mock user contexts live under `data/coach/users`. To exercise the API locally send `x-user-id: demo-user`.

## Testing
```powershell
npm test
```
Vitest covers the lineup simulator and delta points math for the demo user scenario.

## Development Notes
- No live NHL calls occur on the request path; data is loaded from the cached fixtures in `data/`.
- Feature flags are environment-driven so we can tune behaviors without new deploys.
- Keep new work ASCII only and avoid touching production infrastructure.
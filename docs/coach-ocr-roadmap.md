# OCR + Front-End Workflow Draft

## Screenshot Ingestion Pipeline
1. **Upload** – Front-end submits `multipart/form-data` to `POST /api/coach/users/:userId/free-agents/upload` with fields:
   - `image`: screenshot file
   - `provider` (optional): `openai`, `groq`, etc.
   - `hints` (optional): extra prompt strings (e.g. "Yahoo stat columns order").
2. **Server handler**
   - Persists the raw image under `server/data/uploads/{uuid}.png` for audit.
   - Calls `parseRosterScreenshot(imageBuffer, { provider, userId, promptHints })`.
   - The helper delegates to the selected LLM/OCR implementation (ChatGPT Vision, Groq LLaVA, etc.).
   - Normalization logic matches OCR names to canonical player ids via `searchPlayers`, records confidence scores, and surfaces unresolved names back to the UI for manual mapping.
   - On success, writes `free_agents.json` through `writeUserFreeAgents` and returns `{ ok: true, matched, unresolved }`.
3. **Fallbacks** – If OCR is disabled or fails, the handler returns a `501`/`422` with the raw text so the UI can prompt the user to finish manually.

## Front-End Workflow (coach overlay)
1. **League Settings Wizard**
   - Dedicated modal to capture league name, scoring weights, lineup slots.
   - Persist via `PUT /api/coach/users/:userId/settings`.
2. **Roster Builder**
   - 16-slot grid pulling from the Player Lookup panel; allows CSV paste or JSON import.
   - Save via `PUT /api/coach/users/:userId/roster`.
   - After saving, auto-fetch conflict report for the default window.
3. **Free-Agent Intake**
   - Option A: drag-and-drop screenshot → calls the OCR upload endpoint, renders matches + unresolved players.
   - Option B: manual search/add list → reuses `PUT /api/coach/users/:userId/free-agents`.
4. **Conflict Dashboard**
   - Visual display powered by `GET /api/coach/users/:userId/conflicts` showing daily starters, bench counts, and unused slots.
   - Highlights problem days before running the coach.
5. **Run Coach**
   - Once settings + roster (+ optional free agents) are uploaded, the existing overlay issues `POST /api/coach/streamers`.
   - Show warnings when any component is missing or stale (e.g. last modified timestamp older than N hours).

## Next Implementation Steps
- Add upload endpoint placeholder: `POST /api/coach/users/:userId/free-agents/upload` (returns 501 until provider chosen).
- Extend `server/src/services/ocr.ts` with provider adapters; include retry/backoff and structured logging.
- Track file modification timestamps (settings/roster/free agents) to inform the UI when data is outdated.
- Build React hooks for the new endpoints and integrate them into a multi-step “Coach Setup” experience.

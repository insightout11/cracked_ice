# Coach API Contracts

The coach service routes expose normalized scoring data using the runtime weights system. Incoming league data is merged with preset defaults (falling back to the `Default` preset when no league configuration is supplied), and player IDs are coerced to numeric `nhl` identifiers throughout the responses.

## GET /api/coach/health

- **Purpose:** Advertise feature flags to the frontend without touching user data.
- **Auth:** none
- **Request body:** none
- **Response:**

```json
{
  "version": "1.4.2",
  "capabilities": {
    "presets": true,
    "weights": true,
    "projections": true
  }
}
```

## GET /api/coach/users/:userId/context

- **Purpose:** Return the normalized league profile for a stored user context.
- **Params:** `userId` path param (3-64 chars, letters/digits `-_.`).
- **Request body:** none
- **Response:**

```json
{
  "league_profile": {
    "league_name": "Demo Dynasty Points",
    "scoring_type": "points",
    "preset_name": "KKUPFL",
    "lineup_slots": {
      "C": 2,
      "LW": 2,
      "RW": 2,
      "D": 4,
      "G": 2,
      "BN": 4,
      "IR": 1
    },
    "skater_scoring": {
      "goals": 4.5,
      "assists": 3,
      "shots_on_goal": 0.5,
      "blocks": 0.5,
      "hits": 0.25,
      "shorthanded_goals": 2,
      "shorthanded_assists": 2,
      "power_play_points": 0.5
    },
    "goalie_scoring": {
      "wins": 3,
      "saves": 0.3,
      "goals_against": -1.5,
      "shutouts": 3
    }
  },
  "note": "All required uploads detected."
}
```

## GET /api/coach/users/:userId/roster

- **Purpose:** Provide the roster list enriched with blended FPPG and current stat totals.
- **Params:** `userId` path param.
- **Request body:** none
- **Response:**

```json
{
  "roster": [
    {
      "id": "8478402",
      "full_name": "Vincent Trocheck",
      "team": "NYR",
      "positions": ["C", "RW"],
      "current_slot": "C",
      "games_played": 18,
      "stats": {
        "goals": 7,
        "assists": 14,
        "shots_on_goal": 58,
        "blocks": 6,
        "power_play_points": 8,
        "shorthanded_goals": 0,
        "shorthanded_assists": 1,
        "hits": 12,
        "game_winning_goals": 2
      },
      "blendedFppg": 3.12
    }
  ]
}
```

Notes:
- `positions` always contains an array (`splitPositions`) even if only one slot is eligible.
- `blendedFppg` is derived with `calculatePlayerFppg` using runtime weights and the cached stats snapshot when available.

## POST /api/coach/users/:userId/projections

- **Purpose:** Simulate upcoming starts and produce fantasy projections for the supplied roster window.
- **Params:** `userId` path param.
- **Body:**
  - `league` *(optional)*: league profile payload identical in shape to the stored `league_profile`.
  - `league_profile` *(optional)*: alias for `league`; either key is accepted.
  - `window`: `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }` (inclusive).
  - `roster`: array of `{ "playerId": "nhl:8478402" | "8478402", "slot": "C" }`.

  The handler normalizes IDs with `toNumericId`, merges scoring weights through `normalizeLeagueProfile`, and simulates starts with `simulateLineup`.

- **Example request:**

```json
{
  "league": {
    "league_name": "Demo Dynasty Points"
  },
  "window": {
    "start": "2025-01-13",
    "end": "2025-01-19"
  },
  "roster": [
    { "playerId": "nhl:8478402", "slot": "C" },
    { "playerId": "8476468", "slot": "D" }
  ]
}
```

- **Response:**

```json
{
  "projections": {
    "8478402": {
      "fppg": 3.28,
      "starts": 3,
      "projectedPoints": 9.84,
      "startsByDate": {
        "2025-01-13": 1,
        "2025-01-15": 1,
        "2025-01-18": 1
      }
    },
    "8476468": {
      "fppg": 3.6,
      "starts": 4,
      "projectedPoints": 14.4,
      "startsByDate": {
        "2025-01-14": 1,
        "2025-01-16": 1,
        "2025-01-18": 1,
        "2025-01-19": 1
      }
    }
  },
  "meta": {
    "weightsSource": "league"
  }
}
```

Notes:
- `projections` keys are always numeric strings stripped of any `nhl:` prefix.
- `weightsSource` is one of `league`, `preset(Name)`, or `custom`, depending on how weights were resolved.
- `startsByDate` is included only when simulated starts are available for that skater/goalie during the requested window.

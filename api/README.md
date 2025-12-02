# API Serverless Functions

This directory contains Vercel serverless functions for the Fantasy Hockey app.

## Coach API

The `/api/coach/*` endpoints handle roster management, player search, and recommendations.

### Key endpoints:
- `GET /api/coach/health` - Health check
- `GET /api/coach/users/:userId/roster` - Get user roster
- `POST /api/coach/users/:userId/roster/add` - Add player to roster
- `DELETE /api/coach/users/:userId/roster/remove/:playerId` - Remove player

### Storage

User data is persisted in Redis (Vercel KV) with filesystem fallback.

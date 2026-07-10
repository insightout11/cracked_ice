# WP11 — Yahoo OAuth roster import (conditional — do not start unprompted)

**Status**: deferred. **Trigger**: studio beta (WP10) shows weekly return usage — owner decides
using GA4 (`roster_created` → returning `/team` sessions across ≥3 consecutive weeks), or
simply wants it for personal use. **Size**: 1–2 weeks. **Depends on**: WP10.

## Why it's last

It is the single feature that makes the studio feel finished (roster entry friction → zero,
data always current), but it demands: a Yahoo developer app, OAuth2 flow with token refresh,
a real callback endpoint, per-user token storage, and mapping Yahoo player ids to
`data/players.json` ids. None of that is worth building before evidence that people return.

## Sketch (expand into a full spec when triggered)

1. **Yahoo app registration** (owner): Fantasy Sports read scope (`fspt-r`), callback
   `https://crackedicehockey.com/api/yahoo/callback`.
2. **Backend** (`server/src/features/yahoo/`): OAuth2 authorization-code flow; tokens
   (access + refresh) encrypted at rest in Redis under the existing anonymous user id —
   this de facto turns the device id into an account; consider magic-link email upgrade here.
3. **Import**: Yahoo Fantasy API → league settings (scoring weights → `LeagueProfile`),
   roster (player key mapping table `data/yahoo-id-map.json`, generated in hydrate from
   name+team alias resolution with manual-review fallback for mismatches), free agents (top N).
4. **UX**: "Connect Yahoo" as step 1 of the WP10 wizard (replacing manual entry as primary);
   nightly re-sync; visible "synced from Yahoo · 2h ago" state; disconnect = delete tokens.
5. **Safety rails**: read-only scope only; never write to Yahoo; token failures degrade to the
   manual roster, never block the studio.

## Pre-work worth doing early (cheap, non-blocking)

During WP10, keep `LeagueProfile` and roster schemas Yahoo-shaped (they already are — the OCR
flow was designed around Yahoo screenshots), and build the name→id alias resolution robustly;
it is the same matching problem OCR already solves in `server/src/services/alias_resolver.ts` /
`apps/api` equivalents.

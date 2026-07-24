# WP11 — Yahoo Connect: read/import/sync

**Goal**: eliminate repeated manual setup for Yahoo users while keeping Yahoo as a provider attached
to the platform-neutral League Workspace.
**Depends on**: WP8, WP10. **Branch**: `wp11-yahoo-connect`.

This package is no longer conditional on studio analytics. It begins only after the shared league
and roster schemas are reliable. App registration, credentials, auth settings, and production
configuration remain owner approval tasks.

The non-credentialed durable-profile, guest-migration, optimistic-revision, and synthetic provider
reconciliation foundation is documented in [`wp11-profile-foundation.md`](wp11-profile-foundation.md).
Redis is not the planned durable source of truth for profiles or workspaces.

The approved Supabase/Postgres implementation and owner activation steps are documented in
[`wp11-supabase-setup.md`](wp11-supabase-setup.md). The account UI remains dormant without public
Supabase configuration, and real Yahoo credentials remain outside this implementation slice.

### Implemented connection foundation (local, not activated)

- Server-only `provider_connections` and short-lived `provider_oauth_attempts` tables are RLS-enabled with no browser-role grants.
- Access and refresh tokens use AES-256-GCM envelopes; OAuth attempts use hashed state plus S256 PKCE.
- Signed-in status/connect/disconnect routes validate the Supabase session server-side.
- The callback consumes state once and stores the newest token pair atomically without returning credentials to the browser.
- League Workspace exposes a read-only Yahoo connection control and clearly reports when the developer app is not configured.

Activation still requires Matt to create/approve a Yahoo Fantasy Sports app with **Read** permission, register the exact callback URL,
and place the client ID, client secret, service-role credential, and a generated encryption key in server-only environment configuration.
Secrets must never be entered into Vite variables or committed files.

## 1. Feasibility spike and contract fixtures

Before building UI, verify against a real owner-approved Yahoo developer application and hockey
league:

- authorization-code OAuth and refresh-token rotation;
- durable Yahoo user/provider identity;
- league discovery and multiple-league selection;
- settings/scoring/slots/locking/playoff mapping;
- roster and date-specific lineup mapping;
- free-agent, waiver, and taken status filters;
- transaction/acquisition state available through supported reads; and
- player-id mapping coverage and rate-limit/error behavior.

Record sanitized fixtures and unsupported/ambiguous fields. Do not guess mappings silently.

### Draft-time sync evidence gate

Yahoo's public Fantasy Sports guide confirms OAuth-protected hockey league, team, and player data
retrieval, but it does not publish a real-time guarantee or refresh cadence for draft results. Treat
draft snapshots as eventually consistent until an owner-approved test draft measures otherwise.

Before enabling a `Live` badge or automatic polling, the feasibility spike must record:

- whether draft results are readable before, during, and immediately after a hockey draft;
- observed pick latency and whether results ever arrive out of order or disappear temporarily;
- stable provider player/team identifiers and their canonical NHL-player mapping coverage;
- response behavior when the draft is paused, reset, completed, or the user reconnects;
- safe manual-refresh and polling intervals under observed rate limits; and
- sanitized pre-draft, partial-draft, completed-draft, stale, duplicate, and unmapped fixtures.

The platform-neutral reconciler may be built and tested with explicitly synthetic contract data
before this spike. It must be idempotent, reject older snapshots, preserve manual annotations, and
surface unmapped picks rather than guessing by player name. Provider connection, credentials,
payload parsing, and polling remain blocked on the real-app approval gate above.

## 2. Security and identity

- Attach provider connection to a durable Cracked Ice profile.
- Encrypt access/refresh tokens at rest; never expose them to frontend storage or logs.
- Store the newest rotated refresh token atomically.
- Use state/PKCE and callback protections appropriate to the selected OAuth client profile.
- Disconnect revokes/deletes local credentials and clearly defines retained manual workspace data.
- Reauthorization and token failures degrade to last-known/manual data without corrupting it.

## 3. Import and sync

Import into WP8 contracts rather than Yahoo-specific UI models:

- league identity and scoring provenance;
- roster slots, lock behavior, dates, and playoffs;
- own roster, eligibility, keeper flags when represented, and current lineup;
- live player availability/waiver/taken evidence; and
- acquisition context supported by the API.

Provider data is authoritative for provider-owned fields. Preserve user-only annotations such as
protected-from-recommendations. Show last successful sync, current error, and data age. Support
manual refresh; schedule background sync conservatively only after rate/operational behavior is
measured.

## 4. Read-only UX

`Connect Yahoo` is available in League setup/settings. Users select which Yahoo league to attach.
My Team and acquisition surfaces label Yahoo-confirmed data as live only while it meets freshness
policy. This WP does not mutate Yahoo.

## Acceptance criteria

- [ ] OAuth connect, refresh, reauthorize, and disconnect pass against a real test league.
- [ ] Multiple Yahoo leagues map to distinct League Workspaces.
- [ ] Scoring, slots, dates, roster, and availability reconcile with Yahoo fixtures/manual checks.
- [ ] No tokens or private payloads appear in browser storage, logs, analytics, or error messages.
- [ ] Sync drift/errors are visible and never overwrite newer manual-only annotations.
- [ ] Expired/revoked connection retains a usable last-known/manual workspace.
- [ ] Provider contract and mapping tests use sanitized fixtures.
- [ ] Security review and owner approval precede any production credential/configuration change.

## Explicit non-goals

No lineup, add/drop, waiver, trade, or commissioner writes. Lineup write is WP13 with a separate
owner approval and safety review.

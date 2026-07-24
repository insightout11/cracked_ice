# WP11 durable-profile foundation

Implemented locally on 2026-07-24 before any authentication, provider credential, or production
storage work.

## Persistence decision

- Guest League Workspaces remain versioned browser-local data with JSON export/import.
- Signed-in profiles use Supabase Postgres as the durable source of truth. The approved browser
  client is `@supabase/supabase-js`; production project creation, migration application, and
  environment configuration remain separate owner-controlled activation steps.
- Redis is not the source of truth for profiles, leagues, rosters, or provider connections. It may
  remain an optional cache, rate-limit store, short-lived session store, or job coordinator.
- The anonymous `cracked-ice-user-id` remains a compatibility identifier for legacy Coach routes.
  It is not an account and may never own Yahoo credentials.
- No unauthenticated profile-by-id write endpoint is permitted. The repository contract exists
  before routes so authorization cannot be bolted on after data becomes reachable.

## Implemented contracts

- `server/src/features/profile/workspaceRepository.ts` defines durable profile/workspace documents,
  create semantics, and optimistic revision checks. Its in-memory adapter is test-only and explicitly
  prohibited as a production fallback.
- `web/src/lib/profileWorkspaceMigration.ts` plans guest-to-account migration. Non-overlapping
  leagues import automatically; same-id or same-provider collisions require `keep account`, `use
  device`, or `keep both`. A kept device copy has its provider attachment removed to prevent two
  workspaces from claiming one Yahoo league.
- `web/src/lib/providerWorkspaceSync.ts` is the provider-neutral reconciliation boundary currently
  exercised with synthetic Yahoo snapshots. It rejects old observations and wrong-league payloads,
  preserves manual keeper/protected annotations, replaces provider-owned roster state, and reports
  missing/duplicate player mappings instead of guessing by name.
- League Workspace validation now rejects duplicate league IDs and missing active-league references.

## Owner gates before real OAuth

1. Select the durable profile authentication path. Yahoo may be one sign-in method, but a
   provider-neutral option must exist so Fantrax/manual users are not forced through Yahoo.
2. Approve the PostgreSQL provider and exact dependency/migration workflow.
3. Approve a Yahoo developer application, callback URLs, scopes, and credential handling.
4. Provide an owner-controlled hockey test league for sanitized fixture capture.
5. Approve production environment and secret-management changes after a security review.

Until those decisions are approved, no account UI should imply cloud sync is active and no real
provider token should be accepted or stored.

## Approved implementation

Use one Supabase project for Postgres plus provider-neutral email magic-link/OTP authentication,
with Row Level Security requiring `auth.uid()` ownership for every profile/workspace row. This is
the smallest operational surface for the current Vite application and avoids combining separate
database and identity vendors. The client, SQL migration, guest/account reconciliation, and
optimistic cloud-save path are implemented locally. Follow `wp11-supabase-setup.md` before enabling
it; no Supabase or Vercel project settings were changed as part of the local implementation.

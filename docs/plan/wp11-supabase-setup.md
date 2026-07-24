# WP11 Supabase activation checklist

The codebase contains the account client, PostgreSQL migration, row-level policies, local/device
migration flow, and optimistic cloud saves. It remains dormant when the two public Vite variables
are absent, so the existing guest experience is unchanged.

## Owner-controlled activation

1. Create the Supabase project in Matt's account and choose the desired data region.
2. Review and apply `supabase/migrations/202607240001_durable_profiles.sql` in a non-production
   project first.
3. In Supabase Auth URL settings, set the canonical site URL and explicitly allow localhost,
   preview, and production callback URLs that should receive magic links.
4. Copy only the project URL and publishable/anon key into local `web/.env.local` using the names in
   `web/.env.example`. Never place the service-role key in Vite variables or browser code.
5. Test two separate users. Confirm each can read and update only its own `profiles` and
   `workspace_documents` row, and that an unauthenticated request cannot access either table.
6. Test guest migration with: no cloud document, a non-overlapping cloud document, a same-ID
   conflict, a same-provider-league conflict, a stale revision, sign-out/sign-in on the same
   profile, and a different profile on the same browser.
7. Only after non-production verification, explicitly approve the corresponding Vercel environment
   variables and production migration.

## Storage behavior

- Guests continue using `cracked-ice-league-workspaces` plus JSON export/import.
- A first sign-in creates revision 1 from the reviewed guest workspace.
- Every later save uses `where revision = expected` and increments by exactly one. The database
  trigger rejects skipped revisions, and the client surfaces conflicts rather than overwriting.
- An untouched placeholder guest league is not copied into an existing account.
- Browser data marked as belonging to one profile is blocked from automatic upload into another
  profile.
- Sign-out retains the local cached workspace. Redis is not involved in this path.

## Deferred Yahoo secrets

Yahoo access and refresh tokens are not part of this migration and must never be written to
`workspace_documents`. WP11's real OAuth callback requires a server-only encrypted provider
connection table, key-management decision, refresh-token rotation, and separate owner review.

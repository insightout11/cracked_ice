# WP14 — Folded into universal import adapters

**Status**: folded into WP12. Fantrax does not ship as a separate user-facing tool. Its copied-table,
screenshot, vocabulary-mapping, and fixture work belongs behind the shared League Workspace import
and review flow. Retain this file only as the provider-adapter checklist.

**Goal**: make Fantrax captures and copied tables reliable inputs to the universal roster/candidate
pipeline while pursuing a supportable official integration path.
**Depends on**: WP8, WP10, WP12. **Branch**: `wp14-fantrax-import`.

## Scope

- Research/document current Fantrax export, copied-table, screenshot, public-league, and any
  owner-approved partner/API options before implementation.
- Add Fantrax-specific instructions and parsers for own roster, league settings where visible, and
  available-player results.
- Map Fantrax position/status vocabulary to canonical contracts with review for ambiguity.
- Provide a fast repeat import that replaces candidate observations without requiring a full league
  roster refresh.
- Keep manual overrides and Cracked Ice annotations when importing updated provider data.

Do not request passwords, session cookies, browser storage, or undocumented authenticated scraping.
A browser extension is a separate later decision with its own permissions and security review.

## Acceptance criteria

- [ ] Real owner-provided sanitized Fantrax captures/tables parse through reviewed fixtures.
- [ ] Own roster and current candidate imports are distinct; neither requires maintaining every
      league roster.
- [ ] Unknown settings are requested once and saved in League Workspace.
- [ ] Availability observations show source/time and never masquerade as live API state.
- [ ] Layout changes in fixtures fail clearly rather than producing confident wrong matches.
- [ ] Desktop/mobile instructions and import flow pass browser verification.

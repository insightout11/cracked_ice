# WP6 — Homepage story + navigation/IA restructure

**Goal**: a first-time visitor understands the product in one screen; the nav matches user
intent instead of internal history.
**Depends on**: WP4 (brand/primitives), WP5 (verdict card exists to embed).
**Size**: 3–4 days. **Branch**: `wp6-homepage-nav`.

## 1. Information architecture

New top nav (update `web/src/components/Header.tsx` + `MobileMenu.tsx`):

| Nav item | Route | Content |
|---|---|---|
| **Draft** | `/` | The redesigned Draft Helper (WP5) with the story header below |
| **Season** | `/season` | Weekly grid + season view (WP7) |
| **My Team** | `/team` | Studio — nav item HIDDEN until WP10 beta ships |
| **Blog** | `/blog` | unchanged route |

- Redirects in `vercel.json`: `/schedule` → `/season`, `/game-analysis` → `/season?view=season`,
  `/help` → `/` (help content becomes tooltips + a footer FAQ section). Delete the
  `/schedule-v2` route and `ScheduleV2.tsx` if WP1's runtime map confirmed it unreferenced.
- Keep `/coach/*` routes working (studio beta), aliased to `/team` at WP10.
- AI Coach: no longer a homepage toggle. It gets its own spot per WP8 (either `/coach` public
  page linked from Draft results, or a section below the fold — WP8 decides placement).
  Remove the `activeMode` toggle from `HomePage.tsx`.

## 2. Homepage as story

Above-the-fold, in order:
1. **Headline**: "The right pair of centers plays **13 more games** than the wrong one."
   Subline: "Cracked Ice finds the schedule edges your league ignores. Free."
2. **Live default verdict card**: pre-computed McDavid/EDM example rendered immediately
   (no dropdown-first). Interacting with it (typing a player) morphs into the real tool —
   the demo IS the input.
3. The full Draft Helper below.

Footer: data freshness line (WP2), buy-me-a-coffee, blog links, one-line about.

## 3. Cleanup within scope

- `Header.tsx`: remove `console.log`s, the `marginLeft: '200px'` absolute-positioning hack,
  and both PNG logos (WP4 SVG). Rebuild as flex layout with the primitives.
- Per-route `<title>` via the WP3 hook ("Draft Tools — Cracked Ice Hockey", etc.).
- Delete `HelpPage.tsx` after its content is distributed into tooltips/FAQ; keep a redirect.

## Acceptance criteria

- [ ] Fresh visitor at `/` sees headline + a populated example verdict card without any interaction, within one viewport at 1440px and 390px.
- [ ] Nav shows Draft · Season · Blog (My Team absent); active states correct; mobile menu matches.
- [ ] All old URLs 301 to their new homes (curl each: `/schedule`, `/game-analysis`, `/help`, `/schedule-v2`).
- [ ] Lighthouse (mobile) performance ≥ 80, SEO ≥ 95 on `/`.
- [ ] No regression in Draft Helper functionality embedded on the page.

## Verification

Preview deploy → walk all routes + redirects, run Lighthouse, test back/forward navigation,
confirm GA4 pageviews register the new routes.

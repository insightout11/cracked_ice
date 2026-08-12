# Off-Night Bible launch review

Status: owner-approved editorial and release package. Production deployment approved on 2026-08-12; Reddit posting is not yet approved.

Publication date: 2026-08-12.

## Package

- Published article source: `content/posts/2026-27-off-night-bible.md`
- Canonical calculations: `content/generated/2026-27/schedule-analysis.json`
- Paste-ready Reddit post: `content/social/2026-27/off-night-bible-reddit.md`
- Voice guide: `content/strategy/cracked-ice-voice-guide.md`
- Editable graphics: `content/social/2026-27/assets/off-night-bible-*.svg`
- Reddit-ready graphics: `content/social/2026-27/assets/off-night-bible-*.png`
- Deployable article graphics: `web/public/blog-assets/off-night-bible-*`

## Automated verification completed

- Regeneration from the latest hydrated `master` changed no schedule conclusions.
- All 32 teams have 84 games inside the configured regular-season dates.
- The compact date index and detailed game index agree for every team.
- All 1,067 player IDs are unique and all populated player-team codes are recognized.
- The article's schedule, player-affiliation, stats, scoring-preset, and week inputs are covered by canonical hash `48672be45ea55834fe5a0dbe48deec452dcb97a0e2ebaea241def4db98797329`.
- On 2026-08-06, the NHL player API agreed with the local team and right-wing assignments for Nikita Kucherov (TBL), David Pastrnak (BOS), Pavel Dorofeyev (NYR), and Kirill Marchenko (CBJ).
- The three 1200 x 675 PNG graphics were rendered and visually inspected.
- The approved article is `status: published`, dated 2026-08-12, and enters the generated blog registry and sitemap.
- The generated article-table wrapper is safelisted in Tailwind and constrained to horizontal scrolling so wide tables do not make the mobile page overflow.
- The complete original 2025–26 articles were recovered from commit `7e3418f` and restored under `content/posts/`; the short migration summaries are no longer the published archive copies.
- Machine drafts live under `content/generated/2026-27/drafts/`. Normal regeneration does not recreate or overwrite the published article.
- The Bible received a first editorial rewrite using the recovered Cracked Ice voice at a deliberately lower intensity than the original 2025 articles.

## Release instructions

1. Production deployment was explicitly approved on 2026-08-12.
2. Use the Reddit title and body exactly as separated in `content/social/2026-27/off-night-bible-reddit.md`; do not include this review file.
3. Attach `content/social/2026-27/assets/off-night-bible-third-rw.png` to the Reddit post.
4. Recheck Dorofeyev's and Marchenko's teams immediately before posting. As of 2026-08-12, Dorofeyev is with the Rangers and Marchenko remains with Columbus amid trade rumours.
5. The controlled example assumes two active RW slots and no utility spot; it is not a claim about every provider's current multi-position eligibility.
6. Confirm Google Search Console ownership and sitemap submission when convenient; this is not a release blocker.

## Publication gate

The article lives in `content/posts/` with a unique slug, `status: published`, and a 2026-08-12 publication date. Run `npm run content:prepare`, then inspect the generated registry and sitemap. The production build must verify the prerendered HTML, social metadata, and mobile table containment before release. Reddit posting remains a separate owner-approved action.

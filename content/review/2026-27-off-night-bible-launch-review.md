# Off-Night Bible launch review

Status: owner-approved editorial; prepared for an undated site preview. Deployment is not yet approved.

Publication date: intentionally omitted until the article is shared.

## Package

- Published article source: `content/posts/2026-27-off-night-bible.md`
- Canonical calculations: `content/generated/2026-27/schedule-analysis.json`
- Reddit draft: `content/social/2026-27/off-night-bible-reddit.md`
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
- The approved article is now `status: published` and enters the generated blog registry and sitemap without displaying a date.
- The complete original 2025–26 articles were recovered from commit `7e3418f` and restored under `content/posts/`; the short migration summaries are no longer the published archive copies.
- Machine drafts live under `content/generated/2026-27/drafts/`. Normal regeneration does not recreate or overwrite the published article.
- The Bible received a first editorial rewrite using the recovered Cracked Ice voice at a deliberately lower intensity than the original 2025 articles.

## Owner decisions before publication

1. Approve the Kucherov/Pastrnak/Dorofeyev/Marchenko opening example and the overall voice.
2. Confirm platform-specific fantasy eligibility for the four players. The model intentionally uses a controlled two-RW lineup, not every provider's current multi-position eligibility.
3. Add `publishDate: YYYY-MM-DD` when the article is shared.
4. Choose the primary distribution graphic. Recommended: `off-night-bible-84-game-illusion.png`.
5. Review the Reddit copy and add the final published article URL only after the article is live.
6. Confirm Google Search Console ownership and sitemap submission.

## Publication gate

The article now lives in `content/posts/` with a unique slug and `status: published`, but no publication date. Run `npm run content:prepare`, then inspect the generated registry, sitemap, prerendered HTML, and social unfurl. Deployment and posting remain separate owner-approved actions.

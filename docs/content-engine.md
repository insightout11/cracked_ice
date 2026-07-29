# Cracked Ice content engine

The content engine turns the current schedule and reference stats into reviewable editorial material. It never publishes content.

## Owner workflow

1. Run `npm run content:generate` from the repository root. Pass a week with `node scripts/generate-content.mjs --start YYYY-MM-DD` when needed.
2. Review the canonical facts in `content/generated/<season>/schedule-analysis.json`.
3. Edit the weekly and flagship drafts in `content/drafts/` and the Reddit copy in `content/social/`.
4. Verify injuries, roles, news, and player availability outside the generator. The engine intentionally makes no free-agent availability claims.
5. To publish later, copy an approved article into `content/posts/`, set `status: published`, and use a unique slug. A deployment remains a separate owner-approved action.

`npm run content:prepare` validates published frontmatter, builds the browser-safe post registry, and regenerates the sitemap. Drafts cannot enter either output.

## Outputs

- `content/generated/<season>/schedule-analysis.json`: canonical machine-readable analysis and source metadata.
- `content/drafts/*.md`: owner-reviewable blog drafts.
- `content/social/<season>/*.md`: Reddit/social copy.
- `content/social/<season>/assets/*.svg`: dependency-free social graphics.
- `web/src/generated/blog-posts.json`: generated registry of published posts only.

## Methodology

- Off-night: 8 or fewer NHL games on a date.
- Team off-nights: team games that fall on those dates.
- One-slot pairing: the union of two team date sets; shared dates are conflicts.
- Editorial FPPG: the checked-in Cracked Ice default preset, clearly labeled. Interactive tools continue to use each user's saved league settings.
- Weekly default: the first Monday–Sunday window on or after the current date that contains NHL games.

The schedule file, refresh timestamp, stats timestamp, and an input hash are stored with every canonical run.

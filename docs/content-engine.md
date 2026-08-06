# Cracked Ice content engine

The content engine turns the current schedule and reference stats into reviewable editorial material. It never publishes content.

## Owner workflow

1. Run `npm run content:generate` from the repository root. Pass a week with `node scripts/generate-content.mjs --start YYYY-MM-DD` when needed. The Off-Night Bible defaults to the current launch target; override it with `node scripts/generate-off-night-bible.mjs --publish-date YYYY-MM-DD`.
2. Review the canonical facts and machine drafts in `content/generated/<season>/`. Machine drafts are safe to regenerate at any time.
3. Edit the protected weekly and flagship drafts in `content/drafts/` and the Reddit copy in `content/social/`. Normal generation preserves existing editorial drafts. Use `--replace-editorial` only when intentionally discarding editorial work.
4. Verify injuries, roles, news, and player availability outside the generator. The engine intentionally makes no free-agent availability claims.
5. To publish later, move an approved article into `content/posts/`, set `status: published`, and use a unique slug. `publishDate` is optional until distribution; when omitted, the site hides the date and excludes date fields from article metadata. A deployment remains a separate owner-approved action.

`npm run content:prepare` validates published frontmatter, builds the browser-safe post registry, and regenerates the sitemap. Drafts cannot enter either output.

Generation validates both schedule indexes, all 32 team codes, per-team game totals, unique player IDs, and player-team codes. The canonical input hash covers the actual schedule, player affiliations, stats, scoring preset, and requested week—not only source timestamps. During the offseason an older schedule refresh date is expected and is retained as provenance; editorial player news still requires owner review immediately before publication.

## Outputs

- `content/generated/<season>/schedule-analysis.json`: canonical machine-readable analysis and source metadata.
- `content/generated/<season>/drafts/*.generated.md`: replaceable machine drafts; never published directly.
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

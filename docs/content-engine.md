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

## Weekly Edge (the Sunday post)

The weekly post simulates lineups instead of counting games, and everything is in usable games (games that fit a lineup), never fantasy points. For each Monday-Sunday week:

1. `cd web && npx vite-node ../scripts/weekly/weekly-edge.ts -- --start YYYY-MM-DD` (a Monday). This drafts 1,800 Yahoo-style rosters from ADP, solves each night's lineup, and writes `content/generated/<season>/weekly/<start>.json`: nights (games, share of rosters with an open slot), storylines (light-night back-to-backs, the Sunday-Monday bridge team), every team over three horizons (week, 2 weeks, 30 days), top targets per horizon with player options across Yahoo percent-owned bands, strategies (one add, a two- or three-add team chain, a two-team rotation, the bridge add) and holds by band for forwards and defence. It takes about 20 seconds.
2. Write `content/editorial/weekly/<start>.json`: the quick-hit teams per horizon, the chain title and legs, and the bridge team. The generator owns the numbers; the editorial file owns the choices.
3. `node scripts/weekly/render-weekly.mjs --start YYYY-MM-DD` draws `week-<start>-glance|chain|quick.png` (2x, via headless Chrome) into `web/public/blog-assets/` and `content/social/<season>/assets/` (SVGs go only to the social folder).
4. Write the article in `content/drafts/` (the fuller reference: all targets, options and the method) and the Reddit copy in `content/social/<season>/week-<start>-reddit.md` (self-contained, one link to the article). Both are preserved by `content:generate`. Voice: `content/strategy/cracked-ice-voice-guide.md`.

5. Video (optional): `node scripts/weekly/render-video.mjs --start YYYY-MM-DD` renders one storyboard still per scene into `content/social/<season>/video/`; add `--video` for the MP4 (1080x1920, about 22 seconds, under a minute to render) and a cover image. Write the voiceover script in `content/social/<season>/week-<start>-video-script.md`; a recording saved as `content/social/<season>/video/week-<start>-voice.(m4a|mp3|wav)` is laid under the video automatically, and scene lengths in `video/src/scenes.json` can be retimed to it. The Remotion project is `video/` (`npm install` there once; `npm run studio` to preview and tweak). Scenes and their lengths are in `video/src/scenes.json`; props come from `scripts/weekly/video-props.mjs`, built from the same weekly JSON and editorial file. Renders aren't committed. Music is added in the app at upload, never baked in, and there's no game footage (NHL rights).

Player notes come from data: second-half splits, power-play minutes (never for a player on a new team), youth, a new team, and an injured higher-minute teammate. Check injury news before citing an opportunity. Percent owned is Yahoo's league average, never an availability claim, which is why every team gets options at several ownership levels.


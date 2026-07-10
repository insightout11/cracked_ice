# WP9 — Blog rebuild + weekly content engine

**Goal**: make content crawlable (it is currently invisible to search engines) and make the
weekly post a near-zero-effort artifact generated from data the pipeline already computes.
Owner commits to posting ~1x/week Aug–Oct.
**Depends on**: WP3 (SEO shell), WP5 (share-image renderer). **Size**: 4–5 days.
**Branch**: `wp9-blog-content`.

## 1. Blog rebuild: markdown + prerender

- Move the 3 articles hardcoded in `web/src/pages/BlogPage.tsx` (objects with 2025 dates) to
  `content/posts/*.md` with frontmatter (title, slug, date, description, hero image).
- Loader: Vite `import.meta.glob` over the markdown + a tiny frontmatter parser (add
  `gray-matter` or hand-roll ~20 lines; note the dependency either way).
- **Prerendering** (the point of this WP): at build time, render each post + the blog index to
  static HTML with correct `<title>/<meta>/OG` (options: `vite-plugin-ssr`-style prerender, or a
  post-build script that renders routes via `react-dom/server` into `web/dist/blog/<slug>/index.html`).
  Acceptance is what matters: **`curl` of a post URL returns the article text without JS.**
- Update `sitemap.xml` generation (WP3) to include posts from frontmatter.
- Refresh the 3 existing articles' season references (2025-26 → 2026-27) or mark them clearly
  as prior-season archive posts.

## 2. Weekly content generator

`scripts/generate-weekly-post.mjs` (run manually or via a weekly GitHub Action that opens a PR):

Reads `data/*.json` + `config/season.json`, writes `content/posts/week-N-schedule-edge.md` +
share images (via a headless render of WP5/WP7 share components, or a pure-node SVG→PNG step —
implementer's choice, document it):

Sections, all computed:
1. **Streaming edge next week** — teams ranked by off-night game count next week; top 3 with
   best available skaters by FPPG.
2. **Gap-filler pairs** — the week's best complement pairs among likely-rostered teams.
3. **Back-to-back watch** — goalie-relevant B2Bs next week.
4. A closing CTA line linking the Draft/Season tools.

Tone guide (put in the script's template, owner edits before posting): numbers first,
no hype, one insight per section — the voice of the original viral post.

Also generate `content/social/week-N.md`: a Reddit-ready version (title options + body that
works as a self-post with one image) since Reddit is the proven channel.

## 3. Launch content (one-time, with owner)

- "**The 2026-27 Off-Night Bible**" — the season's complement matrix, best/worst pairs,
  off-night rankings. Generated core + owner's voice. This is the late-August Reddit post.
- Ensure the Draft Helper share-PNG footer includes the URL (WP5) so tool screenshots
  circulate with attribution.

## Acceptance criteria

- [ ] `curl https://<preview>/blog/<slug>` returns full article HTML (title, meta, body text) with JS disabled.
- [ ] Blog index lists posts from markdown; adding a `.md` file is the entire publish flow.
- [ ] Generator produces a valid post + images from current data in one command; output committed for one real week as proof.
- [ ] Sitemap includes all posts; Search Console instructions updated in the PR.
- [ ] Old hardcoded article objects deleted from `BlogPage.tsx`.

## Verification

Run the generator against live 2026-27 data; owner reviews the sample post for voice;
Google Rich Results test on one post URL; share a preview post link in Discord/X and confirm
the unfurl shows the generated image.

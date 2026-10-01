import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdownDocument, postFromDocument } from './lib/content.mjs';
import { mondayOf } from './lib/week-schedule.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'content', 'posts');
const publicDir = path.join(root, 'web', 'public');
const output = path.join(root, 'web', 'src', 'generated', 'blog-posts.json');
const metaOutput = path.join(root, 'web', 'src', 'generated', 'blog-meta.json');
const sitemap = path.join(publicDir, 'sitemap.xml');
const canonical = 'https://www.crackedicehockey.com';
const season = JSON.parse(readFileSync(path.join(root, 'config', 'season.json'), 'utf8'));

/** Pixel size of a PNG or WebP in web/public, or null. Lets pages reserve the space before the image loads. */
export function imageSize(url) {
  const file = path.join(publicDir, url);
  if (!url?.startsWith('/') || !existsSync(file)) return null;
  const bytes = readFileSync(file);
  if (bytes.toString('ascii', 1, 4) === 'PNG') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === 'VP8L') { const bits = bytes.readUInt32LE(21); return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }; }
    if (chunk === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

/** The lighter WebP copy of a PNG/JPEG when one sits beside it (social previews keep the original). */
export function displayImage(url) {
  if (!url) return undefined;
  const webp = url.replace(/\.(png|jpe?g)$/i, '.webp');
  return webp !== url && existsSync(path.join(publicDir, webp)) ? webp : url;
}

/** Article images: the WebP copy where there is one, with width and height so the layout doesn't jump. */
function sizeArticleImages(html) {
  return html.replace(/<img src="([^"]+)"/g, (_match, src) => {
    const shown = displayImage(src);
    const size = imageSize(shown);
    return `<img src="${shown}"${size ? ` width="${size.width}" height="${size.height}"` : ''} decoding="async"`;
  });
}

const filenames = (await fs.readdir(postsDir)).filter((file) => file.endsWith('.md')).sort();
const posts = [];
for (const filename of filenames) {
  const filePath = path.join(postsDir, filename);
  const document = parseMarkdownDocument(await fs.readFile(filePath, 'utf8'), filePath);
  const post = postFromDocument(document, filePath);
  if (post.status !== 'published') continue;
  // A published post without a date is a preview before distribution: reachable by link, but
  // kept out of the sitemap and marked noindex until it gets its date.
  const heroImage = displayImage(post.imageUrl);
  posts.push({ ...post, html: sizeArticleImages(post.html), heroImage, heroSize: imageSize(heroImage) ?? undefined });
}
posts.sort((a, b) => {
  if (!a.publishDate && b.publishDate) return -1;
  if (a.publishDate && !b.publishDate) return 1;
  return (b.publishDate || '').localeCompare(a.publishDate || '') || a.id.localeCompare(b.id);
});
const duplicates = posts.filter((post, index) => posts.findIndex((candidate) => candidate.id === post.id) !== index);
if (duplicates.length) throw new Error(`Duplicate blog slug: ${duplicates[0].id}`);

// Related reading: the post's own `related` list, topped up with the posts sharing the most
// specific tags (current-season posts before archived ones).
const GENERIC_TAGS = new Set(['2026-27', 'draft', 'strategy', 'archive']);
for (const post of posts) {
  const chosen = (Array.isArray(post.related) ? post.related : []).filter((id) => {
    if (posts.some((candidate) => candidate.id === id)) return true;
    throw new Error(`${post.sourceFile}: related post "${id}" doesn't exist or isn't published`);
  });
  const score = (other) => other.tags.filter((tag) => post.tags.includes(tag) && !GENERIC_TAGS.has(tag)).length * 2
    + other.tags.filter((tag) => post.tags.includes(tag)).length
    - (other.tags.includes('archive') ? 3 : 0);
  const extra = posts
    .filter((other) => other.id !== post.id && !chosen.includes(other.id))
    .filter((other) => other.publishDate)
    .sort((a, b) => score(b) - score(a) || b.publishDate.localeCompare(a.publishDate))
    .map((other) => other.id);
  post.related = [...chosen, ...extra].slice(0, 3).map((id) => {
    const other = posts.find((candidate) => candidate.id === id);
    return { id, title: other.title, excerpt: other.excerpt };
  });
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(posts, null, 2)}\n`);
// Titles, dates and excerpts only: what the blog index and page titles need, without the article bodies.
const meta = posts.map(({ content: _content, html: _html, ...rest }) => rest);
await fs.writeFile(metaOutput, `${JSON.stringify(meta, null, 2)}\n`);

// Sitemap dates follow real content changes. /season carries this week's schedule summary, so
// it changes each Monday; the blog changes with its newest post; the home page with either.
// The other pages' dates move when their copy does (set here, by hand).
const today = new Date().toISOString().slice(0, 10);
const thisMonday = mondayOf([today, season.regularSeasonStart].sort()[1]);
const seasonLastmod = [thisMonday, today].sort()[0];
const datedPosts = posts.filter((post) => post.publishDate);
const newestPost = datedPosts.map((post) => post.updatedDate || post.publishDate).sort().at(-1);
const staticRoutes = [
  { path: '/', lastmod: [seasonLastmod, newestPost].sort().at(-1) },
  { path: '/season', lastmod: seasonLastmod },
  { path: '/draft', lastmod: '2026-09-30' },
  { path: '/optimizer', lastmod: '2026-09-30' },
  { path: '/compare', lastmod: '2026-09-30' },
  { path: '/card', lastmod: '2026-09-24' },
  { path: '/blog', lastmod: newestPost },
  { path: '/methodology', lastmod: '2026-09-30' },
  { path: '/privacy', lastmod: '2026-10-01' },
  { path: '/terms', lastmod: '2026-07-29' },
  { path: '/contact', lastmod: '2026-07-29' },
];
const routes = [...staticRoutes, ...datedPosts.map((post) => ({ path: `/blog/${post.id}`, lastmod: post.updatedDate || post.publishDate }))];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url>\n    <loc>${canonical}${route.path}</loc>\n    <lastmod>${route.lastmod}</lastmod>\n  </url>`).join('\n')}\n</urlset>\n`;
await fs.writeFile(sitemap, xml);
console.log(`Prepared ${posts.length} published posts and ${routes.length} sitemap URLs.`);

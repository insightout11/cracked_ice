import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdownDocument, postFromDocument } from './lib/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'content', 'posts');
const output = path.join(root, 'web', 'src', 'generated', 'blog-posts.json');
const sitemap = path.join(root, 'web', 'public', 'sitemap.xml');
const canonical = 'https://www.crackedicehockey.com';

const filenames = (await fs.readdir(postsDir)).filter((file) => file.endsWith('.md')).sort();
const posts = [];
for (const filename of filenames) {
  const filePath = path.join(postsDir, filename);
  const document = parseMarkdownDocument(await fs.readFile(filePath, 'utf8'), filePath);
  const post = postFromDocument(document, filePath);
  if (post.status === 'published') posts.push(post);
}
posts.sort((a, b) => {
  if (!a.publishDate && b.publishDate) return -1;
  if (a.publishDate && !b.publishDate) return 1;
  return (b.publishDate || '').localeCompare(a.publishDate || '');
});
const duplicates = posts.filter((post, index) => posts.findIndex((candidate) => candidate.id === post.id) !== index);
if (duplicates.length) throw new Error(`Duplicate blog slug: ${duplicates[0].id}`);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(posts, null, 2)}\n`);

const staticRoutes = [
  { path: '/', lastmod: '2026-07-29', changefreq: 'weekly', priority: '1.0' },
  { path: '/season', lastmod: '2026-07-29', changefreq: 'weekly', priority: '0.9' },
  { path: '/compare', lastmod: '2026-07-29', changefreq: 'weekly', priority: '0.8' },
  { path: '/blog', lastmod: '2026-07-29', changefreq: 'weekly', priority: '0.8' },
  { path: '/privacy', lastmod: '2026-07-29', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', lastmod: '2026-07-29', changefreq: 'yearly', priority: '0.3' },
  { path: '/contact', lastmod: '2026-07-29', changefreq: 'yearly', priority: '0.3' },
];
const routes = [...staticRoutes, ...posts.map((post) => ({ path: `/blog/${post.id}`, lastmod: post.updatedDate || post.publishDate, changefreq: 'monthly', priority: '0.7' }))];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url>\n    <loc>${canonical}${route.path}</loc>${route.lastmod ? `\n    <lastmod>${route.lastmod}</lastmod>` : ''}\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
await fs.writeFile(sitemap, xml);
console.log(`Prepared ${posts.length} published posts and ${routes.length} sitemap URLs.`);

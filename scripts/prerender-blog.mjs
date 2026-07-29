import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './lib/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web', 'dist');
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const posts = JSON.parse(await fs.readFile(path.join(root, 'web', 'src', 'generated', 'blog-posts.json'), 'utf8'));
const origin = 'https://www.crackedicehockey.com';

function pageTemplate({ title, description, pathname, type = 'website', image = `${origin}/og-image.png`, body, jsonLd }) {
  const canonical = `${origin}${pathname}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>(?![\s\S]*<link rel="canonical")/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>(?![\s\S]*<meta name="description")/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${type}">`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${image}">`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}">`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeHtml(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeHtml(description)}">`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${image}">`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  if (jsonLd) html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>\n  </head>`);
  return html;
}

const shell = (content) => `<main style="min-height:100vh;background:#071522;color:#f1f8ff"><div style="max-width:960px;margin:0 auto;padding:48px 24px"><nav style="margin-bottom:40px"><a href="/" style="color:#58dcf5;text-decoration:none;font-weight:800;letter-spacing:.08em">CRACKED ICE</a></nav>${content}</div></main>`;
const cards = posts.map((post) => `<article style="padding:28px;margin:0 0 24px;border:1px solid #28506a;border-radius:18px;background:#102638"><p style="color:#9cb6c7">${escapeHtml(post.publishDate)} · ${post.readTimeMinutes} min read</p><h2><a href="/blog/${post.id}" style="color:#f1f8ff">${escapeHtml(post.title)}</a></h2><p style="color:#bed0dc;line-height:1.6">${escapeHtml(post.excerpt)}</p></article>`).join('');
const indexBody = shell(`<header><p style="color:#58dcf5;text-transform:uppercase;letter-spacing:.15em">Schedule-aware strategy</p><h1>Cracked Ice Blog</h1><p style="color:#bed0dc">Original fantasy hockey schedule analysis, draft strategy, and lineup decisions.</p></header><section style="margin-top:40px">${cards}</section>`);
const indexHtml = pageTemplate({ title: 'Fantasy Hockey Schedule Strategy — Cracked Ice Hockey', description: 'Original fantasy hockey schedule analysis, draft strategy, and lineup decisions from Cracked Ice.', pathname: '/blog', body: indexBody });
await fs.mkdir(path.join(dist, 'blog'), { recursive: true });
await fs.writeFile(path.join(dist, 'blog', 'index.html'), indexHtml);

for (const post of posts) {
  const body = shell(`<p><a href="/blog" style="color:#58dcf5">← Back to blog</a></p><header style="margin:32px 0"><p style="color:#9cb6c7">${escapeHtml(post.publishDate)} · ${post.readTimeMinutes} min read · ${escapeHtml(post.author)}</p><h1>${escapeHtml(post.title)}</h1><p style="color:#bed0dc;font-size:1.125rem;line-height:1.6">${escapeHtml(post.excerpt)}</p></header><article class="article-content" style="padding:36px;border:1px solid #28506a;border-radius:18px;background:#102638">${post.html}</article>`);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.excerpt, datePublished: post.publishDate, dateModified: post.updatedDate || post.publishDate, author: { '@type': 'Organization', name: post.author }, publisher: { '@type': 'Organization', name: 'Cracked Ice Hockey', url: origin }, mainEntityOfPage: `${origin}/blog/${post.id}`, image: post.imageUrl ? `${origin}${post.imageUrl}` : `${origin}/og-image.png` };
  const html = pageTemplate({ title: `${post.title} — Cracked Ice Hockey`, description: post.excerpt, pathname: `/blog/${post.id}`, type: 'article', image: post.imageUrl ? `${origin}${post.imageUrl}` : `${origin}/og-image.png`, body, jsonLd });
  const directory = path.join(dist, 'blog', post.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html);
}
console.log(`Prerendered blog index and ${posts.length} article pages.`);

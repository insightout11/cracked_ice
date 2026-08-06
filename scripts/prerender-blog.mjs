import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './lib/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web', 'dist');
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const posts = JSON.parse(await fs.readFile(path.join(root, 'web', 'src', 'generated', 'blog-posts.json'), 'utf8'));
const origin = 'https://www.crackedicehockey.com';
const logo = `${origin}/logo-mark.svg`;

function pageTemplate({ title, description, pathname, type = 'website', image = `${origin}/og-image.png`, body, jsonLd, robots = 'index,follow' }) {
  const canonical = `${origin}${pathname}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>(?![\s\S]*<link rel="canonical")/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>(?![\s\S]*<meta name="description")/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace('</title>', `</title>\n    <meta name="robots" content="${robots}">`)
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

const nav = `<nav aria-label="Primary" style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:40px"><a href="/" style="color:#58dcf5;text-decoration:none;font-weight:800;letter-spacing:.08em">CRACKED ICE</a><a href="/season" style="color:#bed0dc">Season</a><a href="/compare" style="color:#bed0dc">Compare players</a><a href="/blog" style="color:#bed0dc">Blog</a></nav>`;
const shell = (content) => `<main style="min-height:100vh;background:#071522;color:#f1f8ff"><div style="max-width:960px;margin:0 auto;padding:48px 24px">${nav}${content}</div></main>`;
const toolLinks = `<aside style="margin-top:36px;padding:24px;border:1px solid #28506a;border-radius:16px;background:#0b1d2b"><h2 style="margin-top:0">Use the schedule in your league</h2><p style="color:#bed0dc;line-height:1.65">Build a league-scored draft board, compare two players, or inspect every team’s 2026–27 schedule.</p><p><a href="/" style="color:#58dcf5">Open the optimizer</a> · <a href="/compare" style="color:#58dcf5">Compare players</a> · <a href="/season" style="color:#58dcf5">Explore the season</a></p></aside>`;

const organization = { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'Cracked Ice Hockey', url: origin, logo: { '@type': 'ImageObject', url: logo } };
const website = { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Cracked Ice Hockey', url: origin, publisher: { '@id': `${origin}/#organization` } };
const breadcrumb = (pathname, name, parent) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Cracked Ice Hockey', item: `${origin}/` },
    ...(parent ? [{ '@type': 'ListItem', position: 2, name: parent.name, item: `${origin}${parent.pathname}` }] : []),
    { '@type': 'ListItem', position: parent ? 3 : 2, name, item: `${origin}${pathname}` },
  ],
});

const staticPages = [
  {
    pathname: '/',
    title: 'Fantasy Hockey Schedule Optimizer | Cracked Ice',
    description: 'Turn league scoring, roster slots, and the 2026–27 NHL schedule into better fantasy hockey draft, pickup, and lineup decisions.',
    heading: 'Fantasy hockey decisions built around your league',
    eyebrow: 'League-aware schedule tools',
    copy: `<p>Generic rankings stop at projected production. Cracked Ice combines your scoring settings, roster construction, position eligibility, date window, and the NHL schedule to estimate which games your lineup can actually use.</p><p>Plan a draft, find an off-night pickup, compare close players, and prepare for your league’s fantasy playoffs without assuming every scheduled game fits.</p><p><a href="/compare" style="color:#58dcf5">Compare two players</a> or <a href="/season" style="color:#58dcf5">explore the full 2026–27 schedule</a>.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, website, { '@type': 'WebApplication', name: 'Cracked Ice Hockey', url: origin, applicationCategory: 'SportsApplication', operatingSystem: 'Web browser', description: 'League-aware fantasy hockey schedule, roster, draft, and player comparison tools.' }] },
  },
  {
    pathname: '/season',
    title: '2026–27 NHL Schedule Analysis | Cracked Ice',
    description: 'Explore the 2026–27 NHL schedule by week, off-nights, back-to-backs, fantasy playoff games, and schedule strength.',
    heading: '2026–27 NHL schedule and off-night analysis',
    eyebrow: 'Season planner',
    copy: `<p>See all 32 teams in one compact weekly schedule. Filter by date, compare off-night volume, identify back-to-backs, and inspect fantasy-playoff windows configured for your league.</p><p>Schedule volume is only the starting point. Cracked Ice highlights when games occur so you can distinguish nominal NHL games from starts that are more likely to fit a fantasy lineup.</p><p><a href="/compare" style="color:#58dcf5">Compare players with schedule context</a> or return to the <a href="/" style="color:#58dcf5">fantasy hockey optimizer</a>.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/season', '2026–27 NHL Schedule'), { '@type': 'WebApplication', name: 'Cracked Ice Season Planner', url: `${origin}/season`, applicationCategory: 'SportsApplication', operatingSystem: 'Web browser' }] },
  },
  {
    pathname: '/compare',
    title: 'Compare Fantasy Hockey Players | Cracked Ice',
    description: 'Compare fantasy hockey players using your league scoring, lineup fit, position value, usable starts, and fantasy playoff schedule.',
    heading: 'Compare fantasy hockey players in your league',
    eyebrow: 'Player decision tool',
    copy: `<p>Two players with similar fantasy points per game can produce different value after schedule, lineup congestion, position scarcity, and multi-position eligibility are considered.</p><p>Choose a draft, keeper, pickup, or roster context. Cracked Ice scores both players using your league settings and explains how regular-season and fantasy-playoff schedules change the decision.</p><p><a href="/" style="color:#58dcf5">Build your draft board</a> or <a href="/season" style="color:#58dcf5">inspect the season schedule</a>.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/compare', 'Compare Fantasy Hockey Players'), { '@type': 'WebApplication', name: 'Cracked Ice Player Comparison', url: `${origin}/compare`, applicationCategory: 'SportsApplication', operatingSystem: 'Web browser' }] },
  },
  {
    pathname: '/privacy',
    title: 'Privacy Policy | Cracked Ice Hockey',
    description: 'How Cracked Ice handles league settings, rosters, accounts, analytics, imports, and optional fantasy-provider connections.',
    heading: 'Privacy Policy', eyebrow: 'Your data',
    copy: `<p>Cracked Ice can be used without an account. League settings, rosters, and preferences may be stored on your device; signed-in users may sync a League Workspace through Supabase.</p><p>Optional fantasy-provider connections use express authorization and only retrieve information needed for league-specific analysis. See the interactive policy page for complete collection, retention, disconnection, and deletion details.</p><p>Privacy and deletion requests can be sent to <a href="mailto:support@crackedicehockey.com" style="color:#58dcf5">support@crackedicehockey.com</a>.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/privacy', 'Privacy Policy')] },
  },
  {
    pathname: '/terms',
    title: 'Terms of Use | Cracked Ice Hockey',
    description: 'Terms governing Cracked Ice fantasy hockey projections, schedule analysis, provider integrations, and user responsibilities.',
    heading: 'Terms of Use', eyebrow: 'Using Cracked Ice',
    copy: `<p>Cracked Ice provides informational fantasy-hockey projections, schedule analysis, and planning tools. Recommendations are estimates rather than guarantees of player performance or league outcomes.</p><p>Users remain responsible for verifying league rules, player eligibility, lineup locks, transactions, and third-party provider information before acting.</p><p>For questions, visit the <a href="/contact" style="color:#58dcf5">contact page</a>.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/terms', 'Terms of Use')] },
  },
  {
    pathname: '/contact',
    title: 'Contact Cracked Ice Hockey',
    description: 'Contact Cracked Ice for product support, account and privacy requests, security reports, and fantasy hockey feedback.',
    heading: 'Contact Cracked Ice', eyebrow: 'Support',
    copy: `<p>Email <a href="mailto:support@crackedicehockey.com" style="color:#58dcf5">support@crackedicehockey.com</a> for private product support, account requests, provider-data questions, or security reports.</p><p>For reproducible bugs and feature suggestions that contain no private information, use the public <a href="https://github.com/insightout11/cracked_ice/issues" style="color:#58dcf5">Cracked Ice issue tracker</a>.</p><p>Never send passwords, OAuth codes, access tokens, or unnecessary private league information.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/contact', 'Contact')] },
  },
];

for (const page of staticPages) {
  const body = shell(`<header style="margin:32px 0"><p style="color:#58dcf5;text-transform:uppercase;letter-spacing:.15em">${page.eyebrow}</p><h1>${page.heading}</h1><div style="max-width:760px;color:#bed0dc;font-size:1.075rem;line-height:1.75">${page.copy}</div></header>`);
  const html = pageTemplate({ ...page, body });
  const directory = page.pathname === '/' ? dist : path.join(dist, page.pathname.slice(1));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html);
}

const postMeta = (post, includeAuthor = false) => [post.publishDate, `${post.readTimeMinutes} min read`, includeAuthor ? post.author : null]
  .filter(Boolean)
  .map(escapeHtml)
  .join(' · ');
const cards = posts.map((post) => `<article style="padding:28px;margin:0 0 24px;border:1px solid #28506a;border-radius:18px;background:#102638"><p style="color:#9cb6c7">${postMeta(post)}</p><h2><a href="/blog/${post.id}" style="color:#f1f8ff">${escapeHtml(post.title)}</a></h2><p style="color:#bed0dc;line-height:1.6">${escapeHtml(post.excerpt)}</p></article>`).join('');
const indexBody = shell(`<header><p style="color:#58dcf5;text-transform:uppercase;letter-spacing:.15em">Schedule-aware strategy</p><h1>Cracked Ice Blog</h1><p style="color:#bed0dc">Original fantasy hockey schedule analysis, draft strategy, and lineup decisions.</p></header><section style="margin-top:40px">${cards}</section>${toolLinks}`);
const indexJsonLd = { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/blog', 'Fantasy Hockey Blog'), { '@type': 'Blog', name: 'Cracked Ice Blog', url: `${origin}/blog`, publisher: { '@id': `${origin}/#organization` }, blogPost: posts.map((post) => ({ '@type': 'BlogPosting', headline: post.title, url: `${origin}/blog/${post.id}` })) }] };
const indexHtml = pageTemplate({ title: 'Fantasy Hockey Schedule Strategy | Cracked Ice', description: 'Original fantasy hockey schedule analysis, draft strategy, and lineup decisions from Cracked Ice.', pathname: '/blog', body: indexBody, jsonLd: indexJsonLd });
await fs.mkdir(path.join(dist, 'blog'), { recursive: true });
await fs.writeFile(path.join(dist, 'blog', 'index.html'), indexHtml);

for (const post of posts) {
  const body = shell(`<p><a href="/blog" style="color:#58dcf5">← Back to blog</a></p><header style="margin:32px 0"><p style="color:#9cb6c7">${postMeta(post, true)}</p><h1>${escapeHtml(post.title)}</h1><p style="color:#bed0dc;font-size:1.125rem;line-height:1.6">${escapeHtml(post.excerpt)}</p></header><article class="article-content" style="padding:36px;border:1px solid #28506a;border-radius:18px;background:#102638">${post.html}</article>${toolLinks}`);
  const article = { '@type': 'Article', headline: post.title, description: post.excerpt, ...(post.publishDate ? { datePublished: post.publishDate, dateModified: post.updatedDate || post.publishDate } : post.updatedDate ? { dateModified: post.updatedDate } : {}), author: { '@type': 'Organization', name: post.author, url: origin }, publisher: { '@id': `${origin}/#organization` }, mainEntityOfPage: `${origin}/blog/${post.id}`, image: post.imageUrl ? `${origin}${post.imageUrl}` : `${origin}/og-image.png` };
  const jsonLd = { '@context': 'https://schema.org', '@graph': [organization, breadcrumb(`/blog/${post.id}`, post.title, { name: 'Blog', pathname: '/blog' }), article] };
  const html = pageTemplate({ title: post.title, description: post.excerpt, pathname: `/blog/${post.id}`, type: 'article', image: post.imageUrl ? `${origin}${post.imageUrl}` : `${origin}/og-image.png`, body, jsonLd });
  const directory = path.join(dist, 'blog', post.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html);
}

console.log(`Prerendered ${staticPages.length} static routes, the blog index, and ${posts.length} article pages.`);

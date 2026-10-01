import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './lib/content.mjs';
import { addDays, buildWeek, dayLabel, mondayOf, teamNote, weekday } from './lib/week-schedule.mjs';
import { bestPairings, sameGamesDifferentFit, seasonScheduleTable } from './lib/seo-examples.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web', 'dist');
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const posts = JSON.parse(await fs.readFile(path.join(root, 'web', 'src', 'generated', 'blog-posts.json'), 'utf8'));
// Titles, descriptions, headings and guides: the same file the app's RouteMeta and ToolGuide read,
// so a page says the same thing before and after JavaScript runs.
const pages = JSON.parse(await fs.readFile(path.join(root, 'web', 'src', 'seo', 'pages.json'), 'utf8'));
const origin = 'https://www.crackedicehockey.com';

// This week's schedule for the /season page's crawlable copy. The site rebuilds after every
// nightly data refresh, so search engines see the current week, not a generic description.
const seasonConfig = JSON.parse(await fs.readFile(path.join(root, 'config', 'season.json'), 'utf8'));
const seasonSchedule = JSON.parse(await fs.readFile(path.join(root, 'web', 'public', seasonConfig.scheduleFile), 'utf8'));
const buildDate = new Date().toISOString().slice(0, 10);
const fromDate = [buildDate, seasonConfig.regularSeasonStart].sort()[1];
const thisWeek = buildWeek(seasonSchedule, mondayOf(fromDate));
const scheduleWeekCopy = [
  `<h2>This week: ${escapeHtml(thisWeek.label)} (${thisWeek.totalGames} NHL games)</h2>`,
  `<p><strong>Off-nights (quiet nights):</strong> ${escapeHtml(thisWeek.quietNights.map((night) => `${weekday(night.date)} (${night.games} games)`).join(', ') || 'none')}. `
    + `<strong>Packed nights:</strong> ${escapeHtml(thisWeek.packedNights.map((night) => `${weekday(night.date)} (${night.games} games)`).join(', ') || 'none')}.</p>`,
  `<p><strong>Best streaming schedules this week:</strong></p><ul>${thisWeek.best.map((team) => `<li>${escapeHtml(`${team.name} (${team.team}): ${teamNote(team)}`)}</li>`).join('')}</ul>`,
  thisWeek.fourGameTeams.length ? `<p><strong>Four-game weeks:</strong> ${escapeHtml(thisWeek.fourGameTeams.map((team) => team.name).join(', '))}.</p>` : '',
].join('');
const logo = `${origin}/logo-mark.svg`;
const link = (href, label) => `<a href="${href}" style="color:#58dcf5">${escapeHtml(label)}</a>`;
const shortDate = (date) => dayLabel(date, { month: 'short', day: 'numeric' });
const table = (headers, rows) => `<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:.95rem"><thead><tr>${headers.map((header) => `<th style="text-align:left;border-bottom:1px solid #28506a;padding:6px 8px">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="border-bottom:1px solid #16344a;padding:6px 8px">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

// Worked examples for the tool pages: what the tool answers, from the current schedule.
const pairStart = fromDate;
const pairEnd = addDays(pairStart, 13);
const pairings = bestPairings(seasonSchedule, pairStart, pairEnd, 5);
const optimizerExample = `<h2>Example: the best-fitting pairs for the next two weeks</h2><p>Between ${shortDate(pairStart)} and ${shortDate(pairEnd)}, these two-team pairings cover the most nights with the fewest clashes, so a player from each would rarely compete for the same lineup spot:</p>${table(['Teams', 'Games', 'Nights covered', 'Same-night clashes', 'Off-nights covered'], pairings.map((pair) => [pair.names.join(' + '), String(pair.games), String(pair.nights), String(pair.clashes), String(pair.offNights)]))}<p>Schedule fit runs the same comparison inside your own dates and lineup slots.</p>`;
const scheduleLeaders = seasonScheduleTable(seasonSchedule, seasonConfig, 10);
const draftExample = `<h2>2026–27 schedule leaders: off-nights and fantasy playoffs</h2><p>Every team plays ${seasonConfig.gamesPerTeam} games, but not every game is easy to use. These teams play the most games on off-nights (8 or fewer NHL games), with their games in the default fantasy playoffs (${shortDate(seasonConfig.defaultFantasyPlayoffsStart)}–${shortDate(seasonConfig.defaultFantasyPlayoffsEnd)}):</p>${table(['Team', 'Off-night games', 'Fantasy playoff games', 'Playoff off-nights'], scheduleLeaders.map((team) => [team.name, String(team.offNightGames), String(team.playoffGames), String(team.playoffOffNightGames)]))}<p>The draft board adds this schedule value to each player's projection under your league's scoring.</p>`;
const tie = sameGamesDifferentFit(seasonSchedule, fromDate, 30);
const compareExample = tie ? `<h2>Example: same games, different value</h2><p>From ${shortDate(tie.start)} to ${shortDate(tie.end)}, the ${escapeHtml(tie.teams[0].name)} and the ${escapeHtml(tie.teams[1].name)} both play ${tie.games} games. For the ${escapeHtml(tie.teams[0].name)}, ${tie.teams[0].offNightGames} of those games fall on off-nights; for the ${escapeHtml(tie.teams[1].name)}, ${tie.teams[1].offNightGames}. Two similar players on those teams look tied on games played, but the first is far more likely to find a lineup spot on the nights he plays. A comparison counts that difference.</p>` : '';
const guideCopy = (pathname) => {
  const guide = pages[pathname]?.guide;
  return guide ? `<h2>${escapeHtml(guide.heading)}</h2>${guide.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}<p>${link('/methodology', 'How the numbers are made')}</p>` : '';
};

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

// Every public tool, so each page links to all of them before the app loads (the app's footer does the same after).
const navLinks = [['/season', 'Schedule'], ['/optimizer', 'Schedule optimizer'], ['/draft', 'Draft board'], ['/compare', 'Compare players'], ['/card', 'Roster Card'], ['/blog', 'Guides'], ['/methodology', 'How it works']];
const nav = `<nav aria-label="Primary" style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:40px"><a href="/" style="color:#58dcf5;text-decoration:none;font-weight:800;letter-spacing:.08em">CRACKED ICE</a>${navLinks.map(([href, label]) => `<a href="${href}" style="color:#bed0dc">${label}</a>`).join('')}</nav>`;
const shell = (content) => `<main style="min-height:100vh;background:#071522;color:#f1f8ff"><div style="max-width:960px;margin:0 auto;padding:48px 24px">${nav}${content}</div></main>`;
const toolLinks = `<aside style="margin-top:36px;padding:24px;border:1px solid #28506a;border-radius:16px;background:#0b1d2b"><h2 style="margin-top:0">Use the schedule in your league</h2><p style="color:#bed0dc;line-height:1.65">Find schedules that fit together, build a league-scored draft board, compare two players, or check this week's off-nights.</p><p>${link('/optimizer', 'Open the schedule optimizer')} · ${link('/draft', 'Draft board')} · ${link('/compare', 'Compare players')} · ${link('/season', "This week's schedule")}</p></aside>`;

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
const app = (pathname, name) => ({ '@type': 'WebApplication', name, url: `${origin}${pathname}`, applicationCategory: 'SportsApplication', operatingSystem: 'Web browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } });

// Per-page body copy and structured data; titles, descriptions and headings come from pages.json.
const staticPages = [
  {
    pathname: '/',
    copy: `<p>Generic rankings stop at projected production. Cracked Ice combines your scoring settings, roster construction, position eligibility, date window, and the NHL schedule to estimate which games your lineup can actually use.</p><p>Check ${link('/season', "this week's off-nights and streaming schedules")}, find ${link('/optimizer', 'teams whose schedules fit together')}, plan a ${link('/draft', 'league-scored draft')}, or ${link('/compare', 'compare two players')} with your own scoring.</p>${scheduleWeekCopy}`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, website, { ...app('/', 'Cracked Ice Hockey'), url: origin, description: 'League-aware fantasy hockey schedule, roster, draft, and player comparison tools.' }] },
  },
  {
    pathname: '/season',
    copy: `${scheduleWeekCopy}<p>See all 32 teams in one compact weekly schedule. Filter by date, compare off-night volume, identify back-to-backs, and inspect fantasy-playoff windows configured for your league.</p>${guideCopy('/season')}<p>${link('/optimizer', 'Find schedules that fit together')} or ${link('/compare', 'compare players with schedule context')}.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/season', '2026–27 NHL Schedule'), app('/season', 'Cracked Ice Season Planner')] },
  },
  {
    pathname: '/draft',
    copy: `<p>Rank players using your selected projection source, identify likely round targets, compare alternatives, and track picks without losing your league context.</p>${draftExample}${guideCopy('/draft')}<p>${link('/compare', 'Compare two draft targets')} or read the ${link('/blog/2026-27-draft-roster-context-strategies', 'four draft strategies we tested')}.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/draft', 'Fantasy Hockey Draft Board'), app('/draft', 'Cracked Ice Draft Board')] },
  },
  {
    pathname: '/optimizer',
    copy: `<p>Compare teams across your selected window to find schedule combinations with more usable game nights and fewer lineup conflicts.</p>${optimizerExample}${guideCopy('/optimizer')}<p>${link('/season', "See this week's full schedule")} or read the ${link('/blog/2026-27-fantasy-hockey-off-night-bible', 'off-night bible')}.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/optimizer', 'Fantasy Hockey Schedule Optimizer'), app('/optimizer', 'Cracked Ice Schedule Optimizer')] },
  },
  {
    pathname: '/compare',
    copy: `<p>Two players with similar fantasy points per game can produce different value after schedule, lineup congestion, position scarcity, and multi-position eligibility are considered.</p>${compareExample}${guideCopy('/compare')}<p>${link('/draft', 'Build your draft board')} or ${link('/season', 'inspect the season schedule')}.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/compare', 'Compare Fantasy Hockey Players'), app('/compare', 'Cracked Ice Player Comparison')] },
  },
  {
    pathname: '/card',
    image: `${origin}/og-roster-card.jpg`,
    copy: `<p>Copy your whole team page from Yahoo, ESPN or Fantrax (stats and all) or paste a plain list of names. Cracked Ice names your team, gives a (gently roasting) verdict on your draft, and digs up facts nobody asked for: shared birthdays, hometowns, the oldest and youngest, and how many hippos your roster weighs.</p><p>Share the card with your league, then see which nights your players actually play on the ${link('/season', 'weekly schedule')}.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/card', 'Roster Card'), app('/card', 'Cracked Ice Roster Card')] },
  },
  {
    pathname: '/methodology',
    copy: `<p>${escapeHtml(pages['/methodology'].description)}</p>${(pages['/methodology'].sections ?? []).map((section) => `<h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}`).join('')}${pages['/methodology'].author ? `<h2 id="author">${escapeHtml(pages['/methodology'].author.heading)}</h2>${pages['/methodology'].author.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}<p><a href="${pages['/methodology'].author.profile}" rel="me" style="color:#58dcf5">${escapeHtml(pages['/methodology'].author.profileLabel)}</a></p>` : ''}<h2>Questions or corrections</h2><p>Spotted a number that looks wrong? ${link('/contact', 'Get in touch')}. Every report gets checked against the source data.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/methodology', 'How Cracked Ice Works'), { '@type': 'AboutPage', name: pages['/methodology'].heading, url: `${origin}/methodology`, publisher: { '@id': `${origin}/#organization` } }, ...(pages['/methodology'].author ? [{ '@type': 'Person', '@id': `${origin}/methodology#author`, name: pages['/methodology'].author.name, url: `${origin}/methodology#author`, sameAs: [pages['/methodology'].author.profile] }] : [])] },
  },
  {
    pathname: '/privacy',
    copy: `<p>Cracked Ice can be used without an account. League settings, rosters, and preferences may be stored on your device; signed-in users may sync a League Workspace through Supabase.</p><p>Optional fantasy-provider connections use express authorization and only retrieve information needed for league-specific analysis. The Cracked Ice plugin for ChatGPT needs no account: it receives only the dates, teams and player names ChatGPT sends for a question, returns public NHL schedule information, and stores nothing about you. See the interactive policy page for complete collection, retention, disconnection, and deletion details.</p><p>Privacy and deletion requests can be sent to <a href="mailto:support@crackedicehockey.com" style="color:#58dcf5">support@crackedicehockey.com</a>.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/privacy', 'Privacy Policy')] },
  },
  {
    pathname: '/terms',
    copy: `<p>Cracked Ice provides informational fantasy-hockey projections, schedule analysis, and planning tools. Recommendations are estimates rather than guarantees of player performance or league outcomes.</p><p>Users remain responsible for verifying league rules, player eligibility, lineup locks, transactions, and third-party provider information before acting.</p><p>For questions, visit the ${link('/contact', 'contact page')}.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/terms', 'Terms of Use')] },
  },
  {
    pathname: '/contact',
    copy: `<p>Email <a href="mailto:support@crackedicehockey.com" style="color:#58dcf5">support@crackedicehockey.com</a> for private product support, account requests, provider-data questions, or security reports.</p><p>For reproducible bugs and feature suggestions that contain no private information, use the public <a href="https://github.com/insightout11/cracked_ice/issues" style="color:#58dcf5">Cracked Ice issue tracker</a>.</p><p>Never send passwords, OAuth codes, access tokens, or unnecessary private league information.</p>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/contact', 'Contact')] },
  },
];

for (const page of staticPages) {
  const meta = pages[page.pathname];
  if (!meta?.heading) throw new Error(`web/src/seo/pages.json has no heading for ${page.pathname}`);
  const body = shell(`<header style="margin:32px 0"><p style="color:#58dcf5;text-transform:uppercase;letter-spacing:.15em">${escapeHtml(meta.eyebrow ?? '')}</p><h1>${escapeHtml(meta.heading)}</h1><div style="max-width:760px;color:#bed0dc;font-size:1.075rem;line-height:1.75">${page.copy}</div></header>`);
  const html = pageTemplate({ ...page, title: meta.title, description: meta.description, body });
  const directory = page.pathname === '/' ? dist : path.join(dist, page.pathname.slice(1));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html);
}

const postMeta = (post, includeAuthor = false) => [post.publishDate, `${post.readTimeMinutes} min read`]
  .filter(Boolean)
  .map(escapeHtml)
  .concat(includeAuthor && post.author ? [`<a href="/methodology#author" style="color:#9cb6c7">${escapeHtml(post.author)}</a>`] : [])
  .join(' · ');
// The person behind the byline (pages.json '/methodology'.author), for articles' structured data.
const authorInfo = pages['/methodology'].author;
const authorFor = (name) => authorInfo && name === authorInfo.name
  ? { '@type': 'Person', name, url: `${origin}/methodology#author`, sameAs: [authorInfo.profile] }
  : { '@type': 'Organization', name, url: `${origin}/methodology` };
const blogMeta = pages['/blog'];
const cards = posts.map((post) => `<article style="padding:28px;margin:0 0 24px;border:1px solid #28506a;border-radius:18px;background:#102638"><p style="color:#9cb6c7">${postMeta(post)}</p><h2><a href="/blog/${post.id}" style="color:#f1f8ff">${escapeHtml(post.title)}</a></h2><p style="color:#bed0dc;line-height:1.6">${escapeHtml(post.excerpt)}</p></article>`).join('');
const indexBody = shell(`<header><p style="color:#58dcf5;text-transform:uppercase;letter-spacing:.15em">${escapeHtml(blogMeta.eyebrow)}</p><h1>${escapeHtml(blogMeta.heading)}</h1><p style="color:#bed0dc">${escapeHtml(blogMeta.description)}</p></header><section style="margin-top:40px">${cards}</section>${toolLinks}`);
const indexJsonLd = { '@context': 'https://schema.org', '@graph': [organization, breadcrumb('/blog', 'Fantasy Hockey Blog'), { '@type': 'Blog', name: 'Cracked Ice Blog', url: `${origin}/blog`, publisher: { '@id': `${origin}/#organization` }, blogPost: posts.filter((post) => post.publishDate).map((post) => ({ '@type': 'BlogPosting', headline: post.title, url: `${origin}/blog/${post.id}`, datePublished: post.publishDate })) }] };
const indexHtml = pageTemplate({ title: blogMeta.title, description: blogMeta.description, pathname: '/blog', body: indexBody, jsonLd: indexJsonLd });
await fs.mkdir(path.join(dist, 'blog'), { recursive: true });
await fs.writeFile(path.join(dist, 'blog', 'index.html'), indexHtml);

for (const post of posts) {
  // The visible headline keeps its editorial voice; the <title> can say what the article answers.
  const searchTitle = post.seoTitle || post.title;
  const related = post.related?.length
    ? `<nav aria-label="Keep reading" style="margin-top:36px"><h2>Keep reading</h2><ul>${post.related.map((other) => `<li style="margin-bottom:10px"><a href="/blog/${other.id}" style="color:#58dcf5">${escapeHtml(other.title)}</a><br><span style="color:#bed0dc">${escapeHtml(other.excerpt)}</span></li>`).join('')}</ul></nav>`
    : '';
  const hero = post.heroImage ? `<img src="${post.heroImage}"${post.heroSize ? ` width="${post.heroSize.width}" height="${post.heroSize.height}"` : ''} alt="" style="width:100%;height:auto;border-radius:18px;margin-bottom:24px" fetchpriority="high">` : '';
  const body = shell(`<p><a href="/blog" style="color:#58dcf5">← Back to guides</a></p><header style="margin:32px 0">${hero}<p style="color:#9cb6c7">${postMeta(post, true)}</p><h1>${escapeHtml(post.title)}</h1><p style="color:#bed0dc;font-size:1.125rem;line-height:1.6">${escapeHtml(post.excerpt)}</p></header><article class="article-content" style="padding:36px;border:1px solid #28506a;border-radius:18px;background:#102638">${post.html}</article>${related}${toolLinks}`);
  const socialImage = post.imageUrl ? `${origin}${post.imageUrl}` : `${origin}/og-image.png`;
  const article = { '@type': 'Article', headline: searchTitle, description: post.excerpt, ...(post.publishDate ? { datePublished: post.publishDate, dateModified: post.updatedDate || post.publishDate } : {}), author: authorFor(post.author), publisher: { '@id': `${origin}/#organization` }, mainEntityOfPage: `${origin}/blog/${post.id}`, image: socialImage };
  const jsonLd = { '@context': 'https://schema.org', '@graph': [organization, breadcrumb(`/blog/${post.id}`, searchTitle, { name: 'Guides', pathname: '/blog' }), article] };
  // An undated post is a preview before distribution: not for search engines yet.
  const html = pageTemplate({ title: searchTitle, description: post.excerpt, pathname: `/blog/${post.id}`, type: 'article', image: socialImage, body, jsonLd, robots: post.publishDate ? 'index,follow' : 'noindex,follow' });
  const directory = path.join(dist, 'blog', post.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'index.html'), html);
}

console.log(`Prerendered ${staticPages.length} static routes, the blog index, and ${posts.length} article pages.`);

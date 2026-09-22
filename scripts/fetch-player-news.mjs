/**
 * Fetch NHL player news from FantasyPros' public player-news feed (server-rendered HTML,
 * robots-permitted, crawl-delay 5s) and normalize it into data/player-news.json.
 *
 * Each item: itemid, playerId (our nhl: id), playerSlug, title, url, date (ISO),
 * source {href,label}, impact, category, author.
 *
 * Name/slug matching against the canonical player directory (data/players.json).
 * Items that do not match a directory player are kept with playerId: null (skaters
 * outside the 1,464 directory are rare but possible).
 *
 * Usage: node scripts/fetch-player-news.mjs [--pages=2] [--dry-run]
 * CI guard: scripts/tests/player-news.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(scriptDir, '..');
const outPath = path.join(repoRoot, 'data', 'player-news.json');
const playersPath = path.join(repoRoot, 'data', 'players.json');

const SOURCE_BASE = 'https://www.fantasypros.com';
const SOURCE_PAGE = '/nhl/player-news.php';
const FETCH_PAGES = 3; // front 3 pages ≈ rolling 7-day window in-season
const CRAWL_DELAY_MS = 6000; // respect robots.txt Crawl-delay: 5
const USER_AGENT = 'CrackedIceHockey/1.0 (+https://crackedicehockey.com)';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const pagesArg = args.find((a) => a.startsWith('--pages='));
const MAX_PAGES = pagesArg ? Math.max(1, Math.min(5, Number(pagesArg.split('=')[1]))) : FETCH_PAGES;

function slugifyName(name) {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadDirectoryIndex() {
  const dir = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  const bySlug = new Map();
  for (const p of dir.players) {
    bySlug.set(slugifyName(p.name), p.id);
    // alias slugs («A.J. Greer» -> 'aj-greer') as secondary keys; first write wins for canonical names
    for (const alias of p.aliases ?? []) {
      const s = slugifyName(alias);
      if (s && !bySlug.has(s)) bySlug.set(s, p.id);
    }
  }
  return bySlug;
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Parse one .player-news-item HTML block into a normalized record. */
export function parseNewsItem(html) {
  const title = /target="_blank">([^<]+)<\/a>\s*<\/span>/.exec(html)?.[1]?.trim() ?? null;
  const relUrl = /href="(\/nhl\/news\/\d+\/[^"]+)"/.exec(html)?.[1] ?? null;
  const dateRaw = /(\w{3}, \w{3} \d{1,2}\w{2} \d{1,2}:\d{2}[ap]m EDT)/.exec(html)?.[1] ?? null;
  const itemid = /data-itemid="(n-\d+)"/.exec(html)?.[1] ?? null;
  const slug = /href="\/nhl\/players\/([a-z0-9-]+)\.php"/.exec(html)?.[1] ?? null;
  const author = /By\s*<a href="\/news\/correspondents\/[^"]*"[^>]*>([^<]+)<\/a>/.exec(html)?.[1]?.trim() ?? null;
  const srcHref = /\(Source:\s*<a href="([^"]+)"[^>]*>([^<(]+)/.exec(html);
  const impactRaw = /Fantasy Impact:<\/em><\/b>\s*(.*?)<\/p>/s.exec(html)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? null;
  const category = /Category:\s*<a[^>]*>([^<]+)<\/a>/.exec(html)?.[1]?.trim() ?? null;
  const bodyRaw = /<p>([^<{]*?)\s*\(Source:/s.exec(html)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? null;

  if (!title || !dateRaw || !itemid) return null;

  // "Fri, Aug 28th 9:07pm EDT" -> ISO (year inferred from window: FP spans one season window incl. offseason;
  // pick the year that keeps the item within the last 14 months of now)
  const now = new Date();
  let iso = null;
  const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const m = /(\w{3}), (\w{3}) (\d{1,2})\w{2} (\d{1,2}):(\d{2})([ap]m) EDT/.exec(dateRaw);
  if (m) {
    const [, , mon, day, hh, mm, ampm] = m;
    let hour = Number(hh) % 12 + (ampm === 'pm' ? 12 : 0);
    const month = monthMap[mon];
    const dayN = Number(day);
    for (const year of [now.getUTCFullYear(), now.getUTCFullYear() - 1]) {
      const candidate = new Date(Date.UTC(year, month, dayN, hour - 4, Number(mm))); // EDT = UTC-4
      const ageDays = (now - candidate) / 86400000;
      if (ageDays >= -2 && ageDays <= 425) { iso = candidate.toISOString(); break; }
    }
    void hour;
  }

  return {
    itemid,
    title,
    url: relUrl ? `https://www.fantasypros.com${relUrl}` : null,
    date: iso,
    dateLabel: dateRaw,
    playerSlug: slug,
    author,
    source: srcHref ? { href: srcHref[1], label: srcHref[2].trim() } : null,
    body: bodyRaw,
    impact: impactRaw,
    category,
  };
}

function extractItems(pageHtml) {
  const chunks = pageHtml.split('<div class="player-news-item">').slice(1);
  const items = [];
  const seen = new Set();
  for (const chunk of chunks) {
    const block = chunk.slice(0, Math.max(chunk.indexOf('<!-- .player-news-item -->'), 0) === -1 ? chunk.length : chunk.indexOf('player-news-item -->'));
    const item = parseNewsItem(block);
    if (!item || seen.has(item.itemid)) continue;
    seen.add(item.itemid);
    items.push(item);
  }
  return items;
}

async function main() {
  const bySlug = loadDirectoryIndex();
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? `${SOURCE_BASE}${SOURCE_PAGE}` : `${SOURCE_BASE}${SOURCE_PAGE}?page=${page}`;
    const html = await fetchPage(url);
    const items = extractItems(html);
    if (page > 1 && items.length && items[0].itemid && seen.has(items[0].itemid)) {
      console.error('pagination collapsed (cache) — stopping at page', page);
      break;
    }
    for (const it of items) {
      if (seen.has(it.itemid)) continue;
      seen.add(it.itemid);
      it.playerId = it.playerSlug && bySlug.has(it.playerSlug) ? bySlug.get(it.playerSlug) : null;
      all.push(it);
    }
    if (page < MAX_PAGES) await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
  }

  const doc = {
    updatedAt: new Date().toISOString(),
    source: `${SOURCE_BASE}${SOURCE_PAGE}`,
    sourceLabel: 'FantasyPros player news (attributed)',
    itemCount: all.length,
    items: all,
  };

  if (dryRun) {
    console.log(JSON.stringify({ itemCount: all.length, matched: all.filter((i) => i.playerId).length }, null, 1));
    console.log(JSON.stringify(all.slice(0, 2), null, 1));
    return;
  }
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
  const matched = all.filter((i) => i.playerId).length;
  console.log(`player-news: wrote ${all.length} items (${matched} matched to directory) -> data/player-news.json`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('fetch-player-news.mjs')) {
  main().catch((err) => { console.error('fetch-player-news failed:', err.message); process.exit(1); });
}

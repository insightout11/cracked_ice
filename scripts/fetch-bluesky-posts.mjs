/**
 * Nightly beat-writer posts from Bluesky, matched to players.
 *
 * Reads the approved accounts in config/bluesky-writers.json through Bluesky's
 * public AppView API (no key needed), keeps each writer's own posts from the last
 * 7 days (no reposts or replies), and keeps a post only when it names a player:
 * - any writer: a player's full name or directory alias;
 * - team writers: also a surname alone, for players on their team, when no
 *   teammate shares it and it is not an ordinary word ("Power", "Point", "Stone").
 * Posts are shown as written with attribution and a link; a rerun drops posts the
 * author has deleted. Output: web/public/beat-posts.json (served statically).
 *
 * Usage: node scripts/fetch-bluesky-posts.mjs [--days=7] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITERS_PATH = path.join(repoRoot, 'config', 'bluesky-writers.json');
const PLAYERS_PATH = path.join(repoRoot, 'data', 'players.json');
const OUTPUT_PATH = path.join(repoRoot, 'web', 'public', 'beat-posts.json');
const API = 'https://public.api.bsky.app/xrpc';
const MAX_PAGES = 4;

// Surnames that are also everyday words; these players need their full name.
export const AMBIGUOUS_SURNAMES = new Set([
  'bear', 'best', 'black', 'brown', 'burns', 'chase', 'cook', 'day', 'fox', 'free', 'frost', 'green',
  'grant', 'hall', 'hart', 'high', 'hill', 'hunt', 'king', 'lane', 'little', 'long', 'love', 'may',
  'miller', 'pace', 'point', 'power', 'price', 'read', 'rust', 'sharp', 'smith', 'steel', 'still',
  'stone', 'strong', 'white', 'wood', 'young', 'rose', 'page', 'martin', 'lee', 'ward', 'walker',
]);

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Name patterns per player. Full names and aliases match case-insensitively;
 * surnames only case-sensitively (capitalised, as a proper noun).
 */
export function buildMatchers(players, staffSurnamesByTeam = {}) {
  const byTeam = new Map();
  for (const player of players) {
    const list = byTeam.get(player.team) ?? [];
    list.push(player);
    byTeam.set(player.team, list);
  }
  const surnameOf = (name) => normalize(name).trim().split(/\s+/).slice(-1)[0];
  const teamSurnameCounts = new Map();
  for (const [team, list] of byTeam) {
    const counts = new Map();
    for (const player of list) counts.set(surnameOf(player.name).toLowerCase(), (counts.get(surnameOf(player.name).toLowerCase()) ?? 0) + 1);
    teamSurnameCounts.set(team, counts);
  }
  return players.map((player) => {
    const fullNames = [player.name, ...(player.aliases ?? []).filter((alias) => /\s/.test(alias) && alias.length >= 6 && !/\.\s*$|\b[A-Z]\.$/.test(alias))];
    const full = new RegExp(`(^|[^\\p{L}])(${fullNames.map((n) => escapeRegex(normalize(n))).join('|')})(?![\\p{L}])`, 'iu');
    const surname = surnameOf(player.name);
    const staff = new Set((staffSurnamesByTeam[player.team] ?? []).map((name) => normalize(name).toLowerCase()));
    const surnameUsable = surname.length >= 4
      && !AMBIGUOUS_SURNAMES.has(surname.toLowerCase())
      && !staff.has(surname.toLowerCase())
      && teamSurnameCounts.get(player.team)?.get(surname.toLowerCase()) === 1;
    // Group 2 captures a capitalised word directly before the surname ("Rod Brind'Amour");
    // a first name other than the player's means a different person.
    const last = surnameUsable ? new RegExp(`(^|[^\\p{L}])(?:(\\p{Lu}[\\p{L}'.-]*)\\s+)?${escapeRegex(surname)}(?![\\p{L}])`, 'gu') : null;
    const firstName = normalize(player.name).trim().split(/\s+/)[0].toLowerCase();
    return { id: player.id, team: player.team, full, last, firstName };
  });
}

// Capitalised words that often sit right before a surname without being a first name.
const NOT_FIRST_NAMES = new Set(['the', 'and', 'but', 'with', 'for', 'as', 'at', 'if', 'on', 'so', 'then', 'when', 'while', 'per', 'via', 'forward', 'defenseman', 'defenceman', 'goalie', 'goaltender', 'center', 'centre', 'winger', 'rookie', 'captain', 'prospect', 'veteran', 'says', 'said', 'no', 'yes', 'also', 'plus', 'now', 'today', 'tonight', 'why', 'how', 'what', 'who', 'like', 'love', 'great', 'nice', 'big', 'good']);

function surnameMatches(matcher, text) {
  for (const match of text.matchAll(matcher.last)) {
    const before = match[2]?.toLowerCase();
    if (!before || before === matcher.firstName || NOT_FIRST_NAMES.has(before)) return true;
  }
  return false;
}

/** Player ids named in a post by this writer. */
export function matchPlayers(text, writerTeams, matchers) {
  const t = normalize(text);
  const teamSet = new Set(writerTeams);
  const ids = [];
  for (const matcher of matchers) {
    if (matcher.full.test(t) || (matcher.last && teamSet.has(matcher.team) && surnameMatches(matcher, t))) ids.push(matcher.id);
  }
  return ids;
}

export function postUrl(handle, uri) {
  const rkey = String(uri).split('/').pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

/** The writer's own recent posts: no reposts, no replies. */
export function ownPosts(feed, since) {
  return (feed ?? [])
    .filter((item) => !item.reason && item.post && !item.post.record?.reply)
    .map((item) => item.post)
    .filter((post) => (post.record?.createdAt ?? '') >= since);
}

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) return response.json();
    if (response.status === 400) return null; // unknown or deactivated account
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw new Error(`Bluesky request failed: ${url}`);
}

async function fetchWriterPosts(handle, since) {
  const posts = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await getJson(`${API}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=100&filter=posts_no_replies${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (!data) break;
    const items = data.feed ?? [];
    posts.push(...ownPosts(items, since));
    const oldest = items.map((item) => item.post?.record?.createdAt ?? '').filter(Boolean).sort()[0];
    if (!data.cursor || !items.length || (oldest && oldest < since)) break;
    cursor = data.cursor;
  }
  return posts;
}

async function main() {
  const args = process.argv.slice(2);
  const days = Number(args.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 7);
  const dryRun = args.includes('--dry-run');
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { writers, staffSurnamesByTeam = {} } = JSON.parse(fs.readFileSync(WRITERS_PATH, 'utf8'));
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8')).players ?? [];
  const matchers = buildMatchers(players, staffSurnamesByTeam);

  const posts = [];
  let failedWriters = 0;
  for (const writer of writers) {
    try {
      for (const post of await fetchWriterPosts(writer.handle, since)) {
        const text = String(post.record?.text ?? '').trim();
        const playerIds = matchPlayers(text, writer.teams, matchers);
        if (!text || !playerIds.length) continue;
        posts.push({
          id: post.uri,
          url: postUrl(writer.handle, post.uri),
          author: { handle: writer.handle, name: writer.name, outlet: writer.outlet },
          text,
          date: post.record.createdAt,
          playerIds,
        });
      }
    } catch (error) {
      failedWriters++;
      console.warn(`bluesky: ${writer.handle} skipped: ${error instanceof Error ? error.message : error}`);
    }
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));

  const playerCount = new Set(posts.flatMap((post) => post.playerIds)).size;
  console.log(`beat-posts: ${posts.length} posts naming ${playerCount} players from ${writers.length - failedWriters}/${writers.length} accounts`);
  if (failedWriters > writers.length / 2) throw new Error('Most Bluesky accounts failed; keeping the previous snapshot.');
  const output = { updatedAt: new Date().toISOString(), source: 'Bluesky', windowDays: days, postCount: posts.length, posts };
  if (dryRun) {
    console.log(JSON.stringify(posts.slice(0, 5), null, 2));
    return;
  }
  // Compact: this file is fetched by player cards on phones.
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`fetch-bluesky-posts failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

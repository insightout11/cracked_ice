/**
 * Nightly player news from NHL.com, with a one-line fantasy takeaway per tagged player.
 *
 * Source: the public content API behind NHL.com and the team sites. Stories are
 * tagged with official NHL player ids (`playerid-8478402`), the same ids as the
 * canonical directory, so no name matching is needed. We publish the headline,
 * NHL.com's own one-sentence summary and a link back; never the article text.
 *
 * Fantasy takeaways: Claude Haiku writes one per tagged player, as JSON constrained to
 * the story's player ids (ANTHROPIC_API_KEY). They are reused across runs, so each
 * story is summarised once. Without a key the file is still written, just without
 * takeaways. Output: web/public/player-news.json (served statically).
 *
 * Usage: node scripts/fetch-nhl-news.mjs [--days=14] [--dry-run] [--no-ai]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(repoRoot, 'web', 'public', 'player-news.json');
const PLAYERS_PATH = path.join(repoRoot, 'data', 'players.json');
const API = 'https://forge-dapi.d3.nhle.com/v2/content/en-us/stories';
const PAGE_SIZE = 100;
const MAX_PAGES = 8;
const MAX_NEW_SUMMARIES = 150; // per run (about $0.003 each); the rest are picked up the next night
const SUMMARY_CONCURRENCY = 4;
const ARTICLE_CHAR_LIMIT = 6000;
const MODEL = 'claude-haiku-4-5';
const USER_AGENT = 'CrackedIceHockey/1.0 (+https://crackedicehockey.com)';

// NHL team id -> team-site path on nhl.com (verified 2026-09-23). League stories use /news/.
export const TEAM_SITE_BY_ID = {
  1: 'devils', 2: 'islanders', 3: 'rangers', 4: 'flyers', 5: 'penguins', 6: 'bruins', 7: 'sabres',
  8: 'canadiens', 9: 'senators', 10: 'mapleleafs', 12: 'hurricanes', 13: 'panthers', 14: 'lightning',
  15: 'capitals', 16: 'blackhawks', 17: 'redwings', 18: 'predators', 19: 'blues', 20: 'flames',
  21: 'avalanche', 22: 'oilers', 23: 'canucks', 24: 'ducks', 25: 'stars', 26: 'kings', 28: 'sharks',
  29: 'bluejackets', 30: 'wild', 52: 'jets', 54: 'goldenknights', 55: 'kraken', 68: 'utah',
};

export const CATEGORIES = ['injury', 'lineup', 'transaction', 'performance', 'feature'];

/** Public nhl.com URL for a story, or null when its site is unknown. */
export function storyUrl(story) {
  const context = story.context?.slug ?? 'nhl';
  if (context === 'nhl') return `https://www.nhl.com/news/${story.slug}`;
  const teamId = Number(/^teamid-(\d+)$/.exec(context)?.[1]);
  const site = TEAM_SITE_BY_ID[teamId];
  return site ? `https://www.nhl.com/${site}/news/${story.slug}` : null;
}

export function playerIdsOf(story) {
  return [...new Set((story.tags ?? [])
    .map((tag) => /^playerid-(\d+)$/.exec(tag.slug ?? '')?.[1])
    .filter(Boolean)
    .map((id) => `nhl:${id}`))];
}

/**
 * Fantasy category for a story. The headline decides; the summary only upgrades a
 * story to 'injury' (summaries of features and recaps mention signings, minutes
 * and so on in passing, which made them look like transactions or lineup news).
 */
export function categorizeStory(headline, summary) {
  const fromHeadline = classifyStory(headline);
  if (fromHeadline !== 'feature' && fromHeadline !== 'performance') return fromHeadline;
  return classifyStory(summary) === 'injury' ? 'injury' : fromHeadline;
}

/**
 * Rule-based category for one piece of text. Order matters: injury wins. Terms
 * match whole words ("Red Wings" is not a win); "injur" is a deliberate prefix.
 */
export function classifyStory(text) {
  const t = ` ${String(text ?? '').toLowerCase()} `;
  if (/\b(injur|day-to-day|week-to-week|out indefinitely|surgery|concussion|upper[- ]body|lower[- ]body|placed on (long-term )?injured reserve|ltir\b|won't play|will miss|return(s|ing)? from)/.test(t)) return 'injury';
  if (/\b(lines?|linemates?|top line|top-six|top six|power play|power-play|pp1|first unit|centering|wing(er)? with|pairing|partner|starting goalie|starter|in net|will start|to start in goal|minutes|role|lineup|healthy scratch(es|ed)?)\b/.test(t)) return 'lineup';
  if (/\b(sign(s|ed|ing)?|contract|extension|trade[ds]?|acquire[ds]?|waivers?|claimed|recall(s|ed)?|assign(s|ed)?|loan(s|ed)?|reassign(s|ed)?|released|buyout|bought out|agree(s|d)? to terms|roster moves|cuts|named captain)\b/.test(t)) return 'transaction';
  if (/\b(goals?|assists?|scores|scored|hat trick|points|shutout|saves|wins?|victory|beats?|rally|rallies|recap|takeaways|leads? .* (to|past|over))\b/.test(t)) return 'performance';
  return 'feature';
}

/** Plain text of a story detail's markdown parts, capped for the summariser. */
export function articleText(detail, limit = ARTICLE_CHAR_LIMIT) {
  const text = (detail.parts ?? [])
    .filter((part) => part.type === 'markdown' && typeof part.content === 'string')
    .map((part) => part.content)
    .join('\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > limit ? text.slice(0, limit) : text;
}

/** One output entry per player-tagged story in the window, reusing prior takeaways. */
export function buildEntries(stories, { knownPlayerIds, previousById = new Map(), since }) {
  const entries = [];
  const seen = new Set();
  for (const story of stories) {
    const id = story._entityId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const date = story.contentDate ?? null;
    if (!date || date < since) continue;
    const playerIds = playerIdsOf(story).filter((pid) => knownPlayerIds.has(pid));
    const url = storyUrl(story);
    if (!playerIds.length || !url) continue;
    const previous = previousById.get(id);
    // A story edited since it was summarised gets fresh takeaways, as does one
    // summarised before takeaways became per player.
    const reuse = previous
      && previous.updatedAt === (story.lastUpdatedDate ?? null)
      && (previous.takeawayStatus !== 'ok' || previous.takeaways);
    entries.push({
      id,
      headline: String(story.headline ?? story.title ?? '').trim(),
      nhlSummary: String(story.summary ?? story.fields?.description ?? '').trim() || null,
      url,
      date,
      updatedAt: story.lastUpdatedDate ?? null,
      category: categorizeStory(story.headline ?? story.title ?? '', `${story.summary ?? ''} ${story.fields?.description ?? ''}`),
      playerIds,
      takeaways: reuse ? previous.takeaways ?? {} : {},
      takeawayStatus: reuse ? previous.takeawayStatus ?? 'pending' : 'pending',
      detailUrl: story.selfUrl ?? `${API}/${story.slug}`,
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

const SYSTEM_PROMPT = `You write takeaways of NHL news for fantasy hockey managers.

For each tagged player, write one sentence (at most 25 words) about what the story says that matters for that player's fantasy value: role, line or power-play deployment, ice time, goalie workload, injury status or timeline, contract or roster status. Name the player. Use only facts stated in the story. Do not predict or speculate ("could", "may", "expected to") unless the story itself says so, and do not add numbers the story does not contain.

Use null for a player the story mentions only in passing or says nothing fantasy-relevant about. Community events, broadcasts, fan stories and general features are null for everyone.`;

const takeawaySchema = (playerIds) => ({
  type: 'object',
  properties: {
    players: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          playerId: { type: 'string', enum: playerIds },
          takeaway: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['playerId', 'takeaway'],
        additionalProperties: false,
      },
    },
  },
  required: ['players'],
  additionalProperties: false,
});

/**
 * Ask Haiku for one takeaway per tagged player, as JSON constrained to the story's
 * player ids. Returns { status: 'ok'|'none'|'skipped', takeaways: { [playerId]: text } }.
 */
export async function summarise(client, entry, article, players) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: takeawaySchema(players.map((player) => player.id)) } },
    messages: [{
      role: 'user',
      content: `Tagged players:\n${players.map((player) => `- ${player.id}: ${player.name}`).join('\n')}\n\nHeadline: ${entry.headline}\nNHL.com summary: ${entry.nhlSummary ?? '(none)'}\n\nStory:\n${article || '(article text unavailable)'}`,
    }],
  });
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return { status: 'skipped', takeaways: {} };
  const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
  const known = new Set(players.map((player) => player.id));
  const takeaways = {};
  for (const item of JSON.parse(text).players ?? []) {
    const takeaway = typeof item.takeaway === 'string' ? item.takeaway.replace(/\s+/g, ' ').trim() : '';
    if (known.has(item.playerId) && takeaway && !/^(none|null)\.?$/i.test(takeaway)) takeaways[item.playerId] = takeaway;
  }
  return { status: Object.keys(takeaways).length ? 'ok' : 'none', takeaways };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchStories(since) {
  const stories = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { items = [] } = await getJson(`${API}?$limit=${PAGE_SIZE}&$skip=${page * PAGE_SIZE}`);
    stories.push(...items);
    // The feed is roughly newest-first but pins some older stories near the top, so
    // stop only once a whole page falls before the window.
    const inWindow = items.some((item) => (item.contentDate ?? '') >= since);
    if (items.length < PAGE_SIZE || !inWindow) break;
  }
  return stories;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

async function main() {
  const args = process.argv.slice(2);
  const days = Number(args.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 14);
  const dryRun = args.includes('--dry-run');
  const useAi = !args.includes('--no-ai') && Boolean(process.env.ANTHROPIC_API_KEY);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const directory = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8')).players ?? [];
  const nameById = new Map(directory.map((player) => [player.id, player.name]));
  const previous = fs.existsSync(OUTPUT_PATH) ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')) : { stories: [] };
  const previousById = new Map((previous.stories ?? []).map((entry) => [entry.id, entry]));

  const stories = await fetchStories(since);
  const entries = buildEntries(stories, { knownPlayerIds: new Set(nameById.keys()), previousById, since });

  let summarised = 0;
  let failed = 0;
  if (useAi) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const pending = entries.filter((entry) => entry.takeawayStatus === 'pending').slice(0, MAX_NEW_SUMMARIES);
    await mapLimit(pending, SUMMARY_CONCURRENCY, async (entry) => {
      try {
        const detail = await getJson(entry.detailUrl);
        const players = entry.playerIds.map((id) => ({ id, name: nameById.get(id) })).filter((player) => player.name);
        const result = await summarise(client, entry, articleText(detail), players);
        entry.takeaways = result.takeaways;
        entry.takeawayStatus = result.status;
        summarised++;
      } catch (error) {
        // Leave it pending; the next nightly run retries.
        failed++;
        console.warn(`takeaway failed for ${entry.id}: ${error instanceof Error ? error.message : error}`);
      }
    });
  }

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'NHL.com',
    windowDays: days,
    takeawayModel: MODEL,
    storyCount: entries.length,
    stories: entries.map(({ detailUrl, ...entry }) => entry),
  };

  const players = new Set(entries.flatMap((entry) => entry.playerIds)).size;
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, entries.filter((e) => e.category === c).length]));
  console.log(`player-news: ${entries.length} stories, ${players} players, ${JSON.stringify(byCategory)}; takeaways: ${summarised} new${failed ? `, ${failed} failed` : ''}${useAi ? '' : ' (AI disabled: no ANTHROPIC_API_KEY or --no-ai)'}`);
  if (!entries.length) throw new Error('No player-tagged NHL.com stories found; refusing to overwrite the snapshot.');
  if (dryRun) {
    console.log(JSON.stringify(output.stories.slice(0, 3), null, 2));
    return;
  }
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 1)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`fetch-nhl-news failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

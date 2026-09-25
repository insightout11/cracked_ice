/**
 * Weekly Edge: the numbers behind Cracked Ice's Sunday schedule post.
 *
 * Other schedule posts count games. This one simulates lineups: it drafts 1,800
 * realistic fantasy rosters from Yahoo draft positions, sets each one's best lineup
 * every night, and measures which games a pickup could actually play in.
 *
 *   - Week at a glance: games per night, light and packed nights, the Sunday-Monday bridge.
 *   - Starts that count: for each NHL team, games vs usable starts for a streamer.
 *   - One-slot stream plan: the best sequence of up to three rarely drafted forwards
 *     for a single open spot, against the best single pickup held all week.
 *   - The rotation: the best two rarely drafted forwards to carry for one slot.
 *
 * Run from web/:  npx vite-node ../scripts/weekly/weekly-edge.ts -- --start 2026-09-28
 * Writes content/generated/<season>/weekly/<start>.json. Rendering is separate
 * (scripts/weekly/render-weekly.mjs), so the numbers can be reviewed on their own.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlayerBio, withInjuryStatus, type BioPlayer } from '../../web/src/lib/rosterCard';
import { simulateRosters } from '../../web/src/lib/rosterCardBaseline';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const season = readJson('config/season.json');
const schedule = readJson(`data/${season.scheduleFile}`) as { teams: Record<string, string[]> };
const presets = readJson('config/scoring-presets.json');
const stats = readJson('data/stats.json').players as Record<string, { skaterStats?: SkaterLine; priorSkaterStats?: SkaterLine }>;
const injuries = readJson('web/public/injuries.json').players as Record<string, { status: string }>;
const bio = withInjuryStatus(parsePlayerBio(readJson('web/public/player-bio.json')), Object.fromEntries(Object.entries(injuries).map(([id, entry]) => [id, entry.status])));

const SCORING = presets.yahoo;
const SLOTS: string[] = Object.entries(SCORING.slots as Record<string, number>)
  .filter(([slot]) => ['C', 'LW', 'RW', 'D', 'UTIL'].includes(slot))
  .flatMap(([slot, count]) => Array.from({ length: count }, () => slot));
const LIGHT = 8;
const PACKED = 13;
const RARELY_DRAFTED_ADP = 150;
const OUT = new Set(['IR', 'IR-LT', 'IR-NR', 'O', 'NA', 'SUSP']);

interface SkaterLine { gamesPlayed?: number; goals?: number; assists?: number; shots?: number; blocks?: number; ppPoints?: number; shGoals?: number; hits?: number; plusMinus?: number }

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const start = arg('start') ?? (() => { throw new Error('--start YYYY-MM-DD (a Monday) is required'); })();
const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
const nextMonday = addDays(start, 7);

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const teamsOn = (date: string) => Object.entries(schedule.teams).filter(([, games]) => games.includes(date)).map(([team]) => team);
const nights = [...dates, nextMonday].map((date) => ({ date, teams: teamsOn(date), games: teamsOn(date).length / 2 }));
const plays = (team: string, date: string) => schedule.teams[team]?.includes(date) ?? false;

// ---------------------------------------------------------------------------
// Scoring: last full season in Yahoo standard points, as a reference rate
// ---------------------------------------------------------------------------

function fppg(player: BioPlayer): number | null {
  const record = stats[`nhl:${player.id}`];
  const line = (record?.priorSkaterStats?.gamesPlayed ?? 0) >= 20 ? record?.priorSkaterStats : record?.skaterStats;
  if (!line?.gamesPlayed || line.gamesPlayed < 20) return null;
  const w = SCORING.skater;
  const total = (line.goals ?? 0) * (w.goals ?? 0) + (line.assists ?? 0) * (w.assists ?? 0) + (line.shots ?? 0) * (w.shots_on_goal ?? 0)
    + (line.blocks ?? 0) * (w.blocks ?? 0) + (line.ppPoints ?? 0) * (w.power_play_points ?? 0) + (line.shGoals ?? 0) * (w.shorthanded_goals ?? 0)
    + (line.hits ?? 0) * (w.hits ?? 0) + (line.plusMinus ?? 0) * (w.plus_minus ?? 0);
  return total / line.gamesPlayed;
}

// ---------------------------------------------------------------------------
// Lineups: does a pickup with these positions find an open slot tonight?
// ---------------------------------------------------------------------------

const fits = (positions: string[], slot: string) => (slot === 'UTIL' ? !positions.includes('G') : positions.includes(slot));

/** Maximum number of players that can be placed in the skater slots (bipartite matching). */
function lineupSize(players: string[][]): number {
  const slotOwner = new Array<number>(SLOTS.length).fill(-1);
  const place = (player: number, seen: boolean[]): boolean => {
    for (let slot = 0; slot < SLOTS.length; slot += 1) {
      if (seen[slot] || !fits(players[player], SLOTS[slot])) continue;
      seen[slot] = true;
      if (slotOwner[slot] < 0 || place(slotOwner[slot], seen)) {
        slotOwner[slot] = player;
        return true;
      }
    }
    return false;
  };
  let size = 0;
  players.forEach((_, index) => { if (place(index, new Array(SLOTS.length).fill(false))) size += 1; });
  return size;
}

const rosters = simulateRosters(bio).map((roster) => roster.filter((player) => !player.pos.includes('G') && !(player.injury && OUT.has(player.injury))));

/** Share of simulated rosters with an open slot tonight for a player with these positions. */
const openCache = new Map<string, number>();
function openShare(positions: string[], date: string): number {
  const key = `${[...positions].sort().join('/')}|${date}`;
  const cached = openCache.get(key);
  if (cached !== undefined) return cached;
  let open = 0;
  for (const roster of rosters) {
    const playing = roster.filter((player) => plays(player.team, date)).map((player) => player.pos);
    if (lineupSize([...playing, positions]) > lineupSize(playing)) open += 1;
  }
  const share = open / rosters.length;
  openCache.set(key, share);
  return share;
}

// ---------------------------------------------------------------------------
// Starts that count, per NHL team (for a forward pickup)
// ---------------------------------------------------------------------------

const FORWARD_SHAPES = [['C'], ['LW'], ['RW']];
const teamStarts = Object.keys(schedule.teams).map((team) => {
  const games = dates.filter((date) => plays(team, date));
  const usable = games.reduce((sum, date) => sum + FORWARD_SHAPES.reduce((acc, shape) => acc + openShare(shape, date), 0) / FORWARD_SHAPES.length, 0);
  return {
    team,
    games: games.length,
    usable: Math.round(usable * 10) / 10,
    lightGames: games.filter((date) => (nights.find((night) => night.date === date)?.games ?? 99) <= LIGHT).length,
    packedGames: games.filter((date) => (nights.find((night) => night.date === date)?.games ?? 0) >= PACKED).length,
  };
}).sort((a, b) => b.usable - a.usable || b.games - a.games || a.team.localeCompare(b.team));

// ---------------------------------------------------------------------------
// Candidates: rarely drafted forwards with a real track record
// ---------------------------------------------------------------------------

const candidates = bio
  .filter((player) => !player.pos.includes('G') && !player.pos.includes('D') && player.pos.length > 0)
  .filter((player) => player.adp === null || player.adp > RARELY_DRAFTED_ADP)
  .filter((player) => !(player.injury && OUT.has(player.injury)))
  .map((player) => ({ player, rate: fppg(player) }))
  .filter((entry): entry is { player: BioPlayer; rate: number } => entry.rate !== null && entry.rate > 0)
  .map(({ player, rate }) => ({
    player,
    rate,
    byDay: dates.map((date) => (plays(player.team, date) ? rate * openShare(player.pos, date) : 0)),
  }))
  .filter((entry) => entry.byDay.some((value) => value > 0));

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// Best single pickup held all week.
const bestHold = [...candidates].sort((a, b) => sum(b.byDay) - sum(a.byDay))[0];

// One-slot stream plan: up to three players in consecutive stretches (each is an add).
interface Stretch { entry: typeof candidates[number]; from: number; to: number; value: number }
function bestPlan(maxAdds: number): { value: number; stretches: Stretch[] } {
  // best[k][d]: best value covering days 0..d-1 using k stretches.
  const best: Array<Array<{ value: number; stretches: Stretch[] }>> = Array.from({ length: maxAdds + 1 }, () => Array.from({ length: 8 }, () => ({ value: -1, stretches: [] })));
  best[0][0] = { value: 0, stretches: [] };
  const bestStretch = new Map<string, Stretch>();
  for (let from = 0; from < 7; from += 1) {
    for (let to = from; to < 7; to += 1) {
      let top: Stretch | null = null;
      for (const entry of candidates) {
        const value = sum(entry.byDay.slice(from, to + 1));
        if (!top || value > top.value) top = { entry, from, to, value };
      }
      if (top) bestStretch.set(`${from}-${to}`, top);
    }
  }
  for (let k = 0; k < maxAdds; k += 1) {
    for (let day = 0; day < 7; day += 1) {
      const state = best[k][day];
      if (state.value < 0) continue;
      // Leave the day empty (no add yet) or start a stretch here.
      if (state.value > best[k][day + 1].value) best[k][day + 1] = state;
      for (let to = day; to < 7; to += 1) {
        const stretch = bestStretch.get(`${day}-${to}`) as Stretch;
        const value = state.value + stretch.value;
        if (value > best[k + 1][to + 1].value) best[k + 1][to + 1] = { value, stretches: [...state.stretches, stretch] };
      }
    }
    for (let day = 0; day < 7; day += 1) if (best[k + 1][day].value > best[k + 1][day + 1].value) best[k + 1][day + 1] = best[k + 1][day];
  }
  return [...best.map((row) => row[7])].sort((a, b) => b.value - a.value)[0];
}
const plan = bestPlan(3);
// Drop stretches that add nothing and merge back-to-back stretches of the same player.
const planStretches = plan.stretches
  .filter((stretch) => stretch.value > 0.01)
  .reduce<Stretch[]>((list, stretch) => {
    const last = list[list.length - 1];
    if (last && last.entry.player.id === stretch.entry.player.id && last.to + 1 === stretch.from) {
      list[list.length - 1] = { ...last, to: stretch.to, value: last.value + stretch.value };
    } else list.push(stretch);
    return list;
  }, []);

// The rotation: two players carried all week, start whoever plays.
const shortlist = [...candidates].sort((a, b) => sum(b.byDay) - sum(a.byDay)).slice(0, 60);
let rotation = { a: shortlist[0], b: shortlist[1], value: 0 };
for (let i = 0; i < shortlist.length; i += 1) {
  for (let j = i + 1; j < shortlist.length; j += 1) {
    if (shortlist[i].player.team === shortlist[j].player.team) continue;
    const value = sum(dates.map((_, day) => Math.max(shortlist[i].byDay[day], shortlist[j].byDay[day])));
    if (value > rotation.value) rotation = { a: shortlist[i], b: shortlist[j], value };
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const describe = (entry: typeof candidates[number]) => ({
  id: entry.player.id,
  name: entry.player.name,
  team: entry.player.team,
  positions: entry.player.pos,
  adp: entry.player.adp,
  referenceFppg: Math.round(entry.rate * 100) / 100,
  games: dates.filter((date) => plays(entry.player.team, date)),
});
const round1 = (value: number) => Math.round(value * 10) / 10;

const output = {
  generatedAt: new Date().toISOString(),
  week: { start, end: dates[6], nextMonday },
  method: {
    rosters: rosters.length,
    scoring: SCORING.label,
    skaterSlots: SLOTS,
    lightNight: `${LIGHT} or fewer NHL games`,
    packedNight: `${PACKED} or more NHL games`,
    rarelyDrafted: `Yahoo average draft pick after ${RARELY_DRAFTED_ADP}, or not drafted`,
    referenceRate: 'Last full season, Yahoo standard points per game',
  },
  nights: nights.map((night) => ({ ...night, light: night.games > 0 && night.games <= LIGHT, packed: night.games >= PACKED, forwardOpenShare: round1(100 * (FORWARD_SHAPES.reduce((acc, shape) => acc + openShare(shape, night.date), 0) / FORWARD_SHAPES.length)) })),
  bridge: nights[6].teams.filter((team) => nights[7].teams.includes(team)),
  teamStarts,
  plan: {
    expectedPoints: round1(sum(planStretches.map((stretch) => stretch.value))),
    adds: planStretches.length,
    // A stretch runs from its first to its last game (empty days either side are just waiting).
    stretches: planStretches.map((stretch) => {
      const played = dates.slice(stretch.from, stretch.to + 1).filter((date) => plays(stretch.entry.player.team, date));
      return { ...describe(stretch.entry), from: played[0], to: played[played.length - 1], expectedPoints: round1(stretch.value) };
    }),
    bestHold: { ...describe(bestHold), expectedPoints: round1(sum(bestHold.byDay)) },
  },
  rotation: {
    expectedPoints: round1(rotation.value),
    players: [rotation.a, rotation.b].map((entry) => ({ ...describe(entry), expectedPoints: round1(sum(entry.byDay)) })),
  },
};

const outDir = path.join(root, 'content', 'generated', season.label, 'weekly');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${start}.json`), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Weekly edge ${start}: ${rosters.length} rosters, ${candidates.length} candidates`);
console.log('Nights:', output.nights.map((night) => `${night.date.slice(5)} ${night.games}g ${night.forwardOpenShare}% open`).join(' | '));
console.log('Top usable:', teamStarts.slice(0, 8).map((team) => `${team.team} ${team.games}g/${team.usable}`).join(', '));
console.log('Traps:', [...teamStarts].sort((a, b) => (b.games - b.usable) - (a.games - a.usable)).slice(0, 4).map((team) => `${team.team} ${team.games}g/${team.usable}`).join(', '));
console.log('Plan:', output.plan.stretches.map((stretch) => `${stretch.name} (${stretch.team}) ${stretch.from.slice(5)}-${stretch.to.slice(5)} ${stretch.expectedPoints}`).join(' -> '), `= ${output.plan.expectedPoints} vs hold ${output.plan.bestHold.name} ${output.plan.bestHold.expectedPoints}`);
console.log('Rotation:', output.rotation.players.map((player) => `${player.name} (${player.team})`).join(' + '), `= ${output.rotation.expectedPoints}`);

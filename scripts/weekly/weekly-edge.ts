/**
 * Weekly Edge: the numbers behind Cracked Ice's Sunday schedule post.
 *
 * Other schedule posts count games. This one simulates lineups: it drafts 1,800
 * realistic fantasy rosters from Yahoo draft positions, sets each one's best lineup
 * every night, and measures which games a pickup could actually play in. Everything is
 * in games, never fantasy points, because every league scores differently.
 *
 *   - Nights: games per night, light and packed nights, the share of rosters with room.
 *   - Teams: games vs usable games over this week, the next 2 weeks and the next 30 days.
 *   - Storylines: back-to-backs, four-game weeks, the Sunday-Monday bridge.
 *   - Options: for the best teams to target, players across Yahoo ownership bands
 *     (so there's something left whatever your league looks like), each with a reason.
 *   - Holds: players whose next 30 days make them worth keeping, not streaming.
 *
 * Run from web/:  npx vite-node ../scripts/weekly/weekly-edge.ts -- --start 2026-09-28
 * Writes content/generated/<season>/weekly/<start>.json; render-weekly.mjs draws it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlayerBio, withInjuryStatus, type BioPlayer } from '../../web/src/lib/rosterCard';
import { simulateRosters } from '../../web/src/lib/rosterCardBaseline';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

interface GameLogRow { gameDate: string; points?: number; shots?: number; hits?: number; blocks?: number; powerPlayPoints?: number }
interface SkaterLine { gamesPlayed?: number; goals?: number; assists?: number; points?: number; shots?: number; blocks?: number; hits?: number; ppPoints?: number }
interface StatsRecord { skaterStats?: SkaterLine; gameLog?: GameLogRow[]; advancedStats?: { ppTimeOnIcePerGame?: number; avgToiPerGame?: number }; careerHistory?: Record<string, { team?: string; gamesPlayed?: number }> }

const season = readJson('config/season.json');
const schedule = readJson(`data/${season.scheduleFile}`) as { teams: Record<string, string[]> };
const stats = readJson('data/stats.json').players as Record<string, StatsRecord>;
const yahoo = readJson('data/yahoo-player-eligibility.json').players as Record<string, { percentOwned?: number | null; percentOwnedDelta?: number | null; injuryStatus?: string | null }>;
const injuries = readJson('web/public/injuries.json').players as Record<string, { status: string }>;
const bio = withInjuryStatus(parsePlayerBio(readJson('web/public/player-bio.json')), Object.fromEntries(Object.entries(injuries).map(([id, entry]) => [id, entry.status])));

// Yahoo standard skater slots: 2 C, 2 LW, 2 RW, 4 D.
const SLOTS = ['C', 'C', 'LW', 'LW', 'RW', 'RW', 'D', 'D', 'D', 'D'];
const TEAM_NAMES: Record<string, string> = {
  ANA: 'Anaheim Ducks', BOS: 'Boston Bruins', BUF: 'Buffalo Sabres', CAR: 'Carolina Hurricanes', CBJ: 'Columbus Blue Jackets', CGY: 'Calgary Flames', CHI: 'Chicago Blackhawks', COL: 'Colorado Avalanche', DAL: 'Dallas Stars', DET: 'Detroit Red Wings', EDM: 'Edmonton Oilers', FLA: 'Florida Panthers', LAK: 'Los Angeles Kings', MIN: 'Minnesota Wild', MTL: 'Montréal Canadiens', NJD: 'New Jersey Devils', NSH: 'Nashville Predators', NYI: 'New York Islanders', NYR: 'New York Rangers', OTT: 'Ottawa Senators', PHI: 'Philadelphia Flyers', PIT: 'Pittsburgh Penguins', SEA: 'Seattle Kraken', SJS: 'San Jose Sharks', STL: 'St. Louis Blues', TBL: 'Tampa Bay Lightning', TOR: 'Toronto Maple Leafs', UTA: 'Utah Mammoth', VAN: 'Vancouver Canucks', VGK: 'Vegas Golden Knights', WPG: 'Winnipeg Jets', WSH: 'Washington Capitals',
};
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const LIGHT = 8;
const PACKED = 13;
const OUT = new Set(['IR', 'IR-LT', 'IR-NR', 'O', 'NA', 'SUSP']);
/** Ownership bands, so every team's options include someone likely to be free. */
const BANDS = [
  { key: 'check', label: 'Check first', min: 40, max: 85 },
  { key: 'often', label: 'Often available', min: 15, max: 40 },
  { key: 'deep', label: 'Almost always free', min: 0, max: 15 },
] as const;

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

const start = arg('start') ?? (() => { throw new Error('--start YYYY-MM-DD (a Monday) is required'); })();
const HORIZONS = [
  { key: 'week', label: 'This week', days: 7 },
  { key: 'twoWeeks', label: 'Next 2 weeks', days: 14 },
  { key: 'month', label: 'Next 30 days', days: 30 },
] as const;
const horizonDates = Object.fromEntries(HORIZONS.map((horizon) => [horizon.key, Array.from({ length: horizon.days }, (_, index) => addDays(start, index))])) as Record<(typeof HORIZONS)[number]['key'], string[]>;
const allDates = horizonDates.month;

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const plays = (team: string, date: string) => schedule.teams[team]?.includes(date) ?? false;
const gamesOn = (date: string) => Object.values(schedule.teams).filter((dates) => dates.includes(date)).length / 2;
const nightGames = new Map(allDates.concat(addDays(start, 30)).map((date) => [date, gamesOn(date)]));

// ---------------------------------------------------------------------------
// Lineups: does a pickup with these positions find an open slot tonight?
// ---------------------------------------------------------------------------

const fits = (positions: string[], slot: string) => positions.includes(slot);
function lineupSize(players: string[][]): number {
  const owner = new Array<number>(SLOTS.length).fill(-1);
  const place = (player: number, seen: boolean[]): boolean => {
    for (let slot = 0; slot < SLOTS.length; slot += 1) {
      if (seen[slot] || !fits(players[player], SLOTS[slot])) continue;
      seen[slot] = true;
      if (owner[slot] < 0 || place(owner[slot], seen)) { owner[slot] = player; return true; }
    }
    return false;
  };
  return players.reduce((size, _, index) => size + (place(index, new Array(SLOTS.length).fill(false)) ? 1 : 0), 0);
}

const rosters = simulateRosters(bio).map((roster) => roster.filter((player) => !player.pos.includes('G') && !(player.injury && OUT.has(player.injury))));
const openCache = new Map<string, number>();
/** Share of simulated rosters with a slot tonight for a player with these positions. */
function openShare(positions: string[], date: string): number {
  const key = `${[...positions].sort().join('/')}|${date}`;
  const cached = openCache.get(key);
  if (cached !== undefined) return cached;
  let open = 0;
  for (const roster of rosters) {
    const playing = roster.filter((player) => plays(player.team, date)).map((player) => player.pos);
    if (lineupSize([...playing, positions]) > lineupSize(playing)) open += 1;
  }
  openCache.set(key, open / rosters.length);
  return open / rosters.length;
}
const usableGames = (team: string, positions: string[], dates: string[]) => dates.reduce((sum, date) => sum + (plays(team, date) ? openShare(positions, date) : 0), 0);
const FORWARD = [['C'], ['LW'], ['RW']];
const forwardUsable = (team: string, dates: string[]) => FORWARD.reduce((sum, shape) => sum + usableGames(team, shape, dates), 0) / FORWARD.length;

// ---------------------------------------------------------------------------
// Teams and storylines
// ---------------------------------------------------------------------------

function backToBacks(team: string, dates: string[]): string[][] {
  const games = dates.filter((date) => plays(team, date));
  return games.slice(1).filter((date, index) => addDays(games[index], 1) === date).map((date, index) => [addDays(date, -1), date]).filter(() => true);
}

const teams = Object.keys(schedule.teams).sort().map((team) => {
  const byHorizon = Object.fromEntries(HORIZONS.map((horizon) => {
    const dates = horizonDates[horizon.key];
    const games = dates.filter((date) => plays(team, date));
    return [horizon.key, {
      games: games.length,
      usableForward: round1(forwardUsable(team, dates)),
      usableDefence: round1(usableGames(team, ['D'], dates)),
      lightGames: games.filter((date) => (nightGames.get(date) ?? 99) <= LIGHT).length,
      packedGames: games.filter((date) => (nightGames.get(date) ?? 0) >= PACKED).length,
      backToBacks: backToBacks(team, dates).length,
    }];
  }));
  return { team, ...byHorizon } as { team: string } & Record<(typeof HORIZONS)[number]['key'], { games: number; usableForward: number; usableDefence: number; lightGames: number; packedGames: number; backToBacks: number }>;
});

const week = horizonDates.week;
const storylines = {
  backToBacks: teams.flatMap((team) => backToBacks(team.team, week).map(([first, second]) => ({ team: team.team, first, second, bothLight: (nightGames.get(first) ?? 99) <= LIGHT && (nightGames.get(second) ?? 99) <= LIGHT }))),
  fourGameTeams: teams.filter((team) => team.week.games >= 4).map((team) => team.team),
  allLight: teams.filter((team) => team.week.games >= 3 && team.week.packedGames === 0 && team.week.lightGames === team.week.games).map((team) => team.team),
  bridge: Object.keys(schedule.teams).filter((team) => plays(team, week[6]) && plays(team, addDays(start, 7))),
};

// ---------------------------------------------------------------------------
// Players: last season's profile, from real stats (no fantasy points)
// ---------------------------------------------------------------------------

function profile(player: BioPlayer) {
  const record = stats[`nhl:${player.id}`];
  const line = record?.skaterStats;
  const gp = line?.gamesPlayed ?? 0;
  if (gp < 20) return null;
  const log = [...(record?.gameLog ?? [])].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  // Split the season at New Year's: how he finished vs how he started.
  const newYear = `${Number(log[log.length - 1]?.gameDate.slice(0, 4) ?? 0)}-01-01`;
  const first = log.filter((game) => game.gameDate < newYear);
  const second = log.filter((game) => game.gameDate >= newYear);
  const perGame = (games: GameLogRow[]) => (games.length ? games.reduce((sum, game) => sum + (game.points ?? 0), 0) / games.length : null);
  const seasons = Object.keys(record?.careerHistory ?? {}).sort();
  const lastTeam = seasons.length ? record?.careerHistory?.[seasons[seasons.length - 1]]?.team ?? null : null;
  const currentTeam = TEAM_NAMES[player.team];
  // Utah renamed (Hockey Club -> Mammoth); only the city matters for that check.
  const newTeam = Boolean(lastTeam && currentTeam && !fold(lastTeam).startsWith(fold(currentTeam).split(' ')[0]));
  return {
    gp,
    toiMinutes: round1((record?.advancedStats?.avgToiPerGame ?? 0) / 60),
    lastTeam,
    newTeam,
    points: line?.points ?? 0,
    pointsPerGame: round2((line?.points ?? 0) / gp),
    pace82: Math.round(((line?.points ?? 0) / gp) * 82),
    shotsPerGame: round1((line?.shots ?? 0) / gp),
    hitsBlocksPerGame: round1(((line?.hits ?? 0) + (line?.blocks ?? 0)) / gp),
    ppMinutes: round1((record?.advancedStats?.ppTimeOnIcePerGame ?? 0) / 60),
    firstHalf: first.length >= 15 ? { games: first.length, pointsPerGame: round2(perGame(first) as number) } : null,
    secondHalf: second.length >= 15 ? { games: second.length, pointsPerGame: round2(perGame(second) as number) } : null,
  };
}

type Profile = NonNullable<ReturnType<typeof profile>>;

/** Short, checkable reasons to care. Most important first. */
function reasons(player: BioPlayer, stat: Profile): string[] {
  const list: string[] = [];
  const isD = player.pos.includes('D');
  const opening = opportunity(player, stat);
  if (opening) list.push(opening);
  if (stat.newTeam && stat.lastTeam) list.push(`New team: came over from ${stat.lastTeam}, so his role is still being set`);
  if (stat.firstHalf && stat.secondHalf && stat.secondHalf.pointsPerGame - stat.firstHalf.pointsPerGame >= 0.2) {
    list.push(`Finished hot: ${stat.firstHalf.pointsPerGame.toFixed(2)} points a game before New Year's, ${stat.secondHalf.pointsPerGame.toFixed(2)} after`);
  }
  if (!stat.newTeam && stat.ppMinutes >= 2) list.push(`${stat.ppMinutes.toFixed(1)} power-play minutes a game`);
  if ((player.career?.gp ?? 0) < 90) list.push(`Young and rising: ${player.career?.gp ?? stat.gp} NHL games so far`);
  if (!isD && stat.shotsPerGame >= 2.6) list.push(`${stat.shotsPerGame.toFixed(1)} shots a game`);
  if (isD && stat.hitsBlocksPerGame >= 3.5) list.push(`${stat.hitsBlocksPerGame.toFixed(1)} hits + blocks a game (banger leagues)`);
  if (isD && stat.pointsPerGame >= 0.45) list.push(`${stat.pace82}-point pace from the blue line`);
  if (!isD && stat.pointsPerGame >= 0.6) list.push(`${stat.pace82}-point pace last season`);
  return list;
}

const injuredOut = bio.filter((player) => player.injury && OUT.has(player.injury) && !player.pos.includes('G'));
function opportunity(player: BioPlayer, stat: Profile): string | null {
  const group = (positions: string[]) => (positions.includes('D') ? 'D' : 'F');
  const minimum = group(player.pos) === 'D' ? 20 : 16;
  const missing = injuredOut
    .filter((teammate) => teammate.team === player.team && group(teammate.pos) === group(player.pos))
    .map((teammate) => ({ teammate, toi: (stats[`nhl:${teammate.id}`]?.advancedStats?.avgToiPerGame ?? 0) / 60 }))
    .filter(({ toi }) => toi >= minimum && toi > stat.toiMinutes + 1)
    .sort((a, b) => b.toi - a.toi)[0];
  return missing ? `Opportunity: ${missing.teammate.name} is out (${missing.teammate.injury}), so there's room to move up` : null;
}

/** A rough "how good is he" score from real stats, for ordering options within a band. */
function quality(player: BioPlayer, stat: Profile): number {
  const isD = player.pos.includes('D');
  const surge = stat.firstHalf && stat.secondHalf ? Math.max(0, stat.secondHalf.pointsPerGame - stat.firstHalf.pointsPerGame) : 0;
  return stat.pointsPerGame * (isD ? 1.6 : 1) + stat.shotsPerGame * 0.08 + stat.ppMinutes * 0.06 + surge * 0.5 + (isD ? stat.hitsBlocksPerGame * 0.03 : 0);
}

const players = bio
  .filter((player) => !player.pos.includes('G') && player.pos.length > 0)
  .filter((player) => !(player.injury && OUT.has(player.injury)))
  .flatMap((player) => {
    const owned = yahoo[`nhl:${player.id}`];
    if (!owned) return [];
    const stat = profile(player);
    if (!stat) return [];
    const percentOwned = owned.percentOwned ?? 0;
    if (percentOwned > 85) return [];
    const usable = Object.fromEntries(HORIZONS.map((horizon) => [horizon.key, round1(usableGames(player.team, player.pos, horizonDates[horizon.key]))])) as Record<(typeof HORIZONS)[number]['key'], number>;
    return [{
      id: player.id,
      name: player.name,
      team: player.team,
      positions: player.pos,
      percentOwned,
      ownedChange: owned.percentOwnedDelta ?? 0,
      band: BANDS.find((band) => percentOwned >= band.min && percentOwned <= band.max)?.key ?? 'deep',
      usable,
      games: Object.fromEntries(HORIZONS.map((horizon) => [horizon.key, horizonDates[horizon.key].filter((date) => plays(player.team, date)).length])),
      stats: stat,
      reasons: reasons(player, stat),
      quality: round2(quality(player, stat)),
    }];
  });

type Option = (typeof players)[number];

// ---------------------------------------------------------------------------
// Where to look: best teams by usable games, with options in every ownership band
// ---------------------------------------------------------------------------

function options(team: string, horizon: (typeof HORIZONS)[number]['key']): Array<Option & { bandLabel: string }> {
  const pool = players.filter((player) => player.team === team && player.reasons.length > 0);
  return BANDS.flatMap((band) => pool
    .filter((player) => player.band === band.key)
    .sort((a, b) => b.quality - a.quality || b.usable[horizon] - a.usable[horizon])
    .slice(0, band.key === 'check' ? 1 : 2)
    .map((player) => ({ ...player, bandLabel: band.label })));
}

const targets = Object.fromEntries(HORIZONS.map((horizon) => {
  const ranked = [...teams].sort((a, b) => b[horizon.key].usableForward - a[horizon.key].usableForward || b[horizon.key].games - a[horizon.key].games);
  return [horizon.key, ranked.slice(0, 5).map((team) => ({ team: team.team, ...team[horizon.key], options: options(team.team, horizon.key) }))];
}));

// Strategies for one open forward spot this week, in usable games (no points).
const forwardShare = (date: string) => FORWARD.reduce((sum, shape) => sum + openShare(shape, date), 0) / FORWARD.length;
const teamCodes = Object.keys(schedule.teams);
const segmentValue = (team: string, from: number, to: number) => week.slice(from, to + 1).reduce((sum, date) => sum + (plays(team, date) ? forwardShare(date) : 0), 0);
function bestChain(adds: number) {
  // best[k][d]: best chain using k teams that covers days 0..d-1.
  type State = { value: number; legs: Array<{ team: string; from: number; to: number }> };
  const best: State[][] = Array.from({ length: adds + 1 }, () => Array.from({ length: 8 }, () => ({ value: -1, legs: [] })));
  best[0][0] = { value: 0, legs: [] };
  for (let k = 0; k < adds; k += 1) {
    for (let day = 0; day < 7; day += 1) {
      const state = best[k][day];
      if (state.value < 0) continue;
      if (state.value > best[k][day + 1].value) best[k][day + 1] = state;
      for (let to = day; to < 7; to += 1) {
        for (const team of teamCodes) {
          if (state.legs.some((leg) => leg.team === team)) continue;
          const value = state.value + segmentValue(team, day, to);
          if (value > best[k + 1][to + 1].value) best[k + 1][to + 1] = { value, legs: [...state.legs, { team, from: day, to }] };
        }
      }
    }
  }
  const final = best[adds][7].value >= 0 ? best[adds][7] : best[adds].reduce((a, b) => (b.value > a.value ? b : a));
  return {
    usable: round1(final.value),
    legs: final.legs.map((leg) => {
      const games = week.slice(leg.from, leg.to + 1).filter((date) => plays(leg.team, date));
      return { team: leg.team, games, usable: round1(segmentValue(leg.team, leg.from, leg.to)), options: options(leg.team, 'week') };
    }).filter((leg) => leg.games.length),
  };
}
let rotation = { teams: ['', ''], usable: 0, games: 0 };
for (let i = 0; i < teamCodes.length; i += 1) {
  for (let j = i + 1; j < teamCodes.length; j += 1) {
    const usable = week.reduce((sum, date) => sum + (plays(teamCodes[i], date) || plays(teamCodes[j], date) ? forwardShare(date) : 0), 0);
    if (usable > rotation.usable) rotation = { teams: [teamCodes[i], teamCodes[j]], usable, games: week.filter((date) => plays(teamCodes[i], date) || plays(teamCodes[j], date)).length };
  }
}
const strategies = {
  oneAdd: bestChain(1),
  twoAdds: bestChain(2),
  threeAdds: bestChain(3),
  rotation: { ...rotation, usable: round1(rotation.usable), options: Object.fromEntries(rotation.teams.map((team) => [team, options(team, 'week')])) },
  // A spare third add: a team playing Sunday and next Monday gives a Week 2 game on a Week 1 add.
  bridgeAdd: storylines.bridge.length ? {
    team: storylines.bridge[0],
    games: [week[6], addDays(start, 7)],
    nextWeekGames: horizonDates.twoWeeks.slice(7).filter((date) => plays(storylines.bridge[0], date)),
    options: options(storylines.bridge[0], 'twoWeeks'),
  } : null,
};

// Holds: rarely owned players with a real reason and a strong 30 days. Forwards and
// defence separately: D slots open up more often, so a mixed list would be all D.
const holdScore = (player: Option) => player.usable.month * (1 + player.quality);
const holdPool = players.filter((player) => player.percentOwned <= 80 && player.reasons.length > 0);
// Across ownership bands too, so there's a hold left in any league.
const byBand = (list: Option[], perBand: number) => BANDS.flatMap((band) => list.filter((player) => player.band === band.key).sort((a, b) => holdScore(b) - holdScore(a)).slice(0, perBand));
const holds = {
  forwards: byBand(holdPool.filter((player) => !player.positions.includes('D')), 2),
  defence: byBand(holdPool.filter((player) => player.positions.includes('D')), 1),
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const output = {
  generatedAt: new Date().toISOString(),
  week: { start, end: week[6], nextMonday: addDays(start, 7) },
  method: {
    rosters: rosters.length,
    skaterSlots: SLOTS,
    lightNight: `${LIGHT} or fewer NHL games`,
    packedNight: `${PACKED} or more NHL games`,
    ownership: 'Yahoo percent owned this week',
    stats: 'Last full NHL season; halves split at New Year\'s',
  },
  horizons: HORIZONS.map((horizon) => ({ ...horizon, start, end: horizonDates[horizon.key][horizon.days - 1] })),
  nights: [...week, addDays(start, 7)].map((date) => {
    const games = gamesOn(date);
    return { date, games, light: games > 0 && games <= LIGHT, packed: games >= PACKED, forwardOpenShare: Math.round(100 * FORWARD.reduce((sum, shape) => sum + openShare(shape, date), 0) / FORWARD.length), defenceOpenShare: Math.round(100 * openShare(['D'], date)) };
  }),
  storylines,
  teams,
  targets,
  strategies,
  holds,
};

const outDir = path.join(root, 'content', 'generated', season.label, 'weekly');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${start}.json`), `${JSON.stringify(output, null, 2)}\n`);

console.log(`Weekly edge ${start}: ${rosters.length} rosters, ${players.length} players with ownership and stats`);
console.log('Nights:', output.nights.map((night) => `${night.date.slice(5)} ${night.games}g F${night.forwardOpenShare}% D${night.defenceOpenShare}%`).join(' | '));
console.log('Storylines:', JSON.stringify(storylines));
for (const [name, strategy] of Object.entries(strategies)) {
  if (name === 'rotation') console.log(`Strategy rotation: ${strategies.rotation.teams.join(' + ')} = ${strategies.rotation.games} games, ${strategies.rotation.usable} usable`);
  else console.log(`Strategy ${name}: ${(strategy as ReturnType<typeof bestChain>).legs.map((leg) => `${leg.team} ${leg.games.map((date) => date.slice(5)).join(',')}`).join(' -> ')} = ${(strategy as ReturnType<typeof bestChain>).usable} usable`);
}
for (const horizon of HORIZONS) {
  console.log(`\n${horizon.label}:`);
  for (const target of targets[horizon.key]) {
    console.log(`  ${target.team} ${target.games}g -> ${target.usableForward} usable F | ${target.options.map((option) => `${option.name} ${option.positions.join('/')} ${option.percentOwned}% [${option.reasons[0]}]`).join(' ; ')}`);
  }
}
for (const [group, list] of Object.entries(holds)) console.log(`\nHolds (${group}):`, list.map((player) => `${player.name} (${player.team} ${player.percentOwned}%) 30d ${player.usable.month} usable: ${player.reasons[0]}`).join('\n       '));

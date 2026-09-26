/**
 * Builds the input for the Weekly Edge short video from the same files as the graphics:
 *   content/generated/<season>/weekly/<start>.json   numbers (weekly-edge.ts)
 *   content/editorial/weekly/<start>.json            choices (quick hits, the featured chain)
 * and writes video/src/data/week.json, which the Remotion project renders.
 *
 * Usage: node scripts/weekly/video-props.mjs --start 2026-09-28
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildVideoProps(start) {
  const season = JSON.parse(fs.readFileSync(path.join(root, 'config/season.json'), 'utf8'));
  const data = JSON.parse(fs.readFileSync(path.join(root, 'content/generated', season.label, 'weekly', `${start}.json`), 'utf8'));
  const editorial = JSON.parse(fs.readFileSync(path.join(root, 'content/editorial/weekly', `${start}.json`), 'utf8'));
  const schedule = JSON.parse(fs.readFileSync(path.join(root, 'data', season.scheduleFile), 'utf8'));
  const plays = (team, date) => schedule.teams[team]?.includes(date) ?? false;
  const day = (date, options) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
  const weekday = (date) => day(date, { weekday: 'short' });
  const teamRow = (team) => data.teams.find((row) => row.team === team);

  // Week number: Monday weeks from the season's first Monday-anchored week.
  const seasonStart = new Date(`${season.regularSeasonStart}T12:00:00Z`);
  const firstMonday = new Date(seasonStart);
  firstMonday.setUTCDate(firstMonday.getUTCDate() - ((firstMonday.getUTCDay() + 6) % 7));
  const weekNumber = Math.round((new Date(`${start}T12:00:00Z`).getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1;

  const weekNights = data.nights.filter((night) => night.date >= data.week.start && night.date <= data.week.end && night.games > 0);
  const packed = weekNights.filter((night) => night.packed);

  const note = (team, horizon) => {
    const row = teamRow(team)[horizon];
    if (horizon !== 'week') return `${row.games} games, ${row.usableForward} that fit a lineup`;
    if (row.games >= 4) return `${row.games} games, ${row.packedGames === 0 ? 'all on quiet nights' : `${row.packedGames} on a packed night`}`;
    const b2b = data.storylines.backToBacks.find((entry) => entry.team === team && entry.bothLight);
    if (b2b) return `${weekday(b2b.first)}/${weekday(b2b.second)} back-to-back`;
    if (row.packedGames === 0) return `${row.games} games, ${row.games === row.lightGames ? 'all on quiet nights' : 'none on Saturday'}`;
    return `${row.games} games`;
  };

  // The featured chain: each editorial leg starts at its team's first game after the
  // previous leg's last game, and runs until the next leg's team first plays after that.
  const chainDates = [...weekNights.map((night) => night.date), data.week.nextMonday];
  const weekDates = chainDates.filter((date) => date <= data.week.end);
  const legs = [];
  let after = '';
  editorial.chain.legs.forEach((team, index) => {
    const firstGame = weekDates.find((date) => date > after && plays(team, date));
    if (!firstGame) throw new Error(`${team} has no game after ${after || 'the week start'} for the chain`);
    const next = editorial.chain.legs[index + 1];
    // Hand over when the next team plays after this team's back-to-back or run of games.
    const handover = next ? weekDates.find((date) => date > firstGame && plays(next, date) && !plays(team, date)) : null;
    const dates = weekDates.filter((date) => date >= firstGame && (!handover || date < handover));
    legs.push({ team, from: dates[0], to: dates[dates.length - 1], games: dates.filter((date) => plays(team, date)) });
    after = dates[dates.length - 1];
  });
  const bridgeTeam = editorial.chain.bridge;
  const bridge = bridgeTeam ? { team: bridgeTeam, games: [data.week.end, data.week.nextMonday].filter((date) => plays(bridgeTeam, date)) } : null;
  const strategy = data.strategies.twoAdds.legs.map((leg) => leg.team).join() === editorial.chain.legs.join() ? data.strategies.twoAdds : null;

  return {
    start,
    weekNumber,
    weekLabel: `${day(data.week.start, { month: 'short', day: 'numeric' })} – ${day(data.week.end, { month: 'short', day: 'numeric' })}`,
    totalGames: weekNights.reduce((sum, night) => sum + night.games, 0),
    quietNights: weekNights.filter((night) => night.light).length,
    packedNight: packed.length ? { day: day(packed[0].date, { weekday: 'long' }), games: packed[0].games, room: packed[0].forwardOpenShare } : null,
    nights: weekNights.map((night) => ({ date: night.date, label: weekday(night.date), games: night.games, light: night.light, packed: night.packed, room: night.forwardOpenShare })),
    chain: {
      title: editorial.chain.title,
      dates: chainDates,
      labels: chainDates.map((date) => (date > data.week.end ? `Next ${weekday(date)}` : weekday(date))),
      legs,
      bridge,
      usable: strategy?.usable ?? null,
      holdOne: data.strategies.oneAdd.legs[0] ? { team: data.strategies.oneAdd.legs[0].team, usable: data.strategies.oneAdd.usable } : null,
    },
    quickHits: Object.fromEntries(Object.entries(editorial.quickHits).map(([horizon, teams]) => [horizon, teams.map((team) => ({ team, note: note(team, horizon) }))])),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const start = process.argv[process.argv.indexOf('--start') + 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '')) throw new Error('--start YYYY-MM-DD is required');
  const props = buildVideoProps(start);
  const out = path.join(root, 'video/src/data/week.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(props, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, out)} (week ${props.weekNumber}, ${props.totalGames} games)`);
}

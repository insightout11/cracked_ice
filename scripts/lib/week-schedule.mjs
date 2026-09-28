/**
 * One Monday-to-Sunday NHL week from the season schedule file: games per night, quiet
 * and packed nights, and every team's week (games, off-night games, back-to-backs).
 * Used by the Monday schedule post, its article, and the /season page's prerendered copy.
 *
 * The ranking matches the site's "Best Schedule First" sort (web/src/lib/schedule.ts):
 * 60% games relative to the week's most, 40% share of games on off-nights.
 */
export const QUIET_NIGHT = 8;
export const PACKED_NIGHT = 13;

export const TEAM_NAMES = {
  ANA: 'Ducks', BOS: 'Bruins', BUF: 'Sabres', CAR: 'Hurricanes', CBJ: 'Blue Jackets', CGY: 'Flames', CHI: 'Blackhawks', COL: 'Avalanche', DAL: 'Stars', DET: 'Red Wings', EDM: 'Oilers', FLA: 'Panthers', LAK: 'Kings', MIN: 'Wild', MTL: 'Canadiens', NJD: 'Devils', NSH: 'Predators', NYI: 'Islanders', NYR: 'Rangers', OTT: 'Senators', PHI: 'Flyers', PIT: 'Penguins', SEA: 'Kraken', SJS: 'Sharks', STL: 'Blues', TBL: 'Lightning', TOR: 'Maple Leafs', UTA: 'Mammoth', VAN: 'Canucks', VGK: 'Golden Knights', WPG: 'Jets', WSH: 'Capitals',
};

export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** The Monday on or before a date. */
export function mondayOf(date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export const dayLabel = (date, options) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
export const weekday = (date) => dayLabel(date, { weekday: 'short' });
export function weekRangeLabel(start) {
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${dayLabel(start, { month: 'short', day: 'numeric' })}–${dayLabel(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
}

/** `schedule` is web/public/schedules-<season>.json ({ games: { TEAM: [{ date, opponent, isHome, isOffNight }] } }). */
export function buildWeek(schedule, start) {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const inWeek = new Set(dates);
  const teams = Object.entries(schedule.games).map(([team, games]) => {
    const week = games.filter((game) => inWeek.has(game.date)).sort((a, b) => a.date.localeCompare(b.date));
    const playDates = week.map((game) => game.date);
    const backToBacks = playDates.filter((date, index) => index > 0 && playDates[index - 1] === addDays(date, -1)).map((date) => [addDays(date, -1), date]);
    return {
      team,
      name: TEAM_NAMES[team] ?? team,
      games: week.length,
      offNightGames: week.filter((game) => game.isOffNight).length,
      dates: playDates,
      opponents: week.map((game) => `${game.isHome ? 'vs' : '@'} ${game.opponent}`),
      backToBacks,
    };
  });
  const nights = dates.map((date) => ({ date, games: teams.reduce((sum, team) => sum + (team.dates.includes(date) ? 1 : 0), 0) / 2 }));
  const maxGames = Math.max(1, ...teams.map((team) => team.games));
  for (const team of teams) {
    team.score = (team.games / maxGames) * 100 * 0.6 + (team.games ? (team.offNightGames / team.games) * 100 : 0) * 0.4;
    team.packedGames = team.dates.filter((date) => (nights.find((night) => night.date === date)?.games ?? 0) >= PACKED_NIGHT).length;
  }
  const ranked = [...teams].sort((a, b) => b.score - a.score || a.team.localeCompare(b.team));
  const quietNights = nights.filter((night) => night.games > 0 && night.games <= QUIET_NIGHT);
  const packedNights = nights.filter((night) => night.games >= PACKED_NIGHT);
  const quietSet = new Set(quietNights.map((night) => night.date));
  return {
    start,
    end: dates[6],
    label: weekRangeLabel(start),
    totalGames: nights.reduce((sum, night) => sum + night.games, 0),
    nights,
    quietNights,
    packedNights,
    teams: ranked,
    best: ranked.filter((team) => team.games > 0).slice(0, 5),
    fourGameTeams: ranked.filter((team) => team.games >= 4),
    quietBackToBacks: ranked.flatMap((team) => team.backToBacks.filter(([a, b]) => quietSet.has(a) && quietSet.has(b)).map((pair) => ({ team: team.team, name: team.name, dates: pair }))),
    // Few games, or most of them on packed nights: players worth benching or trading around.
    toughest: [...teams].filter((team) => team.games > 0).sort((a, b) => a.score - b.score || a.team.localeCompare(b.team)).slice(0, 3),
  };
}

export function teamNote(team) {
  const off = team.offNightGames === team.games ? 'all on off-nights' : team.offNightGames > 0 ? `${team.offNightGames} on off-nights` : 'none on off-nights';
  return `${team.games} game${team.games === 1 ? '' : 's'}, ${off}${team.backToBacks.length ? ', back-to-back' : ''}`;
}

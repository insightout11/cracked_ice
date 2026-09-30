/**
 * Worked examples for the tool pages' prerendered copy, computed from the season schedule
 * file at build time (the site rebuilds nightly, so they stay current). Each one shows the
 * answer the tool gives, not just a description of the tool.
 *
 * `schedule` is web/public/schedules-<season>.json: { games: { TEAM: [{ date, isOffNight }] } }.
 */
import { addDays, TEAM_NAMES } from './week-schedule.mjs';

function teamDatesBetween(schedule, start, end) {
  return Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => [
    team,
    games.filter((game) => game.date >= start && game.date <= end),
  ]));
}

/**
 * Two-team pairings whose schedules cover the most nights between `start` and `end` with the
 * fewest clashes (both teams playing the same night): the Schedule Fit idea in one table.
 */
export function bestPairings(schedule, start, end, count = 5) {
  const byTeam = teamDatesBetween(schedule, start, end);
  const teams = Object.keys(byTeam).sort();
  const pairs = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const a = new Set(byTeam[teams[i]].map((game) => game.date));
      const b = new Set(byTeam[teams[j]].map((game) => game.date));
      const clashes = [...a].filter((date) => b.has(date)).length;
      const covered = new Set([...a, ...b]);
      const offNights = [...byTeam[teams[i]], ...byTeam[teams[j]]].filter((game) => game.isOffNight).map((game) => game.date);
      pairs.push({ teams: [teams[i], teams[j]], games: a.size + b.size, nights: covered.size, clashes, offNights: new Set(offNights).size });
    }
  }
  return pairs
    .sort((x, y) => y.nights - x.nights || x.clashes - y.clashes || y.offNights - x.offNights || x.teams.join().localeCompare(y.teams.join()))
    .slice(0, count)
    .map((pair) => ({ ...pair, names: pair.teams.map((team) => TEAM_NAMES[team] ?? team) }));
}

/** Season off-night games and fantasy-playoff games by team, most off-night games first. */
export function seasonScheduleTable(schedule, season, count = 10) {
  const playoffStart = season.defaultFantasyPlayoffsStart;
  const playoffEnd = season.defaultFantasyPlayoffsEnd;
  return Object.entries(schedule.games)
    .map(([team, games]) => {
      const playoffs = games.filter((game) => game.date >= playoffStart && game.date <= playoffEnd);
      return {
        team,
        name: TEAM_NAMES[team] ?? team,
        games: games.length,
        offNightGames: games.filter((game) => game.isOffNight).length,
        playoffGames: playoffs.length,
        playoffOffNightGames: playoffs.filter((game) => game.isOffNight).length,
      };
    })
    .sort((a, b) => b.offNightGames - a.offNightGames || b.playoffGames - a.playoffGames || a.team.localeCompare(b.team))
    .slice(0, count);
}

/**
 * Two teams with the same number of games over the next `days` days but the biggest gap in
 * off-night games: the case where "games played" says it's a tie and lineup fit says it isn't.
 */
export function sameGamesDifferentFit(schedule, start, days = 30) {
  const end = addDays(start, days - 1);
  const byTeam = Object.entries(teamDatesBetween(schedule, start, end)).map(([team, games]) => ({
    team,
    name: TEAM_NAMES[team] ?? team,
    games: games.length,
    offNightGames: games.filter((game) => game.isOffNight).length,
  }));
  let best = null;
  for (const a of byTeam) {
    for (const b of byTeam) {
      if (a.team >= b.team || a.games !== b.games || a.games === 0) continue;
      const gap = Math.abs(a.offNightGames - b.offNightGames);
      if (!best || gap > best.gap || (gap === best.gap && a.games > best.games)) {
        best = { gap, games: a.games, teams: a.offNightGames >= b.offNightGames ? [a, b] : [b, a] };
      }
    }
  }
  return best && best.gap > 0 ? { start, end, ...best } : null;
}

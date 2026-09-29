import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Season comes from config/season.json (single source of truth).
const SEASON = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'season.json'), 'utf8')
);
const SEASON_ID = SEASON.seasonId;

// All 32 NHL teams from the mapping in schedules.ts
const NHL_TEAMS = [
  'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'BOS',
  'BUF', 'MTL', 'OTT', 'TOR', 'CAR', 'FLA', 
  'TBL', 'WSH', 'CHI', 'DET', 'NSH', 'STL',
  'CGY', 'COL', 'EDM', 'VAN', 'ANA', 'DAL',
  'LAK', 'SJS', 'CBJ', 'MIN', 'WPG', 'VGK',
  'SEA', 'UTA'
];

async function fetchTeamSchedule(teamCode) {
  try {
    console.log(`Fetching ${teamCode} schedule...`);

    const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamCode}/${SEASON_ID}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract regular season games (gameType: 2) with full metadata. The
    // downstream hydrate pipeline needs opponent/home-away/start-time/game-id to
    // build the enriched schedule cache — dates alone would strip that.
    const seen = new Set();
    const games = [];
    for (const game of data.games || []) {
      if (game.gameType !== 2 || !game.gameDate || seen.has(game.gameDate)) continue;
      seen.add(game.gameDate);
      const isHome = game.homeTeam?.abbrev === teamCode;
      const opponent = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
      games.push({
        date: game.gameDate,
        opponent: opponent || null,
        isHome,
        gameId: game.id,
        startTime: game.startTimeUTC || null,
        venue: game.venue?.default || null,
      });
    }

    games.sort((a, b) => a.date.localeCompare(b.date));
    const dates = games.map((g) => g.date);

    console.log(`✅ ${teamCode}: ${dates.length} games`);
    return { dates, games };

  } catch (error) {
    console.error(`❌ Error fetching ${teamCode} schedule:`, error.message);
    return null;
  }
}

/**
 * A schedule is only written when it's whole: every team has the season's game count
 * (84 in 2026-27), every game is inside the season with an opponent and an id, and every
 * game id shows up twice (home and away) with the same date and start time.
 */
export function validateSchedule(scheduleData, season = SEASON) {
  const problems = [];
  const byGameId = new Map();
  for (const team of NHL_TEAMS) {
    const games = scheduleData.games[team] ?? [];
    if (games.length !== season.gamesPerTeam) problems.push(`${team}: ${games.length} games, expected ${season.gamesPerTeam}`);
    for (const game of games) {
      if (!game.gameId || !game.opponent) problems.push(`${team} ${game.date}: missing game id or opponent`);
      if (game.date < season.regularSeasonStart || game.date > season.regularSeasonEnd) problems.push(`${team} ${game.date}: outside the regular season`);
      byGameId.set(game.gameId, [...(byGameId.get(game.gameId) ?? []), { team, ...game }]);
    }
  }
  for (const [gameId, sides] of byGameId) {
    if (sides.length !== 2) { problems.push(`game ${gameId}: listed by ${sides.length} team(s)`); continue; }
    const [a, b] = sides;
    if (a.date !== b.date || a.startTime !== b.startTime || a.isHome === b.isHome || a.opponent !== b.team) {
      problems.push(`game ${gameId}: ${a.team} and ${b.team} disagree on date, time or home/away`);
    }
  }
  return problems;
}

async function fetchAllSchedules() {
  console.log('🏒 Fetching real NHL schedules for all 32 teams...\n');

  const scheduleData = {
    season: SEASON_ID,
    teams: {},
    games: {},
    lastRefreshed: new Date().toISOString()
  };

  // Fetch schedules with some delay to avoid rate limiting
  for (const teamCode of NHL_TEAMS) {
    const schedule = await fetchTeamSchedule(teamCode);

    if (schedule) {
      scheduleData.teams[teamCode] = schedule.dates;
      scheduleData.games[teamCode] = schedule.games;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const successfulTeams = Object.keys(scheduleData.teams).length;
  console.log(`\n📊 Successfully fetched schedules for ${successfulTeams}/${NHL_TEAMS.length} teams`);

  if (successfulTeams < 32) {
    console.error(`❌ Only ${successfulTeams}/32 teams fetched — refusing to write a partial schedule.`);
    process.exitCode = 1;
    return;
  }

  // Compute off-nights: a date is an off-night when the whole league plays
  // OFF_NIGHT_GAME_THRESHOLD or fewer games that night (streaming/extra starts
  // are easiest then). Each game appears in two teams' lists, so de-dupe by
  // gameId. This flag is read directly by the frontend week grid, so it must be
  // baked into the schedule file.
  const OFF_NIGHT_GAME_THRESHOLD = 8;
  const gamesByDate = {};
  for (const games of Object.values(scheduleData.games)) {
    for (const g of games) {
      (gamesByDate[g.date] = gamesByDate[g.date] || new Set()).add(g.gameId);
    }
  }
  const offNightDates = new Set(
    Object.entries(gamesByDate)
      .filter(([, ids]) => ids.size <= OFF_NIGHT_GAME_THRESHOLD)
      .map(([date]) => date)
  );
  let flagged = 0;
  for (const games of Object.values(scheduleData.games)) {
    for (const g of games) {
      g.isOffNight = offNightDates.has(g.date);
      if (g.isOffNight) flagged++;
    }
  }
  console.log(`🌙 Off-nights: ${offNightDates.size} dates, ${flagged} team-game records flagged`);

  const problems = validateSchedule(scheduleData);
  if (problems.length) {
    console.error(`❌ Schedule failed validation — keeping the current files:\n  ${problems.slice(0, 20).join('\n  ')}`);
    process.exitCode = 1;
    return;
  }

  // One schedule, three readers: hydrate and the API read data/, the site fetches
  // web/public/, the coach server reads server/data/. Write them all or none.
  const body = JSON.stringify(scheduleData, null, 2);
  for (const dir of ['data', path.join('web', 'public'), path.join('server', 'data')]) {
    const outputPath = path.join(__dirname, '..', dir, `schedules-${SEASON_ID}.json`);
    fs.writeFileSync(outputPath, body);
    console.log(`✅ Saved all schedules to ${outputPath}`);
  }

  // Show some stats
  const gameCounts = Object.entries(scheduleData.teams).map(([team, games]) => `${team}: ${games.length}`);
  console.log('\n📅 Games per team:');
  console.log(gameCounts.join(', '));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fetch-all-schedules.js')) {
  fetchAllSchedules()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { fetchAllSchedules, fetchTeamSchedule };

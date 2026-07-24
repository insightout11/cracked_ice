#!/usr/bin/env node
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache');
const REPO_ROOT = join(ROOT, '..', '..');

// Season id comes from config/season.json (single source of truth), overridable
// by STATS_SEASON for one-off backfills.
function seasonFromConfig() {
  try {
    return JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'season.json'), 'utf8')).seasonId;
  } catch {
    return undefined;
  }
}

// Map team IDs and names to their abbreviations
const TEAM_CODE_MAP = {
  // By team ID (from NHL API)
  1: 'NJD', 2: 'NYI', 3: 'NYR', 4: 'PHI', 5: 'PIT', 6: 'BOS', 7: 'BUF', 8: 'MTL',
  9: 'OTT', 10: 'TOR', 12: 'CAR', 13: 'FLA', 14: 'TBL', 15: 'WSH', 16: 'CHI',
  17: 'DET', 18: 'NSH', 19: 'STL', 20: 'CGY', 21: 'COL', 22: 'EDM', 23: 'VAN',
  24: 'ANA', 25: 'DAL', 26: 'LAK', 28: 'SJS', 29: 'CBJ', 30: 'MIN', 52: 'WPG',
  54: 'VGK', 55: 'SEA', 68: 'UTA',
  // By team name fragments (case-insensitive)
  'devils': 'NJD', 'islanders': 'NYI', 'rangers': 'NYR', 'flyers': 'PHI',
  'penguins': 'PIT', 'bruins': 'BOS', 'sabres': 'BUF', 'canadiens': 'MTL',
  'senators': 'OTT', 'maple leafs': 'TOR', 'hurricanes': 'CAR', 'panthers': 'FLA',
  'lightning': 'TBL', 'capitals': 'WSH', 'blackhawks': 'CHI', 'red wings': 'DET',
  'predators': 'NSH', 'blues': 'STL', 'flames': 'CGY', 'avalanche': 'COL',
  'oilers': 'EDM', 'canucks': 'VAN', 'ducks': 'ANA', 'stars': 'DAL', 'kings': 'LAK',
  'sharks': 'SJS', 'blue jackets': 'CBJ', 'wild': 'MIN', 'jets': 'WPG',
  'utah': 'UTA', 'golden knights': 'VGK', 'kraken': 'SEA'
};

function getTeamCode(team) {
  // Try direct fields first
  if (team.triCode) return team.triCode.toUpperCase();
  if (team.teamAbbrev?.default) return team.teamAbbrev.default.toUpperCase();
  if (team.franchiseId && TEAM_CODE_MAP[team.franchiseId]) return TEAM_CODE_MAP[team.franchiseId];
  if (team.teamId && TEAM_CODE_MAP[team.teamId]) return TEAM_CODE_MAP[team.teamId];

  // Try matching team name
  const teamName = (team.teamFullName || team.teamName || '').toLowerCase();
  for (const [key, code] of Object.entries(TEAM_CODE_MAP)) {
    if (teamName.includes(key.toLowerCase())) {
      return code;
    }
  }

  return null;
}

// Fetch team PP stats from NHL API
async function fetchTeamPPStats(season, startDate, endDate) {
  const dateFilter = startDate && endDate
    ? ` and gameDate>=\"${startDate}\" and gameDate<=\"${endDate}\"`
    : '';
  const ppUrl = `https://api.nhle.com/stats/rest/en/team/powerplay?cayenneExp=${encodeURIComponent(`seasonId=${season} and gameTypeId=2${dateFilter}`)}`;

  console.log(`Fetching team PP stats from NHL API...`);

  const response = await fetch(ppUrl, {
    headers: { 'User-Agent': 'cracked-ice-hydrator/1.0' }
  });

  if (!response.ok) {
    console.warn(`⚠ Failed to fetch PP stats: ${response.status}`);
    return {};
  }

  const data = await response.json();
  const ppData = {};

  if (data.data && Array.isArray(data.data)) {
    for (const entry of data.data) {
      const teamCode = TEAM_CODE_MAP[entry.teamId];
      if (teamCode && entry.ppTimeOnIcePerGame) {
        ppData[teamCode] = {
          ppTimeOnIcePerGame: entry.ppTimeOnIcePerGame,
          gamesPlayed: entry.gamesPlayed ?? 0,
        };
      }
    }
    console.log(`  Fetched PP stats for ${Object.keys(ppData).length} teams`);
  }

  return ppData;
}

// Fetch team stats from NHL API and calculate per-60 metrics
async function fetchAndCalculateTeamStats() {
  const season = process.env.STATS_SEASON || seasonFromConfig();
  if (!season) {
    throw new Error('No season resolved — set STATS_SEASON or provide config/season.json');
  }
  const url = `https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=${season}`;

  console.log(`Fetching team stats from NHL API for season ${season}...`);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'cracked-ice-hydrator/1.0' }
  });

  if (!response.ok) {
    throw new Error(`NHL API returned ${response.status}`);
  }

  const data = await response.json();
  const teams = data.data || [];

  console.log(`Fetched ${teams.length} teams from NHL API`);

  // Fetch PP stats in parallel
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(windowEnd.getUTCDate() - 7);
  const recentStartDate = windowStart.toISOString().slice(0, 10);
  const recentEndDate = windowEnd.toISOString().slice(0, 10);
  const [ppStats, recentPpStats] = await Promise.all([
    fetchTeamPPStats(season),
    fetchTeamPPStats(season, recentStartDate, recentEndDate),
  ]);

  // Calculate per-60 stats from per-game stats
  // Assuming average game is 60 minutes of regulation time
  const teamStats = {};

  for (const team of teams) {
    const teamCode = getTeamCode(team);

    if (!teamCode) {
      console.warn(`⚠ Skipping team without code:`, team.teamFullName || team.teamName || 'Unknown');
      continue;
    }

    // NHL provides per-game stats, convert to approximate per-60
    // Most games are 60 minutes regulation, so per-game ≈ per-60
    const goalsForPerGame = team.goalsForPerGame || 0;
    const goalsAgainstPerGame = team.goalsAgainstPerGame || 0;

    teamStats[teamCode] = {
      teamCode,
      goalsForPerGame: Number(goalsForPerGame.toFixed(2)),
      goalsAgainstPerGame: Number(goalsAgainstPerGame.toFixed(2))
    };

    // Add PP time if available
    if (ppStats[teamCode]) {
      teamStats[teamCode].ppTimeOnIcePerGame = ppStats[teamCode].ppTimeOnIcePerGame;
    }
    if (recentPpStats[teamCode]) {
      teamStats[teamCode].last7PpTimeOnIcePerGame = recentPpStats[teamCode].ppTimeOnIcePerGame;
      teamStats[teamCode].last7PpGamesPlayed = recentPpStats[teamCode].gamesPlayed;
    }

    const ppSeconds = ppStats[teamCode]?.ppTimeOnIcePerGame;
    const ppTime = ppSeconds ? `, PP=${Math.floor(ppSeconds/60)}:${Math.floor(ppSeconds%60).toString().padStart(2,'0')}` : '';
    console.log(`  ${teamCode}: GF/GP=${teamStats[teamCode].goalsForPerGame}, GA/GP=${teamStats[teamCode].goalsAgainstPerGame}${ppTime}`);
  }

  const ppTeamsCount = Object.values(teamStats).filter(t => t.ppTimeOnIcePerGame).length;

  // Sanity gate: the NHL team-summary endpoint returns 0 rows during the
  // preseason (no games played yet) and can return partial data on a glitch.
  // Never overwrite a valid dataset with an incomplete one — retain the last
  // good team_stats.json and exit cleanly so the nightly run still succeeds.
  const teamCount = Object.keys(teamStats).length;
  if (teamCount < 32) {
    const outputPath = join(CACHE_DIR, 'team_stats.json');
    const existing = existsSync(outputPath)
      ? Object.keys(JSON.parse(readFileSync(outputPath, 'utf8')).teams || {}).length
      : 0;
    console.warn(
      `⚠ Only ${teamCount}/32 teams returned for season ${season} ` +
      `(likely preseason). Keeping existing team_stats.json (${existing} teams) instead of overwriting.`
    );
    return { skipped: true, teamCount };
  }

  const output = {
    schemaVersion: 'v1',
    generatedAt: new Date().toISOString(),
    source: `nhl-api-${season}-calculated${ppTeamsCount > 0 ? '+pp' : ''}`,
    recentPpWindow: { start: recentStartDate, end: recentEndDate },
    teams: teamStats
  };

  mkdirSync(CACHE_DIR, { recursive: true });
  const outputPath = join(CACHE_DIR, 'team_stats.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✓ Team stats written to ${outputPath}`);
  console.log(`  Teams: ${Object.keys(teamStats).length}`);
  console.log(`  Teams with PP data: ${ppTeamsCount}`);
  console.log(`  Season: ${season}`);

  return output;
}

fetchAndCalculateTeamStats().catch(error => {
  console.error('Failed to fetch/calculate team stats:', error);
  process.exit(1);
});

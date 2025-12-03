#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'cache');

// Map team IDs and names to their abbreviations
const TEAM_CODE_MAP = {
  // By team ID (from NHL API)
  1: 'NJD', 2: 'NYI', 3: 'NYR', 4: 'PHI', 5: 'PIT', 6: 'BOS', 7: 'BUF', 8: 'MTL',
  9: 'OTT', 10: 'TOR', 12: 'CAR', 13: 'FLA', 14: 'TBL', 15: 'WSH', 16: 'CHI',
  17: 'DET', 18: 'NSH', 19: 'STL', 20: 'CGY', 21: 'COL', 22: 'EDM', 23: 'VAN',
  24: 'ANA', 25: 'DAL', 26: 'LAK', 28: 'SJS', 29: 'CBJ', 30: 'MIN', 52: 'WPG',
  53: 'UTA', 54: 'VGK', 55: 'SEA',
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

// Fetch team stats from NHL API and calculate per-60 metrics
async function fetchAndCalculateTeamStats() {
  const season = process.env.STATS_SEASON || '20252026';
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
    const gfPer60 = team.goalsForPerGame || 0;
    const gaPer60 = team.goalsAgainstPerGame || 0;

    teamStats[teamCode] = {
      teamCode,
      gfPer60: Number(gfPer60.toFixed(2)),
      gaPer60: Number(gaPer60.toFixed(2))
    };

    console.log(`  ${teamCode}: GF/60=${teamStats[teamCode].gfPer60}, GA/60=${teamStats[teamCode].gaPer60}`);
  }

  const output = {
    schemaVersion: 'v1',
    generatedAt: new Date().toISOString(),
    source: `nhl-api-${season}-calculated`,
    teams: teamStats
  };

  mkdirSync(CACHE_DIR, { recursive: true });
  const outputPath = join(CACHE_DIR, 'team_stats.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✓ Team stats written to ${outputPath}`);
  console.log(`  Teams: ${Object.keys(teamStats).length}`);
  console.log(`  Season: ${season}`);

  return output;
}

fetchAndCalculateTeamStats().catch(error => {
  console.error('Failed to fetch/calculate team stats:', error);
  process.exit(1);
});

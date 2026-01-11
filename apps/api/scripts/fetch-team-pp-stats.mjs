import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_CACHE_DIR = path.resolve(ROOT, 'data-cache');
const TEAM_STATS_PATH = path.join(DATA_CACHE_DIR, 'team_stats.json');

const NHL_PP_ENDPOINT = 'https://api.nhle.com/stats/rest/en/team/powerplay';

// NHL team ID to team code mapping
const TEAM_ID_TO_CODE = {
  1: 'NJD', 2: 'NYI', 3: 'NYR', 4: 'PHI', 5: 'PIT', 6: 'BOS',
  7: 'BUF', 8: 'MTL', 9: 'OTT', 10: 'TOR', 12: 'CAR', 13: 'FLA',
  14: 'TBL', 15: 'WSH', 16: 'CHI', 17: 'DET', 18: 'NSH', 19: 'STL',
  20: 'CGY', 21: 'COL', 22: 'EDM', 23: 'VAN', 24: 'ANA', 25: 'DAL',
  26: 'LAK', 27: 'SJS', 28: 'CBJ', 29: 'MIN', 30: 'WPG', 52: 'WPG',
  53: 'VGK', 54: 'SEA', 55: 'SEA', 68: 'UTA'
};

async function fetchTeamPPStats() {
  const currentSeason = getCurrentSeasonId();
  const url = `${NHL_PP_ENDPOINT}?cayenneExp=seasonId=${currentSeason} and gameTypeId=2`;

  console.log(`Fetching team PP stats from: ${url}`);

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`fetch ${url} -> ${res.status}`);
  }

  const json = await res.json();
  const teams = {};

  if (json.data && Array.isArray(json.data)) {
    for (const entry of json.data) {
      const teamCode = TEAM_ID_TO_CODE[entry.teamId];
      if (teamCode && entry.ppTimeOnIcePerGame) {
        teams[teamCode] = {
          ppTimeOnIcePerGame: entry.ppTimeOnIcePerGame
        };
      }
    }
  }

  console.log(`Fetched PP stats for ${Object.keys(teams).length} teams`);
  return teams;
}

function getCurrentSeasonId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // NHL season typically starts in October
  // If we're in Jan-Sept, use previous year as start year
  // If we're in Oct-Dec, use current year as start year
  const startYear = month >= 10 ? year : year - 1;
  const endYear = startYear + 1;

  return `${startYear}${endYear}`;
}

async function mergeWithExistingStats(ppStats) {
  let existingCache;

  try {
    const raw = await fs.readFile(TEAM_STATS_PATH, 'utf8');
    existingCache = JSON.parse(raw);
  } catch (error) {
    console.warn('Could not read existing team_stats.json, creating new cache');
    existingCache = {
      generatedAt: new Date().toISOString(),
      source: 'nhl-api-pp',
      teams: {}
    };
  }

  // Merge PP stats into existing team data
  for (const [teamCode, ppData] of Object.entries(ppStats)) {
    if (!existingCache.teams[teamCode]) {
      existingCache.teams[teamCode] = {
        teamId: teamCode,
        gfPer60: 0,
        gaPer60: 0
      };
    }
    existingCache.teams[teamCode].ppTimeOnIcePerGame = ppData.ppTimeOnIcePerGame;
  }

  // Update metadata
  existingCache.generatedAt = new Date().toISOString();
  existingCache.source = existingCache.source ? `${existingCache.source} + nhl-api-pp` : 'nhl-api-pp';

  return existingCache;
}

async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
  await fs.rename(tmp, file);
}

async function main() {
  console.log('Fetching team PP stats from NHL API...');
  const ppStats = await fetchTeamPPStats();

  console.log('Merging with existing team stats...');
  const mergedCache = await mergeWithExistingStats(ppStats);

  console.log('Writing updated cache...');
  await writeJson(TEAM_STATS_PATH, mergedCache);

  console.log('✅ Team PP stats updated successfully!');
  console.log(`   Updated ${Object.keys(ppStats).length} teams`);
  console.log(`   Cache: ${TEAM_STATS_PATH}`);
}

main().catch((error) => {
  console.error('❌ Failed to fetch team PP stats:', error);
  process.exit(1);
});

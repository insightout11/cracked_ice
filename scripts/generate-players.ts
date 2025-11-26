/**
 * Generate players.json with correct position data and additional useful metadata
 * Fetches from NHL API roster endpoints
 */

const NHL_API_BASE = 'https://api-web.nhle.com';
const USER_AGENT = 'cracked-ice-hydrator/1.0 (+https://crackedicehockey.com)';
const REQUEST_DELAY_MS = 300;

const TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WPG', 'WSH'
];

interface NHLRosterPlayer {
  id: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  sweaterNumber: number;
  positionCode: string;
  shootsCatches: string;
  heightInInches?: number;
  weightInPounds?: number;
  birthDate?: string;
}

interface NHLRosterResponse {
  forwards?: NHLRosterPlayer[];
  defensemen?: NHLRosterPlayer[];
  goalies?: NHLRosterPlayer[];
}

interface PlayerEntry {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
  sweaterNumber?: number;
  shoots?: string;
  heightInches?: number;
  weightPounds?: number;
  birthDate?: string;
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (response.ok) {
        return response;
      }
      if (response.status === 404) {
        throw new Error(`404: ${url}`);
      }
      await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
    }
  }
  throw new Error(`Failed after ${maxRetries} retries: ${url}`);
}

function mapPosition(nhlPositionCode: string): string[] {
  switch (nhlPositionCode.toUpperCase()) {
    case 'C':
      return ['C'];
    case 'L':
      return ['LW'];
    case 'R':
      return ['RW'];
    case 'D':
      return ['D'];
    case 'G':
      return ['G'];
    default:
      console.warn(`Unknown position code: ${nhlPositionCode}`);
      return ['C', 'LW', 'RW'];
  }
}

function generateAliases(firstName: string, lastName: string): string[] {
  const aliases: string[] = [];
  const firstInitial = firstName.charAt(0);
  const lastInitial = lastName.charAt(0);

  aliases.push(`${firstInitial}. ${lastName}`);
  aliases.push(`${firstName} ${lastInitial}.`);
  aliases.push(`${firstInitial}.${lastInitial}.`);

  return aliases;
}

async function fetchTeamRoster(teamAbbr: string): Promise<PlayerEntry[]> {
  console.error(`Fetching roster for ${teamAbbr}...`);

  try {
    const url = `${NHL_API_BASE}/v1/roster/${teamAbbr}/current`;
    const response = await fetchWithRetry(url);
    const data: NHLRosterResponse = await response.json();

    const players: PlayerEntry[] = [];

    const processPlayers = (playerList: NHLRosterPlayer[] | undefined) => {
      if (!playerList) return;
      for (const player of playerList) {
        const fullName = `${player.firstName.default} ${player.lastName.default}`;
        players.push({
          id: `nhl:${player.id}`,
          name: fullName,
          team: teamAbbr,
          pos: mapPosition(player.positionCode),
          aliases: generateAliases(player.firstName.default, player.lastName.default),
          sweaterNumber: player.sweaterNumber,
          shoots: player.shootsCatches,
          heightInches: player.heightInInches,
          weightPounds: player.weightInPounds,
          birthDate: player.birthDate
        });
      }
    };

    processPlayers(data.forwards);
    processPlayers(data.defensemen);
    processPlayers(data.goalies);

    console.error(`  Found ${players.length} players for ${teamAbbr}`);
    return players;
  } catch (err) {
    console.error(`Error fetching ${teamAbbr}:`, err);
    return [];
  }
}

async function generatePlayersJson() {
  console.error('Starting player data generation...\n');

  const allPlayers: PlayerEntry[] = [];

  for (const team of TEAMS) {
    const teamPlayers = await fetchTeamRoster(team);
    allPlayers.push(...teamPlayers);
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  allPlayers.sort((a, b) => {
    if (a.team !== b.team) {
      return a.team.localeCompare(b.team);
    }
    return a.name.localeCompare(b.name);
  });

  const output = {
    players: allPlayers,
    meta: {
      generatedAt: new Date().toISOString(),
      playerCount: allPlayers.length,
      teamCount: TEAMS.length,
      source: 'api-web.nhle.com/v1/roster',
      version: '1.0.0'
    }
  };

  console.error(`\nGeneration complete!`);
  console.error(`Total players: ${allPlayers.length}`);
  console.error(`Teams processed: ${TEAMS.length}`);

  return JSON.stringify(output, null, 2);
}

generatePlayersJson()
  .then(json => {
    console.log(json);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

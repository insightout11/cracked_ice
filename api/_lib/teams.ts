// Canonical NHL team list for the serverless API functions.
// The `id` values follow the legacy NHL Stats API franchise ids that the
// frontend team dropdowns were built around.
export interface NhlTeam {
  id: number;
  name: string;
  abbreviation: string;
  triCode: string;
}

export const NHL_TEAMS: NhlTeam[] = [
  { id: 24, name: 'Anaheim Ducks', abbreviation: 'ANA', triCode: 'ANA' },
  { id: 6, name: 'Boston Bruins', abbreviation: 'BOS', triCode: 'BOS' },
  { id: 7, name: 'Buffalo Sabres', abbreviation: 'BUF', triCode: 'BUF' },
  { id: 20, name: 'Calgary Flames', abbreviation: 'CGY', triCode: 'CGY' },
  { id: 12, name: 'Carolina Hurricanes', abbreviation: 'CAR', triCode: 'CAR' },
  { id: 16, name: 'Chicago Blackhawks', abbreviation: 'CHI', triCode: 'CHI' },
  { id: 21, name: 'Colorado Avalanche', abbreviation: 'COL', triCode: 'COL' },
  { id: 28, name: 'Columbus Blue Jackets', abbreviation: 'CBJ', triCode: 'CBJ' },
  { id: 25, name: 'Dallas Stars', abbreviation: 'DAL', triCode: 'DAL' },
  { id: 17, name: 'Detroit Red Wings', abbreviation: 'DET', triCode: 'DET' },
  { id: 22, name: 'Edmonton Oilers', abbreviation: 'EDM', triCode: 'EDM' },
  { id: 13, name: 'Florida Panthers', abbreviation: 'FLA', triCode: 'FLA' },
  { id: 26, name: 'Los Angeles Kings', abbreviation: 'LAK', triCode: 'LAK' },
  { id: 29, name: 'Minnesota Wild', abbreviation: 'MIN', triCode: 'MIN' },
  { id: 8, name: 'Montreal Canadiens', abbreviation: 'MTL', triCode: 'MTL' },
  { id: 18, name: 'Nashville Predators', abbreviation: 'NSH', triCode: 'NSH' },
  { id: 1, name: 'New Jersey Devils', abbreviation: 'NJD', triCode: 'NJD' },
  { id: 2, name: 'New York Islanders', abbreviation: 'NYI', triCode: 'NYI' },
  { id: 3, name: 'New York Rangers', abbreviation: 'NYR', triCode: 'NYR' },
  { id: 9, name: 'Ottawa Senators', abbreviation: 'OTT', triCode: 'OTT' },
  { id: 4, name: 'Philadelphia Flyers', abbreviation: 'PHI', triCode: 'PHI' },
  { id: 5, name: 'Pittsburgh Penguins', abbreviation: 'PIT', triCode: 'PIT' },
  { id: 27, name: 'San Jose Sharks', abbreviation: 'SJS', triCode: 'SJS' },
  { id: 54, name: 'Seattle Kraken', abbreviation: 'SEA', triCode: 'SEA' },
  { id: 19, name: 'St. Louis Blues', abbreviation: 'STL', triCode: 'STL' },
  { id: 14, name: 'Tampa Bay Lightning', abbreviation: 'TBL', triCode: 'TBL' },
  { id: 10, name: 'Toronto Maple Leafs', abbreviation: 'TOR', triCode: 'TOR' },
  { id: 55, name: 'Utah Hockey Club', abbreviation: 'UTA', triCode: 'UTA' },
  { id: 23, name: 'Vancouver Canucks', abbreviation: 'VAN', triCode: 'VAN' },
  { id: 53, name: 'Vegas Golden Knights', abbreviation: 'VGK', triCode: 'VGK' },
  { id: 15, name: 'Washington Capitals', abbreviation: 'WSH', triCode: 'WSH' },
  { id: 30, name: 'Winnipeg Jets', abbreviation: 'WPG', triCode: 'WPG' }
];

const byTriCode = new Map(NHL_TEAMS.map(t => [t.triCode, t]));

export function teamName(triCode: string): string {
  return byTriCode.get(triCode)?.name ?? triCode;
}

export function findTeam(triCode: string): NhlTeam | undefined {
  return byTriCode.get(triCode);
}

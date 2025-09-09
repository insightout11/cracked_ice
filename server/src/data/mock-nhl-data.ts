import { Team } from '../types/nhl';

export const MOCK_NHL_TEAMS: Team[] = [
  { id: 1, name: 'New Jersey Devils', abbreviation: 'NJD' },
  { id: 2, name: 'New York Islanders', abbreviation: 'NYI' },
  { id: 3, name: 'New York Rangers', abbreviation: 'NYR' },
  { id: 4, name: 'Philadelphia Flyers', abbreviation: 'PHI' },
  { id: 5, name: 'Pittsburgh Penguins', abbreviation: 'PIT' },
  { id: 6, name: 'Boston Bruins', abbreviation: 'BOS' },
  { id: 7, name: 'Buffalo Sabres', abbreviation: 'BUF' },
  { id: 8, name: 'Montreal Canadiens', abbreviation: 'MTL' },
  { id: 9, name: 'Ottawa Senators', abbreviation: 'OTT' },
  { id: 10, name: 'Toronto Maple Leafs', abbreviation: 'TOR' },
  { id: 12, name: 'Carolina Hurricanes', abbreviation: 'CAR' },
  { id: 13, name: 'Florida Panthers', abbreviation: 'FLA' },
  { id: 14, name: 'Tampa Bay Lightning', abbreviation: 'TBL' },
  { id: 15, name: 'Washington Capitals', abbreviation: 'WSH' },
  { id: 16, name: 'Chicago Blackhawks', abbreviation: 'CHI' },
  { id: 17, name: 'Detroit Red Wings', abbreviation: 'DET' },
  { id: 18, name: 'Nashville Predators', abbreviation: 'NSH' },
  { id: 19, name: 'St. Louis Blues', abbreviation: 'STL' },
  { id: 20, name: 'Calgary Flames', abbreviation: 'CGY' },
  { id: 21, name: 'Colorado Avalanche', abbreviation: 'COL' },
  { id: 22, name: 'Edmonton Oilers', abbreviation: 'EDM' },
  { id: 23, name: 'Vancouver Canucks', abbreviation: 'VAN' },
  { id: 24, name: 'Anaheim Ducks', abbreviation: 'ANA' },
  { id: 25, name: 'Dallas Stars', abbreviation: 'DAL' },
  { id: 26, name: 'Los Angeles Kings', abbreviation: 'LAK' },
  { id: 27, name: 'San Jose Sharks', abbreviation: 'SJS' },
  { id: 28, name: 'Columbus Blue Jackets', abbreviation: 'CBJ' },
  { id: 29, name: 'Minnesota Wild', abbreviation: 'MIN' },
  { id: 30, name: 'Winnipeg Jets', abbreviation: 'WPG' },
  { id: 52, name: 'Arizona Coyotes', abbreviation: 'ARI' },
  { id: 53, name: 'Vegas Golden Knights', abbreviation: 'VGK' },
  { id: 54, name: 'Seattle Kraken', abbreviation: 'SEA' },
];

export function generateMockScheduleDates(teamId: number, startDate: string, endDate: string): Set<string> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = new Set<string>();
  
  const current = new Date(start);
  const teamSeed = teamId * 7;
  
  while (current <= end) {
    const dayOfYear = Math.floor((current.getTime() - new Date(current.getFullYear(), 0, 0).getTime()) / 86400000);
    
    if ((dayOfYear + teamSeed) % 3 === 0 || (dayOfYear + teamSeed) % 4 === 0) {
      dates.add(current.toISOString().split('T')[0]);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}
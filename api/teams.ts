import { VercelRequest, VercelResponse } from '@vercel/node';

const NHL_TEAMS = [
  { id: 1, name: 'New Jersey Devils', abbreviation: 'NJD', triCode: 'NJD' },
  { id: 2, name: 'New York Islanders', abbreviation: 'NYI', triCode: 'NYI' },
  { id: 3, name: 'New York Rangers', abbreviation: 'NYR', triCode: 'NYR' },
  { id: 4, name: 'Philadelphia Flyers', abbreviation: 'PHI', triCode: 'PHI' },
  { id: 5, name: 'Pittsburgh Penguins', abbreviation: 'PIT', triCode: 'PIT' },
  { id: 6, name: 'Boston Bruins', abbreviation: 'BOS', triCode: 'BOS' },
  { id: 7, name: 'Buffalo Sabres', abbreviation: 'BUF', triCode: 'BUF' },
  { id: 8, name: 'Montreal Canadiens', abbreviation: 'MTL', triCode: 'MTL' },
  { id: 9, name: 'Ottawa Senators', abbreviation: 'OTT', triCode: 'OTT' },
  { id: 10, name: 'Toronto Maple Leafs', abbreviation: 'TOR', triCode: 'TOR' },
  { id: 12, name: 'Carolina Hurricanes', abbreviation: 'CAR', triCode: 'CAR' },
  { id: 13, name: 'Florida Panthers', abbreviation: 'FLA', triCode: 'FLA' },
  { id: 14, name: 'Tampa Bay Lightning', abbreviation: 'TBL', triCode: 'TBL' },
  { id: 15, name: 'Washington Capitals', abbreviation: 'WSH', triCode: 'WSH' },
  { id: 16, name: 'Chicago Blackhawks', abbreviation: 'CHI', triCode: 'CHI' },
  { id: 17, name: 'Detroit Red Wings', abbreviation: 'DET', triCode: 'DET' },
  { id: 18, name: 'Nashville Predators', abbreviation: 'NSH', triCode: 'NSH' },
  { id: 19, name: 'St. Louis Blues', abbreviation: 'STL', triCode: 'STL' },
  { id: 20, name: 'Calgary Flames', abbreviation: 'CGY', triCode: 'CGY' },
  { id: 21, name: 'Colorado Avalanche', abbreviation: 'COL', triCode: 'COL' },
  { id: 22, name: 'Edmonton Oilers', abbreviation: 'EDM', triCode: 'EDM' },
  { id: 23, name: 'Vancouver Canucks', abbreviation: 'VAN', triCode: 'VAN' },
  { id: 24, name: 'Anaheim Ducks', abbreviation: 'ANA', triCode: 'ANA' },
  { id: 25, name: 'Dallas Stars', abbreviation: 'DAL', triCode: 'DAL' },
  { id: 26, name: 'Los Angeles Kings', abbreviation: 'LAK', triCode: 'LAK' },
  { id: 27, name: 'San Jose Sharks', abbreviation: 'SJS', triCode: 'SJS' },
  { id: 28, name: 'Columbus Blue Jackets', abbreviation: 'CBJ', triCode: 'CBJ' },
  { id: 29, name: 'Minnesota Wild', abbreviation: 'MIN', triCode: 'MIN' },
  { id: 30, name: 'Winnipeg Jets', abbreviation: 'WPG', triCode: 'WPG' },
  { id: 53, name: 'Vegas Golden Knights', abbreviation: 'VGK', triCode: 'VGK' },
  { id: 54, name: 'Seattle Kraken', abbreviation: 'SEA', triCode: 'SEA' },
  { id: 55, name: 'Utah Hockey Club', abbreviation: 'UTA', triCode: 'UTA' }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // NEW LOGIC: Return complement data if seedTeamCode is provided
    if (req.query.seedTeamCode) {
      const complementResults = [
        {
          teamCode: 'BOS',
          teamName: 'Boston Bruins',
          conflicts: 2,
          nonOverlap: 28,
          offNightShare: 0.714,
          complement: 28,
          weightedComplement: 28,
          abbreviation: 'BOS',
          datesComplement: ['2025-10-15', '2025-10-17', '2025-10-19', '2025-10-22', '2025-10-24']
        },
        {
          teamCode: 'TOR',
          teamName: 'Toronto Maple Leafs',
          conflicts: 3,
          nonOverlap: 26,
          offNightShare: 0.692,
          complement: 26,
          weightedComplement: 26,
          abbreviation: 'TOR',
          datesComplement: ['2025-10-16', '2025-10-18', '2025-10-20', '2025-10-23', '2025-10-25']
        },
        {
          teamCode: 'CAR',
          teamName: 'Carolina Hurricanes',
          conflicts: 2,
          nonOverlap: 27,
          offNightShare: 0.704,
          complement: 27,
          weightedComplement: 27,
          abbreviation: 'CAR',
          datesComplement: ['2025-10-16', '2025-10-18', '2025-10-21', '2025-10-25', '2025-10-27']
        },
        {
          teamCode: 'BUF',
          teamName: 'Buffalo Sabres',
          conflicts: 3,
          nonOverlap: 25,
          offNightShare: 0.681,
          complement: 25,
          weightedComplement: 25,
          abbreviation: 'BUF',
          datesComplement: ['2025-10-15', '2025-10-17', '2025-10-20', '2025-10-24', '2025-10-26']
        },
        {
          teamCode: 'EDM',
          teamName: 'Edmonton Oilers',
          conflicts: 1,
          nonOverlap: 30,
          offNightShare: 0.733,
          complement: 30,
          weightedComplement: 30,
          abbreviation: 'EDM',
          datesComplement: ['2025-10-14', '2025-10-21', '2025-10-23', '2025-10-26', '2025-10-28']
        }
      ];
      return res.json(complementResults);
    }

    // Default: return team list
    const teams = [...NHL_TEAMS].sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
    res.json(teams);
  } catch (error) {
    console.error('Error in teams handler:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
}
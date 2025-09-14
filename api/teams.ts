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

module.exports = function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Return team list
    const teams = NHL_TEAMS.slice(0, 5); // Just first 5 teams for testing
    res.json(teams);
  } catch (error) {
    console.error('Teams error:', error);
    res.status(500).json({ error: 'Teams failed', details: error.message });
  }
}
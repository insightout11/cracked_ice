export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Complete mock response with all 32 NHL teams
    const mockResult = {
      teams: [
        // Cyan tier (Elite: Strong in both regular season and playoffs)
        { teamCode: 'ANA', teamName: 'Anaheim Ducks', tier: 'cyan', score: 85, gamesInWindow: 45 },
        { teamCode: 'UTA', teamName: 'Utah Hockey Club', tier: 'cyan', score: 84, gamesInWindow: 47 },
        { teamCode: 'NYR', teamName: 'New York Rangers', tier: 'cyan', score: 83, gamesInWindow: 44 },
        { teamCode: 'VAN', teamName: 'Vancouver Canucks', tier: 'cyan', score: 82, gamesInWindow: 46 },
        { teamCode: 'NJD', teamName: 'New Jersey Devils', tier: 'cyan', score: 81, gamesInWindow: 43 },
        { teamCode: 'CAR', teamName: 'Carolina Hurricanes', tier: 'cyan', score: 80, gamesInWindow: 45 },

        // Blue tier (Playoff Specialists: Strong playoff schedule)
        { teamCode: 'PIT', teamName: 'Pittsburgh Penguins', tier: 'blue', score: 78, gamesInWindow: 42 },
        { teamCode: 'WSH', teamName: 'Washington Capitals', tier: 'blue', score: 77, gamesInWindow: 44 },
        { teamCode: 'DAL', teamName: 'Dallas Stars', tier: 'blue', score: 76, gamesInWindow: 41 },
        { teamCode: 'STL', teamName: 'St. Louis Blues', tier: 'blue', score: 75, gamesInWindow: 43 },
        { teamCode: 'PHI', teamName: 'Philadelphia Flyers', tier: 'blue', score: 74, gamesInWindow: 40 },
        { teamCode: 'LAK', teamName: 'Los Angeles Kings', tier: 'blue', score: 73, gamesInWindow: 42 },
        { teamCode: 'SEA', teamName: 'Seattle Kraken', tier: 'blue', score: 72, gamesInWindow: 41 },
        { teamCode: 'CGY', teamName: 'Calgary Flames', tier: 'blue', score: 71, gamesInWindow: 43 },

        // Green tier (Regular Season Strong: Good regular season schedule)
        { teamCode: 'CHI', teamName: 'Chicago Blackhawks', tier: 'green', score: 68, gamesInWindow: 38 },
        { teamCode: 'DET', teamName: 'Detroit Red Wings', tier: 'green', score: 67, gamesInWindow: 39 },
        { teamCode: 'VGK', teamName: 'Vegas Golden Knights', tier: 'green', score: 66, gamesInWindow: 37 },
        { teamCode: 'SJS', teamName: 'San Jose Sharks', tier: 'green', score: 65, gamesInWindow: 40 },
        { teamCode: 'BUF', teamName: 'Buffalo Sabres', tier: 'green', score: 64, gamesInWindow: 36 },
        { teamCode: 'OTT', teamName: 'Ottawa Senators', tier: 'green', score: 63, gamesInWindow: 38 },
        { teamCode: 'MTL', teamName: 'Montreal Canadiens', tier: 'green', score: 62, gamesInWindow: 35 },
        { teamCode: 'CBJ', teamName: 'Columbus Blue Jackets', tier: 'green', score: 61, gamesInWindow: 37 },
        { teamCode: 'NYI', teamName: 'New York Islanders', tier: 'green', score: 60, gamesInWindow: 36 },

        // Red tier (Below Average: Weaker schedules overall)
        { teamCode: 'TOR', teamName: 'Toronto Maple Leafs', tier: 'red', score: 55, gamesInWindow: 35 },
        { teamCode: 'BOS', teamName: 'Boston Bruins', tier: 'red', score: 54, gamesInWindow: 34 },
        { teamCode: 'TBL', teamName: 'Tampa Bay Lightning', tier: 'red', score: 53, gamesInWindow: 33 },
        { teamCode: 'FLA', teamName: 'Florida Panthers', tier: 'red', score: 52, gamesInWindow: 32 },
        { teamCode: 'COL', teamName: 'Colorado Avalanche', tier: 'red', score: 51, gamesInWindow: 31 },
        { teamCode: 'EDM', teamName: 'Edmonton Oilers', tier: 'red', score: 50, gamesInWindow: 30 },
        { teamCode: 'WPG', teamName: 'Winnipeg Jets', tier: 'red', score: 49, gamesInWindow: 33 },
        { teamCode: 'MIN', teamName: 'Minnesota Wild', tier: 'red', score: 48, gamesInWindow: 32 },
        { teamCode: 'NSH', teamName: 'Nashville Predators', tier: 'red', score: 47, gamesInWindow: 31 },
      ],
      settings: {
        start: '2025-10-01',
        end: '2026-04-30',
        playoffStartWeek: 22
      }
    };

    res.json(mockResult);
  } catch (error) {
    console.error('Error in team-tiers API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
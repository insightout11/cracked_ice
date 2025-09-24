export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Simple mock response to prevent app crashes
    const mockResults = [
      {
        teamCode: 'UTA',
        teamName: 'Utah Hockey Club',
        totalGames: 82,
        conflictGames: 15,
        conflictPct: 18.29,
        offNightGames: 67,
        offNightPct: 81.71,
        usableStarts: 67
      },
      {
        teamCode: 'ANA',
        teamName: 'Anaheim Ducks',
        totalGames: 82,
        conflictGames: 18,
        conflictPct: 21.95,
        offNightGames: 64,
        offNightPct: 78.05,
        usableStarts: 64
      }
    ];

    res.json(mockResults);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
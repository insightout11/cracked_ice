export default function handler(req: any, res: any) {
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
    const nhlTeams = [
      { id: 1, name: 'New Jersey Devils', abbreviation: 'NJD', triCode: 'NJD' },
      { id: 6, name: 'Boston Bruins', abbreviation: 'BOS', triCode: 'BOS' },
      { id: 10, name: 'Toronto Maple Leafs', abbreviation: 'TOR', triCode: 'TOR' },
      { id: 12, name: 'Carolina Hurricanes', abbreviation: 'CAR', triCode: 'CAR' },
      { id: 22, name: 'Edmonton Oilers', abbreviation: 'EDM', triCode: 'EDM' }
    ];

    // Check if this is a complement request
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
    res.json(nhlTeams);
  } catch (error: any) {
    console.error('Teams endpoint error:', error);
    res.status(500).json({ error: 'Failed to get teams', details: error.message });
  }
}
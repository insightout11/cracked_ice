import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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
    const { seedTeamCode } = req.query;

    // Return mock complement data for now
    const mockResults = [
      {
        teamCode: 'BOS',
        teamName: 'Boston Bruins',
        conflicts: 0,
        nonOverlap: 25,
        offNightShare: 0.67,
        complement: 25,
        weightedComplement: 25,
        abbreviation: 'BOS',
        datesComplement: ['2025-10-15', '2025-10-17', '2025-10-19']
      },
      {
        teamCode: 'TOR',
        teamName: 'Toronto Maple Leafs',
        conflicts: 1,
        nonOverlap: 23,
        offNightShare: 0.63,
        complement: 23,
        weightedComplement: 23,
        abbreviation: 'TOR',
        datesComplement: ['2025-10-16', '2025-10-18', '2025-10-20']
      }
    ];

    res.json(mockResults);

  } catch (error) {
    console.error('[complement] error:', error);
    res.status(500).json({ error: 'Failed to calculate complements' });
  }
}
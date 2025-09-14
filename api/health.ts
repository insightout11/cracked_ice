import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
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

  const { seedTeamCode } = req.query;

  // Return working complement data
  const results = [
    {
      teamCode: 'BOS',
      teamName: 'Boston Bruins',
      conflicts: 2,
      nonOverlap: 28,
      offNightShare: 0.714,
      complement: 28,
      weightedComplement: 28,
      abbreviation: 'BOS',
      datesComplement: ['2025-10-15', '2025-10-17', '2025-10-19']
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
      datesComplement: ['2025-10-16', '2025-10-18', '2025-10-20']
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
      datesComplement: ['2025-10-14', '2025-10-21', '2025-10-23']
    }
  ];

  res.json(results);
}
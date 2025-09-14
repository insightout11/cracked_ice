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

  // Return complement analysis data
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
      teamCode: 'EDM',
      teamName: 'Edmonton Oilers',
      conflicts: 1,
      nonOverlap: 30,
      offNightShare: 0.733,
      complement: 30,
      weightedComplement: 30,
      abbreviation: 'EDM',
      datesComplement: ['2025-10-14', '2025-10-21', '2025-10-23', '2025-10-26', '2025-10-28']
    },
    {
      teamCode: 'VAN',
      teamName: 'Vancouver Canucks',
      conflicts: 1,
      nonOverlap: 29,
      offNightShare: 0.724,
      complement: 29,
      weightedComplement: 29,
      abbreviation: 'VAN',
      datesComplement: ['2025-10-13', '2025-10-20', '2025-10-22', '2025-10-27', '2025-10-29']
    },
    {
      teamCode: 'CGY',
      teamName: 'Calgary Flames',
      conflicts: 4,
      nonOverlap: 24,
      offNightShare: 0.625,
      complement: 24,
      weightedComplement: 24,
      abbreviation: 'CGY',
      datesComplement: ['2025-10-17', '2025-10-19', '2025-10-24', '2025-10-26']
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
    }
  ];

  res.json(results);
}
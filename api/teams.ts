import { NHL_TEAMS } from './_lib/teams';
import { handleCors } from './_lib/respond';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  try {
    res.json(NHL_TEAMS);
  } catch (error: any) {
    console.error('Teams endpoint error:', error);
    res.status(500).json({ error: 'Failed to get teams', details: error?.message });
  }
}

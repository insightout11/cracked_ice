import { VercelRequest, VercelResponse } from '@vercel/node';
import { getKVStorage } from '../server/dist/server/src/features/coach/kvStorage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = req.query.userId as string || 'user-1767327042619-bbd0gch';

  try {
    const kv = getKVStorage();

    const [settings, roster, freeAgents] = await Promise.all([
      kv.read(userId, 'settings'),
      kv.read(userId, 'roster'),
      kv.read(userId, 'free_agents')
    ]);

    return res.json({
      userId,
      hasSettings: !!settings,
      hasRoster: !!roster,
      hasFreeAgents: !!freeAgents,
      rosterLength: roster ? JSON.parse(roster).roster?.length : 0,
      rosterPreview: roster ? JSON.parse(roster).roster?.slice(0, 5).map((p: any) => p.full_name) : []
    });

  } catch (error: any) {
    return res.json({
      error: error.message,
      stack: error.stack
    });
  }
}

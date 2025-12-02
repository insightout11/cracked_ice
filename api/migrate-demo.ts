import { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

// Simple endpoint to migrate demo user data to Redis
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read demo data from filesystem
    const dataDir = join(process.cwd(), 'data', 'coach', 'users', 'demo-user');
    const settings = readFileSync(join(dataDir, 'settings.json'), 'utf8');
    const roster = readFileSync(join(dataDir, 'roster.json'), 'utf8');
    const freeAgents = readFileSync(join(dataDir, 'free_agents.json'), 'utf8');

    // Import Redis storage
    const { getKVStorage } = require('../server/dist/server/src/features/coach/kvStorage.js');
    const kv = getKVStorage();

    const userId = 'demo-user';

    // Write to Redis
    await kv.write(userId, 'settings', settings);
    await kv.write(userId, 'roster', roster);
    await kv.write(userId, 'free_agents', freeAgents);

    return res.json({
      success: true,
      message: 'Demo user data migrated to Redis',
      userId
    });
  } catch (error: any) {
    console.error('[migrate] Error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
}

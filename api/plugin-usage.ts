import type { VercelRequest, VercelResponse } from '@vercel/node';
import { usageSummary } from './_lib/plugin-usage.js';

/**
 * ChatGPT plugin usage counts for the owner: GET /api/plugin-usage?days=30 with
 * "Authorization: Bearer <PLUGIN_USAGE_KEY>". Not found until PLUGIN_USAGE_KEY is set in Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.PLUGIN_USAGE_KEY?.trim();
  res.setHeader('Cache-Control', 'no-store');
  if (!key) return res.status(404).json({ error: 'Not found' });
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (supplied !== key) return res.status(401).json({ error: 'Unauthorized' });
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
  try {
    return res.status(200).json(await usageSummary(days));
  } catch (error) {
    return res.status(503).json({ error: (error as Error).message });
  }
}

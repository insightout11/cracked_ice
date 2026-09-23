import { loadPublicPlayerDetails, parseDraftLeagueProfile } from './_lib/player-directory.js';
import { handleCors } from './_lib/respond.js';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  const playerId = String(req.query.playerId ?? '').trim();
  if (!/^\d+$/.test(playerId) && !/^nhl:\d+$/.test(playerId)) {
    return res.status(400).json({ error: 'invalid_player_id' });
  }

  try {
    const player = loadPublicPlayerDetails(playerId, parseDraftLeagueProfile(req.query.profile));
    if (!player) return res.status(404).json({ error: 'player_not_found' });
    return res.json({ player });
  } catch (error: any) {
    console.error('[player-details] error:', error);
    return res.status(500).json({ error: 'player_details_failed' });
  }
}

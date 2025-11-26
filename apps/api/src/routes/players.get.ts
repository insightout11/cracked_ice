import { Router } from 'express';
import { getCanonicalPlayer } from '../services/resolve';
import { getPlayerStats, getStatsMetadata } from '../services/stats';

export const playersRouter = Router();

playersRouter.get('/players/:id', (req, res) => {
  const meta = getStatsMetadata();
  const stats = getPlayerStats(req.params.id);
  const player = getCanonicalPlayer(req.params.id);

  if (!stats || !player) {
    return res.status(404).json({
      error: 'Player not found in cache',
      how_to_fix: 'Run pnpm --filter cracked-ice-api hydrate to refresh apps/api/data-cache/stats.json'
    });
  }

  return res.json({
    player,
    stats,
    meta
  });
});

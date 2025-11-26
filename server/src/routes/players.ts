import { Router } from 'express';
import { searchPlayers, type PlayersContext } from '../context/players';
import type { StatsContext } from '../context/stats';
import type { ScheduleContext } from '../context/schedules';
import { getTeamScheduleDates } from '../context/schedules';

export const playersRoutes = Router();

function resolveLimit(raw: unknown): number {
  if (typeof raw !== 'string') {
    return 10;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.min(parsed, 25);
}

function getUpcomingGames(teamCode: string, scheduleContext: ScheduleContext | null | undefined, limit: number = 10): string[] {
  if (!scheduleContext) {
    return [];
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const allDates = getTeamScheduleDates(teamCode, scheduleContext);

  // Filter to future games only and limit
  return allDates
    .filter(date => date >= today)
    .slice(0, limit);
}

// Get all players (for dropdown/management UI)
playersRoutes.get('/players', (req, res) => {
  const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;
  if (!playersContext) {
    return res.status(503).json({ error: 'Player directory unavailable' });
  }

  const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
  const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;

  // Convert all players to results
  const results = playersContext.entries.map((entry) => {
    const stat = statsContext?.players.get(entry.id);
    const upcomingGames = getUpcomingGames(entry.team, scheduleContext, 10);
    return {
      id: entry.id,
      full_name: entry.name,
      name: entry.name, // Alias for compatibility
      team: entry.team,
      positions: entry.pos,
      pos: entry.pos, // Alias for compatibility
      aliases: entry.aliases || [],
      blendedFppg: stat?.blendedFppg ?? null,
      seasonFppg: stat?.seasonFppg ?? null,
      last30Fppg: stat?.last30Fppg ?? null,
      last7Fppg: stat?.last7Fppg ?? null,
      upcomingGames
    };
  });

  return res.json({
    players: results,
    meta: {
      count: results.length,
      generatedAt: playersContext.meta.generatedAt,
      directorySize: playersContext.meta.playerCount
    }
  });
});

playersRoutes.get('/players/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }
  if (query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;
  if (!playersContext) {
    return res.status(503).json({ error: 'Player directory unavailable' });
  }

  const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
  const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
  const limit = resolveLimit(req.query.limit);
  const matches = searchPlayers(query, playersContext, limit);

  const results = matches.map((entry) => {
    const stat = statsContext?.players.get(entry.id);
    const upcomingGames = getUpcomingGames(entry.team, scheduleContext, 10);
    return {
      id: entry.id,
      name: entry.name,
      team: entry.team,
      pos: entry.pos,
      aliases: entry.aliases,
      blendedFppg: stat?.blendedFppg ?? null,
      seasonFppg: stat?.seasonFppg ?? null,
      last30Fppg: stat?.last30Fppg ?? null,
      last7Fppg: stat?.last7Fppg ?? null,
      upcomingGames
    };
  });

  return res.json({
    results,
    meta: {
      count: results.length,
      limit,
      generatedAt: playersContext.meta.generatedAt,
      directorySize: playersContext.meta.playerCount
    }
  });
});

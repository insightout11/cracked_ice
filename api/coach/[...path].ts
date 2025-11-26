import type { VercelRequest, VercelResponse } from '@vercel/node';
import { coachRoutes } from '../../server/dist/server/src/routes/coach.js';
import { loadSchedules } from '../../server/dist/server/src/context/schedules.js';
import { loadTeamStatsContext } from '../../server/dist/server/src/context/teamStats.js';
import { loadStats } from '../../server/dist/server/src/context/stats.js';
import { loadPlayers } from '../../server/dist/server/src/context/players.js';
import express from 'express';

// Cache contexts at module level (persists across warm starts)
let cachedContexts: {
  schedules: ReturnType<typeof loadSchedules> | null;
  teamStats: Awaited<ReturnType<typeof loadTeamStatsContext>> | null;
  stats: ReturnType<typeof loadStats> | null;
  players: ReturnType<typeof loadPlayers> | null;
  lastLoaded: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getContexts() {
  const now = Date.now();

  // Return cached contexts if fresh
  if (cachedContexts && (now - cachedContexts.lastLoaded < CACHE_TTL)) {
    return cachedContexts;
  }

  // Load fresh contexts
  let schedules = null;
  let stats = null;
  let players = null;
  let teamStats = null;

  try {
    schedules = loadSchedules();
  } catch (error) {
    console.error('Schedule context load failed:', error);
  }

  try {
    stats = loadStats();
  } catch (error) {
    console.error('Stats context load failed:', error);
  }

  try {
    players = loadPlayers();
  } catch (error) {
    console.error('Players context load failed:', error);
  }

  try {
    teamStats = await loadTeamStatsContext();
  } catch (error) {
    console.error('Team stats context load failed:', error);
  }

  cachedContexts = {
    schedules,
    teamStats,
    stats,
    players,
    lastLoaded: now
  };

  return cachedContexts;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Load contexts
    const contexts = await getContexts();

    // Create Express app with contexts
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Inject contexts into app.locals
    app.locals.schedules = contexts.schedules;
    app.locals.teamStats = contexts.teamStats;
    app.locals.stats = contexts.stats;
    app.locals.players = contexts.players;

    // Mount coach routes
    app.use('/api/coach', coachRoutes);

    // Build the full path
    const pathArray = req.query.path as string[] || [];
    const queryString = Object.entries(req.query)
      .filter(([key]) => key !== 'path')
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const fullPath = `/api/coach/${pathArray.join('/')}${queryString ? `?${queryString}` : ''}`;

    // Create a mock request object
    const mockReq = {
      ...req,
      url: fullPath,
      path: `/api/coach/${pathArray.join('/')}`,
      app
    };

    // Handle the request with Express
    // @ts-ignore - Express types are complex
    app(mockReq, res);
  } catch (error) {
    console.error('Coach API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

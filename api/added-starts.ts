import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

let app: express.Application;
let initPromise: Promise<express.Application> | null = null;

async function initializeApp(): Promise<express.Application> {
  if (app) return app;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[server] Initializing Express app for coach API...');

    // Initialize Express app
    app = express();
    app.use(cors());
    app.use(express.json());

    // Load context loaders
    const basePath = path.join(process.cwd(), 'server', 'dist', 'server', 'src');
    console.log('[server] Base path:', basePath);

    try {
      const { loadSchedules } = require(path.join(basePath, 'context', 'schedules.js'));
      const scheduleContext = loadSchedules();
      app.locals.schedules = scheduleContext;
      console.log('[server] Schedule context loaded');
    } catch (error: any) {
      console.error('[server] Schedule context failed:', error.message);
      app.locals.schedules = null;
    }

    try {
      const { loadStats } = require(path.join(basePath, 'context', 'stats.js'));
      const statsContext = loadStats();
      app.locals.stats = statsContext;
      console.log('[server] Stats context loaded:', statsContext.meta.playerCount, 'players');
    } catch (error: any) {
      console.error('[server] Stats context failed:', error.message);
      app.locals.stats = null;
    }

    try {
      const { loadPlayers } = require(path.join(basePath, 'context', 'players.js'));
      const playersContext = loadPlayers();
      app.locals.players = playersContext;
      console.log('[server] Players context loaded:', playersContext.meta.playerCount, 'players');
    } catch (error: any) {
      console.error('[server] Players context failed:', error.message);
      app.locals.players = null;
    }

    try {
      const { loadTeamStatsContext } = require(path.join(basePath, 'context', 'teamStats.js'));
      const teamStatsContext = await loadTeamStatsContext();
      app.locals.teamStats = teamStatsContext;
      console.log('[server] Team stats loaded:', teamStatsContext.byTeam?.size || 0, 'teams');
    } catch (error: any) {
      console.error('[server] Team stats failed:', error.message);
      app.locals.teamStats = null;
    }

    // Load coach routes
    const coachModule = require(path.join(basePath, 'routes', 'coach.js'));
    const coachRouter = coachModule.coachRoutes;

    // Mount coach routes at /coach (since requests come in as /api/server/*)
    app.use('/coach', coachRouter);

    console.log('[server] App initialized successfully');
    return app;
  })();

  return initPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const app = await initializeApp();

    // Log the incoming request
    console.log('[server] Original URL:', req.url);
    console.log('[server] Query:', req.query);

    // Vercel rewrite adds the path as a query parameter
    // Extract it and rewrite req.url for Express
    if (req.query?.path) {
      const pathParam = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
      // Remove path query param
      const url = new URL(req.url || '', 'http://localhost');
      url.searchParams.delete('path');
      const queryString = url.search;
      // Rewrite to /coach/{path} for Express router
      req.url = `/coach/${pathParam}${queryString}`;
      console.log('[server] Rewritten URL:', req.url);
    } else {
      // No path means root request
      req.url = '/coach';
    }

    // Pass to Express
    app(req, res);
  } catch (error: any) {
    console.error('[server] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

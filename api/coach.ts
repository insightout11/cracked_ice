import type { VercelRequest, VercelResponse } from '@vercel/node';
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
    console.log('[coach] Initializing Express app for coach API...');

    // Build the app locally and publish it only once its routes are mounted: a request that
    // arrived while the team stats were loading used to find a route-less app and 404.
    const instance = express();
    instance.use(cors());
    instance.use(express.json());

    // Load context loaders
    const basePath = path.join(process.cwd(), 'server', 'dist', 'server', 'src');
    console.log('[coach] Base path:', basePath);

    try {
      const { loadSchedules } = require(path.join(basePath, 'context', 'schedules.js'));
      const scheduleContext = loadSchedules();
      instance.locals.schedules = scheduleContext;
      console.log('[coach] Schedule context loaded');
    } catch (error: any) {
      console.error('[coach] Schedule context failed:', error.message);
      instance.locals.schedules = null;
    }

    try {
      const { loadStats } = require(path.join(basePath, 'context', 'stats.js'));
      const statsContext = loadStats();
      instance.locals.stats = statsContext;
      console.log('[coach] Stats context loaded:', statsContext.meta.playerCount, 'players');
    } catch (error: any) {
      console.error('[coach] Stats context failed:', error.message);
      instance.locals.stats = null;
    }

    try {
      const { loadPlayers } = require(path.join(basePath, 'context', 'players.js'));
      const playersContext = loadPlayers();
      instance.locals.players = playersContext;
      console.log('[coach] Players context loaded:', playersContext.meta.playerCount, 'players');
    } catch (error: any) {
      console.error('[coach] Players context failed:', error.message);
      instance.locals.players = null;
    }

    try {
      const { loadTeamStatsContext } = require(path.join(basePath, 'context', 'teamStats.js'));
      const teamStatsContext = await loadTeamStatsContext();
      instance.locals.teamStats = teamStatsContext;
      console.log('[coach] Team stats loaded:', teamStatsContext.byTeam?.size || 0, 'teams');
    } catch (error: any) {
      console.error('[coach] Team stats failed:', error.message);
      instance.locals.teamStats = null;
    }

    // Load coach routes
    const coachModule = require(path.join(basePath, 'routes', 'coach.js'));
    const coachRouter = coachModule.coachRoutes;

    // Mount coach routes at /coach (since requests come in as /api/server/*)
    instance.use('/coach', coachRouter);

    console.log('[coach] App initialized successfully');
    app = instance;
    return instance;
  })().catch((error) => {
    // Let the next request try again rather than failing on this rejection forever.
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // DIAGNOSTIC: Check if REDIS_URL is available at handler level
  console.log('[coach] REDIS_URL exists:', !!process.env.REDIS_URL);
  console.log('[coach] REDIS_URL length:', process.env.REDIS_URL?.length || 0);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const app = await initializeApp();

    // Log the incoming request
    console.log('[coach] Original URL:', req.url);
    console.log('[coach] Query:', req.query);

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
      console.log('[coach] Rewritten URL:', req.url);
    } else {
      // No path means root request
      req.url = '/coach';
    }

    // Pass to Express
    app(req, res);
  } catch (error: any) {
    console.error('[coach] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

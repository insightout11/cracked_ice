import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let app;
let initPromise;

async function initializeApp() {
  if (app) return app;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[serverless] Initializing Express app...');

    // Debug: Check what files are available
    const fs = require('fs');
    const path = require('path');
    console.log('[serverless] Current directory:', process.cwd());
    console.log('[serverless] __dirname would be:', path.dirname(new URL(import.meta.url).pathname));
    try {
      console.log('[serverless] Files in /var/task:', fs.readdirSync('/var/task').slice(0, 20));
      if (fs.existsSync('/var/task/server')) {
        console.log('[serverless] Files in /var/task/server:', fs.readdirSync('/var/task/server'));
      }
      if (fs.existsSync('/var/task/server/dist')) {
        console.log('[serverless] Files in /var/task/server/dist:', fs.readdirSync('/var/task/server/dist'));
      }
      if (fs.existsSync('/var/task/server/dist/context')) {
        console.log('[serverless] Files in /var/task/server/dist/context:', fs.readdirSync('/var/task/server/dist/context').slice(0, 10));
      }
    } catch (e) {
      console.log('[serverless] Could not list files:', e.message);
    }

    // Initialize Express app
    app = express();
    app.use(cors());
    app.use(express.json());

    // Load context loaders using absolute paths
    const basePath = path.join(process.cwd(), 'server', 'dist', 'server', 'src');
    console.log('[serverless] Base path for modules:', basePath);

    const { loadSchedules } = require(path.join(basePath, 'context', 'schedules.js'));
    const { loadStats } = require(path.join(basePath, 'context', 'stats.js'));
    const { loadPlayers } = require(path.join(basePath, 'context', 'players.js'));
    const { loadTeamStatsContext } = require(path.join(basePath, 'context', 'teamStats.js'));

    // Load all contexts
    try {
      const scheduleContext = loadSchedules();
      app.locals.schedules = scheduleContext;
      console.log('[serverless] Schedule context loaded');
    } catch (error) {
      console.error('[serverless] Schedule context failed:', error.message);
      app.locals.schedules = null;
    }

    try {
      const statsContext = loadStats();
      app.locals.stats = statsContext;
      console.log('[serverless] Stats context loaded:', statsContext.meta.playerCount, 'players');
    } catch (error) {
      console.error('[serverless] Stats context failed:', error.message);
      app.locals.stats = null;
    }

    try {
      const playersContext = loadPlayers();
      app.locals.players = playersContext;
      console.log('[serverless] Players context loaded:', playersContext.meta.playerCount, 'players');
    } catch (error) {
      console.error('[serverless] Players context failed:', error.message);
      app.locals.players = null;
    }

    try {
      const teamStatsContext = await loadTeamStatsContext();
      app.locals.teamStats = teamStatsContext;
      console.log('[serverless] Team stats loaded:', teamStatsContext.byTeam?.size || 0, 'teams');
    } catch (error) {
      console.error('[serverless] Team stats failed:', error.message);
      app.locals.teamStats = null;
    }

    // Load the coach routes from compiled server code
    const coachModule = require(path.join(basePath, 'routes', 'coach.js'));
    const coachRouter = coachModule.coachRoutes;

    // Mount at root - Vercel routes /api/coach/* to this function
    // so the path prefix is already stripped
    app.use('/', coachRouter);

    console.log('[serverless] App initialized successfully');
    return app;
  })();

  return initPromise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Debug logging
  console.log('[serverless] Original URL:', req.url);
  console.log('[serverless] Query:', req.query);

  // Vercel rewrite adds ?path=... - extract it and rewrite req.url
  if (req.query?.path) {
    const pathParam = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    // Remove the path query param and reconstruct URL
    const url = new URL(req.url, 'http://localhost');
    url.searchParams.delete('path');
    const queryString = url.search;
    req.url = `/${pathParam}${queryString}`;
    console.log('[serverless] Rewritten URL:', req.url);
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const app = await initializeApp();
    app(req, res);
  } catch (error) {
    console.error('[serverless] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

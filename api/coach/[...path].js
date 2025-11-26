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

    // Initialize Express app
    app = express();
    app.use(cors());
    app.use(express.json());

    // Load context loaders
    const { loadSchedules } = require('../../server/dist/context/schedules.js');
    const { loadStats } = require('../../server/dist/context/stats.js');
    const { loadPlayers } = require('../../server/dist/context/players.js');
    const { loadTeamStatsContext } = require('../../server/dist/context/teamStats.js');

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
    const coachModule = require('../../server/dist/routes/coach.js');
    const coachRouter = coachModule.coachRoutes;

    // Mount at /api/coach since req.url includes the full path
    app.use('/api/coach', coachRouter);

    console.log('[serverless] App initialized successfully');
    return app;
  })();

  return initPromise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

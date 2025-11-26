// @ts-nocheck
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import context loaders and routes
let app: any = null;
let initPromise: Promise<void> | null = null;

async function initializeApp() {
  if (app) return app;

  if (initPromise) {
    await initPromise;
    return app;
  }

  initPromise = (async () => {
    try {
      // Dynamic imports of compiled modules
      const { coachRoutes } = await import('../../server/dist/server/src/routes/coach.js');
      const { loadSchedules } = await import('../../server/dist/server/src/context/schedules.js');
      const { loadTeamStatsContext } = await import('../../server/dist/server/src/context/teamStats.js');
      const { loadStats } = await import('../../server/dist/server/src/context/stats.js');
      const { loadPlayers } = await import('../../server/dist/server/src/context/players.js');

      // Create Express app
      app = express();
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true, limit: '10mb' }));

      // Load contexts
      let schedules = null;
      let stats = null;
      let players = null;
      let teamStats = null;

      try {
        schedules = loadSchedules();
        console.log('✓ Schedules loaded');
      } catch (error: any) {
        console.error('✗ Schedule load failed:', error.message);
      }

      try {
        stats = loadStats();
        console.log('✓ Stats loaded');
      } catch (error: any) {
        console.error('✗ Stats load failed:', error.message);
      }

      try {
        players = loadPlayers();
        console.log('✓ Players loaded');
      } catch (error: any) {
        console.error('✗ Players load failed:', error.message);
      }

      try {
        teamStats = await loadTeamStatsContext();
        console.log('✓ Team stats loaded');
      } catch (error: any) {
        console.error('✗ Team stats load failed:', error.message);
      }

      // Inject contexts into app.locals
      app.locals.schedules = schedules;
      app.locals.teamStats = teamStats;
      app.locals.stats = stats;
      app.locals.players = players;

      // Mount coach routes
      app.use('/api/coach', coachRoutes);

      console.log('✓ Coach API initialized');
    } catch (error: any) {
      console.error('✗ App initialization failed:', error);
      throw error;
    }
  })();

  await initPromise;
  return app;
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
    // Initialize the app (cached after first call)
    const expressApp = await initializeApp();

    // Build the full path from the catch-all route
    const pathArray = (req.query.path as string[]) || [];
    const otherParams = Object.entries(req.query)
      .filter(([key]) => key !== 'path')
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
      .join('&');

    const fullPath = `/api/coach/${pathArray.join('/')}${otherParams ? `?${otherParams}` : ''}`;

    // Create a request object that Express expects
    const mockReq: any = Object.assign(req, {
      url: fullPath,
      originalUrl: fullPath,
      path: `/api/coach/${pathArray.join('/')}`,
      baseUrl: '',
      query: Object.fromEntries(
        Object.entries(req.query).filter(([key]) => key !== 'path')
      ),
      params: {},
    });

    // Let Express handle the request
    expressApp(mockReq, res);
  } catch (error: any) {
    console.error('Handler error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        details: error?.stack?.split('\n').slice(0, 5).join('\n'),
      });
    }
  }
}

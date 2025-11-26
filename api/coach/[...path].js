const express = require('express');

// Module-level cache
let app = null;
let contextsLoaded = false;

function initializeApp() {
  if (app) return app;

  try {
    // Require compiled CommonJS modules
    const { coachRoutes } = require('../../server/dist/server/src/routes/coach');
    const { loadSchedules } = require('../../server/dist/server/src/context/schedules');
    const { loadTeamStatsContext } = require('../../server/dist/server/src/context/teamStats');
    const { loadStats } = require('../../server/dist/server/src/context/stats');
    const { loadPlayers } = require('../../server/dist/server/src/context/players');

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
      console.log('✓ Schedules loaded:', schedules?.meta);
    } catch (error) {
      console.error('✗ Schedule load failed:', error.message, error.stack);
    }

    try {
      stats = loadStats();
      console.log('✓ Stats loaded:', stats?.meta);
    } catch (error) {
      console.error('✗ Stats load failed:', error.message, error.stack);
    }

    try {
      players = loadPlayers();
      console.log('✓ Players loaded:', players?.meta);
    } catch (error) {
      console.error('✗ Players load failed:', error.message, error.stack);
    }

    try {
      // This one is async
      loadTeamStatsContext().then(ts => {
        teamStats = ts;
        app.locals.teamStats = teamStats;
        console.log('✓ Team stats loaded');
      }).catch(error => {
        console.error('✗ Team stats load failed:', error.message);
      });
    } catch (error) {
      console.error('✗ Team stats load failed:', error.message);
    }

    // Inject contexts into app.locals
    app.locals.schedules = schedules;
    app.locals.teamStats = teamStats; // Will be updated async
    app.locals.stats = stats;
    app.locals.players = players;

    // Mount coach routes
    app.use('/api/coach', coachRoutes);

    contextsLoaded = true;
    console.log('✓ Coach API initialized');
  } catch (error) {
    console.error('✗ App initialization failed:', error);
    throw error;
  }

  return app;
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Build the path
    const pathArray = req.query.path || [];
    const pathString = pathArray.join('/');

    console.log('📨 Request:', req.method, pathString, 'query:', req.query);

    // Simple health check that doesn't need Express
    if (pathString === 'health') {
      console.log('✓ Health check');
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        contextsLoaded
      });
    }

    // Initialize the app (cached after first call)
    const expressApp = initializeApp();

    // Build the full path from the catch-all route
    const otherParams = Object.entries(req.query)
      .filter(([key]) => key !== 'path')
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
      .join('&');

    const fullPath = `/api/coach/${pathString}${otherParams ? `?${otherParams}` : ''}`;

    console.log('🔄 Forwarding to Express:', fullPath);

    // Create a request object that Express expects
    Object.assign(req, {
      url: fullPath,
      originalUrl: fullPath,
      path: `/api/coach/${pathString}`,
      baseUrl: '',
      query: Object.fromEntries(
        Object.entries(req.query).filter(([key]) => key !== 'path')
      ),
      params: {},
    });

    // Let Express handle the request
    expressApp(req, res);
  } catch (error) {
    console.error('❌ Handler error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        details: error?.stack?.split('\n').slice(0, 10).join('\n'),
      });
    }
  }
};

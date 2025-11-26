const express = require('express');
const cors = require('cors');

let app;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!app) {
      // Initialize Express app
      app = express();
      app.use(cors());
      app.use(express.json());

      // Load the coach routes from compiled server code
      const coachRouter = require('../../server/dist/routes/coach.js');
      app.use('/api/coach', coachRouter);

      // Health check
      app.get('/api/coach/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });
    }

    // Let Express handle the request
    app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

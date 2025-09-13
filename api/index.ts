import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { teamRoutes } from '../server/src/routes/teams';
import { complementRoutes } from '../server/src/routes/complement';
import { loadSchedules } from '../server/src/context/schedules';

// Load schedules at startup
let scheduleContext: ReturnType<typeof loadSchedules> | null = null;
try {
  scheduleContext = loadSchedules();
} catch (error) {
  console.error('⚠️  Schedule context failed to load:', (error as Error).message);
}

const app = express();

// Make schedule context available to routes
app.locals.schedules = scheduleContext;

// Configure CORS for production
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8092',
    'https://cracked-ice-web.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));

app.use(express.json());

app.use('/api/teams', teamRoutes);
app.use('/api', complementRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
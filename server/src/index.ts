import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { teamRoutes } from './routes/teams';
import { complementRoutes } from './routes/complement';
import { gameAnalysisRoutes } from './routes/gameAnalysis';
import { teamTierRoutes } from './routes/teamTiers';
import { coachRoutes } from './routes/coach';
import { loadSchedules } from './context/schedules';
import { loadTeamStatsContext, type TeamStatsContext } from './context/teamStats';
import { loadStats } from './context/stats';
import { loadPlayers } from './context/players';

dotenv.config();

// Load schedules at startup
let scheduleContext: ReturnType<typeof loadSchedules> | null = null;
try {
  scheduleContext = loadSchedules();
} catch (error) {
  console.error('⚠️  Schedule context failed to load:', (error as Error).message);
}

let teamStatsContext: TeamStatsContext | null = null;
let statsContext: ReturnType<typeof loadStats> | null = null;
let playersContext: ReturnType<typeof loadPlayers> | null = null;

// Load stats at startup
try {
  statsContext = loadStats();
  console.log(`[server] Stats cache loaded from ${statsContext.meta.sourcePath} (${statsContext.meta.playerCount} players)`);
} catch (error) {
  console.error('⚠️  Stats context failed to load:', (error as Error).message);
}

// Load players at startup
try {
  playersContext = loadPlayers();
  console.log(`[server] Players directory loaded from ${playersContext.meta.sourcePath} (${playersContext.meta.playerCount} players)`);
} catch (error) {
  console.error('⚠️  Players context failed to load:', (error as Error).message);
}

const app = express();
const PORT = Number(process.env.PORT || 8080);

// Make schedule context available to routes
app.locals.schedules = scheduleContext;
app.locals.teamStats = teamStatsContext;
app.locals.stats = statsContext;
app.locals.players = playersContext;

loadTeamStatsContext()
  .then((context) => {
    teamStatsContext = context;
    app.locals.teamStats = context;
    if (context.loaded) {
      console.log(`[server] Team stats cache loaded (${context.byTeam.size} teams)`);
    } else {
      console.warn('[server] Team stats cache missing or empty');
    }
  })
  .catch((error) => {
    console.error('[server] Team stats cache failed to load:', (error as Error).message);
  });

// Allow Vite dev origin and Vercel production domains
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:8092',
    'https://cracked-ice-web.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json());

app.use('/api/teams', teamRoutes);
app.use('/api', complementRoutes);
app.use('/api', gameAnalysisRoutes);
app.use('/api', teamTierRoutes);
app.use('/api/coach', coachRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
}).on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} in use. Kill process or change PORT.`);
    process.exit(1);
  }
  throw e;
});
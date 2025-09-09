import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { teamRoutes } from './routes/teams';
import { complementRoutes } from './routes/complement';
import { loadSchedules } from './context/schedules';

dotenv.config();

// Load schedules at startup
let scheduleContext: ReturnType<typeof loadSchedules> | null = null;
try {
  scheduleContext = loadSchedules();
} catch (error) {
  console.error('⚠️  Schedule context failed to load:', (error as Error).message);
}

const app = express();
const PORT = Number(process.env.PORT || 8080);

// Make schedule context available to routes
app.locals.schedules = scheduleContext;

// Allow Vite dev origin
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8092'], credentials: true }));
app.use(express.json());

app.use('/api/teams', teamRoutes);
app.use('/api', complementRoutes);

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
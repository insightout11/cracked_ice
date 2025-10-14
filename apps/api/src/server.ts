import express from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { syncSupabaseCacheOnBoot } from './bootstrap/cacheSync';
import { coachRouter } from './routes/coach.streamers.post';
import { healthRouter } from './routes/health.get';
import { playersRouter } from './routes/players.get';
import { scheduleRouter } from './routes/schedule.get';

async function start(): Promise<void> {
  await syncSupabaseCacheOnBoot();
  enforceStagingEnv();

  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const allowedOrigins = (process.env.ALLOW_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true
  };

  app.use(cors(corsOptions));
  app.use(express.json());

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || req.path === '/health') {
      return next();
    }
    const userId = req.header('x-user-id');
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }
    return next();
  });

  app.use('/api', coachRouter);
  app.use('/api', playersRouter);
  app.use('/api', scheduleRouter);
  app.use('/api', healthRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });
}

function enforceStagingEnv(): void {
  if (process.env.NEXT_PUBLIC_ENV !== 'staging') {
    throw new Error('API must run with NEXT_PUBLIC_ENV=staging');
  }
  if (process.env.DISABLE_PROD !== 'true') {
    throw new Error('API requires DISABLE_PROD=true');
  }
}

start().catch((error) => {
  console.error('[boot] Failed to start API:', error);
  process.exit(1);
});
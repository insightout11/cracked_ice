import { Router } from 'express';
import { z } from 'zod';
import { rankStreamers, RecommendationTimeoutError, UserDataError } from '../services/rank';
import { newRequestId } from '../services/logger';

const windowSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1)
});

const requestSchema = z.object({
  window: windowSchema
});

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function parseWindow(payload: unknown) {
  const result = requestSchema.safeParse(payload);
  if (!result.success) {
    throw new Error('invalid_window');
  }

  const { start, end } = result.data.window;

  if (!isIsoDate(start) || !isIsoDate(end)) {
    throw new Error('invalid_window');
  }

  if (start > end) {
    throw new Error('invalid_window');
  }

  return result.data.window;
}

export const coachRouter = Router();

coachRouter.post('/coach/streamers', (req, res) => {
  const startedAt = Date.now();
  const reqId = newRequestId();

  try {
    if (process.env.NEXT_PUBLIC_ENV !== 'staging' || process.env.DISABLE_PROD !== 'true') {
      return res.status(403).json({ error: 'Endpoint disabled outside staging environment' });
    }

    const userId = req.header('x-user-id');
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const window = parseWindow(req.body);

    const result = rankStreamers(userId, window, reqId);
    const duration = Date.now() - startedAt;

    const response = {
      baseline_points: Number(result.baselinePoints.toFixed(2)),
      recommendations: result.recommendations,
      meta: {
        reqId,
        durationMs: duration
      }
    };

    return res.json(response);
  } catch (error) {
    if (error instanceof UserDataError) {
      return res.status(422).json({
        error: 'Missing user fixtures',
        how_to_fix: 'Upload latest roster + free-agent JSON under apps/api/src/data or switch to x-user-id: demo'
      });
    }

    if (error instanceof RecommendationTimeoutError) {
      return res.status(429).json({ error: error.message });
    }

    if (error instanceof Error && error.message === 'invalid_window') {
      return res.status(400).json({ error: 'Invalid window payload' });
    }

    console.error('[coach] unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
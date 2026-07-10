import { VercelRequest, VercelResponse } from '@vercel/node';
import { loadScheduleContext, SCHEDULE_FILE } from './_lib/schedule';
import { handleCors } from './_lib/respond';

// Real health check: reports whether schedule data is loadable and its shape.
// WP2 extends this with season id + hydrate manifest timestamp.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res, ['GET'])) return;

  const scheduleContext = loadScheduleContext();

  if (!scheduleContext) {
    return res.status(503).json({
      status: 'degraded',
      scheduleFile: SCHEDULE_FILE,
      schedulesLoaded: false,
      timestamp: new Date().toISOString()
    });
  }

  let earliest: string | null = null;
  let latest: string | null = null;
  for (const dates of scheduleContext.sets.values()) {
    for (const d of dates) {
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    }
  }

  res.json({
    status: 'ok',
    schedulesLoaded: true,
    scheduleFile: SCHEDULE_FILE,
    teamCount: scheduleContext.sets.size,
    scheduleRange: { earliest, latest },
    timestamp: new Date().toISOString()
  });
}

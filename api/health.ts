import { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadScheduleContext, SCHEDULE_FILE } from './_lib/schedule';
import { SEASON_ID, SEASON_LABEL } from './_lib/season';
import { handleCors } from './_lib/respond';

// Best-effort read of the nightly hydrate timestamp. derived.json is rewritten
// on every hydrate run and lives in root data/, so its generatedAt is the
// freshest "data updated" signal; fall back to the schedule file's refresh time.
function readLastHydrated(): string | null {
  const candidates: Array<[string, string]> = [
    ['derived.json', 'generatedAt'],
    [SCHEDULE_FILE, 'lastRefreshed'],
  ];
  for (const [file, field] of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(join(process.cwd(), 'data', file), 'utf8'));
      if (parsed?.[field]) return parsed[field];
    } catch {
      // try the next source
    }
  }
  return null;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res, ['GET'])) return;

  const scheduleContext = loadScheduleContext();
  const lastHydrated = readLastHydrated();

  if (!scheduleContext) {
    return res.status(503).json({
      status: 'degraded',
      seasonId: SEASON_ID,
      seasonLabel: SEASON_LABEL,
      scheduleFile: SCHEDULE_FILE,
      schedulesLoaded: false,
      lastHydrated,
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
    seasonId: SEASON_ID,
    seasonLabel: SEASON_LABEL,
    schedulesLoaded: true,
    scheduleFile: SCHEDULE_FILE,
    teamCount: scheduleContext.sets.size,
    scheduleRange: { earliest, latest },
    lastHydrated,
    timestamp: new Date().toISOString()
  });
}

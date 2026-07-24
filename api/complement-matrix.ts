import { calculateComplementMatrix, type ComplementMatrixResponse } from './_lib/complement-matrix.js';
import { handleCors } from './_lib/respond.js';
import { loadScheduleContext, SCHEDULES_NOT_LOADED } from './_lib/schedule.js';
import { SEASON_END, SEASON_START } from './_lib/season.js';

const cache = new Map<string, ComplementMatrixResponse>();

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  const start = String(req.query.start || SEASON_START);
  const end = String(req.query.end || SEASON_END);
  if (start > end) {
    return res.status(400).json({ error: 'invalid_window', message: 'start must be on or before end.' });
  }

  const scheduleContext = loadScheduleContext();
  if (!scheduleContext) return res.status(500).json(SCHEDULES_NOT_LOADED);

  const key = `${start}:${end}`;
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  const matrix = calculateComplementMatrix(scheduleContext, start, end);
  if (cache.size >= 8) cache.delete(cache.keys().next().value as string);
  cache.set(key, matrix);
  return res.json(matrix);
}

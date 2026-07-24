import { calculatePairings } from './_lib/pairings.js';
import { handleCors } from './_lib/respond.js';
import { loadScheduleContext, SCHEDULES_NOT_LOADED } from './_lib/schedule.js';
import { SEASON_END, SEASON_START } from './_lib/season.js';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  try {
    const rawAnchors = Array.isArray(req.query.anchors) ? req.query.anchors[0] : req.query.anchors;
    const anchors = String(rawAnchors ?? '')
      .split(',')
      .map((team) => team.trim().toUpperCase())
      .filter(Boolean);
    const start = String(req.query.start || SEASON_START);
    const end = String(req.query.end || SEASON_END);
    const slots = Number(req.query.slots || 2);

    if (anchors.length === 0) {
      return res.status(400).json({ error: 'anchors_required', message: 'Provide at least one anchor team.' });
    }
    if (!Number.isInteger(slots) || slots < 1 || slots > 10) {
      return res.status(400).json({ error: 'invalid_slots', message: 'slots must be an integer from 1 to 10.' });
    }
    if (start > end) {
      return res.status(400).json({ error: 'invalid_window', message: 'start must be on or before end.' });
    }

    const scheduleContext = loadScheduleContext();
    if (!scheduleContext) {
      return res.status(500).json(SCHEDULES_NOT_LOADED);
    }

    const unknown = anchors.find((team) => !scheduleContext.sets.has(team));
    if (unknown) {
      return res.status(400).json({ error: 'unknown_anchor_team', team: unknown });
    }

    return res.json(calculatePairings(scheduleContext, anchors, start, end, slots));
  } catch (error: any) {
    console.error('[pairings] error:', error);
    return res.status(500).json({ error: 'pairings_failed', message: error?.message });
  }
}

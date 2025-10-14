import { Router } from 'express';
import { getScheduleMetadata, getTeamSchedule } from '../services/schedule';

export const scheduleRouter = Router();

scheduleRouter.get('/schedule/:team', (req, res) => {
  const schedule = getTeamSchedule(req.params.team.toUpperCase());

  if (!schedule.length) {
    return res.status(404).json({ error: 'Team schedule not found in cache' });
  }

  return res.json({
    team: req.params.team.toUpperCase(),
    schedule,
    meta: getScheduleMetadata()
  });
});
import { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';
import { format, addDays, startOfISOWeek, parseISO } from 'date-fns';
import { loadSchedules } from '../server/src/context/schedules';

// CORS helper
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8092',
    'https://cracked-ice-web.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
};

function runMiddleware(req: VercelRequest, res: VercelResponse, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Run CORS
  await runMiddleware(req, res, cors(corsOptions));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Load schedules
    let scheduleContext;
    try {
      scheduleContext = loadSchedules();
    } catch (error) {
      return res.status(500).json({
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    // Build teams list from loaded schedule data
    const teams = [];
    let id = 1;

    for (const [triCode, teamName] of scheduleContext.teamNameMap.entries()) {
      // Try to find the actual team ID for this triCode
      let teamId = id++;
      for (const [actualId, actualTriCode] of scheduleContext.idToTriCodeMap.entries()) {
        if (actualTriCode === triCode) {
          teamId = actualId;
          break;
        }
      }

      teams.push({
        id: teamId,
        name: teamName,
        abbreviation: triCode,
        triCode: triCode
      });
    }

    // Sort by abbreviation for consistency
    teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

    res.json(teams);
  } catch (error) {
    console.error('Error building teams list:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
}
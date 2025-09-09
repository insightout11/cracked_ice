import { Router } from 'express';
import { z } from 'zod';
import { filterDatesByRange } from '../context/schedules';
import { countIntersect, countAminusB, pctOffNightNonOverlap, calculateUsableStarts, calculateOffNightPct, filterByRange } from '../utils/schedule-utils';

export const complementRoutes = Router();

const ComplementQuerySchema = z.object({
  seedTeamCode: z.string().min(2).max(4).transform(s => s.toUpperCase()),
  start: z.string().optional(),
  end: z.string().optional(),
});

const AddedStartsSchema = z.object({
  rosterTeamCodes: z.array(z.string().transform(s => s.toUpperCase())),
  candidateTeamCode: z.string().transform(s => s.toUpperCase()),
  window: z.enum(['7d', '14d', 'season']).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  slotsPerDay: z.number().optional().default(2),
});

const BestMatchesSchema = z.object({
  k: z.enum(['2', '3', '4']).transform(Number),
  start: z.string().optional(),
  end: z.string().optional(),
  slotsPerDay: z.string().optional().transform(v => v ? Number(v) : 2),
});

const BulkAddedStartsSchema = z.object({
  rosterTeamCodes: z.array(z.string()).transform(arr => arr.map(s => s.toUpperCase())),
  start: z.string().optional(),
  end: z.string().optional(), 
  slotsPerDay: z.number().optional().default(2),
});

complementRoutes.get('/complement', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ 
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    const query = ComplementQuerySchema.parse(req.query);
    const { seedTeamCode, start, end } = query;
    
    // DIAGNOSTIC LOGGING
    console.log('[complement] input', {
      seedTeamCode: req.query.seedTeamCode,
      start: req.query.start,
      end: req.query.end
    });

    // Resolve seed triCode & set
    const seedTri = String(req.query.seedTeamCode || '').trim().toUpperCase();
    const seedFull = scheduleContext.sets.get(seedTri);
    console.log('[complement] seedTri', seedTri, 'exists?', !!seedFull, 'rawCount', seedFull?.size);
    
    console.log(`[complement] seed=${seedTeamCode} ${start || 'season-start'}->${end || 'season-end'}`);
    const t0 = Date.now();

    // Validate triCode exists in schedule data
    if (!scheduleContext.sets.has(seedTeamCode)) {
      return res.status(400).json({ error: 'unknown_team', team: seedTeamCode });
    }

    // Get seed team dates
    const seedTeamDates = scheduleContext.sets.get(seedTeamCode)!;
    const seedDatesFiltered = filterDatesByRange(seedTeamDates, start, end);
    
    // DIAGNOSTIC LOGGING
    console.log('[complement] window', { start, end }, 'seedCount', seedDatesFiltered.size, 'seedSample', [...seedDatesFiltered].slice(0,5));

    // Also log ONE candidate
    for (const [code, s] of scheduleContext.sets) {
      if (code === seedTeamCode) continue;
      const cand = filterDatesByRange(s, start, end);
      console.log('[complement] sampleCand', code, 'count', cand.size, 'dates', [...cand].slice(0,5));
      break;
    }
    
    // Check if seed set is empty after filtering
    if (seedDatesFiltered.size === 0) {
      return res.status(400).json({ 
        error: 'empty_seed_in_window', 
        team: seedTeamCode, 
        start, 
        end,
        message: 'No games found for seed team in specified date range'
      });
    }

    console.log(`[complement] seedTeam=${seedTeamCode} seedCount=${seedDatesFiltered.size}`);

    // Calculate complements for all other teams
    const results = [];
    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      if (teamCode === seedTeamCode) continue;

      const teamDatesFiltered = filterDatesByRange(teamDates, start, end);
      
      const conflicts = countIntersect(seedDatesFiltered, teamDatesFiltered);
      const nonOverlap = countAminusB(teamDatesFiltered, seedDatesFiltered);
      const offNightShare = pctOffNightNonOverlap(seedDatesFiltered, teamDatesFiltered);

      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        conflicts,
        nonOverlap,
        offNightShare: Math.round(offNightShare * 1000) / 1000, // 3 decimal places
        // Legacy compatibility
        complement: nonOverlap,
        weightedComplement: nonOverlap,
        abbreviation: teamCode,
        datesComplement: [...teamDatesFiltered].filter(d => !seedDatesFiltered.has(d)).sort()
      });
    }

    // Sort by conflicts (asc), then nonOverlap (desc), then offNightShare (desc)
    results.sort((a, b) => 
      a.conflicts - b.conflicts ||
      b.nonOverlap - a.nonOverlap ||
      b.offNightShare - a.offNightShare
    );

    console.log(`[complement] ok in ${Date.now() - t0}ms`);
    res.json(results);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    
    console.error('[complement] error:', error);
    res.status(500).json({ error: 'Failed to calculate complements' });
  }
});

complementRoutes.post('/added-starts', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ 
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    const parsedBody = AddedStartsSchema.parse(req.body);
    const { rosterTeamCodes, candidateTeamCode, window, start, end, slotsPerDay } = parsedBody;

    // Convert window to date range if provided
    let actualStart = start;
    let actualEnd = end;
    
    if (window && !start && !end) {
      const today = new Date();
      actualStart = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (window === '7d') {
        const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        actualEnd = weekLater.toISOString().split('T')[0];
      } else if (window === '14d') {
        const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        actualEnd = twoWeeksLater.toISOString().split('T')[0];
      } else if (window === 'season') {
        actualStart = '2025-10-01';
        actualEnd = '2026-04-30';
      }
    }

    // Logging for debugging
    console.log('[added-starts] INCOMING REQUEST:', JSON.stringify(req.body));
    console.log('[added-starts] roster teams:', rosterTeamCodes);
    console.log('[added-starts] candidate team:', candidateTeamCode);
    console.log('[added-starts] window:', window, '-> date range:', actualStart, 'to', actualEnd);

    // Helper function to get filtered team dates
    const getFilteredTeamDates = (teamCode: string): Set<string> => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return filterDatesByRange(teamDates, actualStart, actualEnd);
    };

    // Validate all teams exist
    if (!scheduleContext.sets.has(candidateTeamCode)) {
      return res.status(400).json({ error: 'unknown_team', team: candidateTeamCode });
    }
    for (const teamCode of rosterTeamCodes) {
      if (!scheduleContext.sets.has(teamCode)) {
        return res.status(400).json({ error: 'unknown_roster_team', team: teamCode });
      }
    }

    // 1) Build occupancy map from roster teams
    const occupiedPerDay = new Map<string, number>();
    for (const teamCode of rosterTeamCodes) {
      const teamDates = getFilteredTeamDates(teamCode);
      for (const date of teamDates) {
        occupiedPerDay.set(date, (occupiedPerDay.get(date) || 0) + 1);
      }
    }

    // 2) Get candidate team's dates in the window  
    const candidateDates = getFilteredTeamDates(candidateTeamCode);

    // 3) Count only candidate dates that have available slots
    const addedDates: string[] = [];
    for (const date of candidateDates) {
      if ((occupiedPerDay.get(date) || 0) < slotsPerDay) {
        addedDates.push(date);
      }
    }

    // Diagnostic information
    const totalFreeDays = [...new Set([...candidateDates])].filter(date => 
      (occupiedPerDay.get(date) || 0) < slotsPerDay
    ).length;

    console.log('[added-starts] candidate games in window:', candidateDates.size);
    console.log('[added-starts] added starts:', addedDates.length);
    console.log('[added-starts] sample dates:', addedDates.slice(0, 5));

    res.json({
      addedStarts: addedDates.length,
      dates: addedDates.sort(),
      candidateGamesInWindow: candidateDates.size,
      candidateOnFreeDays: totalFreeDays,
      sampleAddedDates: addedDates.slice(0, 10),
      diagnostics: {
        rosterTeams: rosterTeamCodes,
        candidateTeam: candidateTeamCode,
        dateRange: { start: actualStart, end: actualEnd },
        slotsPerDay
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors });
    }
    
    console.error('[added-starts] error:', error);
    res.status(500).json({ error: 'Failed to calculate added starts' });
  }
});

complementRoutes.get('/best-matches', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ 
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    const query = BestMatchesSchema.parse(req.query);
    const { k, start, end, slotsPerDay } = query;
    
    console.log(`[best-matches] k=${k} ${start || 'season-start'}->${end || 'season-end'}`);
    const t0 = Date.now();

    // Get precomputed matches for the requested k
    const precomputedMatches = scheduleContext.bestMatches[k as keyof typeof scheduleContext.bestMatches] || [];
    
    // If start/end provided, recompute scoring for the window
    if (start || end) {
      const windowedResults = precomputedMatches.map((match: any) => {
        // Create a filtered context for the window
        const filteredSets = new Map<string, Set<string>>();
        for (const teamCode of match.teams) {
          const teamDates = scheduleContext.sets.get(teamCode);
          if (teamDates) {
            filteredSets.set(teamCode, filterByRange(teamDates, start || '2025-10-01', end || '2026-04-30'));
          }
        }
        
        const windowContext = { sets: filteredSets };
        const usableStarts = calculateUsableStarts(match.teams, windowContext, slotsPerDay);
        const offNightPct = calculateOffNightPct(match.teams, windowContext);
        
        // Calculate unique days for the window
        const uniqueDates = new Set<string>();
        for (const teamCode of match.teams) {
          const teamDates = filteredSets.get(teamCode);
          if (teamDates) {
            for (const date of teamDates) {
              uniqueDates.add(date);
            }
          }
        }
        
        return {
          teams: match.teams,
          usableStarts,
          offNightPct: Math.round(offNightPct * 1000) / 1000, // 3 decimal places
          uniqueDays: uniqueDates.size
        };
      });
      
      // Re-sort by usableStarts (desc), then offNightPct (desc)
      windowedResults.sort((a: any, b: any) => 
        b.usableStarts - a.usableStarts ||
        b.offNightPct - a.offNightPct
      );
      
      console.log(`[best-matches] ok in ${Date.now() - t0}ms (windowed)`);
      return res.json(windowedResults);
    }
    
    // Return precomputed matches with rounded percentages
    const results = precomputedMatches.map((match: any) => ({
      teams: match.teams,
      usableStarts: match.usableStarts,
      offNightPct: Math.round(match.offNightPct * 1000) / 1000, // 3 decimal places
      uniqueDays: match.uniqueDays
    }));
    
    console.log(`[best-matches] ok in ${Date.now() - t0}ms (precomputed)`);
    res.json(results);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    
    console.error('[best-matches] error:', error);
    res.status(500).json({ error: 'Failed to get best matches' });
  }
});

// BULK endpoint for roster-aware calculations
complementRoutes.post('/added-starts-bulk', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ 
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    // Parse and validate request body
    const validatedBody = BulkAddedStartsSchema.parse(req.body);
    
    // Extract with explicit typing 
    const rosterTeamCodes: string[] = validatedBody.rosterTeamCodes;
    const start: string | undefined = validatedBody.start;
    const end: string | undefined = validatedBody.end;
    const slotsPerDay: number = validatedBody.slotsPerDay;

    console.log('[bulk] roster=', rosterTeamCodes, 'window=', start, '->', end, 'slots=', slotsPerDay);

    const roster = rosterTeamCodes; // Already uppercase from schema transform
    const rosterSet = new Set(roster);

    // Helper function to get filtered team dates
    const getTeamDates = (teamCode: string) => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return teamDates;
    };

    const inRange = (teamDates: Set<string>, startDate?: string, endDate?: string) => {
      return filterDatesByRange(teamDates, startDate, endDate);
    };

    // Build occupancy from current roster
    const occ = new Map<string, number>();
    for (const team of roster) {
      // @ts-ignore: Zod typing issue with optional strings
      const dates = inRange(getTeamDates(team), start || '2025-10-01', end || '2026-04-30');
      for (const d of dates) occ.set(d, (occ.get(d) ?? 0) + 1);
    }

    // Get all teams and filter out roster teams
    const ALL_TEAMS = Array.from(scheduleContext.sets.keys());

    // Score every other team
    const rows = ALL_TEAMS
      // @ts-ignore: TypeScript can't infer the filter correctly
      .filter(team => !rosterSet.has(team))
      .map(team => {
        // @ts-ignore: Zod typing issue with optional strings
      const dates = inRange(getTeamDates(team), start || '2025-10-01', end || '2026-04-30');
        let added = 0;
        for (const d of dates) if ((occ.get(d) ?? 0) < slotsPerDay) added++;
        return {
          team,
          candidateGamesInWindow: dates.size,
          usableStarts: added,
          // Include basic complement data too
          teamName: scheduleContext.teamNameMap.get(team) || team,
          abbreviation: team
        };
      });

    // DIAGNOSTIC: print a couple rows to verify not all zero
    console.log('[bulk] sample:', rows.slice(0, 3));

    res.json({ rows });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors });
    }
    
    console.error('[bulk] error:', error);
    res.status(500).json({ error: 'Failed to calculate bulk added starts' });
  }
});

// DIAGNOSTIC endpoint for single-candidate detailed analysis
complementRoutes.get('/diag/added-starts', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ error: 'schedules_not_warmed' });
    }

    const roster = String(req.query.roster || '')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    const candidate = String(req.query.candidate || '').toUpperCase();
    const start = String(req.query.start || '2025-10-01');
    const end = String(req.query.end || '2026-04-30');
    const slots = Number(req.query.slots || 2);

    console.log('[diag/added-starts] input:', { roster, candidate, start, end, slots });

    // Helper functions
    const getTeamDates = (teamCode: string) => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return teamDates;
    };

    const inRange = (teamDates: Set<string>, startDate?: string, endDate?: string) => {
      return filterDatesByRange(teamDates, startDate || '2025-10-01', endDate || '2026-04-30');
    };

    // Build occ
    const occ = new Map<string, number>();
    for (const t of roster) {
      const teamDates = inRange(getTeamDates(t), start, end);
      for (const d of teamDates) {
        occ.set(d, (occ.get(d) ?? 0) + 1);
      }
    }

    const candDates = inRange(getTeamDates(candidate), start, end);
    const sampleCand = [...candDates].slice(0, 10);

    let added = 0, sampleAdded: string[] = [];
    for (const d of candDates) {
      if ((occ.get(d) ?? 0) < slots) {
        added++;
        if (sampleAdded.length < 10) sampleAdded.push(d);
      }
    }

    res.json({
      roster, candidate, start, end, slots,
      candDatesCount: candDates.size,
      sampleCand,
      addedStarts: added,
      sampleAdded,
      // Additional diagnostics
      rosterOccupancy: Object.fromEntries([...occ.entries()].slice(0, 10)),
      availableSlots: slots,
      teamExists: scheduleContext.sets.has(candidate)
    });

  } catch (error) {
    console.error('[diag/added-starts] error:', error);
    res.status(500).json({ error: 'Failed to get added starts diagnostic', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// DIAGNOSTIC endpoint for debugging overlap issues
complementRoutes.get('/diag/overlap', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ error: 'schedules_not_warmed' });
    }

    const a = String(req.query.a || '').toUpperCase();
    const b = String(req.query.b || '').toUpperCase();
    const start = String(req.query.start || '2025-10-01');
    const end = String(req.query.end || '2026-04-30');
    
    const A0 = scheduleContext.sets.get(a);
    const B0 = scheduleContext.sets.get(b);
    const A = filterDatesByRange(A0 ?? new Set(), start, end);
    const B = filterDatesByRange(B0 ?? new Set(), start, end);
    const inter = [...A].filter(d => B.has(d));
    
    res.json({ 
      aCount: A.size, 
      bCount: B.size, 
      overlap: inter.length, 
      aSample: [...A].slice(0,6), 
      bSample: [...B].slice(0,6) 
    });
  } catch (error) {
    console.error('[diag/overlap] error:', error);
    res.status(500).json({ error: 'Failed to get overlap data' });
  }
});


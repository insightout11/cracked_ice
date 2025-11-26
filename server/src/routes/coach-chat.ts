import { Router } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { loadUserContext, getUserStatus } from '../features/coach/data-loader';
import type { UserStatusSummary } from '../features/coach/data-loader';
import { generateCoachRecommendations } from '../features/coach';
import type { CoachResponse, Recommendation } from '../features/coach/types';
import type { ScheduleContext } from '../context/schedules';
import type { StatsContext } from '../context/stats';
import type { TeamStatsContext } from '../context/teamStats';
import { REQUIRED_ENV } from '../features/coach/constants';

export const coachChatRoutes = Router();

const USER_ID_PATTERN = /^[a-z0-9\-_.]{3,64}$/i;

const ChatMessageSchema = z.object({
  message: z.string().min(1),
  window: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
});

interface PreparedChatContext {
  context: any | null;
  recommendations: CoachResponse | null;
  baselineSlots: Record<string, Record<string, number>>;
  missingComponents: string[];
  contextNote?: string;
  statsContext?: StatsContext | null;
}

function ensureStagingEnvironment(): void {
  if (
    process.env.NEXT_PUBLIC_ENV !== REQUIRED_ENV.NEXT_PUBLIC_ENV ||
    process.env.DISABLE_PROD !== REQUIRED_ENV.DISABLE_PROD
  ) {
    throw new Error('Coach endpoint disabled outside staging environment');
  }
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
}

function buildSystemPrompt(
  hasSettings: boolean,
  hasRoster: boolean,
  hasFreeAgents: boolean,
  currentDate: Date,
  window?: { start: string; end: string }
): string {
  const dateStr = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let windowContext = '';
  if (window) {
    const startDate = new Date(window.start);
    const endDate = new Date(window.end);
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    windowContext = `\n\n**Recommendation window: ${startStr} to ${endStr}.**\nOnly consider games within this range when answering questions.`;
  }

  return `You are an AI fantasy hockey coaching assistant. Help users optimize their fantasy rosters with the data provided.\n\n**Today's date: ${dateStr}**\n**Current NHL Season: 2025-26**${windowContext}\n\nCurrent setup status:\n- League settings: ${hasSettings ? 'ready' : 'missing'}\n- Roster: ${hasRoster ? 'ready' : 'missing'}\n- Free agents: ${hasFreeAgents ? 'ready' : 'missing'}\n\nKey duties:\n1. If any uploads are missing, clearly explain which files (league settings, roster, free agents) the user still needs to provide and how to upload them.\n2. Once data is ready, guide users through the top recommendations without inventing information.\n3. Use only the roster, schedule, lineup, and recommendation data supplied below. Never speculate about players that are absent from the context.\n4. When discussing an add, immediately explain lineup fit: which slot type they fill (C, LW, RW, D, G) on each date, which dates they cannot start (and why), and any cascading roster changes.\n5. IMPORTANT: When an add player fills a slot that was already occupied in the baseline, explain this clearly. For example: "Bo Horvat fills a C slot on Oct 30. Since both C slots were already filled in your baseline, this bumps a lower-scoring C-eligible player (like Mathew Barzal who is C/RW eligible) to another position or the bench."\n6. Always mention the trade-off: what the drop player would have started (dates and starts lost) and the point delta for the swap.\n7. Group answers by add player (do not repeat the same add with different drops unless the user explicitly requests alternatives).\n8. If the user questions a fit or points out a conflict, re-check the lineup tables supplied below before responding and be explicit about any correction.\n9. Keep responses concise (aim for two to three sentences by default) but expand when clarifying lineup fit or troubleshooting data issues.\n\nPlayer statistics:\n- Each roster player includes their season statistics in this format: "GP: [games]G, [assists]A, [shots] SOG, [ppp] PPP"\n- When users ask about player statistics (goals, assists, shots, etc.), reference these exact numbers from the context.\n- FPPG (Fantasy Points Per Game) is a calculated performance metric based on the league's scoring weights.\n- Do not claim you lack access to statistics when they are provided in the roster context.\n\nAccuracy rules:\n- Never fabricate schedules, stats, or player availability.\n- Use exact dates and slot types from the context when referencing games.\n- Remind the user when you lack the data needed to answer.\n- Refer to the former Arizona Coyotes as the Utah Hockey Club (UTA) only.\n- Delta points represent the total gain across the entire window, not per game.\n- When the baseline shows open slots in one position but the add player fills a different position, this means multi-position players are being reassigned - explain this clearly.`;
}

function collectMissingComponents(status: UserStatusSummary): string[] {
  const missing: string[] = [];
  if (!status.components.settings.present) missing.push('league settings');
  if (!status.components.roster.present) missing.push('roster');
  if (!status.components.free_agents.present) missing.push('free agents');
  return missing;
}

function sumSlots(slotMap: Record<string, number> | undefined): number {
  if (!slotMap) return 0;
  return Object.values(slotMap).reduce((sum, value) => (value > 0 ? sum + Number(value) : sum), 0);
}

function formatSlotList(slotMap: Record<string, number> | undefined): string {
  if (!slotMap) return 'none';
  const parts = Object.entries(slotMap)
    .filter(([, count]) => count > 0)
    .map(([slot, count]) => `${count} ${slot}`);
  return parts.length ? parts.join(', ') : 'none';
}

function formatDailySlots(slotsByDate: Record<string, Record<string, number>>): string[] {
  const dates = Object.keys(slotsByDate).sort();
  if (!dates.length) {
    return ['No lineup slot data found for this window.'];
  }
  return dates.map((date) => {
    const slotMap = slotsByDate[date];
    const total = sumSlots(slotMap);
    const slotList = formatSlotList(slotMap);
    return `${date}: ${total} slot${total === 1 ? '' : 's'} (${slotList})`;
  });
}

function describeAddFit(rec: Recommendation, baselineSlots: Record<string, Record<string, number>>): string {
  const addGames = rec.add_player.upcomingGamesInWindow || [];
  if (!addGames.length) {
    return 'Add has no games inside the selected window.';
  }

  const starts = new Set(rec.add_player_start_dates || []);
  const slotsByDate = rec.add_player_slots_by_date ?? {};

  const segments = addGames.map((date) => {
    const afterSlots = rec.unused_slots_by_date?.[date] ?? {};

    if (starts.has(date)) {
      // Player starts - show which slot they filled
      const slotFilled = slotsByDate[date] || '?';
      const afterList = formatSlotList(afterSlots) || 'all filled';
      return `${date}: STARTS in ${slotFilled} slot (after: ${afterList})`;
    } else {
      // Player blocked - explain why
      const afterTotal = sumSlots(afterSlots);
      const reason = afterTotal === 0
        ? 'all slots filled'
        : `open slots (${formatSlotList(afterSlots)}) don't match position`;
      return `${date}: BLOCKED (${reason})`;
    }
  });

  return segments.join(' | ');
}

function summarizeRecommendationsForPrompt(
  recommendations: Recommendation[],
  baselineSlots: Record<string, Record<string, number>>
): string {
  if (!recommendations.length) {
    return 'No recommendation beat the current roster baseline for this window.';
  }

  const seenAdds = new Set<string>();
  const lines: string[] = [];

  for (const rec of recommendations) {
    const addId = rec.add_player.base.id;
    if (seenAdds.has(addId)) {
      continue;
    }
    seenAdds.add(addId);

    const addName = rec.add_player.base.full_name;
    const addTeam = rec.add_player.base.team;
    const addPosition = rec.add_player.base.position || 'Unknown';
    const dropName = rec.drop_player.base.full_name;

    const deltaPoints = rec.delta_points.toFixed(2);
    const deltaGp = rec.delta_gp >= 0 ? `+${rec.delta_gp}` : `${rec.delta_gp}`;
    const addStarts = rec.add_player_start_count ?? (rec.add_player_start_dates?.length ?? 0);
    const dropStarts = rec.drop_player_start_count ?? (rec.drop_player_start_dates?.length ?? 0);
    const addPts = typeof rec.add_player_points === 'number' ? rec.add_player_points.toFixed(2) : '0';
    const dropPts = typeof rec.drop_player_points === 'number' ? rec.drop_player_points.toFixed(2) : '0';

    const fitSummary = describeAddFit(rec, baselineSlots);
    const dropSummary = dropStarts
      ? `Drop would have started ${dropStarts} game${dropStarts === 1 ? '' : 's'} (${(rec.drop_player_start_dates || []).join(', ')})`
      : 'Drop had no projected starts in this window';

    const line = [
      `${lines.length + 1}. Add ${addName} (${addTeam}, ${addPosition}) ? drop ${dropName}`,
      `   - Window gain: +${deltaPoints} pts, ${deltaGp} GP (add ${addStarts} starts / ${addPts} pts vs drop ${dropStarts} starts / ${dropPts} pts)`,
      `   - Fit by date: ${fitSummary}`,
      `   - ${dropSummary}`
    ].join('\n');

    lines.push(line);

    if (lines.length === 10) {
      break;
    }
  }

  return lines.join('\n\n');
}

function buildContextMessage(prepared: PreparedChatContext): string {
  const { context, recommendations, baselineSlots, missingComponents, contextNote, statsContext } = prepared;
  const sections: string[] = [];

  const statusLines: string[] = ['Coach data status:'];
  statusLines.push(
    missingComponents.length
      ? `- Missing inputs: ${missingComponents.join(', ')}`
      : '- All required uploads detected.'
  );

  if (context) {
    statusLines.push(`- League: ${context.league_profile.league_name}`);
    statusLines.push(`- Roster size: ${context.roster.length} players`);
    statusLines.push(`- Free agent pool: ${context.free_agents.length} players`);

    // Include scoring information so AI knows how points are calculated
    const skaterWeights = context.league_profile.skater_scoring || context.league_profile.scoring_weights;
    const goalieWeights = context.league_profile.goalie_scoring;

    if (skaterWeights) {
      const skaterCategories = Object.entries(skaterWeights)
        .filter(([_, value]) => value && value !== 0)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      statusLines.push(`- Skater scoring: ${skaterCategories}`);
    }

    if (goalieWeights) {
      const goalieCategories = Object.entries(goalieWeights)
        .filter(([_, value]) => value && value !== 0)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      statusLines.push(`- Goalie scoring: ${goalieCategories}`);
    }
  } else {
    statusLines.push('- User context not yet available.');
  }

  // Add detailed roster player list with FPPG and data quality warnings
  if (context && context.roster.length > 0) {
    const dataIssues: string[] = [];

    const rosterDetails = context.roster.map((player: any) => {
      const stat = statsContext?.players.get(player.id);
      const fppg = stat?.blendedFppg ?? 0;
      const isGoalie = player.position.toUpperCase() === 'G';

      // Build stats string
      let statsStr = '';
      if (!isGoalie && player.stats && player.games_played > 0) {
        statsStr = ` | ${player.games_played} GP: ${player.stats.goals}G, ${player.stats.assists}A, ${player.stats.shots_on_goal} SOG, ${player.stats.power_play_points} PPP`;
      }

      // Check for data quality issues
      if (isGoalie && (!stat?.goalieStats || fppg === 0)) {
        dataIssues.push(`${player.full_name}: Missing goalie stats (FPPG=0) - roster data may only contain skater stats`);
      }

      return `${player.full_name} (${player.team}, ${player.position}, ${fppg.toFixed(2)} FPPG${player.current_slot ? `, slot: ${player.current_slot}` : ''}${statsStr})`;
    }).join('; ');

    sections.push(`Current roster players:\n${rosterDetails}`);

    // Add data quality warnings if any issues found
    if (dataIssues.length > 0) {
      sections.push(`DATA QUALITY WARNINGS:\n${dataIssues.join('\n')}\nNote: Players with missing stats will have 0 projected points. This is a data issue, not a performance issue.`);
    }
  }

  if (recommendations) {
    statusLines.push(`- Baseline projected points: ${recommendations.baseline_points.toFixed(2)}`);
    statusLines.push(`- Recommendations generated: ${recommendations.recommendations.length}`);
  } else {
    statusLines.push('- Recommendations are not available for the current query.');
  }

  if (contextNote) {
    statusLines.push(`Context note: ${contextNote}`);
  }

  sections.push(statusLines.join('\n'));

  if (Object.keys(baselineSlots).length) {
    sections.push(`Baseline lineup slots by date:\n${formatDailySlots(baselineSlots).join('\n')}`);
  } else {
    sections.push('Baseline lineup slots by date:\nNo slot data available. Provide a date window and ensure schedule/stats caches are loaded.');
  }

  if (recommendations) {
    sections.push(`Top recommendations (one per add):\n${summarizeRecommendationsForPrompt(recommendations.recommendations, baselineSlots)}`);
  } else {
    sections.push('Focus on guiding the user to upload missing data or supply a recommendation window before discussing add/drop moves.');
  }

  return `\n\n${sections.join('\n\n')}`;
}

function prepareChatContext(
  userId: string,
  status: UserStatusSummary,
  window: { start: string; end: string } | undefined,
  scheduleContext: ScheduleContext | null,
  statsContext: StatsContext | null,
  teamStatsContext: TeamStatsContext | null
): PreparedChatContext {
  const missingComponents = collectMissingComponents(status);
  let context: any | null = null;
  let recommendations: CoachResponse | null = null;
  let baselineSlots: Record<string, Record<string, number>> = {};
  let contextNote: string | undefined;

  try {
    context = loadUserContext(userId);
  } catch (error) {
    contextNote = (error as Error).message;
    context = null;
  }

  if (window && context && status.contextReady) {
    if (!scheduleContext || !statsContext) {
      contextNote = 'Server schedule or stats caches are unavailable. Restart the backend after hydrating data.';
    } else {
      try {
        recommendations = generateCoachRecommendations(userId, window, scheduleContext, statsContext, teamStatsContext);
        baselineSlots = recommendations.baseline_unused_slots ?? {};
      } catch (error) {
        contextNote = (error as Error).message;
        recommendations = null;
        baselineSlots = {};
      }
    }
  } else if (!window) {
    contextNote = contextNote ?? 'No recommendation window supplied. Ask the user which dates to analyse before running the coach.';
  } else if (!context) {
    contextNote = contextNote ?? 'User context could not be loaded. Ask the user to upload league settings, roster, and free agents.';
  }

  return {
    context,
    recommendations,
    baselineSlots,
    missingComponents,
    contextNote,
    statsContext
  };
}

coachChatRoutes.post('/coach/users/:userId/chat', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const parseResult = ChatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid message', details: parseResult.error.format() });
    }

    const { message, window, history } = parseResult.data;

    const status = getUserStatus(rawUserId);
    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const teamStatsContext = (req.app.locals?.teamStats ?? null) as TeamStatsContext | null;

    const prepared = prepareChatContext(rawUserId, status, window, scheduleContext, statsContext, teamStatsContext);

    const systemPrompt = buildSystemPrompt(
      status.components.settings.present,
      status.components.roster.present,
      status.components.free_agents.present,
      new Date(),
      window
    );

    const contextMessage = buildContextMessage(prepared);
    console.log("[coach-chat] Context message:\n", contextMessage);

    // Build messages array with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt + contextMessage }
    ];

    // Add conversation history if provided
    if (history && history.length > 0) {
      messages.push(...history);
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const reply = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return res.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachChatRoutes.post('/coach/users/:userId/chat/simple', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const parseResult = ChatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid message', details: parseResult.error.format() });
    }

    const { message, window, history } = parseResult.data;

    const status = getUserStatus(rawUserId);
    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const teamStatsContext = (req.app.locals?.teamStats ?? null) as TeamStatsContext | null;

    const prepared = prepareChatContext(rawUserId, status, window, scheduleContext, statsContext, teamStatsContext);

    const systemPrompt = buildSystemPrompt(
      status.components.settings.present,
      status.components.roster.present,
      status.components.free_agents.present,
      new Date(),
      window
    );
    const contextMessage = buildContextMessage(prepared);
    console.log("[coach-chat] Context message:\n", contextMessage);

    // Build messages array with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt + contextMessage }
    ];

    // Add conversation history if provided
    if (history && history.length > 0) {
      messages.push(...history);
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const reply = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return res.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});


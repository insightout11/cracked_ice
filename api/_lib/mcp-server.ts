/**
 * The Cracked Ice ChatGPT plugin: an MCP server with read-only NHL schedule tools for
 * fantasy hockey. Served statelessly by api/mcp.ts. Public data only, so no sign-in.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEASON } from './season.js';
import { MCP_APP_MIME_TYPE, RETIRED_SCHEDULE_CARD_URIS, SCHEDULE_CARD_URI, scheduleCardHtml, scheduleCardResourceMeta, scheduleCardToolMeta } from './mcp-ui.js';
import {
  DEFAULT_LINEUP, OFF_NIGHT_MAX_GAMES, SITE, TEAMS,
  loadSchedule, matchPlayers, resolveTeam, resolveWindow, rosterCheck, schedulePairs, shortDate, teamSchedule, teamsBetween, nightsBetween, weekSummary,
  type LineupSlots,
} from './schedule-tools.js';

const INSTRUCTIONS = `Cracked Ice: NHL schedule math for fantasy hockey (${SEASON.label}). Use these tools whenever a question depends on which NHL teams play when: off-nights (${OFF_NIGHT_MAX_GAMES} or fewer games), games per team this week, 4-game weeks, back-to-backs, streaming targets, a team's upcoming games, teams whose schedules pair well, fantasy playoff schedules, and whether a roster's games fit a lineup. Data refreshes nightly from the NHL; times are Eastern. The tools don't know a user's league, scoring, or who is available on their waiver wire, so say so when that matters.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } as const;
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const anyRows = z.array(z.record(z.string(), z.any()));

function dataAsOf(): string | null {
  return loadSchedule().lastRefreshed ?? null;
}

/** A tool result: structured data for the model, a short readable summary, and where to go deeper. */
function result(structured: Record<string, unknown>, summary: string[], link: string) {
  const structuredContent = { ...structured, dataAsOf: dataAsOf(), moreAt: link };
  return { structuredContent, content: [{ type: 'text' as const, text: `${summary.join('\n')}\n\nFull view: ${link}` }] };
}

function failure(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

const teamLine = (team: { name: string; games: number; offNightGames: number; backToBacks: string[][] }) =>
  `${team.name}: ${team.games} game${team.games === 1 ? '' : 's'}, ${team.offNightGames} on off-nights${team.backToBacks.length ? ', back-to-back' : ''}`;

/** Marks a link back to the site as coming from the plugin, so the site's analytics can count click-throughs. */
export function trackedLink(url: string, tool: string): string {
  const link = new URL(url);
  link.searchParams.set('utm_source', 'chatgpt');
  link.searchParams.set('utm_medium', 'plugin');
  link.searchParams.set('utm_campaign', tool);
  return link.toString();
}

export interface ScheduleServerOptions {
  /** Called once per tool call with the tool's name and whether it answered (usage counts). */
  onToolCall?: (tool: string, ok: boolean) => Promise<void> | void;
}

export function createScheduleServer(options: ScheduleServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'cracked-ice-schedule', title: 'Cracked Ice: NHL Schedule for Fantasy Hockey', version: '1.0.0', websiteUrl: SITE }, { instructions: INSTRUCTIONS });

  // Every tool goes through here: links back to the site are tagged with the tool's name, and
  // the call is counted (name and outcome only; see plugin-usage.ts).
  const register = (name: string, config: any, handler: (args: any, extra: any) => Promise<any>) =>
    server.registerTool(name, config, async (args: any, extra: any) => {
      const response = await handler(args, extra);
      const moreAt = response?.structuredContent?.moreAt;
      if (typeof moreAt === 'string') {
        const tagged = trackedLink(moreAt, name);
        response.structuredContent.moreAt = tagged;
        for (const block of response.content ?? []) if (block.type === 'text') block.text = block.text.split(moreAt).join(tagged);
      }
      try { await options.onToolCall?.(name, !response?.isError); } catch { /* counting never breaks an answer */ }
      return response;
    });

  // The Cracked Ice card ChatGPT shows inline for the weekly, streaming and roster tools.
  for (const [index, uri] of [SCHEDULE_CARD_URI, ...RETIRED_SCHEDULE_CARD_URIS].entries()) {
    server.registerResource(index === 0 ? 'cracked-ice-schedule-card' : `cracked-ice-schedule-card-retired-${index}`, uri, {
      title: 'Cracked Ice schedule card',
      description: 'A branded card showing a Cracked Ice schedule answer: games per night, the best team schedules, or a roster lineup check.',
      mimeType: MCP_APP_MIME_TYPE,
    }, async () => ({
      contents: [{ uri, mimeType: MCP_APP_MIME_TYPE, text: scheduleCardHtml(), _meta: scheduleCardResourceMeta(SITE) }],
    }));
  }

  register('get_weekly_nhl_schedule', {
    title: 'NHL schedule for a fantasy week',
    description: 'NHL games per night and per team for a Monday-to-Sunday fantasy hockey week: off-nights, packed nights, 4-game weeks, back-to-backs, and the teams with the best schedules to stream. Use for "NHL off-nights this week", "which teams play 4 games this week", "light nights this week".',
    inputSchema: { week_of: dateField.describe('Any date in the week (YYYY-MM-DD). Defaults to the current week.') },
    outputSchema: { weekStart: z.string(), weekEnd: z.string(), totalGames: z.number(), nights: anyRows, offNights: z.array(z.string()), packedNights: z.array(z.string()), fourGameTeams: z.array(z.string()), twoOrFewerGameTeams: z.array(z.string()), teams: anyRows, dataAsOf: z.string().nullable(), moreAt: z.string() },
    annotations: READ_ONLY,
    _meta: scheduleCardToolMeta('Checking the NHL week…', 'Week checked'),
  }, async ({ week_of }) => {
    try {
      const { start } = resolveWindow({ start: week_of, days: 1 });
      const week = weekSummary(loadSchedule(), start);
      const nightText = week.nights.map((night) => `${night.weekday} ${night.games}${night.kind === 'off-night' ? ' (off-night)' : night.kind === 'packed' ? ' (packed)' : ''}`).join(', ');
      return result(week, [
        `Week of ${shortDate(week.weekStart)} to ${shortDate(week.weekEnd)}: ${week.totalGames} NHL games.`,
        `Games per night: ${nightText}.`,
        `4-game teams: ${week.fourGameTeams.map((team) => TEAMS[team]?.name ?? team).join(', ') || 'none'}.`,
        `Best schedules to stream: ${week.teams.slice(0, 5).map(teamLine).join('; ')}.`,
      ], `${SITE}/season?start=${week.weekStart}`);
    } catch (error) { return failure((error as Error).message); }
  });

  register('find_streaming_teams', {
    title: 'Best NHL schedules to stream',
    description: `Ranks NHL teams by schedule for streaming over a date range: most games, and most of them on off-nights (${OFF_NIGHT_MAX_GAMES} or fewer NHL games, when fantasy lineups have open spots). Use for "who should I stream this week/next 2 weeks", "best schedules for pickups", "which team plays Thursday and Sunday". Ranks teams, not players: it doesn't know who's on a user's waiver wire.`,
    inputSchema: {
      start_date: dateField.describe('First day (YYYY-MM-DD). Defaults to today.'),
      days: z.number().int().min(1).max(45).optional().describe('How many days, 1 to 45. Defaults to 7.'),
      limit: z.number().int().min(1).max(32).optional().describe('How many teams to return. Defaults to 10.'),
    },
    outputSchema: { start: z.string(), end: z.string(), nights: anyRows, teams: anyRows, dataAsOf: z.string().nullable(), moreAt: z.string() },
    annotations: READ_ONLY,
    _meta: scheduleCardToolMeta('Ranking NHL schedules…', 'Schedules ranked'),
  }, async ({ start_date, days, limit }) => {
    try {
      const window = resolveWindow({ start: start_date, days });
      const schedule = loadSchedule();
      const teams = teamsBetween(schedule, window.start, window.end).slice(0, limit ?? 10);
      const nights = nightsBetween(schedule, window.start, window.end);
      const offNights = nights.filter((night) => night.kind === 'off-night');
      return result({ start: window.start, end: window.end, nights, teams }, [
        `Best schedules from ${shortDate(window.start)} to ${shortDate(window.end)}:`,
        ...teams.map((team, index) => `${index + 1}. ${teamLine(team)} (${team.dates.map((date) => shortDate(date).split(',')[0]).join(', ')})`),
        `Off-nights in the window: ${offNights.map((night) => `${shortDate(night.date)} (${night.games})`).join(', ') || 'none'}.`,
      ], `${SITE}/season?start=${window.start}`);
    } catch (error) { return failure((error as Error).message); }
  });

  register('get_team_schedule', {
    title: "An NHL team's upcoming games",
    description: "One NHL team's games over a date range: opponents, home or away, start times (Eastern), back-to-backs, and whether each game falls on an off-night. Use for \"when do the Canucks play next\", \"does Toronto play Sunday\", \"how many games do the Oilers have this week\".",
    inputSchema: {
      team: z.string().min(2).describe('Team name, nickname or abbreviation, e.g. "Canucks", "Vancouver", "VAN".'),
      start_date: dateField.describe('First day (YYYY-MM-DD). Defaults to today.'),
      days: z.number().int().min(1).max(45).optional().describe('How many days, 1 to 45. Defaults to 14.'),
    },
    outputSchema: { team: z.string(), teamName: z.string(), start: z.string(), end: z.string(), games: anyRows, dataAsOf: z.string().nullable(), moreAt: z.string() },
    annotations: READ_ONLY,
  }, async ({ team, start_date, days }) => {
    try {
      const code = resolveTeam(team);
      if (!code) return failure(`I couldn't match "${team}" to an NHL team. Try a nickname like "Canucks" or an abbreviation like "VAN".`);
      const window = resolveWindow({ start: start_date, days: days ?? 14 });
      const games = teamSchedule(loadSchedule(), code, window.start, window.end);
      return result({ team: code, teamName: TEAMS[code].name, start: window.start, end: window.end, games }, [
        `${TEAMS[code].name}: ${games.length} game${games.length === 1 ? '' : 's'} from ${shortDate(window.start)} to ${shortDate(window.end)}.`,
        ...games.map((game) => `${shortDate(game.date)}: ${game.home ? 'vs' : '@'} ${game.opponentName}${game.startTimeEastern ? `, ${game.startTimeEastern}` : ''}${game.offNight ? ' (off-night)' : ''}${game.backToBack ? ' (back-to-back)' : ''}`),
      ], `${SITE}/season`);
    } catch (error) { return failure((error as Error).message); }
  });

  register('find_schedule_pairs', {
    title: 'NHL teams whose schedules fit together',
    description: 'Finds pairs of NHL teams that play on different nights, so players from both rarely compete for the same lineup spot. With a team, finds the best partners for it. Use for "which team pairs best with my Canucks", "two teams to stream together", "who plays on the nights Toronto doesn\'t".',
    inputSchema: {
      team: z.string().optional().describe('Optional team to find partners for (name, nickname or abbreviation).'),
      start_date: dateField.describe('First day (YYYY-MM-DD). Defaults to today.'),
      days: z.number().int().min(1).max(45).optional().describe('How many days, 1 to 45. Defaults to 14.'),
    },
    outputSchema: { start: z.string(), end: z.string(), team: z.string().nullable(), pairs: anyRows, dataAsOf: z.string().nullable(), moreAt: z.string() },
    annotations: READ_ONLY,
  }, async ({ team, start_date, days }) => {
    try {
      const code = team ? resolveTeam(team) : null;
      if (team && !code) return failure(`I couldn't match "${team}" to an NHL team.`);
      const window = resolveWindow({ start: start_date, days: days ?? 14 });
      const pairs = schedulePairs(loadSchedule(), window.start, window.end, code);
      return result({ start: window.start, end: window.end, team: code, pairs }, [
        `${code ? `Best partners for the ${TEAMS[code].name}` : 'Best-fitting team pairs'}, ${shortDate(window.start)} to ${shortDate(window.end)} (nights covered / same-night clashes / off-nights covered):`,
        ...pairs.map((pair, index) => `${index + 1}. ${pair.names.join(' + ')}: ${pair.nightsCovered} nights, ${pair.clashes} clash${pair.clashes === 1 ? '' : 'es'}, ${pair.offNightsCovered} off-nights`),
      ], `${SITE}/optimizer`);
    } catch (error) { return failure((error as Error).message); }
  });

  register('rank_fantasy_playoff_schedules', {
    title: 'Fantasy playoff schedule rankings',
    description: `Ranks all 32 NHL teams by games, then off-night games, in the fantasy playoffs. Defaults to ${SEASON.defaultFantasyPlayoffsStart} to ${SEASON.regularSeasonEnd} (the usual fantasy playoff weeks); pass dates for a league with different playoff weeks. Use for "best fantasy playoff schedule", "who plays the most games in the fantasy playoffs", trade-deadline schedule questions.`,
    inputSchema: { start_date: dateField.describe('Playoffs start (YYYY-MM-DD).'), end_date: dateField.describe('Playoffs end (YYYY-MM-DD).') },
    outputSchema: { start: z.string(), end: z.string(), teams: anyRows, dataAsOf: z.string().nullable(), moreAt: z.string() },
    annotations: READ_ONLY,
  }, async ({ start_date, end_date }) => {
    try {
      const window = resolveWindow({ start: start_date ?? SEASON.defaultFantasyPlayoffsStart, end: end_date ?? SEASON.regularSeasonEnd, days: 45 });
      // Over a multi-week playoff window extra games outweigh the off-night share, so rank by
      // games, then off-night games (the weekly tools use the site's blended score).
      const teams = teamsBetween(loadSchedule(), window.start, window.end)
        .sort((a, b) => b.games - a.games || b.offNightGames - a.offNightGames || b.score - a.score);
      return result({ start: window.start, end: window.end, teams }, [
        `Fantasy playoff schedules, ${shortDate(window.start)} to ${shortDate(window.end)}:`,
        ...teams.slice(0, 10).map((team, index) => `${index + 1}. ${teamLine(team)}`),
        `Fewest games: ${teams.slice(-3).map((team) => `${team.name} (${team.games})`).join(', ')}.`,
      ], `${SITE}/blog/2026-27-fantasy-hockey-playoff-schedule-rankings`);
    } catch (error) { return failure((error as Error).message); }
  });

  register('check_roster_schedule', {
    title: "Check a roster's schedule against a lineup",
    description: `Takes a list of NHL player names (a fantasy roster) and, night by night, counts how many play, how many a lineup can start, how many games get stuck on the bench, and how many lineup spots sit empty (nights to stream). Default lineup is ${Object.entries(DEFAULT_LINEUP).map(([slot, count]) => `${count} ${slot}`).join(', ')}; pass the league's slots if different. Use for "check my roster this week", "will I have bench problems", "which nights should I stream". It counts games, not fantasy points, and uses NHL positions (a platform's eligibility can differ).`,
    inputSchema: {
      players: z.array(z.string().min(2)).min(1).max(30).describe('Player names. Add a team or position in parentheses to pick between namesakes, e.g. "Elias Pettersson (VAN, C)".'),
      start_date: dateField.describe('First day (YYYY-MM-DD). Defaults to today.'),
      days: z.number().int().min(1).max(45).optional().describe('How many days, 1 to 45. Defaults to 7.'),
      lineup: z.object({ C: z.number().int().min(0).max(6).optional(), LW: z.number().int().min(0).max(6).optional(), RW: z.number().int().min(0).max(6).optional(), F: z.number().int().min(0).max(9).optional(), D: z.number().int().min(0).max(8).optional(), UTIL: z.number().int().min(0).max(6).optional(), G: z.number().int().min(0).max(4).optional() }).optional().describe('Active lineup spots per position, e.g. {"C":2,"LW":2,"RW":2,"D":4,"UTIL":1,"G":2}.'),
    },
    outputSchema: { start: z.string(), end: z.string(), lineup: z.record(z.string(), z.number()), matched: anyRows, unmatched: anyRows, totals: z.record(z.string(), z.number()), perNight: anyRows, perPlayer: anyRows, bestNightsToStream: anyRows, dataAsOf: z.string().nullable(), moreAt: z.string() },
    annotations: READ_ONLY,
    _meta: scheduleCardToolMeta('Checking your roster against the schedule…', 'Roster checked'),
  }, async ({ players, start_date, days, lineup }) => {
    try {
      const window = resolveWindow({ start: start_date, days });
      const slots: LineupSlots = lineup && Object.values(lineup).some((count) => Number(count ?? 0) > 0) ? lineup : { ...DEFAULT_LINEUP };
      const matches = matchPlayers(players);
      const roster = matches.flatMap((match) => (match.player ? [match.player] : []));
      const unmatched = matches.filter((match) => !match.player).map((match) => ({ input: match.input, candidates: match.candidates ?? [] }));
      if (!roster.length) return failure(`None of those names matched an NHL player. ${unmatched.map((item) => item.candidates.length ? `"${item.input}" could be ${item.candidates.map((c) => `${c.name} (${c.team}, ${c.pos.join('/')})`).join(' or ')}` : `"${item.input}" wasn't found`).join('; ')}.`);
      const check = rosterCheck(loadSchedule(), roster, slots, window.start, window.end);
      const crowded = check.perNight.filter((night) => night.benchedGames > 0);
      return result({ start: window.start, end: window.end, lineup: slots as Record<string, number>, matched: roster.map((player) => ({ name: player.name, team: player.team, positions: player.pos })), unmatched, ...check }, [
        `${roster.length} players, ${shortDate(window.start)} to ${shortDate(window.end)}: ${check.totals.games} games, ${check.totals.usableGames} fit the lineup, ${check.totals.benchedGames} stuck on the bench.`,
        crowded.length ? `Crowded nights: ${crowded.map((night) => `${shortDate(night.date)} (${night.playing.length} playing, ${night.benchedGames} sit)`).join('; ')}.` : 'No crowded nights: every game fits.',
        check.bestNightsToStream.length ? `Room to stream: ${check.bestNightsToStream.map((night) => `${shortDate(night.date)} (${night.emptySeats} open, ${night.leagueGames} NHL games)`).join('; ')}.` : 'No open lineup spots on game nights.',
        unmatched.length ? `Not matched: ${unmatched.map((item) => item.candidates.length ? `"${item.input}" (could be ${item.candidates.map((c) => `${c.name} (${c.team}, ${c.pos.join('/')})`).join(' or ')}; add the team and position in parentheses)` : `"${item.input}"`).join('; ')}.` : '',
      ].filter(Boolean), `${SITE}/team?setup=import`);
    } catch (error) { return failure((error as Error).message); }
  });

  return server;
}


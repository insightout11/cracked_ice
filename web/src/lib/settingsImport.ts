import type { LeagueWorkspace } from './leagueWorkspace';

/**
 * Reads text copied from Yahoo's league "Scoring & Settings" page (select all, copy):
 * one "Setting<TAB>Value" row per setting, then stat categories with their points.
 * Everything the site needs to set a league up comes from here and the Starting
 * Rosters page, so a new manager pastes two pages instead of filling in forms.
 */
export interface YahooLeagueSettings {
  leagueId: string | null;
  leagueName: string | null;
  maxTeams: number | null;
  /** "Head-to-Head - Points", "Head-to-Head - Categories", "Rotisserie", … */
  scoringType: string | null;
  points: boolean;
  addsPerWeek: number | null;
  addsPerSeason: number | null;
  /** Days a dropped player sits on waivers. */
  waiverDays: number | null;
  /** Lineups set daily, or locked for the week. */
  lockingMode: 'daily' | 'weekly' | null;
  slots: Record<string, number>;
  playoffs: { start: string; end: string } | null;
  skater: Record<string, number>;
  goalie: Record<string, number>;
  /** Scored categories the site has no per-game count for (they score nothing here). */
  unsupported: string[];
}

const SKATER_STATS: Record<string, string> = {
  G: 'goals', A: 'assists', P: 'points', '+/-': 'plus_minus', PIM: 'penalty_minutes',
  PPG: 'power_play_goals', PPA: 'power_play_assists', PPP: 'power_play_points',
  SHG: 'shorthanded_goals', SHA: 'shorthanded_assists', SHP: 'shorthanded_points',
  GWG: 'game_winning_goals', SOG: 'shots_on_goal', HIT: 'hits', BLK: 'blocks',
  FW: 'faceoffs_won', FL: 'faceoffs_lost',
};
const GOALIE_STATS: Record<string, string> = {
  W: 'wins', L: 'losses', OTL: 'overtime_losses', SV: 'saves', SA: 'shots_against',
  GA: 'goals_against', SHO: 'shutouts', GS: 'games_started',
};
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const number = (value: string | undefined) => {
  const parsed = Number((value ?? '').replace(/[^0-9.-]/g, ''));
  return value !== undefined && /\d/.test(value) && Number.isFinite(parsed) ? parsed : null;
};

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/** "8 teams - Week 25, 26 and 27 (ends Saturday, Apr 10)": the playoff dates, Monday-start weeks. */
function playoffDates(text: string, seasonEndYear: number): { start: string; end: string } | null {
  const weeks = (text.match(/Week\s+([\d,\sand]+)/i)?.[1].match(/\d+/g) ?? []).length;
  const ends = text.match(/ends\s+\w+,\s*([A-Za-z]{3})[a-z]*\s+(\d{1,2})/i);
  if (!weeks || !ends) return null;
  const month = MONTHS[ends[1].toLowerCase()];
  if (!month) return null;
  const end = `${month >= 7 ? seasonEndYear - 1 : seasonEndYear}-${String(month).padStart(2, '0')}-${ends[2].padStart(2, '0')}`;
  const weekday = new Date(`${end}T00:00:00Z`).getUTCDay();
  const lastMonday = addDays(end, -((weekday + 6) % 7));
  return { start: addDays(lastMonday, -7 * (weeks - 1)), end };
}

export function parseYahooSettings(text: string, seasonEndYear: number): YahooLeagueSettings | null {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\p{Co}/gu, '').trim()).filter(Boolean);
  const value = (label: RegExp) => {
    const line = lines.find((item) => label.test(item));
    return line ? line.replace(label, '').replace(/^[:\s\t]+/, '').trim() : undefined;
  };
  const positions = value(/^Roster Positions:?/i);
  const scoringType = value(/^Scoring Type:?/i) ?? null;
  if (!positions && !scoringType) return null;

  const slots: Record<string, number> = {};
  (positions ?? '').split(',').map((slot) => slot.trim().toUpperCase()).filter(Boolean).forEach((slot) => {
    const key = slot === 'UTIL' ? 'UTIL' : slot;
    slots[key] = (slots[key] ?? 0) + 1;
  });

  const skater: Record<string, number> = {};
  const goalie: Record<string, number> = {};
  const unsupported: string[] = [];
  let section: 'skater' | 'goalie' | null = null;
  lines.forEach((line) => {
    if (/Stat Category/i.test(line)) { section = /Goaltend|Goalie/i.test(line) ? 'goalie' : 'skater'; return; }
    if (!section) return;
    const stat = line.match(/^(.+?)\s*\(([^)]+)\)\s*\t?\s*(-?\d*\.?\d+)\s*$/);
    if (!stat) return;
    const abbreviation = stat[2].trim().toUpperCase();
    const points = Number(stat[3]);
    const key = (section === 'goalie' ? GOALIE_STATS : SKATER_STATS)[abbreviation];
    if (key) (section === 'goalie' ? goalie : skater)[key] = points;
    else unsupported.push(`${stat[1].trim()} (${abbreviation})`);
  });

  const deadline = value(/^Weekly Deadline:?/i);
  return {
    leagueId: value(/^League ID#?:?/i)?.match(/\d+/)?.[0] ?? null,
    leagueName: value(/^League Name:?/i) || null,
    maxTeams: number(value(/^Max Teams:?/i)),
    scoringType,
    points: !scoringType || /points/i.test(scoringType),
    addsPerWeek: number(value(/^Max Acquisitions per Week:?/i)),
    addsPerSeason: number(value(/^Max Acquisitions for Entire Season:?/i)),
    waiverDays: number(value(/^Waiver Time:?/i)),
    lockingMode: deadline ? (/daily/i.test(deadline) ? 'daily' : 'weekly') : null,
    slots,
    playoffs: playoffDates(value(/^Playoffs:?/i) ?? '', seasonEndYear),
    skater,
    goalie,
    unsupported,
  };
}

/**
 * Sets the league up from its Yahoo settings: scoring, lineup spots, add limit, waivers,
 * lineup locking, playoff dates and the league id (for one-tap links to Yahoo pages).
 * The team count comes from pasted rosters when there are some (Max Teams is a ceiling).
 */
export function applyYahooSettings(workspace: LeagueWorkspace, settings: YahooLeagueSettings, now: string): LeagueWorkspace {
  const hasScoring = Object.keys(settings.skater).length > 0 || Object.keys(settings.goalie).length > 0;
  const weekly = settings.addsPerWeek !== null;
  const limit = settings.addsPerWeek ?? settings.addsPerSeason;
  const rosterTeams = workspace.leagueRosters?.teams.length ?? 0;
  const teams = rosterTeams >= 2 ? rosterTeams : settings.maxTeams;
  return {
    ...workspace,
    name: settings.leagueName && /^(My League|League \d+|Chesterfield League)$/i.test(workspace.name) ? settings.leagueName.slice(0, 80) : workspace.name,
    platform: workspace.platform === 'manual' ? 'yahoo' : workspace.platform,
    providerLeagueId: settings.leagueId ?? workspace.providerLeagueId,
    numberOfTeams: teams && teams >= 2 && teams <= 32 ? teams : workspace.numberOfTeams,
    scoring: hasScoring
      ? { presetId: 'custom', label: settings.leagueName ?? 'Yahoo league scoring', skater: { ...settings.skater }, goalie: { ...settings.goalie }, updatedAt: now }
      : workspace.scoring,
    rosterRules: {
      ...workspace.rosterRules,
      slots: Object.keys(settings.slots).length ? { ...settings.slots } : workspace.rosterRules.slots,
      lockingMode: settings.lockingMode ?? workspace.rosterRules.lockingMode,
    },
    acquisitions: {
      ...workspace.acquisitions,
      ...(limit !== null ? { limit, period: weekly ? 'week' as const : 'season' as const } : {}),
      ...(settings.waiverDays !== null ? { waiverDelayDays: Math.min(7, Math.max(0, Math.round(settings.waiverDays))) } : {}),
    },
    schedule: settings.playoffs ? { ...workspace.schedule, playoffs: settings.playoffs } : workspace.schedule,
    updatedAt: now,
  };
}

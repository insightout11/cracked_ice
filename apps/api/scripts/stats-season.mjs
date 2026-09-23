/**
 * When the nightly hydrate switches to the new season's stats, and how much
 * current-season data it requires before publishing.
 *
 * - Stats stay on the previous season until the day after opening night: the
 *   morning run on opening day would otherwise find no games played at all.
 * - For the first week, few players have played (opening night has 10 of 32
 *   teams), so the usable-stats floor drops from 50% to 5%. That still rejects a
 *   broken download while letting the early-season data publish.
 */

export const USABLE_STATS_FLOOR = 0.5;
export const OPENING_WEEK_USABLE_STATS_FLOOR = 0.05;
const DAY_MS = 24 * 60 * 60 * 1000;

function previousSeason(season) {
  const startYear = Number(String(season).slice(0, 4));
  if (!/^\d{8}$/.test(String(season)) || !Number.isFinite(startYear)) return season;
  return `${startYear - 1}${startYear}`;
}

function seasonStartMs(config) {
  return config?.regularSeasonStart ? Date.parse(`${config.regularSeasonStart}T00:00:00Z`) : NaN;
}

/** The season whose stats to fetch: the previous one until the day after opening night. */
export function resolveStatsSeason(requestedSeason, config, now = new Date()) {
  const start = seasonStartMs(config);
  if (config?.seasonId === requestedSeason && Number.isFinite(start) && now.getTime() < start + DAY_MS) {
    return previousSeason(requestedSeason);
  }
  return requestedSeason;
}

/** Share of players that must have current-season stats for the snapshot to publish. */
export function minUsableStatsRatio(config, now = new Date()) {
  const start = seasonStartMs(config);
  if (!Number.isFinite(start)) return USABLE_STATS_FLOOR;
  const elapsed = now.getTime() - start;
  return elapsed >= 0 && elapsed < 8 * DAY_MS ? OPENING_WEEK_USABLE_STATS_FLOOR : USABLE_STATS_FLOOR;
}

/** The 8-digit season id at the end of a stats file's source label. */
export function seasonIdOf(source) {
  return String(source ?? '').match(/(\d{8})$/)?.[1] ?? null;
}

/** F, D or G from a directory player's positions. */
export function positionGroupOf(positions) {
  const list = Array.isArray(positions) ? positions.map((position) => String(position).toUpperCase()) : [];
  if (list.includes('G')) return 'G';
  if (list.length && list.every((position) => position === 'D')) return 'D';
  return 'F';
}

/**
 * Last season's full stat lines to keep alongside the new season's, by player id.
 * On the first run of a new season they come from the previous snapshot (which was
 * last season's); after that they are carried forward, since last season never changes.
 * Only NHL lines are kept: a player needs last season in his NHL career history.
 */
export function priorSeasonLines(previousPayload, season) {
  const lines = new Map();
  const players = previousPayload?.players;
  if (!players) return lines;
  const previousSnapshotSeason = seasonIdOf(previousPayload.source);
  const lastSeason = previousSeason(season);
  for (const [playerId, snapshot] of Object.entries(players)) {
    if (previousSnapshotSeason === lastSeason) {
      if (!snapshot?.careerHistory?.[lastSeason]) continue;
      const skater = snapshot.skaterStats?.gamesPlayed > 0 ? snapshot.skaterStats : undefined;
      const goalie = snapshot.goalieStats?.gamesPlayed > 0 ? snapshot.goalieStats : undefined;
      if (skater || goalie) lines.set(playerId, { priorSeason: lastSeason, priorSkaterStats: skater, priorGoalieStats: goalie });
    } else if (previousSnapshotSeason === season && snapshot?.priorSeason === lastSeason) {
      lines.set(playerId, { priorSeason: lastSeason, priorSkaterStats: snapshot.priorSkaterStats, priorGoalieStats: snapshot.priorGoalieStats });
    }
  }
  return lines;
}

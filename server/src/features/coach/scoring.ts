import { FEATURE_FLAGS } from './constants';
import { FeatureFlags } from './constants';
import type { StatsContext, PlayerStatsSnapshot } from '../../context/stats';
import type { TeamStatsContext } from '../../context/teamStats';
import type { ScheduleContext, GameMeta } from '../../context/schedules';
import { getTeamGameMeta } from '../../context/schedules';
import {
  Player,
  FreeAgent,
  PlayerProjection,
  LeagueProfile,
  SimulationResult,
  SimulationStartRecord,
  SimulationBenchRecord
} from './types';
import { getPresetByName } from './presets';
import { calculateIceRating } from './iceRating';

export interface DateWindow {
  start: string;
  end: string;
}

export function estimateStartsInWindow(
  player: Player | FreeAgent,
  snapshot: PlayerStatsSnapshot | undefined,
  teamGamesInWindow: number,
): number {
  if (!isGoalie(player)) return teamGamesInWindow;
  const priorStarts = snapshot?.goalieStats?.gamesStarted ?? 0;
  const workloadRate = Math.max(0.1, Math.min(0.75, priorStarts / 82));
  return Math.round(teamGamesInWindow * workloadRate);
}

const DEFAULT_PRESET = getPresetByName('Default');
if (!DEFAULT_PRESET) {
  throw new Error('Default scoring preset is missing');
}

type WeightMap = Record<string, number>;

const BASE_SKATER_WEIGHTS = normalizeSkaterWeightMap(DEFAULT_PRESET.skater_scoring ?? {});
const BASE_GOALIE_WEIGHTS = normalizeGoalieWeightMap(DEFAULT_PRESET.goalie_scoring ?? {});

const fppgDistributionCache = new Map<string, number[]>();
const playerSosCache = new WeakMap<
  ScheduleContext,
  WeakMap<TeamStatsContext, Map<string, { normalized: number; ui: number }>>
>();

function getFppgDistribution(
  statsContext: StatsContext | null | undefined,
  league: LeagueProfile | null | undefined,
  goalie: boolean,
): number[] {
  if (!statsContext || statsContext.players.size === 0) return [];
  const cacheKey = JSON.stringify({
    generatedAt: statsContext.meta.generatedAt,
    count: statsContext.meta.playerCount,
    goalie,
    skater: resolveSkaterWeights(league),
    goalieWeights: resolveGoalieWeights(league),
  });
  const cached = fppgDistributionCache.get(cacheKey);
  if (cached) return cached;

  const uniqueSnapshots = new Set(statsContext.players.values());
  const values = Array.from(uniqueSnapshots)
    .filter((snapshot) => goalie ? Boolean(snapshot.goalieStats) : Boolean(snapshot.skaterStats))
    .map((snapshot) => computeWindowFppg(snapshot, league, 'season'))
    .filter((result) => result.hasData && result.value > 0)
    .map((result) => result.value)
    .sort((a, b) => a - b);

  if (fppgDistributionCache.size >= 20) {
    const oldestKey = fppgDistributionCache.keys().next().value;
    if (oldestKey) fppgDistributionCache.delete(oldestKey);
  }
  fppgDistributionCache.set(cacheKey, values);
  return values;
}

function percentileRank(values: number[], value: number): number | undefined {
  if (values.length < 10 || value <= 0) return undefined;
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= value) low = middle + 1;
    else high = middle;
  }
  const atOrBelow = low;
  return Number((atOrBelow / values.length).toFixed(3));
}

function normalizeSkaterWeightKey(key: string): string {
  if (key === 'power_play_points') {
    return 'powerplay_points';
  }
  return key;
}

function normalizeSkaterWeightMap(source: Record<string, number | undefined>): WeightMap {
  const result: WeightMap = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'number') continue;
    result[normalizeSkaterWeightKey(key)] = value;
  }
  return result;
}

function normalizeGoalieWeightMap(source: Record<string, number | undefined>): WeightMap {
  const result: WeightMap = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'number') continue;
    result[key] = value;
  }
  return result;
}

function resolveSkaterWeights(league?: LeagueProfile | null): WeightMap {
  const hasExplicitWeights = league?.scoring_weights !== undefined || league?.skater_scoring !== undefined;
  const weights: WeightMap = hasExplicitWeights ? {} : { ...BASE_SKATER_WEIGHTS };

  if (league?.scoring_weights) {
    for (const [key, value] of Object.entries(league.scoring_weights)) {
      if (typeof value !== 'number') continue;
      weights[normalizeSkaterWeightKey(key)] = value;
    }
  }

  if (league?.skater_scoring) {
    for (const [key, value] of Object.entries(league.skater_scoring)) {
      if (typeof value !== 'number') continue;
      weights[normalizeSkaterWeightKey(key)] = value;
    }
  }

  return weights;
}

function resolveGoalieWeights(league?: LeagueProfile | null): WeightMap {
  const weights: WeightMap = league?.goalie_scoring !== undefined ? {} : { ...BASE_GOALIE_WEIGHTS };

  if (league?.goalie_scoring) {
    for (const [key, value] of Object.entries(league.goalie_scoring)) {
      if (typeof value !== 'number') continue;
      weights[key] = value;
    }
  }

  return weights;
}

function getWeight(weights: WeightMap, key: string, ...aliases: string[]): number {
  const value = weights[key];
  if (typeof value === 'number') {
    return value;
  }
  for (const alias of aliases) {
    const aliasValue = weights[alias];
    if (typeof aliasValue === 'number') {
      return aliasValue;
    }
  }
  return 0;
}

function calculateSkaterFppg(
  player: Player | FreeAgent,
  league: LeagueProfile | null | undefined,
  statsContext?: StatsContext | null
): number {
  const weights = resolveSkaterWeights(league);
  // Try both ID formats: numeric-only and with "nhl:" prefix
  const record = statsContext?.players.get(player.id)?.skaterStats ||
                 statsContext?.players.get(`nhl:${player.id}`)?.skaterStats;
  const gamesPlayed = record?.gamesPlayed ?? player.games_played ?? 0;

  if (gamesPlayed <= 0) {
    return 0;
  }

  const goals = record?.goals ?? player.stats.goals ?? 0;
  const assists = record?.assists ?? player.stats.assists ?? 0;
  const points = record?.points ?? (goals + assists);
  const shots = record?.shots ?? player.stats.shots_on_goal ?? 0;
  const blocks = record?.blocks ?? player.stats.blocks ?? 0;
  const powerPlayPoints = record?.ppPoints ?? player.stats.power_play_points ?? 0;
  const shorthandedGoals = record?.shGoals ?? player.stats.shorthanded_goals ?? 0;
  const shorthandedAssists = record?.shAssists ?? player.stats.shorthanded_assists ?? 0;
  const gameWinners = record?.gameWinningGoals ?? player.stats.game_winning_goals ?? 0;
  const hits = record?.hits ?? player.stats.hits ?? 0;
  const plusMinus = record?.plusMinus ?? 0;
  const ppGoals = record?.ppGoals ?? 0;
  const ppAssists = record?.ppAssists ?? 0;
  const shPoints = record?.shPoints ?? 0;

  const total =
    goals * getWeight(weights, 'goals') +
    assists * getWeight(weights, 'assists') +
    points * getWeight(weights, 'points') +
    shots * getWeight(weights, 'shots_on_goal') +
    powerPlayPoints * getWeight(weights, 'powerplay_points', 'power_play_points') +
    shorthandedGoals * getWeight(weights, 'shorthanded_goals') +
    shorthandedAssists * getWeight(weights, 'shorthanded_assists') +
    gameWinners * getWeight(weights, 'game_winning_goals') +
    hits * getWeight(weights, 'hits') +
    blocks * getWeight(weights, 'blocks') +
    plusMinus * getWeight(weights, 'plus_minus') +
    ppGoals * getWeight(weights, 'powerplay_goals', 'power_play_goals') +
    ppAssists * getWeight(weights, 'powerplay_assists', 'power_play_assists') +
    shPoints * getWeight(weights, 'shorthanded_points');

  return Number((total / gamesPlayed).toFixed(2));
}

function calculateGoalieFppg(
  player: Player | FreeAgent,
  league: LeagueProfile | null | undefined,
  statsContext?: StatsContext | null
): number {
  const weights = resolveGoalieWeights(league);
  // Try both ID formats: numeric-only and with "nhl:" prefix
  const record = statsContext?.players.get(player.id)?.goalieStats ||
                 statsContext?.players.get(`nhl:${player.id}`)?.goalieStats;
  const gamesPlayed = record?.gamesPlayed ?? player.games_played ?? 0;

  if (!record || gamesPlayed <= 0) {
    return 0;
  }

  const wins = record.wins ?? 0;
  const losses = record.losses ?? 0;
  const overtimeLosses = record.overtimeLosses ?? 0;
  // Use || instead of ?? for saves because 0 is a valid but incorrect value that needs fallback
  const saves = record.saves || ((record.shotsAgainst ?? 0) - (record.goalsAgainst ?? 0));
  const goalsAgainst = record.goalsAgainst ?? 0;
  const shutouts = record.shutouts ?? 0;
  const gamesStarted = record.gamesStarted ?? 0;

  const total =
    wins * getWeight(weights, 'wins') +
    losses * getWeight(weights, 'losses') +
    overtimeLosses * getWeight(weights, 'overtime_losses', 'otl', 'ot_losses') +
    saves * getWeight(weights, 'saves') +
    shutouts * getWeight(weights, 'shutouts') +
    goalsAgainst * getWeight(weights, 'goals_against') +
    gamesStarted * getWeight(weights, 'games_started');

  return Number((total / gamesPlayed).toFixed(2));
}

export function calculatePlayerFppg(
  player: Player | FreeAgent,
  league: LeagueProfile | null | undefined,
  statsContext?: StatsContext | null
): number {
  if (isGoalie(player)) {
    return calculateGoalieFppg(player, league, statsContext);
  }
  return calculateSkaterFppg(player, league, statsContext);
}

// Helper functions to calculate FPPG from raw stats objects
export function calculateFppgFromSkaterStats(
  stats: import('../../context/stats').SkaterStats | undefined,
  league: LeagueProfile | null | undefined
): number {
  if (!stats || stats.gamesPlayed <= 0) return 0;

  const weights = resolveSkaterWeights(league);
  // Extract ALL possible skater stats (matching calculateSkaterFppg exactly)
  const goals = stats.goals ?? 0;
  const assists = stats.assists ?? 0;
  const points = stats.points ?? (goals + assists);
  const shots = stats.shots ?? 0;
  const blocks = stats.blocks ?? 0;
  const powerPlayPoints = stats.ppPoints ?? 0;
  const shorthandedGoals = stats.shGoals ?? 0;
  const shorthandedAssists = stats.shAssists ?? 0;
  const gameWinners = stats.gameWinningGoals ?? 0;
  const hits = stats.hits ?? 0;
  const plusMinus = stats.plusMinus ?? 0;
  const ppGoals = stats.ppGoals ?? 0;
  const ppAssists = stats.ppAssists ?? 0;
  const shPoints = stats.shPoints ?? 0;

  // Calculate total using ALL stats (getWeight returns 0 for missing weights)
  const total =
    goals * getWeight(weights, 'goals') +
    assists * getWeight(weights, 'assists') +
    points * getWeight(weights, 'points') +
    shots * getWeight(weights, 'shots_on_goal') +
    powerPlayPoints * getWeight(weights, 'powerplay_points', 'power_play_points') +
    shorthandedGoals * getWeight(weights, 'shorthanded_goals') +
    shorthandedAssists * getWeight(weights, 'shorthanded_assists') +
    gameWinners * getWeight(weights, 'game_winning_goals') +
    hits * getWeight(weights, 'hits') +
    blocks * getWeight(weights, 'blocks') +
    plusMinus * getWeight(weights, 'plus_minus') +
    ppGoals * getWeight(weights, 'powerplay_goals', 'power_play_goals') +
    ppAssists * getWeight(weights, 'powerplay_assists', 'power_play_assists') +
    shPoints * getWeight(weights, 'shorthanded_points');

  return Number((total / stats.gamesPlayed).toFixed(2));
}

export function calculateFppgFromGoalieStats(
  stats: import('../../context/stats').GoalieStats | undefined,
  league: LeagueProfile | null | undefined
): number {
  if (!stats || stats.gamesPlayed <= 0) return 0;

  const weights = resolveGoalieWeights(league);
  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const overtimeLosses = stats.overtimeLosses ?? 0;
  const saves = stats.saves || ((stats.shotsAgainst ?? 0) - (stats.goalsAgainst ?? 0));
  const goalsAgainst = stats.goalsAgainst ?? 0;
  const shutouts = stats.shutouts ?? 0;
  const gamesStarted = stats.gamesStarted ?? 0;

  const total =
    wins * getWeight(weights, 'wins') +
    losses * getWeight(weights, 'losses') +
    overtimeLosses * getWeight(weights, 'overtime_losses', 'otl', 'ot_losses') +
    saves * getWeight(weights, 'saves') +
    shutouts * getWeight(weights, 'shutouts') +
    goalsAgainst * getWeight(weights, 'goals_against') +
    gamesStarted * getWeight(weights, 'games_started');

  return Number((total / stats.gamesPlayed).toFixed(2));
}

export interface FppgContribution {
  key: string;
  stat: number;
  weight: number;
  fantasyPoints: number;
  fppg: number;
}

export interface FppgBreakdown {
  gamesPlayed: number;
  fppg: number;
  contributions: FppgContribution[];
}

function buildFppgBreakdown(
  gamesPlayed: number,
  categories: Array<{ key: string; stat: number; weight: number }>,
): FppgBreakdown {
  const contributions = categories
    .filter(({ weight }) => weight !== 0)
    .map(({ key, stat, weight }) => {
      const fantasyPoints = stat * weight;
      return {
        key,
        stat,
        weight,
        fantasyPoints: Number(fantasyPoints.toFixed(2)),
        fppg: Number((fantasyPoints / gamesPlayed).toFixed(2)),
      };
    });
  const total = contributions.reduce((sum, contribution) => sum + contribution.fantasyPoints, 0);
  return { gamesPlayed, fppg: Number((total / gamesPlayed).toFixed(2)), contributions };
}

export function calculateSkaterFppgBreakdown(
  stats: import('../../context/stats').SkaterStats | undefined,
  league: LeagueProfile | null | undefined,
): FppgBreakdown | null {
  if (!stats || stats.gamesPlayed <= 0) return null;
  const weights = resolveSkaterWeights(league);
  const goals = stats.goals ?? 0;
  const assists = stats.assists ?? 0;
  return buildFppgBreakdown(stats.gamesPlayed, [
    { key: 'goals', stat: goals, weight: getWeight(weights, 'goals') },
    { key: 'assists', stat: assists, weight: getWeight(weights, 'assists') },
    { key: 'points', stat: stats.points ?? goals + assists, weight: getWeight(weights, 'points') },
    { key: 'shots_on_goal', stat: stats.shots ?? 0, weight: getWeight(weights, 'shots_on_goal') },
    { key: 'power_play_points', stat: stats.ppPoints ?? 0, weight: getWeight(weights, 'powerplay_points', 'power_play_points') },
    { key: 'power_play_goals', stat: stats.ppGoals ?? 0, weight: getWeight(weights, 'powerplay_goals', 'power_play_goals') },
    { key: 'power_play_assists', stat: stats.ppAssists ?? 0, weight: getWeight(weights, 'powerplay_assists', 'power_play_assists') },
    { key: 'shorthanded_goals', stat: stats.shGoals ?? 0, weight: getWeight(weights, 'shorthanded_goals') },
    { key: 'shorthanded_assists', stat: stats.shAssists ?? 0, weight: getWeight(weights, 'shorthanded_assists') },
    { key: 'shorthanded_points', stat: stats.shPoints ?? 0, weight: getWeight(weights, 'shorthanded_points') },
    { key: 'game_winning_goals', stat: stats.gameWinningGoals ?? 0, weight: getWeight(weights, 'game_winning_goals') },
    { key: 'hits', stat: stats.hits ?? 0, weight: getWeight(weights, 'hits') },
    { key: 'blocks', stat: stats.blocks ?? 0, weight: getWeight(weights, 'blocks') },
    { key: 'plus_minus', stat: stats.plusMinus ?? 0, weight: getWeight(weights, 'plus_minus') },
  ]);
}

export function calculateGoalieFppgBreakdown(
  stats: import('../../context/stats').GoalieStats | undefined,
  league: LeagueProfile | null | undefined,
): FppgBreakdown | null {
  if (!stats || stats.gamesPlayed <= 0) return null;
  const weights = resolveGoalieWeights(league);
  const saves = stats.saves || ((stats.shotsAgainst ?? 0) - (stats.goalsAgainst ?? 0));
  return buildFppgBreakdown(stats.gamesPlayed, [
    { key: 'wins', stat: stats.wins ?? 0, weight: getWeight(weights, 'wins') },
    { key: 'losses', stat: stats.losses ?? 0, weight: getWeight(weights, 'losses') },
    { key: 'overtime_losses', stat: stats.overtimeLosses ?? 0, weight: getWeight(weights, 'overtime_losses', 'otl', 'ot_losses') },
    { key: 'saves', stat: saves, weight: getWeight(weights, 'saves') },
    { key: 'goals_against', stat: stats.goalsAgainst ?? 0, weight: getWeight(weights, 'goals_against') },
    { key: 'shutouts', stat: stats.shutouts ?? 0, weight: getWeight(weights, 'shutouts') },
    { key: 'games_started', stat: stats.gamesStarted ?? 0, weight: getWeight(weights, 'games_started') },
  ]);
}

type WindowKey = 'season' | 'last30' | 'last7';

function getWindowStats(
  snapshot: PlayerStatsSnapshot | undefined,
  window: WindowKey
) {
  if (!snapshot) {
    return { skater: undefined, goalie: undefined };
  }

  switch (window) {
    case 'season':
      return { skater: snapshot.skaterStats, goalie: snapshot.goalieStats };
    case 'last30':
      return { skater: snapshot.last30SkaterStats, goalie: snapshot.last30GoalieStats };
    case 'last7':
      return { skater: snapshot.last7SkaterStats, goalie: snapshot.last7GoalieStats };
    default:
      return { skater: undefined, goalie: undefined };
  }
}

function calculateWindowFppg(
  snapshot: PlayerStatsSnapshot | undefined,
  league: LeagueProfile | null | undefined,
  window: WindowKey
): { value: number; hasData: boolean } {
  const { skater, goalie } = getWindowStats(snapshot, window);

  // Check goalie first - players can have both skater and goalie stats,
  // but goalie stats take precedence for goalies
  if (goalie && goalie.gamesPlayed > 0) {
    return {
      value: calculateFppgFromGoalieStats(goalie, league),
      hasData: true
    };
  }

  if (skater && skater.gamesPlayed > 0) {
    const value = calculateFppgFromSkaterStats(skater, league);
    // If skater FPPG is 0 and the player has goalie stats for ANY window,
    // treat this as missing data (likely a goalie with incomplete window stats)
    if (value === 0 && snapshot?.goalieStats && snapshot.goalieStats.gamesPlayed > 0) {
      return { value: 0, hasData: false };
    }
    return {
      value,
      hasData: true
    };
  }

  return { value: 0, hasData: false };
}

export function computeWindowFppg(
  snapshot: PlayerStatsSnapshot | undefined,
  league: LeagueProfile | null | undefined,
  window: WindowKey
): { value: number; hasData: boolean } {
  return calculateWindowFppg(snapshot, league, window);
}
/**
 * Compute off-night rate based on league-wide schedule
 * An "off-night" is when 8 or fewer games are being played (<= 8 games per day)
 */
function computeOffNightRate(
  games: GameMeta[]
): number {
  if (!games.length) return 0;

  // Count games with isOffNight flag set to true
  const offNightCount = games.filter(game => game.isOffNight).length;
  return offNightCount / games.length;
}

function filterDatesWithinWindow(dates: string[], window: DateWindow): string[] {
  return dates.filter((date) => date >= window.start && date <= window.end);
}

function applyFeatureAdjustments(
  player: Player | FreeAgent,
  baseFppg: number,
  featureFlags: FeatureFlags
): number {
  if ('recent_form' in player && player.recent_form && featureFlags.recentFormBoost) {
    const { last5_points, last5_games } = player.recent_form;
    if (last5_games > 0) {
      const recentFppg = last5_points / last5_games;
      return (baseFppg * 0.7) + (recentFppg * 0.3);
    }
  }
  return baseFppg;
}

function normalizePositions(playerPosition: string): string[] {
  return playerPosition
    .split('/')
    .map((pos) => pos.trim().toUpperCase())
    .filter(Boolean)
    .map((pos) => {
      if (pos === 'L') return 'LW';
      if (pos === 'R') return 'RW';
      return pos;
    });
}

function isGoalie(player: Player | FreeAgent): boolean {
  return normalizePositions(player.position).includes('G');
}

function isEligibleForPosition(playerPosition: string, slotPosition: string): boolean {
  const positions = normalizePositions(playerPosition);
  const slot = slotPosition.toUpperCase();
  const isForward = positions.some((pos) => pos === 'C' || pos === 'LW' || pos === 'RW' || pos === 'W' || pos === 'F');
  const isSkater = positions.some((pos) => pos !== 'G');

  switch (slot) {
    case 'F':
      return isForward;
    case 'W':
      return positions.some((pos) => pos === 'LW' || pos === 'RW' || pos === 'W');
    case 'UTIL':
    case 'U':
    case 'FLEX':
      return isSkater;
    case 'D':
      return positions.includes('D');
    case 'G':
      return positions.includes('G');
    default:
      return positions.includes(slot);
  }
}

export function simulateLineup(
  projections: PlayerProjection[],
  window: DateWindow,
  lineupSlots: Record<string, number>
): SimulationResult {
  const startsByPlayer = new Map<string, number>();
  const startRecords: SimulationStartRecord[] = [];
  const benchRecords: SimulationBenchRecord[] = [];
  const unusedSlotsByDate = new Map<string, Record<string, number>>();
  let totalPoints = 0;

  const calendar = buildDateRange(window);

  const activePositions = Object.entries(lineupSlots)
    .filter(([pos, limit]) => {
      const normalized = pos.toUpperCase();
      return (
        limit > 0 &&
        !Number.isNaN(limit) &&
        normalized !== 'BN' &&
        normalized !== 'BENCH' &&
        normalized !== 'IR' &&
        normalized !== 'IR+' &&
        normalized !== 'IR-LT'
      );
    })
    .map(([pos, limit]) => ({ position: pos, limit: Number(limit) }));

  for (const day of calendar) {
    const usedPlayerIds = new Set<string>();
    const remainingSlots = new Map<string, number>();

    for (const { position, limit } of activePositions) {
      remainingSlots.set(position, limit);
    }

    const playersWithGames = projections
      .filter((p) => {
        const slot = p.base.current_slot?.toUpperCase() ?? '';
        const isIrSlot = slot === 'IR' || slot === 'IR+' || slot === 'IR-LT';
        return !isIrSlot && p.upcomingGamesInWindow.includes(day);
      })
      .sort((a, b) => b.fppg - a.fppg || b.projectedPoints - a.projectedPoints);

    for (const player of playersWithGames) {
      if (usedPlayerIds.has(player.base.id)) continue;

      const eligibleSlots = activePositions.filter(({ position }) =>
        (remainingSlots.get(position) ?? 0) > 0 &&
        isEligibleForPosition(player.base.position, position)
      );

      if (eligibleSlots.length > 0) {
        const preferredSlot = eligibleSlots.find(({ position }) => {
          const norm = position.toUpperCase();
          return norm === 'C' || norm === 'LW' || norm === 'RW' || norm === 'D' || norm === 'G';
        }) || eligibleSlots[0];

        const position = preferredSlot.position;
        remainingSlots.set(position, (remainingSlots.get(position) ?? 0) - 1);
        usedPlayerIds.add(player.base.id);
        totalPoints += player.fppg;
        startsByPlayer.set(player.base.id, (startsByPlayer.get(player.base.id) ?? 0) + 1);
        startRecords.push({
          playerId: player.base.id,
          playerName: player.base.full_name,
          position,
          date: day,
          fppg: player.fppg
        });
      } else {
        const positions = normalizePositions(player.base.position);
        const primaryPos = positions[0];
        benchRecords.push({
          playerId: player.base.id,
          playerName: player.base.full_name,
          position: primaryPos,
          date: day,
          fppg: player.fppg,
          reason: 'slot_filled'
        });
      }
    }

    const unusedSlots: Record<string, number> = {};
    for (const { position } of activePositions) {
      const remaining = remainingSlots.get(position) ?? 0;
      if (remaining > 0) {
        unusedSlots[position] = remaining;
      }
    }
    unusedSlotsByDate.set(day, unusedSlots);
  }

  return {
    totalPoints: Number(totalPoints.toFixed(2)),
    startsByPlayer,
    startRecords,
    benchRecords,
    unusedSlotsByDate
  };
}

/**
 * Utility: clamp a value to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute team defense statistics used for SoS calculations
 */
function computeTeamDefenseScore(teamStats: TeamStatsContext): {
  leagueAvgGoalsAgainstPerGame: number;
  byTeamGoalsAgainstPerGame: Map<string, number>;
  leagueAvgGoalsForPerGame: number;
  byTeamGoalsForPerGame: Map<string, number>;
} {
  if (!teamStats.loaded || teamStats.byTeam.size === 0) {
    return {
      leagueAvgGoalsAgainstPerGame: 0,
      byTeamGoalsAgainstPerGame: new Map(),
      leagueAvgGoalsForPerGame: 0,
      byTeamGoalsForPerGame: new Map(),
    };
  }

  const goalsAgainstPerGameValues: number[] = [];
  const byTeamGoalsAgainstPerGame = new Map<string, number>();
  const goalsForPerGameValues: number[] = [];
  const byTeamGoalsForPerGame = new Map<string, number>();

  for (const [teamCode, stat] of teamStats.byTeam.entries()) {
    if (typeof stat.goalsAgainstPerGame === 'number') {
      goalsAgainstPerGameValues.push(stat.goalsAgainstPerGame);
      byTeamGoalsAgainstPerGame.set(teamCode, stat.goalsAgainstPerGame);
    }
    if (typeof stat.goalsForPerGame === 'number') {
      goalsForPerGameValues.push(stat.goalsForPerGame);
      byTeamGoalsForPerGame.set(teamCode, stat.goalsForPerGame);
    }
  }

  const leagueAvgGoalsAgainstPerGame = goalsAgainstPerGameValues.length > 0
    ? goalsAgainstPerGameValues.reduce((sum, val) => sum + val, 0) / goalsAgainstPerGameValues.length
    : 0;
  const leagueAvgGoalsForPerGame = goalsForPerGameValues.length > 0
    ? goalsForPerGameValues.reduce((sum, val) => sum + val, 0) / goalsForPerGameValues.length
    : 0;

  return { leagueAvgGoalsAgainstPerGame, byTeamGoalsAgainstPerGame, leagueAvgGoalsForPerGame, byTeamGoalsForPerGame };
}

/**
 * Calculate rest days for a team before a given game
 * Returns number of days since previous game, or a neutral baseline if no previous game
 */
function calculateRestDays(teamCode: string, gameDate: string, scheduleContext: ScheduleContext | null | undefined): number {
  if (!scheduleContext) {
    return 3; // Neutral baseline
  }

  const allGames = getTeamGameMeta(teamCode, scheduleContext);
  if (allGames.length === 0) {
    return 3;
  }

  // Find the most recent game before this one
  const sortedGames = allGames
    .filter(g => g.date < gameDate)
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending

  if (sortedGames.length === 0) {
    return 3; // First game of season, neutral baseline
  }

  const previousGame = sortedGames[0];
  const daysDiff = Math.round(
    (new Date(gameDate).getTime() - new Date(previousGame.date).getTime()) / (24 * 60 * 60 * 1000)
  );

  return daysDiff;
}

export function calculateOpponentMatchupEase(input: {
  goalie: boolean;
  opponentGoalsForPerGame?: number;
  opponentGoalsAgainstPerGame?: number;
  leagueAvgGoalsForPerGame: number;
  leagueAvgGoalsAgainstPerGame: number;
}): number {
  const opponentRate = input.goalie
    ? input.opponentGoalsForPerGame ?? input.leagueAvgGoalsForPerGame
    : input.opponentGoalsAgainstPerGame ?? input.leagueAvgGoalsAgainstPerGame;
  const leagueRate = input.goalie ? input.leagueAvgGoalsForPerGame : input.leagueAvgGoalsAgainstPerGame;
  if (leagueRate <= 0) return 0;
  return input.goalie
    ? (leagueRate - opponentRate) / leagueRate
    : (opponentRate - leagueRate) / leagueRate;
}

/**
 * Compute per-game SoS score based on opponent defense, home/away, and rest
 * Returns a value in [-0.5, +0.5] where positive = easier matchup
 */
function computeGameSoS(
  offensiveTeam: string,
  game: GameMeta,
  teamDefense: ReturnType<typeof computeTeamDefenseScore>,
  scheduleContext: ScheduleContext | null | undefined,
  goalie: boolean,
): number {
  const { leagueAvgGoalsAgainstPerGame, byTeamGoalsAgainstPerGame, leagueAvgGoalsForPerGame, byTeamGoalsForPerGame } = teamDefense;

  // Skaters benefit from weak opponent defense; goalies benefit from weak
  // opponent offense. These must not share the same opponent metric.
  const defenseRaw = calculateOpponentMatchupEase({
    goalie,
    opponentGoalsForPerGame: byTeamGoalsForPerGame.get(game.opponent),
    opponentGoalsAgainstPerGame: byTeamGoalsAgainstPerGame.get(game.opponent),
    leagueAvgGoalsForPerGame,
    leagueAvgGoalsAgainstPerGame,
  });
  // Amplify by 1.5x to make differences more pronounced
  const defenseComponent = clamp(defenseRaw * 1.5, -0.45, 0.45);

  // 2. Home/away component - slightly increased weight
  const homeComponent = game.isHome ? 0.07 : -0.07;

  // 3. Rest component
  const offensiveRestDays = calculateRestDays(offensiveTeam, game.date, scheduleContext);
  const opponentRestDays = calculateRestDays(game.opponent, game.date, scheduleContext);
  const restDelta = offensiveRestDays - opponentRestDays;
  const restComponent = clamp(restDelta * 0.03, -0.08, 0.08);

  // Combine and clamp to [-0.6, +0.6] for wider range
  const perGameRaw = defenseComponent + homeComponent + restComponent;
  return clamp(perGameRaw, -0.6, 0.6);
}

/**
 * Compute player SoS for a time window
 * Returns { normalized: number (-1 to +1), ui: number (1-10) }
 */
function computePlayerSoS(
  offensiveTeam: string,
  games: GameMeta[],
  teamStats: TeamStatsContext | null | undefined,
  scheduleContext: ScheduleContext | null | undefined,
  goalie: boolean,
): { normalized: number; ui: number } {
  // Edge case: no team stats or no games
  if (!teamStats?.loaded || games.length === 0) {
    return { normalized: 0, ui: 5 };
  }

  const cacheKey = `${goalie ? 'G' : 'S'}|${offensiveTeam}|${games.map((game) => `${game.date}:${game.opponent}`).join(',')}`;
  if (scheduleContext) {
    const cached = playerSosCache.get(scheduleContext)?.get(teamStats)?.get(cacheKey);
    if (cached) return cached;
  }

  const teamDefense = computeTeamDefenseScore(teamStats);

  // Compute per-game SoS for each game
  const gameScores = games.map(game => computeGameSoS(offensiveTeam, game, teamDefense, scheduleContext, goalie));

  // Average across the window
  const sosRaw = gameScores.reduce((sum, score) => sum + score, 0) / gameScores.length;

  // Normalize to [-1, +1] - optimized to spread the distribution better
  // Analysis showed sosRaw typically ranges ±0.19, so divisor of 0.14 expands the range
  const sosNormalized = clamp(sosRaw / 0.14, -1, 1);

  // Convert to UI scale (1-10) with curve to enhance extremes
  // Exponent of 1.2 (vs 0.8) pushes more values toward the edges
  const curved = Math.sign(sosNormalized) * Math.pow(Math.abs(sosNormalized), 1.2);
  const sosUi = Math.round(((curved + 1) / 2) * 9) + 1;

  const result = { normalized: sosNormalized, ui: sosUi };
  if (scheduleContext) {
    let byTeamStats = playerSosCache.get(scheduleContext);
    if (!byTeamStats) {
      byTeamStats = new WeakMap();
      playerSosCache.set(scheduleContext, byTeamStats);
    }
    let byTeamAndWindow = byTeamStats.get(teamStats);
    if (!byTeamAndWindow) {
      byTeamAndWindow = new Map();
      byTeamStats.set(teamStats, byTeamAndWindow);
    }
    byTeamAndWindow.set(cacheKey, result);
  }

  return result;
}

/**
 * DEPRECATED: Old SoS calculation based on fatigue patterns
 * Kept for reference/fallback if needed
 */
function calculateStrengthOfScheduleLegacy(gameDates: string[]): number {
  if (gameDates.length === 0) return 5.0; // Neutral default

  let totalScore = 0;
  const dates = gameDates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let i = 0; i < dates.length; i++) {
    let gameScore = 5.0; // Base neutral score

    // Check for back-to-back (B2B)
    const prevGame = i > 0 ? dates[i - 1] : null;
    const nextGame = i < dates.length - 1 ? dates[i + 1] : null;

    if (prevGame && (dates[i] - prevGame) <= DAY_MS) {
      gameScore -= 0.5; // Harder when your team is on B2B
    }
    if (nextGame && (nextGame - dates[i]) <= DAY_MS) {
      gameScore -= 0.5;
    }

    // Check for 3-in-4 days
    const threeDaysBack = dates.filter(d => d >= dates[i] - 3 * DAY_MS && d <= dates[i]);
    if (threeDaysBack.length >= 3) {
      gameScore -= 0.25;
    }

    // Check for 4-in-6 days
    const sixDaysBack = dates.filter(d => d >= dates[i] - 5 * DAY_MS && d <= dates[i]);
    if (sixDaysBack.length >= 4) {
      gameScore -= 0.25;
    }

    totalScore += gameScore;
  }

  const avgScore = totalScore / dates.length;

  // Normalize to 1.5-9.5 range to avoid extremes
  const normalized = Math.max(1.5, Math.min(9.5, avgScore));

  return Number(normalized.toFixed(1));
}

export function buildProjection(
  player: Player | FreeAgent,
  league: LeagueProfile | null | undefined,
  window: DateWindow,
  statsContext?: StatsContext | null,
  scheduleContext?: ScheduleContext | null,
  teamStatsContext?: TeamStatsContext | null,
  featureFlags: FeatureFlags = FEATURE_FLAGS
): PlayerProjection {
  const baseFppg = calculatePlayerFppg(player, league, statsContext);
  const adjustedFppg = applyFeatureAdjustments(player, baseFppg, featureFlags);

  // Get GameMeta for the player's team games in this window
  const playerTeam = player.team?.toUpperCase() ?? '';
  const allTeamGames = getTeamGameMeta(playerTeam, scheduleContext);
  const availableGames = allTeamGames.length > 0
    ? allTeamGames
    : (player.upcoming_games ?? []).map((date) => ({
        date,
        startTime: '',
        opponent: '',
        isHome: false,
        isOffNight: false,
      }));
  const teamGamesInWindow = availableGames.filter(
    game => game.date >= window.start && game.date <= window.end
  );

  // Use GameMeta objects for off-night calculation
  const offNightRate = computeOffNightRate(teamGamesInWindow);
  const gamesInWindow = teamGamesInWindow.map(game => game.date);
  const snapshot = statsContext?.players.get(player.id) || statsContext?.players.get(`nhl:${player.id}`);
  const expectedStarts = estimateStartsInWindow(player, snapshot, gamesInWindow.length);
  const projectedPoints = adjustedFppg * expectedStarts;
  const goalie = isGoalie(player);

  // Compute new SoS using opponent defense, home/away, and rest
  const { ui: sosUi } = computePlayerSoS(
    playerTeam,
    teamGamesInWindow,
    teamStatsContext,
    scheduleContext,
    goalie,
  );

  // Calculate ICE Score (Impact • Context • Expectation)
  // Get player stats snapshot for window-specific FPPG
  // Calculate window-specific FPPG values
  const seasonResult = computeWindowFppg(snapshot, league, 'season');
  const last30Result = computeWindowFppg(snapshot, league, 'last30');
  const last7Result = computeWindowFppg(snapshot, league, 'last7');

  const seasonFppg = seasonResult.value;
  const last30Fppg = last30Result.hasData ? last30Result.value : seasonFppg;
  const last7Fppg = last7Result.hasData ? last7Result.value : seasonFppg;

  const windowStart = new Date(`${window.start}T00:00:00Z`).getTime();
  const windowEnd = new Date(`${window.end}T00:00:00Z`).getTime();
  const windowDays = Math.max(1, Math.round((windowEnd - windowStart) / (24 * 60 * 60 * 1000)) + 1);
  const recentAdvanced = snapshot?.last7AdvancedStats;
  const seasonAdvanced = snapshot?.advancedStats;
  const iceBreakdown = calculateIceRating({
    seasonFppg,
    last30Fppg,
    last7Fppg,
    hasSeasonSample: seasonResult.hasData,
    hasLast30Sample: last30Result.hasData,
    hasLast7Sample: last7Result.hasData,
    impactPercentile: percentileRank(getFppgDistribution(statsContext, league, goalie), (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2)),
    isGoalie: goalie,
    gamesAvailable: expectedStarts,
    windowDays,
    offNightRate,
    strengthOfSchedule: sosUi,
    seasonToiSeconds: seasonAdvanced?.avgToiPerGame,
    recentToiSeconds: recentAdvanced?.avgToiPerGame,
    seasonPpToiSeconds: seasonAdvanced?.ppTimeOnIcePerGame,
    recentPpToiSeconds: recentAdvanced?.ppTimeOnIcePerGame,
  });
  const iceScore = iceBreakdown.total;

  // Build game details for frontend calendar view
  const gameDetails = teamGamesInWindow.map(game => ({
    date: game.date,
    opponent: game.opponent,
    isHome: game.isHome,
    isOffNight: game.isOffNight,
    startTime: game.startTime
  }));

  return {
    base: player,
    fppg: Number(adjustedFppg.toFixed(2)),
    last30Fppg: Number(last30Fppg.toFixed(2)),
    last7Fppg: Number(last7Fppg.toFixed(2)),
    projectedPoints: Number(projectedPoints.toFixed(2)),
    upcomingGamesInWindow: gamesInWindow,
    gameDetails,
    offNightRate: Number(offNightRate.toFixed(3)),
    strengthOfSchedule: sosUi,
    iceScore,
    iceBreakdown,
  };
}

export function buildDateRange(window: DateWindow): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${window.start}T00:00:00Z`);
  const end = new Date(`${window.end}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}




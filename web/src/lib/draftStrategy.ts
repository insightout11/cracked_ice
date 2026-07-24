import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace, DraftStrategyPresetId } from './leagueWorkspace';
import { DRAFT_STRATEGY_PRESETS } from './leagueWorkspace';
import { buildMatchupWeeks, type SeasonScheduleData } from './schedulePlanning';
import { simulateDailyLineup } from './acquisitionAnalysis';

export type DraftScoreKey = 'production' | 'regularSeason' | 'playoffs' | 'positionValue';

export interface DraftCandidateScore {
  playerId: string;
  total: number;
  components: Record<DraftScoreKey, number>;
  contributions: Record<DraftScoreKey, number>;
  metrics: {
    fppg: number;
    sampleGames: number;
    productionReliability: number;
    regularGames: number;
    regularOffNights: number;
    regularUsableStarts: number;
    playoffGames: number;
    playoffOffNights: number;
    playoffUsableStarts: number;
    playoffWeeks: PlayoffWeekScore[];
    championshipWeek: PlayoffWeekScore;
    valueOverReplacement: number;
  };
}

export interface PlayoffWeekScore {
  index: number;
  label: string;
  start: string;
  end: string;
  games: number;
  offNights: number;
  usableStarts: number;
  isChampionship: boolean;
}

export interface DraftStrategyComparison {
  strategyLabel: string;
  winnerId: string | null;
  verdict: string;
  explanation: string;
  optionA: DraftCandidateScore;
  optionB: DraftCandidateScore;
}

export interface RankedDraftCandidate {
  player: DraftPlayer;
  score: DraftCandidateScore;
}

const COMPONENT_LABELS: Record<DraftScoreKey, string> = {
  production: 'league production',
  regularSeason: 'regular-season schedule',
  playoffs: 'fantasy-playoff schedule',
  positionValue: 'positional value',
};

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function sampleGames(player: DraftPlayer): number {
  return player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0;
}

function goalieWorkloadRate(player: DraftPlayer): number {
  if (!player.pos.includes('G')) return 1;
  return Math.max(0.1, Math.min(0.75, sampleGames(player) / 82));
}

function stabilizedProduction(player: DraftPlayer, goalieAverage: number): number {
  const raw = player.blendedFppg ?? 0;
  if (!player.pos.includes('G')) return raw;
  const games = sampleGames(player);
  const reliability = games / (games + 25);
  return (raw * reliability) + (goalieAverage * (1 - reliability));
}

function percentile(values: number[], value: number): number {
  if (values.length === 0) return 50;
  const below = values.filter((candidate) => candidate < value).length;
  const equal = values.filter((candidate) => candidate === value).length;
  return clamp(((below + (equal * 0.5)) / values.length) * 100);
}

function rangeScore(values: number[], value: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (quantile: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)))] ?? 0;
  const low = at(0.1);
  const high = at(1);
  if (high <= low) return 50;
  return clamp(((value - low) / (high - low)) * 100);
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function playerAsRoster(player: DraftPlayer): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    current_slot: 'BN',
    games_played: 0,
    blendedFppg: player.blendedFppg ?? 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
  };
}

function buildWindowProjections(
  players: RosterPlayer[],
  directory: DraftPlayer[],
  schedule: SeasonScheduleData,
  start: string,
  end: string,
): Record<string, PlayerProjection> {
  const directoryById = new Map(directory.map((player) => [normalizeId(player.id), player]));
  return Object.fromEntries(players.map((player) => {
    const source = directoryById.get(normalizeId(player.id));
    const fppg = source?.blendedFppg ?? player.blendedFppg ?? player.seasonFppg ?? 0;
    const games = (schedule.games[player.team] ?? []).filter((game) => game.date >= start && game.date <= end);
    return [normalizeId(player.id), {
      fppg,
      starts: games.length,
      gamesAvailable: games.length,
      projectedPoints: fppg * games.length,
      offNightRate: games.length ? games.filter((game) => game.isOffNight).length / games.length : 0,
      strengthOfSchedule: 5,
      gamesByDate: Object.fromEntries(games.map((game) => [game.date, {
        opponent: game.opponent,
        isHome: game.isHome,
        isOffNight: Boolean(game.isOffNight),
        startTime: game.startTime ?? `${game.date}T00:00:00Z`,
      }])),
    } satisfies PlayerProjection];
  }));
}

function buildPositionalValues(directory: DraftPlayer[], workspace: LeagueWorkspace): Map<string, number> {
  const goaliePool = directory.filter((candidate) => candidate.pos.includes('G') && candidate.blendedFppg !== null);
  const goalieAverage = goaliePool.length
    ? goaliePool.reduce((sum, candidate) => sum + (candidate.blendedFppg ?? 0), 0) / goaliePool.length
    : 0;
  const valuationFppg = (candidate: DraftPlayer) => stabilizedProduction(candidate, goalieAverage);
  const replacementByPosition = new Map(Object.keys(workspace.rosterRules.slots).map((position) => {
    const pool = directory
      .filter((candidate) => candidate.pos.includes(position) && candidate.blendedFppg !== null)
      .map(valuationFppg)
      .sort((a, b) => b - a);
    const rosteredAtPosition = Math.max(1, workspace.numberOfTeams * Math.max(1, workspace.rosterRules.slots[position] ?? 1));
    const replacement = pool[Math.min(pool.length - 1, rosteredAtPosition - 1)] ?? 0;
    return [position, replacement] as const;
  }));
  return new Map(directory.map((player) => {
    const fppg = valuationFppg(player);
    const eligible = player.pos.map((position) => replacementByPosition.get(position)).filter((value): value is number => value !== undefined);
    return [normalizeId(player.id), eligible.length ? Math.max(...eligible.map((replacement) => fppg - replacement)) : 0];
  }));
}

function scheduleComponent(
  player: DraftPlayer,
  roster: RosterPlayer[],
  directory: DraftPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
  start: string,
  end: string,
): { score: number; games: number; offNights: number; usableStarts: number; usableDates: string[] } {
  const teamRows = Object.values(schedule.games).map((games) => {
    const inWindow = games.filter((game) => game.date >= start && game.date <= end);
    return { games: inWindow.length, offNights: inWindow.filter((game) => game.isOffNight).length };
  });
  const playerGames = (schedule.games[player.team] ?? []).filter((game) => game.date >= start && game.date <= end);
  const workloadRate = goalieWorkloadRate(player);
  const expectedGames = Math.round(playerGames.length * workloadRate);
  const rawOffNights = playerGames.filter((game) => game.isOffNight).length;
  const offNights = Math.round(rawOffNights * workloadRate);
  const goalieRows = player.pos.includes('G') ? directory
    .filter((candidate) => candidate.pos.includes('G') && candidate.blendedFppg !== null)
    .map((candidate) => {
      const games = (schedule.games[candidate.team] ?? []).filter((game) => game.date >= start && game.date <= end);
      const rate = goalieWorkloadRate(candidate);
      return {
        games: Math.round(games.length * rate),
        offNights: Math.round(games.filter((game) => game.isOffNight).length * rate),
      };
    }) : null;
  const comparisonRows = goalieRows ?? teamRows;
  const comparisonGames = goalieRows ? expectedGames : playerGames.length;
  const comparisonOffNights = goalieRows ? offNights : rawOffNights;
  const scheduleScore = (percentile(comparisonRows.map((row) => row.games), comparisonGames) * 0.65)
    + (percentile(comparisonRows.map((row) => row.offNights), comparisonOffNights) * 0.35);

  if (roster.length === 0) return { score: scheduleScore, games: expectedGames, offNights, usableStarts: expectedGames, usableDates: playerGames.map((game) => game.date) };
  const candidate = playerAsRoster(player);
  const scenarioRoster = [...roster.filter((item) => normalizeId(item.id) !== normalizeId(candidate.id)), candidate];
  const projections = buildWindowProjections(scenarioRoster, directory, schedule, start, end);
  const scenario = simulateDailyLineup(workspace, scenarioRoster, projections);
  const simulatedStarts = scenario.startDatesByPlayer[normalizeId(candidate.id)]?.length ?? 0;
  const usableStarts = Math.round(simulatedStarts * workloadRate);
  const lineupFit = expectedGames ? Math.min(100, (usableStarts / expectedGames) * 100) : 0;
  return { score: (scheduleScore * 0.7) + (lineupFit * 0.3), games: expectedGames, offNights, usableStarts, usableDates: scenario.startDatesByPlayer[normalizeId(candidate.id)] ?? [] };
}

function buildPlayoffWeekScores(
  player: DraftPlayer,
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
  usableDates: string[],
): PlayoffWeekScore[] {
  const workloadRate = goalieWorkloadRate(player);
  const usable = new Set(usableDates);
  return buildMatchupWeeks(workspace.schedule.playoffs.start, workspace.schedule.playoffs.end).map((week) => {
    const games = (schedule.games[player.team] ?? []).filter((game) => game.date >= week.start && game.date <= week.end);
    return {
      ...week,
      games: Math.round(games.length * workloadRate),
      offNights: Math.round(games.filter((game) => game.isOffNight).length * workloadRate),
      usableStarts: Math.round(games.filter((game) => usable.has(game.date)).length * workloadRate),
    };
  });
}

function scoreCandidate(
  player: DraftPlayer,
  directory: DraftPlayer[],
  roster: RosterPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
  positionValues: Map<string, number>,
): DraftCandidateScore {
  const goalie = player.pos.includes('G');
  const peerPool = directory.filter((candidate) => candidate.pos.includes('G') === goalie && candidate.blendedFppg !== null);
  const goalieAverage = goalie && peerPool.length
    ? peerPool.reduce((sum, candidate) => sum + (candidate.blendedFppg ?? 0), 0) / peerPool.length
    : 0;
  const rateProduction = rangeScore(
    peerPool.map((candidate) => stabilizedProduction(candidate, goalieAverage)),
    stabilizedProduction(player, goalieAverage),
  );
  const production = goalie
    ? (rateProduction * 0.65) + (rangeScore(peerPool.map(sampleGames), sampleGames(player)) * 0.35)
    : rateProduction;
  const regularEnd = previousDate(workspace.schedule.playoffs.start) < workspace.season.start
    ? workspace.season.end
    : previousDate(workspace.schedule.playoffs.start);
  const regular = scheduleComponent(player, roster, directory, workspace, schedule, workspace.season.start, regularEnd);
  const playoffs = scheduleComponent(player, roster, directory, workspace, schedule, workspace.schedule.playoffs.start, workspace.schedule.playoffs.end);
  const playoffWeeks = buildPlayoffWeekScores(player, workspace, schedule, playoffs.usableDates);
  const championshipWeek = playoffWeeks[playoffWeeks.length - 1] ?? {
    index: 1,
    label: 'Championship',
    start: workspace.schedule.playoffs.start,
    end: workspace.schedule.playoffs.end,
    games: 0,
    offNights: 0,
    usableStarts: 0,
    isChampionship: true,
  };
  const valueOverReplacement = positionValues.get(normalizeId(player.id)) ?? 0;
  const positionPool = directory
    .filter((candidate) => candidate.pos.includes('G') === goalie)
    .map((candidate) => positionValues.get(normalizeId(candidate.id)) ?? 0);
  const positionValue = rangeScore(positionPool, valueOverReplacement);
  const components = { production, regularSeason: regular.score, playoffs: playoffs.score, positionValue };
  const weights = workspace.draftStrategy.weights;
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 100;
  const contributions = Object.fromEntries((Object.keys(components) as DraftScoreKey[]).map((key) => [key, (components[key] * weights[key]) / weightTotal])) as Record<DraftScoreKey, number>;
  const total = Object.values(contributions).reduce((sum, contribution) => sum + contribution, 0);
  return {
    playerId: player.id,
    total: Number(total.toFixed(1)),
    components: Object.fromEntries((Object.keys(components) as DraftScoreKey[]).map((key) => [key, Number(components[key].toFixed(1))])) as Record<DraftScoreKey, number>,
    contributions,
    metrics: {
      fppg: player.blendedFppg ?? 0,
      sampleGames: sampleGames(player),
      productionReliability: Number((goalie ? Math.min(1, sampleGames(player) / 40) : Math.min(1, sampleGames(player) / 60)).toFixed(2)),
      regularGames: regular.games,
      regularOffNights: regular.offNights,
      regularUsableStarts: regular.usableStarts,
      playoffGames: playoffs.games,
      playoffOffNights: playoffs.offNights,
      playoffUsableStarts: playoffs.usableStarts,
      playoffWeeks,
      championshipWeek,
      valueOverReplacement: Number(valueOverReplacement.toFixed(2)),
    },
  };
}

function strategyLabel(presetId: DraftStrategyPresetId): string {
  return presetId === 'custom' ? 'Custom strategy' : DRAFT_STRATEGY_PRESETS[presetId].label;
}

export function compareDraftCandidates(
  playerA: DraftPlayer,
  playerB: DraftPlayer,
  directory: DraftPlayer[],
  roster: RosterPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
): DraftStrategyComparison {
  const positionValues = buildPositionalValues(directory, workspace);
  const optionA = scoreCandidate(playerA, directory, roster, workspace, schedule, positionValues);
  const optionB = scoreCandidate(playerB, directory, roster, workspace, schedule, positionValues);
  const difference = optionA.total - optionB.total;
  const winner = Math.abs(difference) < 0.1 ? null : difference > 0 ? optionA : optionB;
  const winnerPlayer = winner === optionA ? playerA : playerB;
  const loserPlayer = winner === optionA ? playerB : playerA;
  const label = strategyLabel(workspace.draftStrategy.presetId);
  if (!winner) return {
    strategyLabel: label,
    winnerId: null,
    verdict: `${playerA.name} and ${playerB.name} are tied for ${label}`,
    explanation: 'Their weighted production, schedule, and positional value are effectively equal.',
    optionA,
    optionB,
  };

  const loser = winner === optionA ? optionB : optionA;
  const componentEdges = (Object.keys(winner.components) as DraftScoreKey[])
    .map((key) => ({ key, edge: winner.components[key] - loser.components[key] }))
    .sort((a, b) => b.edge - a.edge);
  const strengths = componentEdges.filter((item) => item.edge > 2).slice(0, 2).map((item) => COMPONENT_LABELS[item.key]);
  const tradeoff = [...componentEdges].reverse().find((item) => item.edge < -2);
  const explanation = `${winnerPlayer.name} leads by ${Math.abs(difference).toFixed(1)} strategy points${strengths.length ? ` on ${strengths.join(' and ')}` : ''}.`
    + (tradeoff ? ` ${loserPlayer.name} still has the stronger ${COMPONENT_LABELS[tradeoff.key]}.` : '');
  return {
    strategyLabel: label,
    winnerId: winnerPlayer.id,
    verdict: `Draft ${winnerPlayer.name} over ${loserPlayer.name}`,
    explanation,
    optionA,
    optionB,
  };
}

export function rankDraftCandidates(
  candidates: DraftPlayer[],
  directory: DraftPlayer[],
  roster: RosterPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
): RankedDraftCandidate[] {
  const positionValues = buildPositionalValues(directory, workspace);
  return candidates
    .map((player) => ({ player, score: scoreCandidate(player, directory, roster, workspace, schedule, positionValues) }))
    .sort((a, b) => b.score.total - a.score.total || (b.player.blendedFppg ?? 0) - (a.player.blendedFppg ?? 0) || a.player.name.localeCompare(b.player.name));
}

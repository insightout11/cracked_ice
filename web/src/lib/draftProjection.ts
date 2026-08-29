import type { DraftPlayer } from './playerSearch';

export type ProjectionTrajectory = 'rising' | 'stable' | 'declining';
export type ProjectionConfidence = 'high' | 'medium' | 'low';
export type ProjectionVolatility = 'low' | 'medium' | 'high';

export const DRAFT_PROJECTION_MODEL = {
  label: 'Cracked Ice early projection',
  shortLabel: 'CI early projection',
  methodology: 'Recent NHL production, multi-season trends, age, role, workload, and regression',
} as const;

export interface NextSeasonProjection {
  playerId: string;
  baselineFppg: number;
  projectedFppg: number;
  deltaPercent: number;
  trajectory: ProjectionTrajectory;
  confidence: ProjectionConfidence;
  reliability: number;
  projectedGames: number;
  volatility: ProjectionVolatility;
  reasons: string[];
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function ageAt(birthDate: string | undefined, asOf: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const date = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(date.getTime())) return null;
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (date.getUTCMonth() < birth.getUTCMonth() || (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function sampleGames(player: DraftPlayer): number {
  return player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0;
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number | null {
  const usable = values.filter((item) => Number.isFinite(item.value) && item.weight > 0);
  const weight = usable.reduce((sum, item) => sum + item.weight, 0);
  return weight ? usable.reduce((sum, item) => sum + (item.value * item.weight), 0) / weight : null;
}

function classifyVolatility(values: number[], goalie: boolean): ProjectionVolatility {
  if (values.length < 2) return 'high';
  const spread = Math.max(...values) - Math.min(...values);
  const high = goalie ? 0.012 : 0.3;
  const medium = goalie ? 0.006 : 0.15;
  return spread >= high ? 'high' : spread >= medium ? 'medium' : 'low';
}

function skaterAgeAdjustment(age: number | null): number {
  if (age === null) return 0;
  if (age <= 22) return 0.04;
  if (age <= 25) return 0.025;
  if (age <= 29) return 0;
  if (age <= 32) return -0.02;
  if (age <= 34) return -0.04;
  return -0.06;
}

function goalieAgeAdjustment(age: number | null): number {
  if (age === null || (age >= 26 && age <= 31)) return 0;
  if (age <= 25) return 0.01;
  if (age <= 34) return -0.02;
  return -0.04;
}

function skaterRoleAdjustment(player: DraftPlayer): number {
  const toiMinutes = (player.avgToiPerGame ?? 0) / 60;
  const ppMinutes = (player.ppTimeOnIcePerGame ?? 0) / 60;
  const toi = toiMinutes >= 20 ? 0.02 : toiMinutes > 0 && toiMinutes < 14 ? -0.025 : 0;
  const powerPlay = ppMinutes >= 3 ? 0.02 : ppMinutes > 0 && ppMinutes < 0.75 ? -0.015 : 0;
  return clamp(toi + powerPlay, -0.04, 0.04);
}

function skaterReliability(games: number, qualifyingSeasons: number): number {
  if (qualifyingSeasons >= 3) {
    if (games >= 60) return 0.98;
    if (games >= 40) return 0.95;
    return 0.9;
  }
  if (qualifyingSeasons >= 2) {
    if (games >= 60) return 0.96;
    if (games >= 40) return 0.92;
    return 0.82;
  }
  if (games >= 60) return 0.88;
  if (games >= 40) return 0.8;
  return games / (games + 30);
}

function percentReason(label: string, adjustment: number): string | null {
  if (Math.abs(adjustment) < 0.005) return null;
  return `${label} ${adjustment > 0 ? '+' : ''}${Math.round(adjustment * 100)}%`;
}

function confidenceFor(player: DraftPlayer, qualifyingSeasons: number, goalie: boolean, evidenceGames = sampleGames(player)): ProjectionConfidence {
  const games = evidenceGames;
  const evidence = [
    games >= (goalie ? 40 : 60),
    qualifyingSeasons >= 2,
    Boolean(player.birthDate),
    goalie ? games >= 25 : Boolean(player.avgToiPerGame),
  ].filter(Boolean).length;
  return evidence >= 4 ? 'high' : evidence >= 2 ? 'medium' : 'low';
}

function median(values: number[]): number | null {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2;
}

function skaterFppgPerPointRatio(player: DraftPlayer, directory: DraftPlayer[]): number {
  const ratios = directory.flatMap((candidate) => {
    if (candidate.pos.includes('G') || candidate.blendedFppg === null || !candidate.pos.some((position) => player.pos.includes(position))) return [];
    const latest = [...(candidate.recentSeasons ?? [])]
      .filter((season) => season.gamesPlayed >= 20 && (season.pointsPerGame ?? 0) > 0)
      .sort((a, b) => b.season.localeCompare(a.season))[0];
    if (!latest?.pointsPerGame) return [];
    return [candidate.blendedFppg / latest.pointsPerGame];
  });
  return clamp(median(ratios) ?? 3.5, 1.5, 7);
}

function skaterProjectedGames(player: DraftPlayer, seasonStart: string): number {
  const age = ageAt(player.birthDate, seasonStart);
  const seasons = [...(player.recentSeasons ?? [])]
    .filter((season) => Number.isFinite(season.gamesPlayed) && season.gamesPlayed >= 0)
    .sort((a, b) => b.season.localeCompare(a.season))
    .slice(0, 3);
  const maxGames = Math.max(0, ...seasons.map((season) => season.gamesPlayed));
  const thinRole = maxGames < 25 && ((player.avgToiPerGame ?? 0) / 60) < 14 && player.yahooAdp == null;
  const healthyExpectation = thinRole ? 50 : age !== null && age <= 22 ? 68 : 74;
  if (!seasons.length) return healthyExpectation;

  // A season-long absence is evidence of availability risk, but it is not a
  // forecast of another zero-game season. Apply a durability penalty, then
  // regress recent workloads toward a normal healthy season.
  const observed = weightedAverage(seasons.map((season, index) => ({
    value: season.gamesPlayed === 0 ? 55 : season.gamesPlayed,
    weight: [0.5, 0.3, 0.2][index] ?? 0.1,
  }))) ?? healthyExpectation;
  const workloadReliability = [0, 0.25, 0.35, 0.45][seasons.length] ?? 0.45;
  return clamp(Math.round((observed * workloadReliability) + (healthyExpectation * (1 - workloadReliability))), 30, 80);
}

function peerAverage(player: DraftPlayer, directory: DraftPlayer[]): number {
  const goalie = player.pos.includes('G');
  const peers = directory.filter((candidate) => {
    if (normalizeId(candidate.id) === normalizeId(player.id) || candidate.blendedFppg === null || candidate.pos.includes('G') !== goalie) return false;
    if (goalie) return sampleGames(candidate) >= 10;
    return sampleGames(candidate) >= 20 && candidate.pos.some((position) => player.pos.includes(position));
  });
  return peers.length
    ? peers.reduce((sum, candidate) => sum + (candidate.blendedFppg ?? 0), 0) / peers.length
    : player.blendedFppg ?? 0;
}

function marketPeerBaseline(player: DraftPlayer, directory: DraftPlayer[]): number | null {
  if (player.yahooAdp == null) return null;
  const peers = directory
    .filter((candidate) => candidate.blendedFppg !== null
      && candidate.yahooAdp != null
      && candidate.pos.includes('G') === player.pos.includes('G')
      && candidate.pos.some((position) => player.pos.includes(position)))
    .sort((a, b) => Math.abs((a.yahooAdp ?? 9999) - player.yahooAdp!) - Math.abs((b.yahooAdp ?? 9999) - player.yahooAdp!))
    .slice(0, 12)
    .map((candidate) => candidate.blendedFppg ?? 0);
  return median(peers);
}

function buildSkaterProjection(player: DraftPlayer, directory: DraftPlayer[], seasonStart: string): NextSeasonProjection {
  const currentBaseline = player.blendedFppg ?? 0;
  const games = sampleGames(player);
  const seasons = [...(player.recentSeasons ?? [])]
    .filter((season) => season.gamesPlayed >= 10 && season.pointsPerGame !== undefined)
    .sort((a, b) => b.season.localeCompare(a.season))
    .slice(0, 3);
  const currentPpg = seasons[0]?.pointsPerGame ?? null;
  const historicalPpg = weightedAverage(seasons.map((season, index) => ({ value: season.pointsPerGame ?? 0, weight: [0.6, 0.3, 0.1][index] ?? 0.1 })));
  const historyBaseline = historicalPpg !== null && historicalPpg > 0
    ? historicalPpg * skaterFppgPerPointRatio(player, directory)
    : null;
  const marketBaseline = currentBaseline <= 0 && historyBaseline === null ? marketPeerBaseline(player, directory) : null;
  const baseline = currentBaseline > 0
    ? currentBaseline
    : historyBaseline ?? marketBaseline ?? 0;
  const priorPpg = weightedAverage(seasons.slice(1).map((season, index) => ({ value: season.pointsPerGame ?? 0, weight: index === 0 ? 0.7 : 0.3 })));
  const trendReliability = Math.min(1, (seasons[0]?.gamesPlayed ?? 0) / 60);
  // A recent jump is useful evidence, but not a reason to extrapolate the full
  // jump again. Pull the forecast gently toward the player's own established
  // scoring level and reserve positional-peer regression for thin samples.
  const scoringBaselineAdjustment = currentPpg !== null && currentPpg > 0 && priorPpg !== null && priorPpg > 0
    ? clamp(((priorPpg / currentPpg) - 1) * 0.35 * trendReliability, -0.05, 0.05)
    : 0;
  const age = ageAt(player.birthDate, seasonStart);
  const ageAdjustment = skaterAgeAdjustment(age);
  const roleAdjustment = skaterRoleAdjustment(player);
  const evidenceGames = Math.max(games, ...seasons.map((season) => season.gamesPlayed), 0);
  // The market fallback is already a median of nearby, position-matched
  // players, so it needs far less additional regression than a tiny NHL
  // sample would.
  const reliability = marketBaseline !== null ? 0.9 : skaterReliability(evidenceGames, seasons.length);
  const regressed = (baseline * reliability) + (peerAverage(player, directory) * (1 - reliability));
  const projectedFppg = Math.max(0, regressed * (1 + scoringBaselineAdjustment + ageAdjustment + roleAdjustment));
  const deltaPercent = baseline > 0 ? ((projectedFppg / baseline) - 1) * 100 : 0;
  const projectedGames = skaterProjectedGames(player, seasonStart);
  const reasons = [
    historyBaseline !== null ? 'Per-game baseline rebuilt from recent NHL scoring history' : null,
    marketBaseline !== null ? 'Temporary per-game baseline estimated from nearby Yahoo draft values' : null,
    `Projected ${projectedGames} games from regressed recent availability`,
    reliability < 0.95 ? `${Math.round((1 - reliability) * 100)}% regression to positional peers` : null,
    percentReason('Recent scoring history', scoringBaselineAdjustment),
    percentReason(age === null ? 'Age curve' : `Age-${age} curve`, ageAdjustment),
    percentReason('NHL and power-play role', roleAdjustment),
  ].filter((reason): reason is string => Boolean(reason));
  return {
    playerId: player.id,
    baselineFppg: baseline,
    projectedFppg: Number(projectedFppg.toFixed(2)),
    deltaPercent: Number(deltaPercent.toFixed(1)),
    trajectory: deltaPercent >= 4 ? 'rising' : deltaPercent <= -4 ? 'declining' : 'stable',
    confidence: confidenceFor(player, seasons.length, false, evidenceGames),
    reliability: Number(reliability.toFixed(2)),
    projectedGames,
    volatility: classifyVolatility(seasons.map((season) => season.pointsPerGame ?? 0), false),
    reasons: reasons.length ? reasons : ['Current league FPPG with a neutral next-season adjustment'],
  };
}

function buildGoalieProjection(player: DraftPlayer, directory: DraftPlayer[], seasonStart: string): NextSeasonProjection {
  const baseline = player.blendedFppg ?? 0;
  const games = sampleGames(player);
  const seasons = [...(player.recentSeasons ?? [])]
    .filter((season) => season.gamesPlayed >= 10)
    .sort((a, b) => b.season.localeCompare(a.season))
    .slice(0, 3);
  const savePctSeasons = seasons.filter((season) => season.savePct !== undefined);
  const currentSavePct = savePctSeasons[0]?.savePct ?? null;
  const priorSavePct = weightedAverage(savePctSeasons.slice(1).map((season, index) => ({ value: season.savePct ?? 0, weight: index === 0 ? 0.7 : 0.3 })));
  const savePctTrend = currentSavePct !== null && priorSavePct !== null
    ? clamp((currentSavePct - priorSavePct) * 4, -0.06, 0.06)
    : 0;
  const age = ageAt(player.birthDate, seasonStart);
  const ageAdjustment = goalieAgeAdjustment(age);
  const reliability = games / (games + 45);
  const regressed = (baseline * reliability) + (peerAverage(player, directory) * (1 - reliability));
  const projectedFppg = Math.max(0, regressed * (1 + savePctTrend + ageAdjustment));
  const workloadAverage = weightedAverage(seasons.map((season, index) => ({ value: season.gamesPlayed, weight: [0.6, 0.3, 0.1][index] ?? 0.1 }))) ?? games;
  const workloadEvidence = seasons.reduce((sum, season) => sum + season.gamesPlayed, 0) || games;
  const workloadReliability = workloadEvidence / (workloadEvidence + 80);
  const projectedGames = clamp(Math.round((workloadAverage * workloadReliability) + (30 * (1 - workloadReliability))), 12, 62);
  const deltaPercent = baseline > 0 ? ((projectedFppg / baseline) - 1) * 100 : 0;
  const volatility = classifyVolatility(savePctSeasons.map((season) => season.savePct ?? 0), true);
  const reasons = [
    `Projected ${projectedGames} appearances from recent workload`,
    percentReason('Multi-year save-percentage trend', savePctTrend),
    percentReason(age === null ? 'Goalie age curve' : `Age-${age} goalie curve`, ageAdjustment),
    reliability < 0.8 ? `${Math.round((1 - reliability) * 100)}% regression to goalie peers` : null,
    `${volatility} year-to-year volatility`,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    playerId: player.id,
    baselineFppg: baseline,
    projectedFppg: Number(projectedFppg.toFixed(2)),
    deltaPercent: Number(deltaPercent.toFixed(1)),
    trajectory: deltaPercent >= 4 ? 'rising' : deltaPercent <= -4 ? 'declining' : 'stable',
    confidence: confidenceFor(player, seasons.length, true),
    reliability: Number(reliability.toFixed(2)),
    projectedGames,
    volatility,
    reasons,
  };
}

export function buildNextSeasonProjection(player: DraftPlayer, directory: DraftPlayer[], seasonStart: string): NextSeasonProjection {
  return player.pos.includes('G')
    ? buildGoalieProjection(player, directory, seasonStart)
    : buildSkaterProjection(player, directory, seasonStart);
}

export function buildNextSeasonProjectionMap(directory: DraftPlayer[], seasonStart: string): Map<string, NextSeasonProjection> {
  return new Map(directory.map((player) => [normalizeId(player.id), buildNextSeasonProjection(player, directory, seasonStart)]));
}

export function applyImportedProjectionOverrides(
  projections: Map<string, NextSeasonProjection>,
  imported: Record<string, { projectedFppg?: number; projectedGames?: number }> | undefined,
  label = 'Imported projection',
): Map<string, NextSeasonProjection> {
  if (!imported) return projections;
  const next = new Map(projections);
  Object.entries(imported).forEach(([id, value]) => {
    const current = next.get(normalizeId(id)); if (!current || value.projectedFppg === undefined || value.projectedGames === undefined) return;
    const deltaPercent = current.baselineFppg > 0 ? ((value.projectedFppg / current.baselineFppg) - 1) * 100 : 0;
    next.set(normalizeId(id), { ...current, projectedFppg: value.projectedFppg, projectedGames: value.projectedGames, deltaPercent: Number(deltaPercent.toFixed(1)), trajectory: deltaPercent >= 4 ? 'rising' : deltaPercent <= -4 ? 'declining' : 'stable', confidence: 'high', reliability: 1, reasons: [`${label} supplied by the user`] });
  }); return next;
}

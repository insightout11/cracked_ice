import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace, LeagueWorkspaceRosterEntry } from './leagueWorkspace';
import { buildPositionValuations, type PositionValuation } from './draftStrategy';

export type KeeperFactorKey = 'currentValue' | 'ageTrajectory' | 'role' | 'durability' | 'scarcity';

export interface KeeperCandidateProfile {
  playerId: string;
  total: number;
  confidence: 'high' | 'medium' | 'low';
  age: number | null;
  trend: number | null;
  costLabel: string | null;
  factors: Record<KeeperFactorKey, number>;
  evidence: {
    leagueFppg: number;
    nhlGamesPlayed: number;
    avgToiMinutes: number | null;
    ppToiMinutes: number | null;
    recentSeasons: number;
  };
}

export interface KeeperComparison {
  horizonLabel: string;
  winnerId: string | null;
  verdict: string;
  explanation: string;
  optionA: KeeperCandidateProfile;
  optionB: KeeperCandidateProfile;
}

const FACTOR_LABELS: Record<KeeperFactorKey, string> = {
  currentValue: 'current league value',
  ageTrajectory: 'age and trajectory',
  role: 'NHL and power-play role',
  durability: 'recent availability',
  scarcity: 'positional scarcity',
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function percentile(values: number[], value: number): number {
  if (!values.length) return 50;
  const below = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return clamp(((below + (equal * 0.5)) / values.length) * 100);
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

function ageScore(age: number | null, goalie: boolean, multiYear: boolean): number {
  if (age === null) return 50;
  if (goalie) {
    if (age < 22) return multiYear ? 70 : 45;
    if (age <= 24) return multiYear ? 90 : 70;
    if (age <= 29) return 100;
    if (age <= 32) return multiYear ? 75 : 90;
    if (age <= 34) return multiYear ? 50 : 70;
    return multiYear ? 30 : 50;
  }
  if (age < 21) return multiYear ? 85 : 60;
  if (age <= 24) return 100;
  if (age <= 27) return multiYear ? 95 : 100;
  if (age <= 30) return multiYear ? 75 : 90;
  if (age <= 33) return multiYear ? 50 : 70;
  return multiYear ? 25 : 50;
}

function trajectory(player: DraftPlayer): number | null {
  const seasons = player.recentSeasons ?? [];
  const values = player.pos.includes('G')
    ? seasons.map((season) => season.savePct).filter((value): value is number => value !== undefined)
    : seasons.map((season) => season.pointsPerGame).filter((value): value is number => value !== undefined);
  if (values.length < 2) return null;
  return values[0] - values[values.length - 1];
}

function trajectoryScore(player: DraftPlayer, age: number | null, multiYear: boolean): number {
  const goalie = player.pos.includes('G');
  const trend = trajectory(player);
  const trendScore = trend === null ? 50 : goalie ? clamp(50 + (trend * 1_000)) : clamp(50 + (trend * 100));
  return (ageScore(age, goalie, multiYear) * 0.6) + (trendScore * 0.4);
}

function roleScore(player: DraftPlayer): number {
  if (player.pos.includes('G')) return clamp(((player.nhlGamesPlayed ?? 0) / 60) * 100);
  const toi = player.avgToiPerGame ? player.avgToiPerGame / 60 : null;
  const pp = player.ppTimeOnIcePerGame ? player.ppTimeOnIcePerGame / 60 : null;
  if (toi === null && pp === null) return 50;
  const toiScore = toi === null ? 50 : clamp(((toi - 10) / 12) * 100);
  const ppScore = pp === null ? 50 : clamp((pp / 4.5) * 100);
  return (toiScore * 0.6) + (ppScore * 0.4);
}

function durabilityScore(player: DraftPlayer): number {
  const seasons = player.recentSeasons ?? [];
  if (!seasons.length) return 50;
  const baseline = player.pos.includes('G') ? 60 : 82;
  return clamp((seasons.reduce((sum, season) => sum + Math.min(baseline, season.gamesPlayed), 0) / (seasons.length * baseline)) * 100);
}

function costLabel(entry: LeagueWorkspaceRosterEntry | undefined): string | null {
  if (!entry?.keeperCost) return null;
  if (entry.keeperCost.type === 'draft-round') return `Round ${entry.keeperCost.round}`;
  return `${entry.keeperCost.currency} ${entry.keeperCost.amount.toFixed(0)}`;
}

function profile(player: DraftPlayer, directory: DraftPlayer[], workspace: LeagueWorkspace, positionValues: Map<string, PositionValuation>): KeeperCandidateProfile {
  const goalie = player.pos.includes('G');
  const peerPool = directory.filter((candidate) => candidate.pos.includes('G') === goalie && candidate.blendedFppg !== null);
  const productionValues = peerPool.map((candidate) => candidate.blendedFppg ?? 0);
  const currentValue = percentile(productionValues, player.blendedFppg ?? 0);
  const positionValue = positionValues.get(player.id.replace(/^nhl:/, ''));
  const scarcity = positionValue?.positionValue ?? 0;
  const age = ageAt(player.birthDate, workspace.season.start);
  const multiYear = workspace.keeperRules.horizon === 'two-to-three-years';
  const factors = {
    currentValue,
    ageTrajectory: trajectoryScore(player, age, multiYear),
    role: roleScore(player),
    durability: durabilityScore(player),
    scarcity,
  };
  const weights = multiYear
    ? { currentValue: 30, ageTrajectory: 30, role: 20, durability: 10, scarcity: 10 }
    : { currentValue: 40, ageTrajectory: 20, role: 20, durability: 10, scarcity: 10 };
  const total = (Object.keys(factors) as KeeperFactorKey[]).reduce((sum, key) => sum + ((factors[key] * weights[key]) / 100), 0);
  const evidenceCount = [player.birthDate, player.avgToiPerGame, player.recentSeasons?.length && player.recentSeasons.length >= 2, (player.nhlGamesPlayed ?? 0) >= (goalie ? 25 : 40)].filter(Boolean).length;
  const entry = workspace.roster.find((item) => item.playerId.replace(/^nhl:/, '') === player.id.replace(/^nhl:/, ''));
  return {
    playerId: player.id,
    total: Number(total.toFixed(1)),
    confidence: evidenceCount >= 4 ? 'high' : evidenceCount >= 2 ? 'medium' : 'low',
    age,
    trend: trajectory(player),
    costLabel: costLabel(entry),
    factors: Object.fromEntries((Object.keys(factors) as KeeperFactorKey[]).map((key) => [key, Number(factors[key].toFixed(1))])) as Record<KeeperFactorKey, number>,
    evidence: {
      leagueFppg: player.blendedFppg ?? 0,
      nhlGamesPlayed: player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0,
      avgToiMinutes: player.avgToiPerGame ? Number((player.avgToiPerGame / 60).toFixed(1)) : null,
      ppToiMinutes: player.ppTimeOnIcePerGame ? Number((player.ppTimeOnIcePerGame / 60).toFixed(1)) : null,
      recentSeasons: player.recentSeasons?.length ?? 0,
    },
  };
}

export function compareKeeperCandidates(playerA: DraftPlayer, playerB: DraftPlayer, directory: DraftPlayer[], workspace: LeagueWorkspace): KeeperComparison {
  const positionValues = buildPositionValuations(directory, workspace);
  const optionA = profile(playerA, directory, workspace, positionValues);
  const optionB = profile(playerB, directory, workspace, positionValues);
  const difference = optionA.total - optionB.total;
  const winner = Math.abs(difference) < 3 ? null : difference > 0 ? optionA : optionB;
  const winnerPlayer = winner === optionA ? playerA : playerB;
  const loserPlayer = winner === optionA ? playerB : playerA;
  const horizonLabel = workspace.keeperRules.horizon === 'two-to-three-years' ? '2–3 year keeper outlook' : 'Next-season keeper outlook';
  if (!winner) return { horizonLabel, winnerId: null, verdict: 'Keeper profiles are too close to call', explanation: 'Their evidence-weighted profiles are within three points. Keeper cost and your roster construction should break the tie.', optionA, optionB };
  const loser = winner === optionA ? optionB : optionA;
  const edges = (Object.keys(winner.factors) as KeeperFactorKey[])
    .map((key) => ({ key, edge: winner.factors[key] - loser.factors[key] }))
    .sort((a, b) => b.edge - a.edge);
  const strengths = edges.filter((item) => item.edge > 4).slice(0, 2).map((item) => FACTOR_LABELS[item.key]);
  return {
    horizonLabel,
    winnerId: winner.playerId,
    verdict: `Keeper lean: ${winnerPlayer.name}`,
    explanation: `${winnerPlayer.name} leads ${loserPlayer.name} by ${Math.abs(difference).toFixed(1)} profile points${strengths.length ? ` through ${strengths.join(' and ')}` : ''}. This is a transparent outlook, not a dynasty projection.`,
    optionA,
    optionB,
  };
}

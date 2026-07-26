export type IceConfidenceLevel = 'low' | 'medium' | 'high';

export interface IceRatingComponent {
  score: number;
  label: string;
  detail: string;
}

export interface IceRatingBreakdown {
  version: '2.0';
  total: number;
  impact: IceRatingComponent;
  context: IceRatingComponent;
  expectation: IceRatingComponent;
  confidence: {
    score: number;
    level: IceConfidenceLevel;
    detail: string;
  };
}

export interface IceRatingInput {
  seasonFppg: number;
  last30Fppg?: number;
  last7Fppg?: number;
  hasSeasonSample: boolean;
  hasLast30Sample: boolean;
  hasLast7Sample: boolean;
  impactPercentile?: number;
  isGoalie: boolean;
  gamesAvailable: number;
  starts?: number;
  windowDays: number;
  offNightRate: number;
  strengthOfSchedule: number;
  seasonToiSeconds?: number;
  recentToiSeconds?: number;
  seasonPpToiSeconds?: number;
  recentPpToiSeconds?: number;
}

const clamp = (value: number, min = 0, max = 10): number => Math.min(max, Math.max(min, value));
const round = (value: number): number => Number(clamp(value).toFixed(1));

function componentLabel(score: number): string {
  if (score >= 8.5) return 'Elite';
  if (score >= 7) return 'Strong';
  if (score >= 5) return 'Useful';
  if (score >= 3) return 'Limited';
  return 'Low';
}

function fallbackImpactScore(fppg: number, isGoalie: boolean): number {
  const midpoint = isGoalie ? 6 : 2.5;
  if (fppg <= 0) return 0;
  return clamp((fppg / (fppg + midpoint)) * 10);
}

function confidence(input: IceRatingInput): IceRatingBreakdown['confidence'] {
  let score = 0;
  if (input.hasSeasonSample) score += 0.4;
  if (input.hasLast30Sample) score += 0.15;
  if (input.hasLast7Sample) score += 0.1;
  if (input.gamesAvailable > 0) score += 0.15;
  if (input.isGoalie || input.seasonToiSeconds !== undefined) score += 0.1;
  if (input.isGoalie || input.seasonPpToiSeconds !== undefined) score += 0.1;
  const normalized = Number(Math.min(1, score).toFixed(2));
  const level: IceConfidenceLevel = normalized >= 0.8 ? 'high' : normalized >= 0.55 ? 'medium' : 'low';
  const detail = level === 'high'
    ? 'Season, recent, role, and schedule data are available.'
    : level === 'medium'
      ? 'Some recent or deployment data is unavailable.'
      : 'The rating relies on limited production or schedule data.';
  return { score: normalized, level, detail };
}

function impactComponent(input: IceRatingInput): IceRatingComponent {
  const weightedFppg = (input.seasonFppg * 0.5)
    + ((input.hasLast30Sample ? input.last30Fppg ?? input.seasonFppg : input.seasonFppg) * 0.3)
    + ((input.hasLast7Sample ? input.last7Fppg ?? input.seasonFppg : input.seasonFppg) * 0.2);
  const score = input.impactPercentile !== undefined
    ? 1 + (clamp(input.impactPercentile, 0, 1) * 9)
    : fallbackImpactScore(weightedFppg, input.isGoalie);
  const rounded = round(score);
  const detail = input.impactPercentile !== undefined
    ? `${Math.round(input.impactPercentile * 100)}th percentile · ${weightedFppg.toFixed(2)} league FPPG`
    : `${weightedFppg.toFixed(2)} league FPPG`;
  return {
    score: rounded,
    label: componentLabel(rounded),
    detail,
  };
}

function blendTotal(
  impact: IceRatingComponent,
  context: IceRatingComponent,
  expectation: IceRatingComponent,
  hasSchedule: boolean,
): number {
  if (!hasSchedule) {
    return round(((impact.score * 0.45) + (expectation.score * 0.25)) / 0.7);
  }
  return round((impact.score * 0.45) + (context.score * 0.3) + (expectation.score * 0.25));
}

function contextComponent(input: IceRatingInput): IceRatingComponent {
  const scheduleDensity = input.windowDays > 0
    ? clamp(input.gamesAvailable / Math.max(1, input.windowDays / 2) * 10)
    : 0;
  const lineupFit = input.starts !== undefined && input.gamesAvailable > 0
    ? clamp(input.starts / input.gamesAvailable * 10)
    : scheduleDensity;
  const score = input.starts !== undefined
    ? (lineupFit * 0.55) + (clamp(input.offNightRate * 10) * 0.2) + (clamp(input.strengthOfSchedule) * 0.25)
    : (scheduleDensity * 0.35) + (clamp(input.offNightRate * 10) * 0.35) + (clamp(input.strengthOfSchedule) * 0.3);
  const rounded = round(score);
  const detail = input.gamesAvailable === 0
    ? 'No games in the selected window'
    : input.starts !== undefined
      ? `${input.starts}/${input.gamesAvailable} usable starts · ${Math.round(input.offNightRate * 100)}% off-nights`
      : `${input.gamesAvailable} games · ${Math.round(input.offNightRate * 100)}% off-nights`;
  return {
    score: rounded,
    label: input.gamesAvailable === 0 ? 'Not counted' : componentLabel(rounded),
    detail: input.gamesAvailable === 0 ? `${detail} — rating is schedule-neutral` : detail,
  };
}

function expectationComponent(input: IceRatingInput): IceRatingComponent {
  const recentFppg = input.hasLast7Sample
    ? input.last7Fppg ?? input.seasonFppg
    : input.hasLast30Sample
      ? input.last30Fppg ?? input.seasonFppg
      : input.seasonFppg;
  const formDelta = input.seasonFppg > 0
    ? clamp(((recentFppg / input.seasonFppg) - 1) * 5, -2.5, 2.5)
    : 0;

  if (input.isGoalie) {
    const score = round(5 + formDelta);
    return {
      score,
      label: componentLabel(score),
      detail: input.hasLast7Sample || input.hasLast30Sample
        ? `${recentFppg.toFixed(2)} recent FPPG versus ${input.seasonFppg.toFixed(2)} season`
        : 'Recent goalie sample unavailable',
    };
  }

  const toi = input.recentToiSeconds ?? input.seasonToiSeconds;
  const ppToi = input.recentPpToiSeconds ?? input.seasonPpToiSeconds;
  const toiScore = toi === undefined ? 5 : clamp(toi / (22 * 60) * 10);
  const ppScore = ppToi === undefined ? 5 : clamp(ppToi / (4 * 60) * 10);
  const roleScore = (toiScore * 0.65) + (ppScore * 0.35);
  const score = round((roleScore * 0.65) + ((5 + formDelta) * 0.35));
  const formatToi = (seconds: number | undefined) => seconds === undefined
    ? '—'
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  return {
    score,
    label: componentLabel(score),
    detail: `TOI ${formatToi(toi)} · PP ${formatToi(ppToi)}${input.hasLast7Sample ? ' · recent form included' : ''}`,
  };
}

export function calculateIceRating(input: IceRatingInput): IceRatingBreakdown {
  const impact = impactComponent(input);
  const context = contextComponent(input);
  const expectation = expectationComponent(input);
  const total = blendTotal(impact, context, expectation, input.gamesAvailable > 0);
  return {
    version: '2.0',
    total,
    impact,
    context,
    expectation,
    confidence: confidence(input),
  };
}

export function personalizeIceRating(
  rating: IceRatingBreakdown,
  input: Pick<IceRatingInput, 'gamesAvailable' | 'starts' | 'windowDays' | 'offNightRate' | 'strengthOfSchedule'>,
): IceRatingBreakdown {
  const context = contextComponent({
    seasonFppg: 0,
    hasSeasonSample: false,
    hasLast30Sample: false,
    hasLast7Sample: false,
    isGoalie: false,
    ...input,
  });
  return {
    ...rating,
    context,
    total: blendTotal(rating.impact, context, rating.expectation, input.gamesAvailable > 0),
  };
}

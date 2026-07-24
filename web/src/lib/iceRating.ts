import type { IceRatingBreakdown, PlayerProjection, RosterPlayer } from './coachSchemas';
import { getLeagueFppg } from './playerProjection';

const clamp = (value: number, min = 0, max = 10) => Math.min(max, Math.max(min, value));
const round = (value: number) => Number(clamp(value).toFixed(1));

function label(score: number): string {
  if (score >= 8.5) return 'Elite';
  if (score >= 7) return 'Strong';
  if (score >= 5) return 'Useful';
  if (score >= 3) return 'Limited';
  return 'Low';
}

const formatToi = (seconds?: number) => seconds === undefined
  ? '—'
  : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function buildFallbackIceRating(
  player: RosterPlayer,
  projection?: PlayerProjection,
): IceRatingBreakdown {
  if (projection?.iceBreakdown) return projection.iceBreakdown;

  const seasonFppg = getLeagueFppg(player, projection);
  const hasLast30 = (player.last30Fppg ?? 0) > 0;
  const hasLast7 = (player.last7Fppg ?? 0) > 0 || (player.roleTrend?.last7Games ?? 0) > 0;
  const last30 = hasLast30 ? player.last30Fppg ?? seasonFppg : seasonFppg;
  const last7 = hasLast7 ? player.last7Fppg ?? seasonFppg : seasonFppg;
  const weightedFppg = (seasonFppg * 0.5) + (last30 * 0.3) + (last7 * 0.2);
  const goalie = player.positions.includes('G');
  const impactScore = round(weightedFppg <= 0 ? 0 : weightedFppg / (weightedFppg + (goalie ? 6 : 2.5)) * 10);

  const games = projection?.gamesAvailable ?? 0;
  const starts = projection?.starts ?? games;
  const offNightRate = projection?.offNightRate ?? 0;
  const sos = projection?.strengthOfSchedule ?? 5;
  const fit = games > 0 ? starts / games * 10 : 0;
  const contextScore = round((fit * 0.55) + (offNightRate * 10 * 0.2) + (sos * 0.25));

  const role = player.roleTrend;
  const toi = role?.last7.avgToi ?? role?.season.avgToi ?? player.advancedStats?.avgToiPerGame;
  const ppToi = role?.last7.avgPpToi ?? role?.season.avgPpToi ?? player.advancedStats?.ppTimeOnIcePerGame;
  const formDelta = seasonFppg > 0 ? clamp(((last7 / seasonFppg) - 1) * 5, -2.5, 2.5) : 0;
  const roleScore = goalie
    ? 5 + formDelta
    : (((toi === undefined ? 5 : clamp(toi / (22 * 60) * 10)) * 0.65)
      + ((ppToi === undefined ? 5 : clamp(ppToi / (4 * 60) * 10)) * 0.35)) * 0.65
      + ((5 + formDelta) * 0.35);
  const expectationScore = round(roleScore);
  const total = round((impactScore * 0.45) + (contextScore * 0.3) + (expectationScore * 0.25));

  let confidenceScore = 0.4;
  if (hasLast30) confidenceScore += 0.15;
  if (hasLast7) confidenceScore += 0.1;
  if (games > 0) confidenceScore += 0.15;
  if (goalie || toi !== undefined) confidenceScore += 0.1;
  if (goalie || ppToi !== undefined) confidenceScore += 0.1;
  confidenceScore = Math.min(1, confidenceScore);
  const confidenceLevel = confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.55 ? 'medium' : 'low';

  return {
    version: '2.0',
    total,
    impact: {
      score: impactScore,
      label: label(impactScore),
      detail: `${weightedFppg.toFixed(2)} league FPPG`,
    },
    context: {
      score: contextScore,
      label: label(contextScore),
      detail: games > 0 ? `${starts}/${games} usable starts · ${Math.round(offNightRate * 100)}% off-nights` : 'No games in the selected window',
    },
    expectation: {
      score: expectationScore,
      label: label(expectationScore),
      detail: goalie ? (hasLast7 ? 'Recent goalie form included' : 'Recent goalie sample unavailable') : `TOI ${formatToi(toi)} · PP ${formatToi(ppToi)}`,
    },
    confidence: {
      score: Number(confidenceScore.toFixed(2)),
      level: confidenceLevel,
      detail: confidenceLevel === 'high'
        ? 'Season, recent, role, and schedule data are available.'
        : confidenceLevel === 'medium'
          ? 'Some recent or deployment data is unavailable.'
          : 'The rating relies on limited production or schedule data.',
    },
  };
}

export function iceRatingTier(score: number): 'elite' | 'strong' | 'useful' | 'limited' | 'low' {
  if (score >= 8.5) return 'elite';
  if (score >= 7) return 'strong';
  if (score >= 5) return 'useful';
  if (score >= 3) return 'limited';
  return 'low';
}

/**
 * Re-personalize a server ICE breakdown for a candidate entering a known,
 * currently-empty active roster slot. Impact and expectation remain player
 * attributes; context reflects that every scheduled game can use that slot.
 */
export function personalizeIceForOpenRosterSlot(projection: PlayerProjection): PlayerProjection {
  if (!projection.iceBreakdown) return projection;

  const gamesAvailable = projection.gamesAvailable ?? 0;
  const lineupFit = gamesAvailable > 0 ? 10 : 0;
  const offNightScore = clamp((projection.offNightRate ?? 0) * 10);
  const scheduleScore = clamp(projection.strengthOfSchedule ?? 5);
  const contextScore = round((lineupFit * 0.55) + (offNightScore * 0.2) + (scheduleScore * 0.25));
  const context = {
    score: contextScore,
    label: label(contextScore),
    detail: gamesAvailable > 0
      ? `${gamesAvailable}/${gamesAvailable} usable starts · ${Math.round((projection.offNightRate ?? 0) * 100)}% off-nights`
      : 'No games in the selected window',
  };
  const total = round(
    (projection.iceBreakdown.impact.score * 0.45)
      + (context.score * 0.3)
      + (projection.iceBreakdown.expectation.score * 0.25),
  );

  return {
    ...projection,
    starts: gamesAvailable,
    iceScore: total,
    iceBreakdown: {
      ...projection.iceBreakdown,
      context,
      total,
    },
  };
}

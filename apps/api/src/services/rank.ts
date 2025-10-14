import { Recommendation, Window } from '../models/types';
import {
  loadLeagueProfile,
  loadRoster,
  loadFreeAgents,
  buildDropPool,
  MAX_FREE_AGENTS,
  MAX_DROP_POOL,
  UserDataError
} from './loaders';
import { fillLineup, simulateSwap } from './simulate';
import { tierBadge, roleBadges, b2bBadges } from './badges';
import { writeRequestLog } from './logger';

const FEATURE_FLAGS = {
  multiMove: process.env.FEATURE_MULTI_MOVE === 'true',
  customScoring: process.env.FEATURE_CUSTOM_SCORING === 'true',
  ocr: process.env.FEATURE_OCR === 'true'
} as const;

const REQUEST_TIMEOUT_MS = 1000;
const MAX_RECOMMENDATIONS = 5;

export class RecommendationTimeoutError extends Error {
  constructor() {
    super('Recommendation generation timed out');
    this.name = 'RecommendationTimeoutError';
  }
}

export interface RankedStreamersResult {
  baselinePoints: number;
  recommendations: Recommendation[];
  freeAgentCount: number;
  dropCount: number;
  truncatedFa?: number;
  truncatedDrops?: number;
}

function ensureFeatures(): void {
  if (FEATURE_FLAGS.multiMove || FEATURE_FLAGS.customScoring || FEATURE_FLAGS.ocr) {
    throw new Error('Unsupported feature flag enabled for MVP build');
  }
}

function collectBadges(team: string, playerId: string, window: Window, isTopPick: boolean): string[] {
  const badges = [tierBadge(team), ...roleBadges(playerId), ...b2bBadges(team, window)];
  if (isTopPick) {
    badges.push('MattPick');
  }
  return badges;
}

export function rankStreamers(userId: string, window: Window, reqId?: string): RankedStreamersResult {
  ensureFeatures();
  const startedAt = Date.now();

  const league = loadLeagueProfile(userId);
  const roster = loadRoster(userId);
  const freeAgents = loadFreeAgents(userId);

  const baseline = fillLineup(roster.players, window, league);
  const dropPoolRaw = buildDropPool(roster.players);
  const dropPool = dropPoolRaw.slice(0, MAX_DROP_POOL);
  const candidates = freeAgents.candidates.slice(0, MAX_FREE_AGENTS);

  const truncatedFa = Math.max(0, freeAgents.candidates.length - candidates.length);
  const truncatedDrops = Math.max(0, dropPoolRaw.length - dropPool.length);

  const intermediate: Array<{ rec: Recommendation; deltaPoints: number }> = [];

  for (const add of candidates) {
    let best: Recommendation | null = null;
    let bestDelta = -Infinity;

    for (const drop of dropPool) {
      const { deltaPoints, deltaGp, lostPoints } = simulateSwap(
        roster.players,
        add,
        drop,
        window,
        league,
        baseline
      );

      if (deltaPoints <= 0 && deltaGp <= 0) {
        continue;
      }

      if (deltaPoints > bestDelta || (deltaPoints === bestDelta && deltaGp > (best?.deltaGp ?? -Infinity))) {
        bestDelta = deltaPoints;
        best = {
          player: add,
          deltaPoints,
          deltaGp,
          bestDrop: {
            player: drop,
            lostPoints
          },
          badges: []
        };
      }

      if (Date.now() - startedAt > REQUEST_TIMEOUT_MS) {
        writeRequestLog({
          reqId: reqId ?? 'unknown',
          userId,
          window,
          faCount: candidates.length,
          dropPoolCount: dropPool.length,
          durationMs: Date.now() - startedAt,
          truncatedFa,
          truncatedDrops,
          error: 'timeout'
        });
        throw new RecommendationTimeoutError();
      }
    }

    if (best) {
      intermediate.push({ rec: best, deltaPoints: best.deltaPoints });
    }
  }

  intermediate.sort((a, b) => b.deltaPoints - a.deltaPoints || b.rec.deltaGp - a.rec.deltaGp);
  const top = intermediate.slice(0, MAX_RECOMMENDATIONS);
  const durationMs = Date.now() - startedAt;

  writeRequestLog({
    reqId: reqId ?? 'unknown',
    userId,
    window,
    faCount: candidates.length,
    dropPoolCount: dropPool.length,
    durationMs,
    truncatedFa: truncatedFa || undefined,
    truncatedDrops: truncatedDrops || undefined
  });

  return {
    baselinePoints: baseline.totalPoints,
    recommendations: top.map((entry, index) => ({
      ...entry.rec,
      badges: collectBadges(
        entry.rec.player.team,
        entry.rec.player.id,
        window,
        index === 0
      )
    })),
    freeAgentCount: candidates.length,
    dropCount: dropPool.length,
    truncatedFa: truncatedFa || undefined,
    truncatedDrops: truncatedDrops || undefined
  };
}

export { UserDataError };
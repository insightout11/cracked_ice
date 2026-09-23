import type { AcquisitionScenario } from './acquisitionScenarios';
import { draftMarketRankForPlayer, type DraftMarketSource } from './draftMarket';
import type { PlayerSearchResult } from '../types';

export interface DiscoveredPickupCandidate {
  player: PlayerSearchResult;
  marketRank?: number;
  marketSource: DraftMarketSource;
  evidence: 'market' | 'nhl-sample';
}

export interface RecommendationLane {
  id: 'best-gain' | 'most-starts' | 'add-and-hold' | 'open-slot';
  title: string;
  description: string;
  scenario: AcquisitionScenario;
}

const POSITION_ORDER = ['C', 'LW', 'RW', 'D', 'G'] as const;

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function primaryPosition(player: PlayerSearchResult): string {
  return POSITION_ORDER.find((position) => player.pos.includes(position)) ?? player.pos[0] ?? 'SKATER';
}

function isCredibleAutomaticCandidate(player: PlayerSearchResult, marketRank: number | undefined): boolean {
  if (!player.team || player.team === 'FA' || player.pos.length === 0) return false;
  if (!Number.isFinite(player.blendedFppg) || (player.blendedFppg ?? 0) <= 0) return false;
  if (player.projectionStatus === 'unprojected') return false;
  const nhlSample = Math.max(player.games_played ?? 0, player.careerGamesPlayed ?? 0);
  return (marketRank !== undefined && marketRank > 0 && marketRank <= 300) || nhlSample >= 10;
}

export function discoverPickupCandidates(
  players: PlayerSearchResult[],
  options: {
    rosterPlayerIds: string[];
    existingCandidateIds: string[];
    excludedPlayerIds?: string[];
    marketSource: DraftMarketSource;
    limit?: number;
    maxPerPosition?: number;
  },
): DiscoveredPickupCandidate[] {
  const excluded = new Set([
    ...options.rosterPlayerIds,
    ...options.existingCandidateIds,
    ...(options.excludedPlayerIds ?? []),
  ].map(normalizeId));
  const marketSource = options.marketSource;
  const limit = options.limit ?? 12;
  const maxPerPosition = options.maxPerPosition ?? 3;
  const ranked = players.flatMap((player) => {
    if (excluded.has(normalizeId(player.id))) return [];
    const marketRank = draftMarketRankForPlayer(player.id, player.yahooAdp, marketSource);
    if (!isCredibleAutomaticCandidate(player, marketRank)) return [];
    const nhlSample = Math.max(player.games_played ?? 0, player.careerGamesPlayed ?? 0);
    return [{
      player,
      marketRank,
      marketSource,
      evidence: marketRank !== undefined && marketRank <= 300 ? 'market' as const : 'nhl-sample' as const,
      score: (marketRank ?? 360) - Math.min(60, (player.blendedFppg ?? 0) * 8) - Math.min(25, nhlSample / 8),
    }];
  }).sort((left, right) => left.score - right.score
    || (right.player.blendedFppg ?? 0) - (left.player.blendedFppg ?? 0)
    || left.player.name.localeCompare(right.player.name));

  const counts = new Map<string, number>();
  const selected: DiscoveredPickupCandidate[] = [];
  for (const candidate of ranked) {
    const position = primaryPosition(candidate.player);
    if ((counts.get(position) ?? 0) >= maxPerPosition) continue;
    counts.set(position, (counts.get(position) ?? 0) + 1);
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

function positiveScenarios(scenarios: AcquisitionScenario[]): AcquisitionScenario[] {
  return scenarios.filter((scenario) => scenario.impact.projectedPointsDelta > 0
    && scenario.materiality.outcome !== 'no-positive-improvement');
}

export function selectRecommendationLanes(scenarios: AcquisitionScenario[], limit = 4): RecommendationLane[] {
  const pool = positiveScenarios(scenarios);
  const usedAdditions = new Set<string>();
  const lanes: RecommendationLane[] = [];
  const addLane = (
    id: RecommendationLane['id'],
    title: string,
    description: string,
    sorted: AcquisitionScenario[],
  ) => {
    const scenario = sorted.find((item) => !usedAdditions.has(normalizeId(item.addition.id)));
    if (!scenario || lanes.length >= limit) return;
    usedAdditions.add(normalizeId(scenario.addition.id));
    lanes.push({ id, title, description, scenario });
  };

  addLane('best-gain', 'Best projected gain', 'Largest improvement over doing nothing.', [...pool].sort((a, b) => b.impact.projectedPointsDelta - a.impact.projectedPointsDelta));
  addLane('most-starts', 'Most usable starts', 'Creates the most additional lineup opportunities.', [...pool].sort((a, b) => b.impact.usableStartsDelta - a.impact.usableStartsDelta || b.impact.projectedPointsDelta - a.impact.projectedPointsDelta));
  addLane('add-and-hold', 'Best add and hold', 'Prefers the strongest longer-term scoring rate.', [...pool].sort((a, b) => (b.addition.blendedFppg ?? 0) - (a.addition.blendedFppg ?? 0) || b.impact.projectedPointsDelta - a.impact.projectedPointsDelta));
  addLane('open-slot', 'Fill an open slot', 'Improves the roster without requiring a drop.', [...pool].filter((scenario) => scenario.drop === null).sort((a, b) => b.impact.projectedPointsDelta - a.impact.projectedPointsDelta));
  return lanes;
}

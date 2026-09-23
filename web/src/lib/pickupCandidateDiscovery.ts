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

export interface RecommendationLanePreview extends RecommendationLane {
  alternatives: AcquisitionScenario[];
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

const LANE_DEFINITIONS: Array<{
  id: RecommendationLane['id'];
  title: string;
  description: string;
  sort: (left: AcquisitionScenario, right: AcquisitionScenario) => number;
  filter?: (scenario: AcquisitionScenario) => boolean;
}> = [
  { id: 'best-gain', title: 'Best projected gain', description: 'Largest improvement over doing nothing.', sort: (a, b) => b.impact.projectedPointsDelta - a.impact.projectedPointsDelta },
  { id: 'most-starts', title: 'Most usable starts', description: 'Creates the most additional lineup opportunities.', sort: (a, b) => b.impact.usableStartsDelta - a.impact.usableStartsDelta || b.impact.projectedPointsDelta - a.impact.projectedPointsDelta },
  { id: 'add-and-hold', title: 'Best add and hold', description: 'Prefers the strongest longer-term scoring rate.', sort: (a, b) => (b.addition.blendedFppg ?? 0) - (a.addition.blendedFppg ?? 0) || b.impact.projectedPointsDelta - a.impact.projectedPointsDelta },
  { id: 'open-slot', title: 'Fill an open slot', description: 'Improves the roster without requiring a drop.', filter: (scenario) => scenario.drop === null, sort: (a, b) => b.impact.projectedPointsDelta - a.impact.projectedPointsDelta },
];

export function selectRecommendationLanePreviews(scenarios: AcquisitionScenario[], limit = 4): RecommendationLanePreview[] {
  const pool = positiveScenarios(scenarios);
  const usedAdditions = new Set<string>();
  const lanes: RecommendationLanePreview[] = [];

  for (const definition of LANE_DEFINITIONS) {
    if (lanes.length >= limit) break;
    const ranked = pool.filter((scenario) => definition.filter?.(scenario) ?? true).sort(definition.sort);
    const scenario = ranked.find((item) => !usedAdditions.has(normalizeId(item.addition.id)));
    if (!scenario) continue;
    usedAdditions.add(normalizeId(scenario.addition.id));
    const alternatives = ranked
      .filter((item) => normalizeId(item.addition.id) !== normalizeId(scenario.addition.id))
      .filter((item, index, items) => items.findIndex((candidate) => normalizeId(candidate.addition.id) === normalizeId(item.addition.id)) === index)
      .slice(0, 2);
    lanes.push({ id: definition.id, title: definition.title, description: definition.description, scenario, alternatives });
  }
  return lanes;
}

export function selectRecommendationLanes(scenarios: AcquisitionScenario[], limit = 4): RecommendationLane[] {
  return selectRecommendationLanePreviews(scenarios, limit).map(({ alternatives: _alternatives, ...lane }) => lane);
}

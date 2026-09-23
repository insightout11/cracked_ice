import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import type { AcquisitionScenario } from '../../lib/acquisitionScenarios';
import { BestMovesStrip, topMoves } from './BestMovesStrip';

const scenario = (id: string, name: string, drop: string | null = 'Bench Guy'): AcquisitionScenario => ({
  id,
  addition: { id: `nhl:${id}`, full_name: name },
  drop: drop ? { id: 'nhl:9', full_name: drop } : null,
  impact: { projectedPointsDelta: 4.25, usableStartsDelta: 2 },
  availability: { status: 'available', freshness: 'current' },
} as unknown as AcquisitionScenario);

const result = (overrides: Partial<AcquisitionRecommendationResult>): AcquisitionRecommendationResult => ({
  status: 'ready',
  leadScenario: null,
  lanes: [],
  error: null,
  ...overrides,
} as AcquisitionRecommendationResult);

describe('topMoves', () => {
  it('leads with the best overall move and skips lanes that repeat it, up to three', () => {
    const lead = scenario('1', 'Lead Player');
    const moves = topMoves(result({
      leadScenario: lead,
      lanes: [
        { id: 'a', title: 'Best overall', scenario: lead, alternatives: [] },
        { id: 'b', title: 'Most usable starts', scenario: scenario('2', 'Second'), alternatives: [] },
        { id: 'c', title: 'Best add and hold', scenario: scenario('3', 'Third'), alternatives: [] },
        { id: 'd', title: 'Fill an open slot', scenario: scenario('4', 'Fourth', null), alternatives: [] },
      ] as unknown as AcquisitionRecommendationResult['lanes'],
    }));
    expect(moves.map((move) => [move.title, move.scenario.addition.full_name])).toEqual([
      ['Best overall', 'Lead Player'],
      ['Most usable starts', 'Second'],
      ['Best add and hold', 'Third'],
    ]);
  });
});

describe('BestMovesStrip', () => {
  const render = (value: AcquisitionRecommendationResult) => renderToStaticMarkup(<BestMovesStrip result={value} windowLabel="Sep 29 – Oct 5" onReview={vi.fn()} />);

  it('shows each move with its impact, drop and a review action', () => {
    const html = render(result({ leadScenario: scenario('1', 'Lead Player') }));
    expect(html).toContain('Sep 29 – Oct 5');
    expect(html).toContain('Lead Player');
    expect(html).toContain('Drop Bench Guy');
    expect(html).toContain('+4.3 pts · +2 starts');
    expect(html).toContain('Confirmed available');
    expect(html).toContain('Review');
  });

  it('says holding is reasonable when no move clearly helps', () => {
    expect(render(result({ status: 'no-clear-upgrade' }))).toContain('Holding is reasonable');
  });

  it('shows a loading placeholder and a readable error', () => {
    expect(render(result({ status: 'loading' }))).toContain('animate-pulse');
    expect(render(result({ status: 'error', error: 'The player directory could not be loaded.' }))).toContain('The player directory could not be loaded.');
  });
});

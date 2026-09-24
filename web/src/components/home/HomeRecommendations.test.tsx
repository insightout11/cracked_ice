import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { buildAcquisitionRecommendationResult, type AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import { createAcquisitionDemo } from '../../lib/acquisitionDemo';
import { createDefaultLeagueWorkspace } from '../../lib/leagueWorkspace';
import type { PlayerSearchResult } from '../../types';
import type { TimeWindowState } from '../../types/timeWindow';
import { HomeRecommendations } from './HomeRecommendations';

function fixture(): { workspace: ReturnType<typeof createDefaultLeagueWorkspace>; timeWindow: TimeWindowState; result: AcquisitionRecommendationResult } {
  const demo = createAcquisitionDemo(createDefaultLeagueWorkspace({ id: 'home-recommendation' }));
  const workspace = {
    ...demo.workspace,
    candidates: [{ playerId: 'demo-candidate', availability: 'unknown' as const, status: 'unknown' as const }],
  };
  const players: PlayerSearchResult[] = [
    { id: 'demo-anchor', name: 'Protected anchor', team: 'TEST', pos: ['RW'], aliases: [], blendedFppg: 7, games_played: 30 },
    { id: 'demo-current', name: 'Current RW', team: 'TEST', pos: ['RW'], aliases: [], blendedFppg: 3, games_played: 30 },
    { id: 'demo-candidate', name: 'Candidate RW', team: 'TEST', pos: ['RW'], aliases: [], blendedFppg: 4, games_played: 30 },
  ];
  const timeWindow: TimeWindowState = { mode: 'regular', preset: 'custom', config: { startUtc: `${demo.window.start}T00:00:00.000Z`, endUtc: `${demo.window.end}T23:59:59.999Z`, source: 'custom' } };
  const calculated = buildAcquisitionRecommendationResult(workspace, demo.roster, players, demo.projections, timeWindow);
  return { workspace, timeWindow, result: { status: 'ready', directoryLoading: false, projectionLoading: false, error: null, players, roster: demo.roster, candidateProjections: demo.projections, mergedProjections: demo.projections, ...calculated } };
}

describe('Home recommendations', () => {
  it('shows conditional impact and links the exact scenario to Pickup Board', () => {
    const { workspace, timeWindow, result } = fixture();
    const html = renderToStaticMarkup(<StaticRouter location="/"><HomeRecommendations workspace={workspace} timeWindow={timeWindow} result={result} /></StaticRouter>);
    expect(html).toContain('Your next decision');
    expect(html).toContain('Availability not checked');
    expect(html).toContain('Review move');
    expect(html).toContain('scenario=acq-');
    expect(html).toContain('fingerprint=');
    expect(html).toContain('#pickup-board');
  });

  it('does not turn a projection failure into a hold recommendation', () => {
    const { workspace, timeWindow, result } = fixture();
    const html = renderToStaticMarkup(<StaticRouter location="/"><HomeRecommendations workspace={workspace} timeWindow={timeWindow} result={{ ...result, status: 'error', error: 'Projection service unavailable.' }} /></StaticRouter>);
    expect(html).toContain('Personalized decision unavailable');
    expect(html).not.toContain('Holding is reasonable');
  });
});

import { describe, expect, it } from 'vitest';
import { createAcquisitionDemo } from '../lib/acquisitionDemo';
import { createDefaultLeagueWorkspace } from '../lib/leagueWorkspace';
import type { PlayerSearchResult } from '../types';
import type { TimeWindowState } from '../types/timeWindow';
import { acquisitionAvailabilityLabel, buildAcquisitionRecommendationResult, withDirectoryInjuries } from './useAcquisitionRecommendations';

function directoryPlayer(id: string, name: string, options: Partial<PlayerSearchResult> = {}): PlayerSearchResult {
  return { id, name, team: 'TEST', pos: ['RW'], aliases: [], blendedFppg: 4, games_played: 30, ...options };
}

describe('shared acquisition recommendations', () => {
  it('applies the nightly injury feed to the player list', () => {
    const players = [directoryPlayer('nhl:8479406', 'Filip Gustavsson', { pos: ['G'] }), directoryPlayer('nhl:1', 'Healthy', { injuryStatus: 'DTD' })];
    const snapshot = { updatedAt: '2026-09-27', players: { 'nhl:8479406': { status: 'O', statusFull: 'Out', note: 'Hip', updatedAt: null } } };
    expect(withDirectoryInjuries(players, snapshot).map((player) => player.injuryStatus)).toEqual(['O', 'DTD']);
    expect(withDirectoryInjuries(players, null)).toBe(players);
  });

  it('never recommends adding an injured player, even one marked available', () => {
    const demo = createAcquisitionDemo(createDefaultLeagueWorkspace({ id: 'injured' }));
    const timeWindow: TimeWindowState = { mode: 'regular', preset: 'custom', config: { startUtc: `${demo.window.start}T00:00:00.000Z`, endUtc: `${demo.window.end}T23:59:59.999Z`, source: 'custom' } };
    const players = (status?: string) => [directoryPlayer('demo-anchor', 'Protected anchor'), directoryPlayer('demo-current', 'Current RW', { blendedFppg: 3 }), directoryPlayer('demo-candidate', 'Candidate RW', status ? { injuryStatus: status } : {})];
    for (const candidate of [
      { playerId: 'demo-candidate', availability: 'user-confirmed' as const, status: 'available' as const, observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
      { playerId: 'demo-candidate', availability: 'unknown' as const, status: 'unknown' as const },
    ]) {
      const workspace = { ...demo.workspace, candidates: [candidate] };
      const additions = (status?: string) => buildAcquisitionRecommendationResult(workspace, demo.roster, players(status), demo.projections, timeWindow).allScenarios.map((scenario) => scenario.addition.id);
      expect(additions()).toContain('demo-candidate');
      expect(additions('O')).not.toContain('demo-candidate');
      expect(additions('DTD')).toContain('demo-candidate');
    }
  });

  it('returns identical scenario identity and values for Home and Pickup Board consumers', () => {
    const demo = createAcquisitionDemo(createDefaultLeagueWorkspace({ id: 'shared-result' }));
    const workspace = {
      ...demo.workspace,
      candidates: [{
        playerId: 'demo-candidate', availability: 'user-confirmed' as const, status: 'available' as const,
        observedAt: '2026-09-23T00:00:00.000Z', expiresAt: '2026-09-24T00:00:00.000Z',
      }],
    };
    const players = [directoryPlayer('demo-anchor', 'Protected anchor'), directoryPlayer('demo-current', 'Current RW', { blendedFppg: 3 }), directoryPlayer('demo-candidate', 'Candidate RW')];
    const timeWindow: TimeWindowState = { mode: 'regular', preset: 'custom', config: { startUtc: `${demo.window.start}T00:00:00.000Z`, endUtc: `${demo.window.end}T23:59:59.999Z`, source: 'custom' } };
    const home = buildAcquisitionRecommendationResult(workspace, demo.roster, players, demo.projections, timeWindow);
    const board = buildAcquisitionRecommendationResult(workspace, demo.roster, players, demo.projections, timeWindow);
    expect(home.allScenarios.map(({ id, calculationFingerprint, addition, drop, impact, analysis, availability }) => ({ id, calculationFingerprint, addition: addition.id, drop: drop?.id, impact, analysis: { start: analysis.start, end: analysis.end, projectionSource: analysis.projectionSource }, availability })))
      .toEqual(board.allScenarios.map(({ id, calculationFingerprint, addition, drop, impact, analysis, availability }) => ({ id, calculationFingerprint, addition: addition.id, drop: drop?.id, impact, analysis: { start: analysis.start, end: analysis.end, projectionSource: analysis.projectionSource }, availability })));
  });

  it('keeps stale observations reviewable and excludes drafted or unavailable players from automatic suggestions', () => {
    const demo = createAcquisitionDemo(createDefaultLeagueWorkspace({ id: 'exclusions' }));
    const workspace = {
      ...demo.workspace,
      candidates: [{ playerId: 'demo-candidate', availability: 'user-confirmed' as const, status: 'available' as const, observedAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z' }],
      draftSession: { ...demo.workspace.draftSession, picks: [{ playerId: 'drafted', status: 'taken' as const }], unavailablePlayerIds: ['keeper'] },
    };
    const players = [
      directoryPlayer('demo-anchor', 'Protected anchor'), directoryPlayer('demo-current', 'Current RW', { blendedFppg: 3 }), directoryPlayer('demo-candidate', 'Candidate RW'),
      directoryPlayer('drafted', 'Drafted star', { yahooAdp: 1 }), directoryPlayer('keeper', 'Keeper', { yahooAdp: 2 }), directoryPlayer('available', 'Plausible target', { yahooAdp: 80 }),
    ];
    const projections = { ...demo.projections, available: demo.projections['demo-candidate'] };
    const timeWindow: TimeWindowState = { mode: 'regular', preset: 'custom', config: { startUtc: `${demo.window.start}T00:00:00.000Z`, endUtc: `${demo.window.end}T23:59:59.999Z`, source: 'custom' } };
    const result = buildAcquisitionRecommendationResult(workspace, demo.roster, players, projections, timeWindow);
    expect(result.automaticCandidates.map(({ player }) => player.id)).toContain('available');
    expect(result.automaticCandidates.map(({ player }) => player.id)).not.toEqual(expect.arrayContaining(['drafted', 'keeper']));
    const stale = result.targetScenarios.find((scenario) => scenario.addition.id === 'demo-candidate');
    expect(stale && acquisitionAvailabilityLabel(stale)).toBe('Needs recheck');
  });
});

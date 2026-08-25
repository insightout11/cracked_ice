import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { assignDraftSlot, buildDraftCandidateContext, buildDraftMarketContext, buildDraftTiers, currentDraftRound, readDraftRoomLayout, sortDraftBoardCandidates, withDraftRoomLayout } from './draftRoom';
import type { RankedDraftCandidate } from './draftStrategy';

function ranked(id: string, position: string, total: number): RankedDraftCandidate {
  return {
    player: { id, name: `Player ${id}`, team: 'TBL', pos: [position], aliases: [], blendedFppg: 3, productionValue: 3, productionLabel: 'FPPG', scoringBreakdown: null },
    score: {
      playerId: id,
      total,
      components: { production: total, regularSeason: total, playoffs: total, positionValue: total },
      contributions: { production: total, regularSeason: 0, playoffs: 0, positionValue: 0 },
      metrics: { fppg: 3, projectedFppg: 3, projectionDeltaPercent: 0, projectionTrajectory: 'stable', projectionConfidence: 'high', projectionVolatility: 'low', projectionReasons: ['Stable baseline'], projectedGames: 82, sampleGames: 82, productionReliability: 1, regularGames: 82, regularOffNights: 30, regularUsableStarts: 82, regularBlockedStarts: 0, playoffGames: 12, playoffOffNights: 5, playoffUsableStarts: 12, playoffBlockedStarts: 0, fantasySeasonGames: 94, fantasySeasonUsableStarts: 94, projectedFantasyPoints: 282, postFantasyGames: 0, playoffWeeks: [{ index: 1, label: 'Championship', start: '2027-03-01', end: '2027-03-07', games: 4, offNights: 2, usableStarts: 4, isChampionship: true }], championshipWeek: { index: 1, label: 'Championship', start: '2027-03-01', end: '2027-03-07', games: 4, offNights: 2, usableStarts: 4, isChampionship: true }, valueOverReplacement: 1, replacementFppg: 2, replacementPosition: position, marketPosition: position, marketScarcity: 50, flexibilityBonus: 0 },
    },
  };
}

describe('Draft room', () => {
  it('forms visible tiers at meaningful score gaps', () => {
    const tiers = buildDraftTiers([ranked('1', 'C', 90), ranked('2', 'RW', 88), ranked('3', 'D', 83)]);
    expect(tiers.map((tier) => [tier.label, tier.candidates.map((candidate) => candidate.player.id)])).toEqual([
      ['C Tier 1', ['1']],
      ['RW Tier 1', ['2']],
      ['D Tier 1', ['3']],
    ]);
  });

  it('builds independent positional tiers and includes dual-eligible players in each lane', () => {
    const dual = ranked('dual', 'C', 90);
    dual.player.pos = ['C', 'RW'];
    const tiers = buildDraftTiers([dual, ranked('c2', 'C', 88), ranked('rw2', 'RW', 82)]);
    expect(tiers.find((tier) => tier.label === 'C Tier 1')?.candidates.map((candidate) => candidate.player.id)).toEqual(['dual', 'c2']);
    expect(tiers.find((tier) => tier.label === 'RW Tier 1')?.candidates.map((candidate) => candidate.player.id)).toEqual(['dual']);
    expect(tiers.find((tier) => tier.label === 'RW Tier 2')?.candidates.map((candidate) => candidate.player.id)).toEqual(['rw2']);
  });

  it('starts a new tier when gradual gaps drift too far from the tier leader', () => {
    const tiers = buildDraftTiers([
      ranked('1', 'D', 90),
      ranked('2', 'D', 88),
      ranked('3', 'D', 86),
      ranked('4', 'D', 84),
    ]);
    expect(tiers.map((tier) => tier.candidates.map((candidate) => candidate.player.id))).toEqual([
      ['1', '2', '3'],
      ['4'],
    ]);
  });

  it('identifies when a position has comparable options left', () => {
    const context = buildDraftCandidateContext([ranked('1', 'C', 90), ranked('2', 'D', 89), ranked('3', 'C', 88), ranked('4', 'C', 87.5), ranked('5', 'C', 87)]);
    expect(context.get('1')).toMatchObject({ position: 'C', similarAtPosition: 2, advice: 'balanced' });
    expect(context.get('2')).toMatchObject({ position: 'D', similarAtPosition: 0, advice: 'take-now' });
  });

  it('measures Yahoo value as the picks available after the Cracked Ice rank', () => {
    const first = ranked('1', 'C', 95);
    const second = ranked('2', 'C', 90);
    const unrankedMarket = ranked('3', 'C', 85);
    first.player.yahooAdp = 14.5;
    second.player.yahooAdp = 4;
    const market = buildDraftMarketContext([first, second, unrankedMarket]);
    expect(market.get('1')).toEqual({ crackedIceRank: 1, valueVsAdp: 13.5 });
    expect(market.get('2')).toEqual({ crackedIceRank: 2, valueVsAdp: 2 });
    expect(market.get('3')).toEqual({ crackedIceRank: 3, valueVsAdp: null });
  });

  it('sorts the ranked board by market value and leaves missing ADP last', () => {
    const earlyValue = ranked('value', 'LW', 84);
    const marketReach = ranked('reach', 'RW', 92);
    const missing = ranked('missing', 'D', 88);
    earlyValue.player.yahooAdp = 40;
    marketReach.player.yahooAdp = 2;
    const rankings = [marketReach, missing, earlyValue];
    const market = buildDraftMarketContext(rankings);
    expect(sortDraftBoardCandidates(rankings, market, 'valueVsAdp').map((candidate) => candidate.player.id)).toEqual(['value', 'reach', 'missing']);
    expect(sortDraftBoardCandidates(rankings, market, 'yahooAdp').map((candidate) => candidate.player.id)).toEqual(['reach', 'value', 'missing']);
  });

  it('assigns drafted players around keepers and advances rounds', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.rosterRules.slots = { C: 1, RW: 1, BN: 1 };
    workspace.roster = [{ playerId: 'k', fullName: 'Keeper', team: 'TBL', positions: ['C'], slot: 'C', keeper: true, protected: false, undroppable: false }];
    expect(assignDraftSlot(workspace, { pos: ['C', 'RW'] })).toBe('RW');
    workspace.numberOfTeams = 2;
    workspace.draftSession.picks = [
      { playerId: '1', fullName: 'One', team: 'TBL', positions: ['C'], status: 'taken', source: 'manual', madeAt: '2026-07-24T00:00:00.000Z' },
      { playerId: '2', fullName: 'Two', team: 'TBL', positions: ['C'], status: 'taken', source: 'manual', madeAt: '2026-07-24T00:00:01.000Z' },
    ];
    expect(currentDraftRound(workspace)).toBe(2);
  });

  it('keeps compact mode URL-addressable while full remains the clean default', () => {
    const base = new URLSearchParams('tool=draft&position=RW');
    const compact = withDraftRoomLayout(base, 'compact');
    expect(compact.toString()).toBe('tool=draft&position=RW&layout=compact');
    expect(readDraftRoomLayout(compact)).toBe('compact');
    const full = withDraftRoomLayout(compact, 'full');
    expect(full.toString()).toBe('tool=draft&position=RW');
    expect(readDraftRoomLayout(full)).toBe('full');
  });
});

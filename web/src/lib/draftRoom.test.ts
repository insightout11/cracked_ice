import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { assignDraftActiveSlot, assignDraftSlot, buildDraftCandidateContext, buildDraftMarketContext, buildDraftRecommendationLanes, buildDraftTiers, configuredDraftRounds, currentDraftRound, draftOverallPickForTeam, draftTeamSlotAtPick, mergeDraftRecommendationLane, nextDraftOverallPick, nextDraftOverallPickForStatus, readDraftRoomLayout, resolveDraftBoardPicks, resolvedDraftPosition, sortDraftBoardCandidates, syncDraftRoster, withDraftRoomLayout } from './draftRoom';
import type { RankedDraftCandidate } from './draftStrategy';

function ranked(id: string, position: string, total: number): RankedDraftCandidate {
  return {
    player: { id, name: `Player ${id}`, team: 'TBL', pos: [position], aliases: [], blendedFppg: 3, productionValue: 3, productionLabel: 'FPPG', scoringBreakdown: null },
    score: {
      playerId: id,
      total,
      components: { production: total, regularSeason: total, playoffs: total, positionValue: total },
      contributions: { production: total, regularSeason: 0, playoffs: 0, positionValue: 0 },
      metrics: { fppg: 3, projectedFppg: 3, projectionDeltaPercent: 0, projectionTrajectory: 'stable', projectionConfidence: 'high', projectionVolatility: 'low', projectionReasons: ['Stable baseline'], projectedGames: 82, sampleGames: 82, productionReliability: 1, regularGames: 82, regularOffNights: 30, regularUsableStarts: 82, regularAddedStarts: 82, regularBlockedStarts: 0, playoffGames: 12, playoffOffNights: 5, playoffUsableStarts: 12, playoffAddedStarts: 12, playoffBlockedStarts: 0, fantasySeasonGames: 94, fantasySeasonUsableStarts: 94, fantasySeasonAddedStarts: 94, standardizedFantasyPoints: 252, projectedFantasyPoints: 282, marginalProjectedPoints: 282, postFantasyGames: 0, playoffWeeks: [{ index: 1, label: 'Championship', start: '2027-03-01', end: '2027-03-07', games: 4, offNights: 2, usableStarts: 4, isChampionship: true }], championshipWeek: { index: 1, label: 'Championship', start: '2027-03-01', end: '2027-03-07', games: 4, offNights: 2, usableStarts: 4, isChampionship: true }, valueOverReplacement: 1, replacementFppg: 2, replacementPosition: position, marketPosition: position, marketScarcity: 50, flexibilityBonus: 0 },
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

  it('keeps preseason Cracked Ice ranks stable after players are drafted', () => {
    const first = ranked('first', 'C', 95);
    const second = ranked('second', 'LW', 90);
    const third = ranked('third', 'D', 85);
    first.player.yahooAdp = 2;
    second.player.yahooAdp = 12;
    third.player.yahooAdp = 30;
    const preseasonMarket = buildDraftMarketContext([first, second, third]);
    const remaining = [second, third];

    expect(preseasonMarket.get('second')).toEqual({ crackedIceRank: 2, valueVsAdp: 10 });
    expect(sortDraftBoardCandidates(remaining, preseasonMarket, 'valueVsAdp').map((candidate) => candidate.player.id)).toEqual(['third', 'second']);
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

  it('maps a snake draft into team columns in both directions', () => {
    expect(Array.from({ length: 10 }, (_, index) => draftTeamSlotAtPick(index + 1, 10))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(Array.from({ length: 10 }, (_, index) => draftTeamSlotAtPick(index + 11, 10))).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(draftOverallPickForTeam(1, 5, 10)).toBe(5);
    expect(draftOverallPickForTeam(2, 5, 10)).toBe(16);
  });

  it('keeps planner picks in the user or opponent lane even when the board has gaps', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { C: 2, BN: 1 };
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 3;
    workspace.draftSession.picks = [
      { playerId: '1', fullName: 'One', team: 'TBL', positions: ['C'], status: 'taken', overallPick: 1, source: 'simulation', madeAt: '2026-07-24T00:00:00.000Z' },
      { playerId: '2', fullName: 'Two', team: 'TBL', positions: ['C'], status: 'taken', overallPick: 2, source: 'simulation', madeAt: '2026-07-24T00:00:01.000Z' },
      { playerId: '4', fullName: 'Four', team: 'TBL', positions: ['C'], status: 'taken', overallPick: 4, source: 'simulation', madeAt: '2026-07-24T00:00:02.000Z' },
    ];
    expect(nextDraftOverallPickForStatus(workspace, 'mine')).toBe(3);
    expect(nextDraftOverallPickForStatus(workspace, 'taken')).toBe(5);
    expect(currentDraftRound(workspace)).toBe(1);

    workspace.draftSession.picks.push({ playerId: '3', fullName: 'Three', team: 'TBL', positions: ['C'], status: 'mine', overallPick: 3, source: 'manual', madeAt: '2026-07-24T00:00:03.000Z' });
    expect(nextDraftOverallPickForStatus(workspace, 'mine')).toBe(6);
    expect(currentDraftRound(workspace)).toBe(2);
  });

  it('gives legacy manual picks stable overall numbers and infers my draft slot', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 10;
    workspace.rosterRules.slots = { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4, IR: 2 };
    workspace.draftSession.picks = Array.from({ length: 16 }, (_, index) => ({
      playerId: `player-${index + 1}`,
      fullName: `Player ${index + 1}`,
      team: 'TBL',
      positions: ['C'],
      status: index === 15 ? 'mine' as const : 'taken' as const,
      source: 'manual' as const,
      madeAt: `2026-07-24T00:00:${String(index).padStart(2, '0')}.000Z`,
    }));

    expect(resolveDraftBoardPicks(workspace).map((entry) => entry.overallPick)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
    expect(resolvedDraftPosition(workspace)).toBe(5);
    expect(nextDraftOverallPick(workspace)).toBe(17);
    expect(configuredDraftRounds(workspace)).toBe(16);
  });

  it('keeps an elite center visible when center is full and defence is open', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.rosterRules.slots = { C: 1, D: 1, BN: 2 };
    workspace.draftSession.picks = [
      { playerId: 'c-rostered', fullName: 'Rostered Center', team: 'TBL', positions: ['C'], status: 'mine', slot: 'C', source: 'manual', madeAt: '2026-07-24T00:00:00.000Z' },
    ];
    const eliteCenter = ranked('elite-c', 'C', 95); const defender = ranked('d1', 'D', 80);
    const lanes = buildDraftRecommendationLanes(workspace, [eliteCenter, defender], buildDraftMarketContext([eliteCenter, defender]));
    expect(assignDraftActiveSlot(workspace, eliteCenter.player)).toBeUndefined();
    expect(assignDraftSlot(workspace, eliteCenter.player)).toBe('BN');
    expect(lanes.find((item) => item.candidate.player.id === 'elite-c')?.labels).toContain('Best overall');
    expect(lanes.find((item) => item.candidate.player.id === 'd1')?.labels).toContain('Best roster fit');
  });

  it('requires a material fall versus both Yahoo ADP and initial CI rank', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.draftSession.picks = Array.from({ length: 12 }, (_, index) => ({ playerId: `taken-${index}`, fullName: `Taken ${index}`, team: 'TBL', positions: ['C'], status: 'taken' as const, source: 'manual' as const, madeAt: '2026-07-24T00:00:00.000Z' }));
    const earlier = ranked('earlier', 'C', 95); earlier.player.yahooAdp = 20;
    const fallen = ranked('fallen', 'D', 90); fallen.player.yahooAdp = 6;
    const lanes = buildDraftRecommendationLanes(workspace, [earlier, fallen], buildDraftMarketContext([earlier, fallen]));
    expect(lanes.find((item) => item.candidate.player.id === 'fallen')?.labels).toContain('Value that fell');
  });

  it('standardizes skater production while retaining goalie workload for best overall', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    const highRate = ranked('high-rate', 'G', 95); highRate.score.metrics.projectedFppg = 5; highRate.score.metrics.projectedGames = 30; highRate.score.metrics.standardizedFantasyPoints = 150;
    const fullWorkload = ranked('full-workload', 'C', 90); fullWorkload.score.metrics.projectedFppg = 4; fullWorkload.score.metrics.projectedGames = 42; fullWorkload.score.metrics.standardizedFantasyPoints = 336;
    const lanes = buildDraftRecommendationLanes(workspace, [highRate, fullWorkload], buildDraftMarketContext([highRate, fullWorkload]));
    expect(lanes.find((item) => item.labels.includes('Best overall'))?.candidate.player.id).toBe('full-workload');
    expect(mergeDraftRecommendationLane([{ candidate: highRate, labels: ['Best overall'] }], highRate, 'Goalie lane')).toEqual([{ candidate: highRate, labels: ['Best overall', 'Goalie lane'] }]);
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

  it('syncs my draft picks into My Team and removes an undone pick', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.roster = [{ playerId: 'keeper', fullName: 'Keeper', team: 'TBL', positions: ['C'], slot: 'C', keeper: true, protected: false, undroppable: false }];
    workspace.draftSession.picks = [
      { playerId: 'mine-1', fullName: 'My Wing', team: 'BOS', positions: ['RW'], status: 'mine', slot: 'RW', source: 'manual', madeAt: '2026-07-24T00:00:00.000Z' },
      { playerId: 'other', fullName: 'Opponent Pick', team: 'COL', positions: ['D'], status: 'taken', source: 'manual', madeAt: '2026-07-24T00:00:01.000Z' },
    ];

    const synced = syncDraftRoster(workspace);
    expect(synced).toEqual([
      expect.objectContaining({ playerId: 'keeper', keeper: true }),
      expect.objectContaining({ playerId: 'mine-1', fullName: 'My Wing', slot: 'RW', keeper: false }),
    ]);

    const withoutMine = syncDraftRoster({ ...workspace, roster: synced }, { ...workspace.draftSession, picks: workspace.draftSession.picks.slice(1) });
    expect(withoutMine.map((entry) => entry.playerId)).toEqual(['keeper']);
  });
});

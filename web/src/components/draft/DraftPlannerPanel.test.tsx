import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftPlannerPanel, draftComparisonPath } from './DraftPlannerPanel';

describe('DraftPlannerPanel', () => {
  it('builds a preselected two-player draft comparison link', () => {
    expect(draftComparisonPath(['stone', 'sennecke'])).toBe('/compare?mode=draft&a=stone&b=sennecke&from=draft-planner');
    expect(draftComparisonPath(['stone'])).toBeNull();
  });

  it('offers every future pick and avoids presenting certainty as 100 percent', () => {
    const markup = renderToStaticMarkup(<DraftPlannerPanel
      mode="planner"
      projectionLabel="Cracked Ice"
      hasDraftPosition
      pickCount={0}
      simulatedPickCount={0}
      numberOfTeams={10}
      draftPosition={5}
      orderType="snake"
      summary={{ playerCount: 0, regularStarts: 0, regularPoints: 0, playoffStarts: 0, playoffPoints: 0 }}
      availability={[
        { playerId: '1', name: 'Player One', team: 'EDM', positions: ['C'], yahooAdp: 25, probability: 99.8 },
        { playerId: '2', name: 'Player Two', team: 'COL', positions: ['D'], yahooAdp: 48, probability: 42.4 },
        { playerId: '3', name: 'No ADP Goalie', team: 'LAK', positions: ['G'], yahooAdp: null, probability: 45 },
      ]}
      availabilityCurves={[]}
      availabilityTargets={[{ round: 1, overallPick: 5 }, { round: 2, overallPick: 16 }, { round: 3, overallPick: 25 }]}
      availabilityPick={16}
      availabilityQuery=""
      targets={[]}
      onModeChange={() => undefined}
      onTeamCountChange={() => undefined}
      onDraftPositionChange={() => undefined}
      onOrderTypeChange={() => undefined}
      onSimulateToNext={() => undefined}
      onSimulateRest={() => undefined}
      onReroll={() => undefined}
      onReset={() => undefined}
      onApplyRoster={() => undefined}
      onAvailabilityPickChange={() => undefined}
      onAvailabilityQueryChange={() => undefined}
      onAddTargetAtPick={() => undefined}
    />);

    expect(markup).toContain('Availability at pick #16');
    expect(markup).toContain('My draft slot');
    expect(markup).toContain('Linear');
    expect(markup).toContain('Round-by-round plan');
    expect(markup).toContain('Round 2 · Pick #16');
    expect(markup).toContain('R1 · #5');
    expect(markup).toContain('R3 · #25');
    expect(markup).toContain('&gt;99%');
    expect(markup).not.toContain('100%');
    expect(markup).toContain('Find a player or team');
    expect(markup).toContain('Decision zone');
    expect(markup).toContain('Likely available later');
    expect(markup).toContain('Target around here');
    expect(markup).toContain('Compare');
    expect(markup).not.toContain('No ADP Goalie');
  });

  it('turns a searched player into safer and aggressive exact-pick targets', () => {
    const markup = renderToStaticMarkup(<DraftPlannerPanel
      mode="planner"
      projectionLabel="Dom"
      hasDraftPosition
      pickCount={0}
      simulatedPickCount={0}
      numberOfTeams={13}
      draftPosition={4}
      orderType="snake"
      summary={{ playerCount: 0, regularStarts: 0, regularPoints: 0, playoffStarts: 0, playoffPoints: 0 }}
      availability={[{ playerId: 'smith', name: 'Will Smith', team: 'SJS', positions: ['LW', 'RW'], yahooAdp: 63.4, probability: 39 }]}
      availabilityCurves={[{ playerId: 'smith', points: [
        { round: 7, overallPick: 64, probability: 76 },
        { round: 8, overallPick: 77, probability: 39 },
      ] }]}
      availabilityTargets={[{ round: 7, overallPick: 64 }, { round: 8, overallPick: 77 }]}
      availabilityPick={77}
      availabilityQuery="smith"
      targets={[]}
      onModeChange={() => undefined}
      onTeamCountChange={() => undefined}
      onDraftPositionChange={() => undefined}
      onOrderTypeChange={() => undefined}
      onSimulateToNext={() => undefined}
      onSimulateRest={() => undefined}
      onReroll={() => undefined}
      onReset={() => undefined}
      onApplyRoster={() => undefined}
      onAvailabilityPickChange={() => undefined}
      onAvailabilityQueryChange={() => undefined}
      onAddTargetAtPick={() => undefined}
    />);

    expect(markup).toContain('Will Smith availability curve');
    expect(markup).toContain('Safer target: R7');
    expect(markup).toContain('Aggressive target: R8');
    expect(markup).toContain('76% chance still available');
    expect(markup).toContain('39% chance still available');
  });

  it('offers manual rounds instead of invented odds when Yahoo ADP is unavailable', () => {
    const markup = renderToStaticMarkup(<DraftPlannerPanel
      mode="planner" projectionLabel="Cracked Ice" hasDraftPosition pickCount={0} simulatedPickCount={0}
      numberOfTeams={10} draftPosition={8} orderType="snake"
      summary={{ playerCount: 0, regularStarts: 0, regularPoints: 0, playoffStarts: 0, playoffPoints: 0 }}
      availability={[{ playerId: 'forsberg', name: 'Anton Forsberg', team: 'LAK', positions: ['G'], yahooAdp: null, probability: 37 }]}
      availabilityCurves={[{ playerId: 'forsberg', points: [{ round: 1, overallPick: 8, probability: 37 }] }]}
      availabilityTargets={[{ round: 1, overallPick: 8 }, { round: 2, overallPick: 13 }]}
      availabilityPick={8} availabilityQuery="forsberg" targets={[]}
      onModeChange={() => undefined} onTeamCountChange={() => undefined} onDraftPositionChange={() => undefined}
      onOrderTypeChange={() => undefined} onSimulateToNext={() => undefined} onSimulateRest={() => undefined}
      onReroll={() => undefined} onReset={() => undefined} onApplyRoster={() => undefined}
      onAvailabilityPickChange={() => undefined} onAvailabilityQueryChange={() => undefined} onAddTargetAtPick={() => undefined}
    />);

    expect(markup).toContain('Yahoo ADP unavailable');
    expect(markup).toContain('Choose a round manually');
    expect(markup).not.toContain('37% chance');
  });

  it('labels reassignment as moving an existing target', () => {
    const markup = renderToStaticMarkup(<DraftPlannerPanel
      mode="planner"
      projectionLabel="Dom"
      hasDraftPosition
      pickCount={0}
      simulatedPickCount={0}
      numberOfTeams={10}
      draftPosition={4}
      orderType="snake"
      summary={{ playerCount: 0, regularStarts: 0, regularPoints: 0, playoffStarts: 0, playoffPoints: 0 }}
      availability={[{ playerId: 'dahlin', name: 'Rasmus Dahlin', team: 'BUF', positions: ['D'], yahooAdp: 35.8, probability: 5 }]}
      availabilityCurves={[{ playerId: 'dahlin', points: [
        { round: 3, overallPick: 24, probability: 98 },
        { round: 4, overallPick: 37, probability: 43 },
        { round: 5, overallPick: 44, probability: 5 },
      ] }]}
      availabilityTargets={[{ round: 3, overallPick: 24 }, { round: 4, overallPick: 37 }, { round: 5, overallPick: 44 }]}
      availabilityPick={44}
      availabilityQuery="dahlin"
      targets={[{ playerId: 'dahlin', fullName: 'Rasmus Dahlin', priority: 'high', targetRound: 4, targetOverallPick: 37, backupOrder: 0, addedAt: '2026-08-31T00:00:00.000Z' }]}
      onModeChange={() => undefined}
      onTeamCountChange={() => undefined}
      onDraftPositionChange={() => undefined}
      onOrderTypeChange={() => undefined}
      onSimulateToNext={() => undefined}
      onSimulateRest={() => undefined}
      onReroll={() => undefined}
      onReset={() => undefined}
      onApplyRoster={() => undefined}
      onAvailabilityPickChange={() => undefined}
      onAvailabilityQueryChange={() => undefined}
      onAddTargetAtPick={() => undefined}
    />);

    expect(markup).toContain('Targeted R4');
    expect(markup).toContain('Move target to: R5');
    expect(markup).not.toContain('Target selected: R5');
  });
});

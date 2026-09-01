import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftPlannerPanel } from './DraftPlannerPanel';

describe('DraftPlannerPanel', () => {
  it('offers every future pick and avoids presenting certainty as 100 percent', () => {
    const markup = renderToStaticMarkup(<DraftPlannerPanel
      mode="planner"
      projectionLabel="Cracked Ice"
      hasDraftPosition
      pickCount={0}
      simulatedPickCount={0}
      numberOfTeams={10}
      summary={{ playerCount: 0, regularStarts: 0, regularPoints: 0, playoffStarts: 0, playoffPoints: 0 }}
      availability={[
        { playerId: '1', name: 'Player One', team: 'EDM', positions: ['C'], yahooAdp: 25, probability: 99.8 },
        { playerId: '2', name: 'Player Two', team: 'COL', positions: ['D'], yahooAdp: 48, probability: 42.4 },
      ]}
      availabilityCurves={[]}
      availabilityTargets={[{ round: 1, overallPick: 5 }, { round: 2, overallPick: 16 }, { round: 3, overallPick: 25 }]}
      availabilityPick={16}
      availabilityQuery=""
      targets={[]}
      onModeChange={() => undefined}
      onTeamCountChange={() => undefined}
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
    expect(markup).toContain('R1 · #5');
    expect(markup).toContain('R3 · #25');
    expect(markup).toContain('&gt;99%');
    expect(markup).not.toContain('100%');
    expect(markup).toContain('Find a player or team');
  });

  it('turns a searched player into safer and aggressive exact-pick targets', () => {
    const markup = renderToStaticMarkup(<DraftPlannerPanel
      mode="planner"
      projectionLabel="Dom"
      hasDraftPosition
      pickCount={0}
      simulatedPickCount={0}
      numberOfTeams={13}
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
});

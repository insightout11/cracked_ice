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
      availabilityTargets={[{ round: 1, overallPick: 5 }, { round: 2, overallPick: 16 }, { round: 3, overallPick: 25 }]}
      availabilityPick={16}
      onModeChange={() => undefined}
      onTeamCountChange={() => undefined}
      onSimulateToNext={() => undefined}
      onSimulateRest={() => undefined}
      onReroll={() => undefined}
      onReset={() => undefined}
      onApplyRoster={() => undefined}
      onAvailabilityPickChange={() => undefined}
    />);

    expect(markup).toContain('Availability at pick #16');
    expect(markup).toContain('R1 · #5');
    expect(markup).toContain('R3 · #25');
    expect(markup).toContain('&gt;99%');
    expect(markup).not.toContain('100%');
    expect(markup).toContain('Find a player or team');
  });
});

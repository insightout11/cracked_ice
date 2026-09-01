import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from '../../lib/leagueWorkspace';
import { DraftGrid } from './DraftGrid';

describe('DraftGrid', () => {
  it('renders recorded picks in their snake-draft team columns', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.fantasyTeam.name = 'Ice Breakers';
    workspace.draftSession.draftPosition = 2;
    workspace.draftSession.picks = [
      { playerId: '1', fullName: 'Connor McDavid', team: 'EDM', positions: ['C'], status: 'taken', overallPick: 1, source: 'manual', madeAt: '2026-08-31T00:00:00.000Z' },
      { playerId: '2', fullName: 'Nikita Kucherov', team: 'TBL', positions: ['RW'], status: 'mine', overallPick: 2, source: 'manual', madeAt: '2026-08-31T00:00:01.000Z' },
      { playerId: '5', fullName: 'Igor Shesterkin', team: 'NYR', positions: ['G'], status: 'taken', overallPick: 5, source: 'manual', madeAt: '2026-08-31T00:00:02.000Z' },
    ];

    const markup = renderToStaticMarkup(<DraftGrid workspace={workspace} onDraftPositionChange={() => undefined} onRemovePick={() => undefined} onTeamNameChange={() => undefined} />);

    expect(markup).toContain('Ice Breakers');
    expect(markup).toContain('Connor McDavid');
    expect(markup).toContain('Nikita Kucherov');
    expect(markup).toContain('Igor Shesterkin');
    expect(markup).toContain('Round 2, team 4, pick 5, Igor Shesterkin');
    expect(markup).toContain('Round 2, team 3, pick 6');
  });

  it('makes each open user cell an availability target in planner mode', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { C: 2, BN: 1 };
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 2;

    const markup = renderToStaticMarkup(<DraftGrid workspace={workspace} availabilityPick={7} onAvailabilityPickChange={() => undefined} onDraftPositionChange={() => undefined} onRemovePick={() => undefined} onTeamNameChange={() => undefined} />);

    expect(markup).toContain('Check player availability at round 1, pick 2');
    expect(markup).toContain('Check player availability at round 2, pick 7');
    expect(markup).toContain('Checking availability');
  });

  it('shows keepers reserved into the final user picks', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { C: 1, BN: 2 };
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 2;
    workspace.roster = [{ playerId: 'keeper-1', fullName: 'My Keeper', team: 'SJS', positions: ['C'], slot: 'BN', keeper: true, protected: false, undroppable: false }];
    workspace.draftSession.keeperPickAssignments = [{ playerId: 'keeper-1', overallPick: 10 }];

    const markup = renderToStaticMarkup(<DraftGrid workspace={workspace} onDraftPositionChange={() => undefined} onRemovePick={() => undefined} onTeamNameChange={() => undefined} />);

    expect(markup).toContain('pick 10, My Keeper, keeper');
    expect(markup).toContain('Keeper');
    expect(markup).not.toContain('Check player availability at round 3, pick 10');
  });

  it('renders a primary target and backup count in the planned draft cell', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { D: 2, BN: 1 };
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 2;
    workspace.draftSession.targets = [
      { playerId: 'dahlin', fullName: 'Rasmus Dahlin', priority: 'high', targetRound: 2, targetOverallPick: 7, backupOrder: 0, addedAt: '2026-08-31T00:00:00.000Z' },
      { playerId: 'seider', fullName: 'Moritz Seider', priority: 'normal', targetRound: 2, targetOverallPick: 7, backupOrder: 1, addedAt: '2026-08-31T00:00:01.000Z' },
    ];

    const markup = renderToStaticMarkup(<DraftGrid workspace={workspace} availabilityPick={7} onAvailabilityPickChange={() => undefined} onDraftPositionChange={() => undefined} onRemovePick={() => undefined} onTeamNameChange={() => undefined} />);

    expect(markup).toContain('Round 2, team 2, pick 7, target Rasmus Dahlin with 1 backup');
    expect(markup).toContain('Primary target');
    expect(markup).toContain('Rasmus Dahlin');
    expect(markup).toContain('+1 backup');
    expect(markup).toContain('View targets at round 2, pick 7');
  });
});

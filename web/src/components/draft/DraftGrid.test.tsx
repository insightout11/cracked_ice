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

    const markup = renderToStaticMarkup(<DraftGrid workspace={workspace} onDraftPositionChange={() => undefined} />);

    expect(markup).toContain('Ice Breakers');
    expect(markup).toContain('Connor McDavid');
    expect(markup).toContain('Nikita Kucherov');
    expect(markup).toContain('Igor Shesterkin');
    expect(markup).toContain('Round 2, team 4, pick 5, Igor Shesterkin');
    expect(markup).toContain('Round 2, team 3, pick 6');
  });
});

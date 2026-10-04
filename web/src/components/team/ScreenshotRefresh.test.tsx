// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSearchResult } from '../../types';
import { createDefaultLeagueWorkspace, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { ScreenshotRefresh } from './ScreenshotRefresh';

const state = vi.hoisted(() => ({ updateLeague: vi.fn() }));
vi.mock('../../contexts/LeagueWorkspaceContext', () => ({ useLeagueWorkspace: () => ({ updateLeague: state.updateLeague }) }));

const pasted = `Starting Rosters
Ladybugs 

Pos
Player
C\t
Connor McDavid
Connor McDavidPlayer Note
EDM - C
The Kim Kazzamz 

Pos
Player
C\t
Nick Suzuki
Nick SuzukiNo new player Notes
MTL - C
IR\t
Brad Marchand
Brad MarchandIRPlayer Note
FLA - LW,RW`;

const player = (id: string, name: string, team: string, pos: string[]): PlayerSearchResult => ({ id, name, team, pos, aliases: [], blendedFppg: 2 });
const players = [player('nhl:1', 'Connor McDavid', 'EDM', ['C']), player('nhl:4', 'Nick Suzuki', 'MTL', ['C']), player('nhl:6', 'Brad Marchand', 'FLA', ['LW'])];

let container: HTMLDivElement;
let root: Root;
const button = (label: string) => [...container.querySelectorAll('button')].find((element) => element.textContent?.includes(label)) as HTMLButtonElement | undefined;
const click = (element: Element | undefined) => act(() => { element?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { state.updateLeague.mockReset(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(workspace: LeagueWorkspace) {
  act(() => root.render(<ScreenshotRefresh workspace={workspace} players={players} />));
  click(button('Update from Yahoo'));
}

describe('Update from Yahoo', () => {
  it('reads a pasted Starting Rosters page and updates every team, yours picked by name', async () => {
    const workspace = { ...createDefaultLeagueWorkspace({ id: 'league', name: 'League' }), fantasyTeam: { name: 'The Kim Kazzamz', logoDataUrl: null, jersey: null } };
    render(workspace);
    Object.defineProperty(navigator, 'clipboard', { value: { readText: () => Promise.resolve(pasted) }, configurable: true });
    await act(async () => { button('Paste from clipboard')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Found 3 players on 2 teams. Yours: The Kim Kazzamz.');
    expect(container.textContent).toContain('Also set My Team to your Yahoo lineup (2 players');
    click(button('Update rosters'));
    const saved = state.updateLeague.mock.calls[0][0] as LeagueWorkspace;
    expect(saved.leagueRosters?.teams.map((team) => [team.name, team.mine, team.playerIds])).toEqual([
      ['Ladybugs', false, ['nhl:1']],
      ['The Kim Kazzamz', true, ['nhl:4', 'nhl:6']],
    ]);
    expect(saved.roster.map((entry) => entry.slot)).toEqual(['C', 'IR']);
  });

  it('links straight to the Starting Rosters page once the league link is saved', () => {
    render({ ...createDefaultLeagueWorkspace({ id: 'league', name: 'League' }), providerLeagueId: '15713' });
    const link = container.querySelector('a[href*="startingrosters"]');
    expect(link?.getAttribute('href')).toBe('https://hockey.fantasysports.yahoo.com/hockey/15713/startingrosters');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});

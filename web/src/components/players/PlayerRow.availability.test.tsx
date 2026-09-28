// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSearchResult } from '../../types';
import { TooltipProvider } from '../ui/tooltip';
import { PlayerRow } from './PlayerRow';

const harley = { id: 'nhl:8481581', name: 'Thomas Harley', team: 'DAL', pos: ['D'], aliases: [], blendedFppg: 1.25 } as PlayerSearchResult;

describe('PlayerRow availability', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  const render = (node: ReactNode) => act(() => root.render(<TooltipProvider>{node}</TooltipProvider>));
  const button = (label: string) => [...container.querySelectorAll('button')].find((item) => item.textContent === label) as HTMLButtonElement | undefined;

  it('shows whose team he is on from the league rosters, instead of asking', () => {
    render(<PlayerRow player={harley} leagueTeam={{ name: 'The Kim Kazzamz', mine: true }} onAvailabilityChange={vi.fn()} />);
    expect(container.textContent).toContain('On your team');
    expect(button('Available')).toBeUndefined();
    render(<PlayerRow player={harley} leagueTeam={{ name: 'Chubbs', mine: false }} onAvailabilityChange={vi.fn()} />);
    expect(container.textContent).toContain('On Chubbs');
  });

  it('marks him available or taken, and a second tap clears it', () => {
    const onChange = vi.fn();
    render(<PlayerRow player={harley} availabilityStatus="UNKNOWN" onAvailabilityChange={onChange} />);
    act(() => button('Available')!.click());
    expect(onChange).toHaveBeenLastCalledWith('FA');
    act(() => button('Taken')!.click());
    expect(onChange).toHaveBeenLastCalledWith('OWNED_OTHER');
    render(<PlayerRow player={harley} availabilityStatus="WAIVER" onAvailabilityChange={onChange} />);
    expect(button('Available')!.getAttribute('aria-pressed')).toBe('true');
    act(() => button('Available')!.click());
    expect(onChange).toHaveBeenLastCalledWith('UNKNOWN');
  });
});

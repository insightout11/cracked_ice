// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace, type LeagueWorkspace } from '../lib/leagueWorkspace';
import { rosterPlayersFromWorkspace } from '../lib/myTeamAnalysis';
import type { RosterPlayer } from '../lib/coachSchemas';
import { useWorkspaceRosterSync } from './useWorkspaceRosterSync';

const entry = (id: string, slot = 'BN') => ({ playerId: `nhl:${id}`, fullName: `Player ${id}`, team: 'TOR', positions: ['C'], slot, keeper: false, protected: false, undroppable: false });
const base = createDefaultLeagueWorkspace({ id: 'league', name: 'Chesterfield' });

// Stands in for the workspace store (the context) and My Team (the page).
let store: LeagueWorkspace;
let setStore: (league: LeagueWorkspace) => void;
let pageRoster: RosterPlayer[] = [];
let setPageRoster: (players: RosterPlayer[]) => void;
let replaced = 0;

function Harness() {
  const [league, setLeague] = useState<LeagueWorkspace>(store);
  store = league;
  setStore = setLeague;
  const [roster, setRoster] = useState<RosterPlayer[]>(() => rosterPlayersFromWorkspace(league));
  pageRoster = roster;
  setPageRoster = setRoster;
  const skipReconcileRef = useRef(false);
  const pageRosterJsonRef = useRef(JSON.stringify(league.roster));
  useWorkspaceRosterSync({ activeLeague: league, roster, setRoster, isLoadingData: false, updateLeague: setLeague, skipReconcileRef, pageRosterJsonRef, onRosterReplaced: () => { replaced += 1; } });
  return null;
}

let container: HTMLDivElement;
let root: Root;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { replaced = 0; container = document.createElement('div'); root = createRoot(container); });
afterEach(() => act(() => root.unmount()));

describe('My Team and the saved roster', () => {
  it('adopts a roster that arrives from another device instead of saving its older copy over it', () => {
    store = { ...base, roster: [entry('1'), entry('2')] };
    act(() => root.render(<Harness />));
    const synced = [entry('1', 'C'), entry('2'), entry('3'), entry('4'), entry('5')];
    act(() => setStore({ ...store, roster: synced }));
    expect(store.roster.map((item) => item.playerId)).toEqual(synced.map((item) => item.playerId));
    expect(pageRoster.map((player) => [player.id, player.current_slot])).toEqual([['nhl:1', 'C'], ['nhl:2', 'BN'], ['nhl:3', 'BN'], ['nhl:4', 'BN'], ['nhl:5', 'BN']]);
    // The phone lineup was built from the old roster and has to be rebuilt.
    expect(replaced).toBe(1);
  });

  it('still saves edits made on the page', () => {
    store = { ...base, roster: [entry('1')] };
    act(() => root.render(<Harness />));
    act(() => setPageRoster([...pageRoster, { ...pageRoster[0], id: 'nhl:9', full_name: 'Player 9' }]));
    expect(store.roster.map((item) => item.playerId)).toEqual(['nhl:1', 'nhl:9']);
    expect(replaced).toBe(0);
    act(() => setStore({ ...store, roster: [entry('1')] }));
    expect(pageRoster.map((player) => player.id)).toEqual(['nhl:1']);
  });
});

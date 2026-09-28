import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { likelyOwnedPlayerIds } from './pickupCandidateDiscovery';
import { applyDraftResults, draftResultGaps, draftResultTeams, matchDraftResults, parseYahooDraftResults } from './draftResultsImport';

const pasted = `Draft Results
Round 1
1.	Connor McDavid
(EDM - C)
Ladybugs
2.	David Pastrnak
(BOS - RW)
Stecher'd Away
Round 16
151.	Juraj Slafkovský 
(MON - LW,RW)
The Kim Kazzamz
152.	Cale Makar
(COL - D)
Ladybugs`;

const player = (id: string, name: string, team: string, pos: string[]): PlayerSearchResult => ({ id, name, team, pos, aliases: [], blendedFppg: 2 });

describe('pasted Yahoo draft results', () => {
  it('reads every pick with its round, NHL team, positions and fantasy team', () => {
    const rows = parseYahooDraftResults(pasted);
    expect(rows).toEqual([
      { overallPick: 1, round: 1, name: 'Connor McDavid', team: 'EDM', positions: ['C'], fantasyTeam: 'Ladybugs' },
      { overallPick: 2, round: 1, name: 'David Pastrnak', team: 'BOS', positions: ['RW'], fantasyTeam: "Stecher'd Away" },
      { overallPick: 3, round: 16, name: 'Juraj Slafkovský', team: 'MON', positions: ['LW', 'RW'], fantasyTeam: 'The Kim Kazzamz' },
      { overallPick: 4, round: 16, name: 'Cale Makar', team: 'COL', positions: ['D'], fantasyTeam: 'Ladybugs' },
    ]);
    expect(draftResultTeams(rows)).toEqual([
      { name: 'Ladybugs', picks: 2 },
      { name: "Stecher'd Away", picks: 1 },
      { name: 'The Kim Kazzamz', picks: 1 },
    ]);
  });

  it('reads round 1 when its heading shares a line with the page header, or is missing', () => {
    const joined = `2026 draft order
Round	Team	Round 1
1.	Connor McDavid
(EDM - C)
Ladybugs
Round 2
11.	Dylan Guenther
(UTA - LW,RW)
Ladybugs`;
    expect(parseYahooDraftResults(joined).map((row) => [row.round, row.name])).toEqual([[1, 'Connor McDavid'], [2, 'Dylan Guenther']]);
    const headless = `1.	Connor McDavid
(EDM - C)
Ladybugs
Round 2
11.	Dylan Guenther
(UTA - LW,RW)
Ladybugs`;
    expect(parseYahooDraftResults(headless).map((row) => row.round)).toEqual([1, 2]);
  });

  it('flags a paste with missing rounds or uneven teams', () => {
    const missingFirst = `Round 2
11.	Dylan Guenther
(UTA - LW,RW)
Ladybugs
12.	Alex DeBrincat
(DET - LW,RW)
Stecher'd Away`;
    expect(draftResultGaps(parseYahooDraftResults(missingFirst))).toEqual({ missingRounds: [1], uneven: false });
    expect(draftResultGaps(parseYahooDraftResults(pasted))).toEqual({ missingRounds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], uneven: true });
  });

  it('finds nothing in unrelated text', () => {
    expect(parseYahooDraftResults('Players\nConnor McDavid\nEDM - C\nFA')).toEqual([]);
  });

  it('records picks as rostered, the chosen team as mine, and treats them as owned', () => {
    const directory = [
      player('nhl:97', 'Connor McDavid', 'EDM', ['C']),
      player('nhl:88', 'David Pastrnak', 'BOS', ['RW']),
      player('nhl:20', 'Juraj Slafkovsky', 'MTL', ['LW']),
      player('nhl:8', 'Cale Makar', 'COL', ['D']),
      player('nhl:1', 'Free Agent', 'TOR', ['C']),
    ];
    const { matched, unmatched } = matchDraftResults(directory, parseYahooDraftResults(pasted));
    expect(unmatched).toEqual([]);
    const workspace = createDefaultLeagueWorkspace({ id: 'draft' });
    const saved = applyDraftResults(workspace, matched, 'The Kim Kazzamz', 3, '2026-09-28T12:00:00.000Z');
    expect(saved.numberOfTeams).toBe(3);
    expect(saved.draftSession.status).toBe('complete');
    expect(saved.draftSession.picks.filter((pick) => pick.status === 'mine').map((pick) => pick.playerId)).toEqual(['nhl:20']);
    expect(saved.leagueRosters?.teams).toEqual([
      { name: 'Ladybugs', mine: false, playerIds: ['nhl:97', 'nhl:8'] },
      { name: "Stecher'd Away", mine: false, playerIds: ['nhl:88'] },
      { name: 'The Kim Kazzamz', mine: true, playerIds: ['nhl:20'] },
    ]);
    // A small league's worth of picks: everyone drafted is owned, nobody else is guessed.
    const tiny = { ...saved, rosterRules: { ...saved.rosterRules, slots: { C: 1 } } };
    expect(likelyOwnedPlayerIds(tiny, directory).sort()).toEqual(['nhl:20', 'nhl:8', 'nhl:88', 'nhl:97']);
  });
});

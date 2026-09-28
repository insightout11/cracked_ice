import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { availableGoalies, rosterGaps } from './rosterGaps';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const rostered = (id: string, positions: string[], extra: Partial<RosterPlayer> = {}): RosterPlayer => ({ id, full_name: id, team: 'VAN', positions, games_played: 10, stats, ...extra });
const directory = (id: string, fppg: number, starts: number, extra: Partial<PlayerSearchResult> = {}): PlayerSearchResult => ({ id, name: id, team: 'DET', pos: ['G'], aliases: [], blendedFppg: fppg, stats: { games_started: starts }, ...extra });

describe('roster gaps', () => {
  const base = createDefaultLeagueWorkspace({ id: 'gaps' });
  const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, D: 1, G: 2, BN: 2, IR: 1 } } };

  it('flags fewer healthy goalies than G spots, not counting the injured or IR', () => {
    const roster = [rostered('c', ['C']), rostered('d', ['D']), rostered('g1', ['G']), rostered('g2', ['G'], { injuryStatus: 'O' })];
    expect(rosterGaps(workspace, roster)).toEqual([{ kind: 'goalies', have: 1, spots: 2 }]);
    expect(rosterGaps(workspace, [...roster, rostered('g3', ['G'], { current_slot: 'IR' })])).toEqual([{ kind: 'goalies', have: 1, spots: 2 }]);
    expect(rosterGaps(workspace, [...roster, rostered('g3', ['G'])])).toEqual([]);
  });

  it('flags too few healthy skaters for the skater spots', () => {
    expect(rosterGaps(workspace, [rostered('c', ['C']), rostered('g1', ['G']), rostered('g2', ['G'])])).toEqual([{ kind: 'skaters', have: 1, spots: 2 }]);
  });

  it('ranks available goalies by points per team game, skipping owned, injured and unsigned ones', () => {
    const players = [
      directory('starter', 2.2, 55),
      directory('hot-backup', 3.0, 15),
      directory('owned', 3.5, 60),
      directory('hurt', 3.5, 60, { injuryStatus: 'O' }),
      directory('unsigned', 3.5, 60, { team: 'FA' }),
    ];
    expect(availableGoalies(players, ['nhl:owned']).map((entry) => entry.player.id)).toEqual(['starter', 'hot-backup']);
  });
});

import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { withInjuries, withInjury, type InjurySnapshot } from './injuries';

const player = (id: string, extra: Partial<RosterPlayer> = {}) => ({ id, full_name: 'Player', team: 'WSH', positions: ['LW'], ...extra }) as RosterPlayer;
const snapshot: InjurySnapshot = {
  updatedAt: '2026-09-23',
  players: { 'nhl:8471214': { status: 'O', statusFull: 'Out', note: 'Lower Body', updatedAt: '2026-09-21T16:08:13.000Z' } },
};

describe('withInjury', () => {
  it('applies the Yahoo status for prefixed and bare ids', () => {
    for (const id of ['nhl:8471214', '8471214']) {
      const result = withInjury(player(id), snapshot);
      expect(result).toMatchObject({ injuryStatus: 'O', injuryStatusFull: 'Out', injuryNote: 'Lower Body' });
    }
  });

  it('overrides the NHL-only INACTIVE flag and leaves healthy players untouched', () => {
    expect(withInjury(player('nhl:8471214', { injuryStatus: 'INACTIVE' }), snapshot).injuryStatus).toBe('O');
    const healthy = player('nhl:1');
    expect(withInjury(healthy, snapshot)).toBe(healthy);
  });

  it('returns the same list when there is no snapshot yet', () => {
    const players = [player('nhl:1')];
    expect(withInjuries(players, null)).toBe(players);
  });
});

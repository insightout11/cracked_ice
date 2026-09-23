import { describe, expect, it } from 'vitest';
import { isEligibleForPosition, simulateLineup } from '../simulation';

// Brute force over every assignment of players to slots (small rosters only).
function bruteForce(players: Array<{ position: string; fppg: number }>, slots: string[]): number {
  let best = 0;
  const walk = (index: number, used: boolean[], points: number) => {
    if (index === players.length) { best = Math.max(best, points); return; }
    walk(index + 1, used, points);
    slots.forEach((slot, unit) => {
      if (used[unit] || !isEligibleForPosition(players[index].position, slot) || players[index].fppg < 0) return;
      used[unit] = true;
      walk(index + 1, used, points + players[index].fppg);
      used[unit] = false;
    });
  };
  walk(0, slots.map(() => false), 0);
  return best;
}

describe('simulateLineup day solver', () => {
  it('matches a brute-force search on random small rosters', () => {
    let seed = 11;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const positions = ['C', 'LW', 'RW', 'D', 'G', 'C,LW', 'LW,RW', 'C,RW'];
    const lineupSlots = { C: 1, LW: 1, RW: 1, UTIL: 1, D: 2, G: 1, BN: 3 };
    const units = ['C', 'LW', 'RW', 'UTIL', 'D', 'D', 'G'];
    for (let trial = 0; trial < 150; trial += 1) {
      const count = 3 + Math.floor(random() * 7);
      const players = Array.from({ length: count }, (_, index) => ({ position: positions[Math.floor(random() * positions.length)], fppg: Math.round(random() * 50) / 10, id: `p${index}` }));
      const projections = players.map((player) => ({
        base: { id: player.id, full_name: player.id, position: player.position, current_slot: 'BN' },
        fppg: player.fppg,
        projectedPoints: player.fppg,
        upcomingGamesInWindow: ['2026-10-06'],
      })) as any;
      const result = simulateLineup(projections, { start: '2026-10-06', end: '2026-10-06' }, lineupSlots);
      expect(result.totalPoints).toBeCloseTo(bruteForce(players, units), 6);
    }
  });
});

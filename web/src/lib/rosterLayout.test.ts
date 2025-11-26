import { describe, it, expect } from 'vitest';
import { canDrop, buildRosterRows } from './rosterLayout';
import type { RosterPlayer } from './coachSchemas';

describe('canDrop', () => {
  const createPlayer = (positions: string[], injury_status?: string): RosterPlayer => ({
    id: '123',
    full_name: 'Test Player',
    team: 'TOR',
    positions,
    games_played: 10,
    stats: {
      goals: 5,
      assists: 10,
      shots_on_goal: 50,
      power_play_points: 3,
      blocks: 20,
    },
    injury_status,
  });

  describe('Exact position matches', () => {
    it('allows C to C slot', () => {
      const player = createPlayer(['C']);
      expect(canDrop(player, 'C')).toBe(true);
    });

    it('allows LW to LW slot', () => {
      const player = createPlayer(['LW']);
      expect(canDrop(player, 'LW')).toBe(true);
    });

    it('allows RW to RW slot', () => {
      const player = createPlayer(['RW']);
      expect(canDrop(player, 'RW')).toBe(true);
    });

    it('allows D to D slot', () => {
      const player = createPlayer(['D']);
      expect(canDrop(player, 'D')).toBe(true);
    });

    it('allows G to G slot', () => {
      const player = createPlayer(['G']);
      expect(canDrop(player, 'G')).toBe(true);
    });

    it('rejects LW to C slot', () => {
      const player = createPlayer(['LW']);
      expect(canDrop(player, 'C')).toBe(false);
    });
  });

  describe('Dual-eligible players', () => {
    it('allows C/LW to C slot', () => {
      const player = createPlayer(['C', 'LW']);
      expect(canDrop(player, 'C')).toBe(true);
    });

    it('allows C/LW to LW slot', () => {
      const player = createPlayer(['C', 'LW']);
      expect(canDrop(player, 'LW')).toBe(true);
    });

    it('allows C/RW to F slot', () => {
      const player = createPlayer(['C', 'RW']);
      expect(canDrop(player, 'F')).toBe(true);
    });
  });

  describe('F (Forward Flex)', () => {
    it('allows C to F', () => {
      const player = createPlayer(['C']);
      expect(canDrop(player, 'F')).toBe(true);
    });

    it('allows LW to F', () => {
      const player = createPlayer(['LW']);
      expect(canDrop(player, 'F')).toBe(true);
    });

    it('allows RW to F', () => {
      const player = createPlayer(['RW']);
      expect(canDrop(player, 'F')).toBe(true);
    });

    it('rejects D to F', () => {
      const player = createPlayer(['D']);
      expect(canDrop(player, 'F')).toBe(false);
    });

    it('rejects G to F', () => {
      const player = createPlayer(['G']);
      expect(canDrop(player, 'F')).toBe(false);
    });
  });

  describe('UTIL (Utility)', () => {
    it('allows C to UTIL', () => {
      const player = createPlayer(['C']);
      expect(canDrop(player, 'UTIL')).toBe(true);
    });

    it('allows LW to UTIL', () => {
      const player = createPlayer(['LW']);
      expect(canDrop(player, 'UTIL')).toBe(true);
    });

    it('allows D to UTIL', () => {
      const player = createPlayer(['D']);
      expect(canDrop(player, 'UTIL')).toBe(true);
    });

    it('rejects G to UTIL', () => {
      const player = createPlayer(['G']);
      expect(canDrop(player, 'UTIL')).toBe(false);
    });
  });

  describe('BN (Bench)', () => {
    it('allows any player to BN', () => {
      expect(canDrop(createPlayer(['C']), 'BN')).toBe(true);
      expect(canDrop(createPlayer(['LW']), 'BN')).toBe(true);
      expect(canDrop(createPlayer(['D']), 'BN')).toBe(true);
      expect(canDrop(createPlayer(['G']), 'BN')).toBe(true);
    });
  });

  describe('IR (Injured Reserve)', () => {
    it('allows injured player to IR', () => {
      const player = createPlayer(['C'], 'DTD');
      expect(canDrop(player, 'IR')).toBe(true);
    });

    it('rejects healthy player to IR', () => {
      const player = createPlayer(['C']);
      expect(canDrop(player, 'IR')).toBe(false);
    });

    it('allows injured player to IR+', () => {
      const player = createPlayer(['C'], 'IR');
      expect(canDrop(player, 'IR+')).toBe(true);
    });
  });
});

describe('buildRosterRows', () => {
  it('builds standard 2LW-2C-2RW-4D-2G-4BN-1IR league', () => {
    const rows = buildRosterRows({
      LW: 2,
      C: 2,
      RW: 2,
      D: 4,
      G: 2,
      BN: 4,
      IR: 1,
    });

    // Should have forwards (2 rows), defense (2 rows), goalies (2 rows), bench (1 row), IR (1 row)
    expect(rows.length).toBe(8);

    // First row: LW-C-RW
    expect(rows[0].rowType).toBe('forwards');
    expect(rows[0].slots.length).toBe(3);
    expect(rows[0].slots[0].type).toBe('LW');
    expect(rows[0].slots[1].type).toBe('C');
    expect(rows[0].slots[2].type).toBe('RW');

    // Second row: LW-C-RW
    expect(rows[1].rowType).toBe('forwards');
    expect(rows[1].slots.length).toBe(3);

    // Defense rows (2 D per row)
    expect(rows[2].rowType).toBe('defense');
    expect(rows[2].slots.length).toBe(2);
    expect(rows[3].rowType).toBe('defense');
    expect(rows[3].slots.length).toBe(2);

    // Goalie rows (1 G per row, centered)
    expect(rows[4].rowType).toBe('goalies');
    expect(rows[4].slots.length).toBe(1);
    expect(rows[4].slots[0].type).toBe('G');
    expect(rows[5].rowType).toBe('goalies');

    // Bench (4 slots in one row)
    expect(rows[6].rowType).toBe('bench');
    expect(rows[6].slots.length).toBe(4);

    // IR (1 slot)
    expect(rows[7].rowType).toBe('ir');
    expect(rows[7].slots.length).toBe(1);
  });

  it('builds league with F and UTIL slots', () => {
    const rows = buildRosterRows({
      C: 2,
      LW: 1,
      RW: 1,
      F: 2,
      D: 4,
      UTIL: 1,
      G: 2,
      BN: 3,
    });

    // Check for forward-flex rows
    const flexRows = rows.filter(r => r.rowType === 'forward-flex');
    expect(flexRows.length).toBeGreaterThan(0);

    // Check for skater-flex rows
    const utilRows = rows.filter(r => r.rowType === 'skater-flex');
    expect(utilRows.length).toBeGreaterThan(0);
  });

  it('handles uneven forward counts', () => {
    const rows = buildRosterRows({
      LW: 3,
      C: 2,
      RW: 1,
    });

    // Should create 3 rows (max of LW=3, C=2, RW=1)
    const forwardRows = rows.filter(r => r.rowType === 'forwards');
    expect(forwardRows.length).toBe(3);

    // First row has all three
    expect(forwardRows[0].slots.length).toBe(3);

    // Second row has LW and C only
    expect(forwardRows[1].slots.length).toBe(2);

    // Third row has LW only
    expect(forwardRows[2].slots.length).toBe(1);
  });

  it('wraps bench slots into multiple rows', () => {
    const rows = buildRosterRows({
      C: 1,
      BN: 9, // Should create 3 rows (4+4+1)
    });

    const benchRows = rows.filter(r => r.rowType === 'bench');
    expect(benchRows.length).toBe(3);
    expect(benchRows[0].slots.length).toBe(4);
    expect(benchRows[1].slots.length).toBe(4);
    expect(benchRows[2].slots.length).toBe(1);
  });

  it('handles IR and IR+ together', () => {
    const rows = buildRosterRows({
      C: 1,
      IR: 2,
      'IR+': 3,
    });

    const irRows = rows.filter(r => r.rowType === 'ir');
    expect(irRows.length).toBeGreaterThan(0);

    // Total IR slots = 2 + 3 = 5, should wrap into 2 rows (4+1)
    expect(irRows.length).toBe(2);
    expect(irRows[0].slots.length).toBe(4);
    expect(irRows[1].slots.length).toBe(1);

    // First 2 should be IR, next 3 should be IR+
    expect(irRows[0].slots[0].type).toBe('IR');
    expect(irRows[0].slots[1].type).toBe('IR');
    expect(irRows[0].slots[2].type).toBe('IR+');
  });
});

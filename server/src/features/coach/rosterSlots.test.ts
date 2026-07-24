import { describe, expect, it } from 'vitest';
import type { Player } from './types';
import { assignRosterSlot, buildSlotUsage } from './rosterSlots';

describe('roster import slot assignment', () => {
  it('fills eligible active slots before the bench', () => {
    const usage = {};
    const slots = { C: 2, LW: 1, D: 1, G: 1, BN: 2 };

    expect(assignRosterSlot(['C'], slots, usage)).toBe('C');
    expect(assignRosterSlot(['C', 'LW'], slots, usage)).toBe('C');
    expect(assignRosterSlot(['C', 'LW'], slots, usage)).toBe('LW');
    expect(assignRosterSlot(['C'], slots, usage)).toBe('BN');
  });

  it('respects occupied slots and supports forward and utility flexes', () => {
    const roster = [{ current_slot: 'C-0' }, { current_slot: 'D' }] as Player[];
    const usage = buildSlotUsage(roster);
    const slots = { C: 1, D: 1, F: 1, UTIL: 1, BN: 2 };

    expect(assignRosterSlot(['RW'], slots, usage)).toBe('F');
    expect(assignRosterSlot(['D'], slots, usage)).toBe('UTIL');
    expect(assignRosterSlot(['G'], slots, usage)).toBe('BN');
  });
});

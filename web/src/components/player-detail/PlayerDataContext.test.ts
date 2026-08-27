import { describe, expect, it } from 'vitest';
import { performanceSeasonLabel } from './PlayerDataContext';

describe('performanceSeasonLabel', () => {
  it('formats NHL season ids and already-formatted season labels', () => {
    expect(performanceSeasonLabel('20252026')).toBe('2025–26');
    expect(performanceSeasonLabel('2025-26')).toBe('2025–26');
  });

  it('uses the previous NHL season when player metadata is absent', () => {
    expect(performanceSeasonLabel()).toBe('2025–26');
  });
});

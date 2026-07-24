import type { Player } from './types';

export type LineupSlots = Record<string, number>;
export type SlotUsage = Record<string, number>;

function slotType(value: string | undefined): string {
  return (value ?? '').replace(/-\d+$/, '');
}

export function buildSlotUsage(roster: Player[]): SlotUsage {
  return roster.reduce<SlotUsage>((usage, player) => {
    const current = slotType(player.current_slot);
    if (current) usage[current] = (usage[current] ?? 0) + 1;
    return usage;
  }, {});
}

export function assignRosterSlot(
  positions: string[],
  lineupSlots: LineupSlots,
  usage: SlotUsage,
): string {
  const normalizedPositions = positions.map((position) => position.toUpperCase());
  const direct = normalizedPositions.find((position) => (usage[position] ?? 0) < (lineupSlots[position] ?? 0));
  const forward = normalizedPositions.some((position) => ['C', 'LW', 'RW'].includes(position));
  const skater = normalizedPositions.some((position) => ['C', 'LW', 'RW', 'D'].includes(position));
  const selected = direct
    ?? (forward && (usage.F ?? 0) < (lineupSlots.F ?? 0) ? 'F' : null)
    ?? (skater && (usage.UTIL ?? 0) < (lineupSlots.UTIL ?? 0) ? 'UTIL' : null)
    ?? 'BN';

  usage[selected] = (usage[selected] ?? 0) + 1;
  return selected;
}

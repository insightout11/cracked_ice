export const INACTIVE_ROSTER_SLOTS = new Set(['BN', 'BENCH', 'IR', 'IR+', 'IR-LT', 'NA']);

export const SUPPORTED_PLAYER_POSITIONS = new Set(['C', 'LW', 'RW', 'W', 'F', 'D', 'G']);

export const SUPPORTED_LINEUP_SLOTS = new Set([
  ...SUPPORTED_PLAYER_POSITIONS,
  'UTIL',
  'U',
  'FLEX',
  ...INACTIVE_ROSTER_SLOTS,
]);

export function normalizeRosterSlot(slot?: string): string {
  return (slot ?? '').replace(/-\d+$/, '').toUpperCase();
}

export function isInactiveRosterSlot(slot?: string): boolean {
  return INACTIVE_ROSTER_SLOTS.has(normalizeRosterSlot(slot));
}

export function isUnavailableRosterSlot(slot?: string): boolean {
  const normalized = normalizeRosterSlot(slot);
  return INACTIVE_ROSTER_SLOTS.has(normalized) && normalized !== 'BN' && normalized !== 'BENCH';
}

export function hasSupportedPlayerPositions(positions: string[]): boolean {
  return positions.length > 0 && positions.every((position) => SUPPORTED_PLAYER_POSITIONS.has(position.toUpperCase()));
}

export function canPositionsFillSlot(rawPositions: string[], rawSlot: string): boolean {
  const slot = normalizeRosterSlot(rawSlot);
  const positions = rawPositions.map((position) => position.toUpperCase());
  if (!SUPPORTED_LINEUP_SLOTS.has(slot) || INACTIVE_ROSTER_SLOTS.has(slot)) return false;
  if (positions.includes(slot)) return true;
  if ((slot === 'LW' || slot === 'RW') && positions.includes('W')) return true;
  if (slot === 'W') return positions.some((position) => position === 'LW' || position === 'RW');
  if (slot === 'F') return positions.some((position) => ['C', 'LW', 'RW', 'W', 'F'].includes(position));
  if (['UTIL', 'U', 'FLEX'].includes(slot)) return positions.some((position) => SUPPORTED_PLAYER_POSITIONS.has(position) && position !== 'G');
  return false;
}

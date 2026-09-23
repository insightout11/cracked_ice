export interface DraftComparePlayer {
  playerId: string;
  name: string;
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function toggleDraftCompareSelection(current: DraftComparePlayer[], player: DraftComparePlayer): DraftComparePlayer[] {
  if (current.some((item) => normalizeId(item.playerId) === normalizeId(player.playerId))) {
    return current.filter((item) => normalizeId(item.playerId) !== normalizeId(player.playerId));
  }
  if (current.length >= 2) return current;
  return [...current, player];
}

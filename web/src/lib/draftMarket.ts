import kkupflAdp from '../data/kkupfl-adp-2026-27.json';
import type { DraftPlayer } from './playerSearch';

export type DraftMarketSource = 'yahoo' | 'kkupfl';

export const DRAFT_MARKETS = {
  yahoo: { label: 'Yahoo ADP', shortLabel: 'Yahoo', updatedAt: null },
  kkupfl: { label: 'KKUPFL ADP', shortLabel: 'KKUPFL', updatedAt: kkupflAdp.updatedAt },
} as const;

const KKUPFL_ADP_BY_NHL_ID = new Map(kkupflAdp.players.map((player) => [player.nhlId, player.adp]));

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function applyDraftMarketSource(players: DraftPlayer[], source: DraftMarketSource): DraftPlayer[] {
  if (source === 'yahoo') return players;
  return players.map((player) => ({
    ...player,
    yahooAdp: KKUPFL_ADP_BY_NHL_ID.get(normalizeId(player.id)),
  }));
}

export function draftMarketRankForPlayer(playerId: string, yahooAdp: number | undefined, source: DraftMarketSource): number | undefined {
  return source === 'kkupfl' ? KKUPFL_ADP_BY_NHL_ID.get(normalizeId(playerId)) : yahooAdp;
}

export function draftMarketLabel(source: DraftMarketSource): string {
  return DRAFT_MARKETS[source].label;
}

export function draftMarketShortLabel(source: DraftMarketSource): string {
  return DRAFT_MARKETS[source].shortLabel;
}

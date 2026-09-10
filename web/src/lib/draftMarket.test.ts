import { describe, expect, it } from 'vitest';
import { applyDraftMarketSource, DRAFT_MARKETS } from './draftMarket';
import type { DraftPlayer } from './playerSearch';

const players: DraftPlayer[] = [
  { id: 'nhl:8477492', name: 'Nathan MacKinnon', aliases: [], team: 'COL', pos: ['C'], yahooAdp: 2.5, blendedFppg: 0, productionValue: 0, productionLabel: 'FPPG' },
  { id: '8478402', name: 'Connor McDavid', aliases: [], team: 'EDM', pos: ['C'], yahooAdp: 1.5, blendedFppg: 0, productionValue: 0, productionLabel: 'FPPG' },
  { id: 'missing', name: 'Unlisted Player', aliases: [], team: 'FA', pos: ['C'], yahooAdp: 300, blendedFppg: 0, productionValue: 0, productionLabel: 'FPPG' },
];

describe('draftMarket', () => {
  it('keeps Yahoo ADP unchanged', () => {
    expect(applyDraftMarketSource(players, 'yahoo')).toBe(players);
  });

  it('maps the KKUPFL snapshot by NHL id and leaves unlisted players without invented ADP', () => {
    const mapped = applyDraftMarketSource(players, 'kkupfl');
    expect(mapped.map((player) => player.yahooAdp)).toEqual([1.2, 1.9, undefined]);
    expect(DRAFT_MARKETS.kkupfl).toMatchObject({ label: 'KKUPFL ADP', updatedAt: '2026-09-10' });
  });
});

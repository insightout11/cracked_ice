import { describe, expect, it } from 'vitest';
import { careerCountingRows, endLabelOffsets } from './CareerCountingChart';

describe('careerCountingRows', () => {
  it('turns season totals into per-game rates, oldest season first', () => {
    const rows = careerCountingRows({
      '20252026': { gamesPlayed: 82, shots: 244, hits: 134, blocks: 16 },
      '20242025': { gamesPlayed: 65, shots: 237, hits: 110, blocks: 13 },
      '20232024': { gamesPlayed: 0, shots: 0, hits: 0, blocks: 0 },
    });
    expect(rows.map((row) => row.seasonLabel)).toEqual(['24-25', '25-26']);
    expect(rows[1]).toMatchObject({ gamesPlayed: 82, shots: 2.98, hits: 1.63, blocks: 0.2 });
  });
});


describe('endLabelOffsets', () => {
  it('pushes close labels apart and leaves distant ones alone', () => {
    // yMax 6 over 230px: 4.38 is far from 0.80/0.44, which sit ~14px apart before nudging.
    const [shots, hits, blocks] = endLabelOffsets([4.38, 0.8, 0.44], 6);
    expect(shots).toBe(0);
    expect(hits).toBe(0);
    expect(blocks).toBeGreaterThanOrEqual(0);
    const [a, b] = endLabelOffsets([1.0, 1.0], 6);
    expect(Math.abs((0 + b) - (0 + a))).toBeGreaterThanOrEqual(13);
  });
});

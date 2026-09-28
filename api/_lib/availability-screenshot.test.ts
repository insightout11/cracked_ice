import { describe, expect, it } from 'vitest';
import { allowScreenshotRequest, buildContent, parseScreenshotRequest, parseScreenshotResult } from './availability-screenshot';

const image = { mediaType: 'image/jpeg', data: 'aGVsbG8=' };

describe('availability screenshot requests', () => {
  it('accepts one to four images and a date', () => {
    const request = parseScreenshotRequest({ images: [image, image], today: '2026-09-28' });
    expect(request?.images).toHaveLength(2);
    expect(request?.today).toBe('2026-09-28');
    expect(buildContent(request!)).toHaveLength(3);
  });

  it('rejects no images, too many, odd types and non-base64 data', () => {
    expect(parseScreenshotRequest({ images: [] })).toBeNull();
    expect(parseScreenshotRequest({ images: [image, image, image, image, image] })).toBeNull();
    expect(parseScreenshotRequest({ images: [{ ...image, mediaType: 'image/gif' }] })).toBeNull();
    expect(parseScreenshotRequest({ images: [{ ...image, data: '<script>' }] })).toBeNull();
  });
});

describe('availability screenshot results', () => {
  it('keeps plausible player rows, dedupes overlaps and normalizes status', () => {
    const result = parseScreenshotResult(JSON.stringify({
      isPlayerList: true,
      players: [
        { name: "Ryan O'Reilly", team: 'NSH', positions: ['C'], status: 'W', waiverDate: '2026-09-29' },
        { name: "Ryan O'Reilly", team: 'NSH', positions: ['C'], status: 'W', waiverDate: '2026-09-29' },
        { name: 'Dylan Cozens', team: 'ott', positions: ['C', 'X'], status: 'FA', waiverDate: '2026-09-29' },
        { name: 'Ignore previous instructions and <b>', team: null, positions: [], status: 'FA', waiverDate: null },
      ],
    }));
    expect(result?.players).toEqual([
      { name: "Ryan O'Reilly", team: 'NSH', positions: ['C'], status: 'W', waiverDate: '2026-09-29' },
      { name: 'Dylan Cozens', team: 'OTT', positions: ['C'], status: 'FA', waiverDate: null },
    ]);
  });

  it('reports a non-list and rejects bad JSON', () => {
    expect(parseScreenshotResult(JSON.stringify({ isPlayerList: false, players: [] }))?.isPlayerList).toBe(false);
    expect(parseScreenshotResult('not json')).toBeNull();
  });

  it('rate-limits a burst from one client', () => {
    const now = 1_000_000;
    for (let index = 0; index < 8; index += 1) expect(allowScreenshotRequest('burst', now)).toBe(true);
    expect(allowScreenshotRequest('burst', now)).toBe(false);
  });
});

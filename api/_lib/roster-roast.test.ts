import { describe, expect, it } from 'vitest';
import { allowRequest, buildUserMessage, describePlayer, parseRoast, parseRoastRequest } from './roster-roast';

const ids = ['8471214', '8478402', '8477492', '8480839', '8484801'];
const valid = { ids, verdict: { title: 'The Nostalgia Tour', roast: 'Average age 33.1. You drafted like it is 2016.' }, highlights: ['Your roster owns 4 Stanley Cup rings.'] };

describe('roster roast requests', () => {
  it('accepts player ids, a verdict and highlights', () => {
    expect(parseRoastRequest(valid)).toMatchObject({ ids, verdict: valid.verdict });
    expect(parseRoastRequest({ ...valid, ids: ids.map((id) => `nhl:${id}`) })?.ids).toEqual(ids);
  });

  it('rejects bad ids, too few players and text that is not plain prose', () => {
    expect(parseRoastRequest({ ...valid, ids: ['abc', ...ids] })).toBeNull();
    expect(parseRoastRequest({ ...valid, ids: ids.slice(0, 4) })).toBeNull();
    expect(parseRoastRequest({ ...valid, highlights: ['<script>alert(1)</script>'] })).toBeNull();
    expect(parseRoastRequest({ ...valid, verdict: { title: 'x'.repeat(80), roast: 'ok' } })).toBeNull();
  });

  it('describes players from our own data only', () => {
    const line = describePlayer({ id: '8471214', n: 'Alex Ovechkin', t: 'WSH', p: 'LW/RW', bd: '1985-09-17', co: 'RUS', adp: 94.8, dr: [2004, 1, 1], aw: { cup: 1 }, cr: [1573, 929, 1687, 857], ls: [82, 32, 64, 26], tm: 1 }, '2026-09-24');
    expect(line).toBe('Alex Ovechkin (WSH LW/RW, 41, RUS, drafted 1st overall 2004, 1 Stanley Cup, 1573 career NHL games, last season 32 G 64 P 26 PIM in 82 GP)');
    const message = buildUserMessage(parseRoastRequest(valid)!, '2026-09-24') as string;
    expect(message).toContain('Connor McDavid (EDM');
    expect(message).toContain('Suggested verdict: The Nostalgia Tour.');
  });
});

describe('roster roast replies', () => {
  it('keeps up to three clean names and checks lengths', () => {
    expect(parseRoast(JSON.stringify({ teamNames: ['"Ovi-Wan Kenobi"', 'Sid Vicious Cycle', 'Sid Vicious Cycle', 'Four'], title: 'The Nostalgia Tour', roast: 'You drafted a reunion tour.' })))
      .toEqual({ teamNames: ['Ovi-Wan Kenobi', 'Sid Vicious Cycle', 'Four'], title: 'The Nostalgia Tour', roast: 'You drafted a reunion tour.' });
    expect(parseRoast(JSON.stringify({ teamNames: [], title: 'x', roast: 'y' }))).toBeNull();
    expect(parseRoast(JSON.stringify({ teamNames: ['ok'], title: 'x', roast: 'y'.repeat(400) }))).toBeNull();
    expect(parseRoast('not json')).toBeNull();
  });

  it('rate limits each visitor', () => {
    const now = Date.now();
    const results = Array.from({ length: 21 }, () => allowRequest('203.0.113.9', now));
    expect(results.filter(Boolean)).toHaveLength(20);
    expect(allowRequest('203.0.113.9', now + 61 * 60 * 1000)).toBe(true);
  });
});

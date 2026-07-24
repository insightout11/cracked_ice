import { describe, expect, it } from 'vitest';
import { resolveFreeAgentOcrMatch } from './ocr';

const hughesMatches = [
  { id: 'jack', name: 'Jack Hughes', team: 'NJD', position: 'C' },
  { id: 'luke', name: 'Luke Hughes', team: 'NJD', position: 'D' },
];

describe('free-agent OCR review matching', () => {
  it('does not silently choose the first ambiguous player', () => {
    expect(resolveFreeAgentOcrMatch({ name: 'Hughes' }, hughesMatches)).toBeNull();
    expect(resolveFreeAgentOcrMatch({ name: 'Hughes', team: 'NJD' }, hughesMatches)).toBeNull();
  });

  it('uses team evidence only when it identifies one match', () => {
    expect(resolveFreeAgentOcrMatch({ name: 'Sebastian Aho', team: 'CAR' }, [
      { id: 'car-aho', name: 'Sebastian Aho', team: 'CAR', position: 'C' },
      { id: 'nyi-aho', name: 'Sebastian Aho', team: 'NYI', position: 'D' },
    ])?.id).toBe('car-aho');
  });
});

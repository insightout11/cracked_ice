import { describe, expect, it } from 'vitest';
import { resolveRootExperience } from './navigation';

describe('root compatibility dispatcher', () => {
  it.each(['', '?utm_source=mail', '?ref=homepage&gclid=123'])('keeps ordinary links on Home', (search) => {
    expect(resolveRootExperience(search)).toBe('home');
  });

  it('gives an explicit Draft Board action precedence', () => {
    expect(resolveRootExperience('?tool=draft&players=1,2&start=2026-10-01')).toBe('draft');
  });

  it.each(['?tool=fit&utm_source=mail', '?players=1,2&slots=2', '?teams=TOR,MTL&result=TOR', '?tw=14d&start=2026-10-01'])('keeps legacy optimizer links in Schedule Fit', (search) => {
    expect(resolveRootExperience(search)).toBe('fit');
  });
});
